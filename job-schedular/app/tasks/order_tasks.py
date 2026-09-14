"""Celery tasks for order lifecycle automation, cancellation warnings, and unpaid expirations."""

from app.celery_app import celery_app
from app.database import get_db_context
from app.services.order_service import (
    find_orders_needing_cancellation_warning,
    find_expired_unpaid_orders,
    reject_and_restock_order
)
from app.tasks.email_tasks import (
    send_cancellation_warning_email_task,
    send_order_status_email_task
)
from app.utils.logging import logger, log_task_event


@celery_app.task(
    bind=True,
    name="app.tasks.order_tasks.process_unpaid_orders_lifecycle",
    acks_late=True
)
def process_unpaid_orders_lifecycle(self) -> dict:
    """
    Periodic Celery Beat task to manage unpaid card orders lifecycle:
    Phase 1: Send warning reminder emails to orders approaching deadline (once per order).
    Phase 2: Reject and restock orders that have reached the expiration deadline (>= threshold).
    """
    task_id = self.request.id
    log_task_event(
        task_name="process_unpaid_orders_lifecycle",
        event="cron_started",
        task_id=task_id
    )

    warned_order_ids = []
    rejected_order_ids = []

    with get_db_context() as db:
        # Phase 1: Warning reminders
        warning_orders = find_orders_needing_cancellation_warning(db)
        logger.info(f"Found {len(warning_orders)} orders eligible for cancellation warning email.")
        for order in warning_orders:
            warned_order_ids.append(order.id)

        # Phase 2: Expiration Rejections
        expired_orders = find_expired_unpaid_orders(db)
        logger.info(f"Found {len(expired_orders)} expired unpaid orders eligible for automatic rejection.")
        for order in expired_orders:
            order_id = order.id
            try:
                success = reject_and_restock_order(
                    db=db,
                    order=order,
                    task_id=task_id,
                    reason="Unpaid expiration deadline reached"
                )
                if success:
                    rejected_order_ids.append(order_id)
            except Exception as e:
                logger.error(f"Failed to reject expired order {order_id}: {e}")

    # After DB commit: dispatch warning emails
    for order_id in warned_order_ids:
        try:
            send_cancellation_warning_email_task.delay(order_id=order_id)
        except Exception as e:
            logger.error(f"Failed to enqueue warning email for order {order_id}: {e}")

    # After DB commit: dispatch status update rejection emails
    for order_id in rejected_order_ids:
        try:
            send_order_status_email_task.delay(
                order_id=order_id,
                previous_status="IN_PROGRESS",
                new_status="REJECTED"
            )
        except Exception as e:
            logger.error(f"Failed to enqueue rejection status email for order {order_id}: {e}")

    log_task_event(
        task_name="process_unpaid_orders_lifecycle",
        event="cron_finished",
        task_id=task_id,
        extra={
            "warned_count": len(warned_order_ids),
            "rejected_count": len(rejected_order_ids)
        }
    )

    return {
        "status": "SUCCESS",
        "task_id": task_id,
        "warned_count": len(warned_order_ids),
        "warned_order_ids": warned_order_ids,
        "rejected_count": len(rejected_order_ids),
        "rejected_order_ids": rejected_order_ids
    }


# Backward-compatible task alias
@celery_app.task(
    bind=True,
    name="app.tasks.order_tasks.cancel_expired_failed_orders",
    acks_late=True
)
def cancel_expired_failed_orders(self) -> dict:
    """Alias pointing to unified process_unpaid_orders_lifecycle task."""
    return process_unpaid_orders_lifecycle.apply(args=[], task_id=self.request.id).get()
