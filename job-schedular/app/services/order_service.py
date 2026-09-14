"""Order service handling lifecycle automation, rejection, restocking, and reminder warnings."""

import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.constants import (
    UNPAID_ORDER_REJECTION_HOURS,
    CANCELLATION_WARNING_HOURS_BEFORE,
    EVENT_TYPE_CANCELLATION_WARNING
)
from app.models.ecommerce import (
    Order,
    OrderItem,
    ProductVariant,
    Payment,
    Notification,
    OrderStatusEnum,
    PaymentStatusEnum
)
from app.models.email_event import EmailEvent
from app.utils.logging import logger, log_task_event


def find_orders_needing_cancellation_warning(
    db: Session,
    now: Optional[datetime] = None
) -> List[Order]:
    """
    Query active Card-payment orders approaching the rejection deadline that have not yet
    received a warning reminder email.
    Eligible when: (UNPAID_ORDER_REJECTION_HOURS - CANCELLATION_WARNING_HOURS_BEFORE) <= age < UNPAID_ORDER_REJECTION_HOURS.
    """
    if now is None:
        now = datetime.utcnow()

    warning_hours = max(0, UNPAID_ORDER_REJECTION_HOURS - CANCELLATION_WARNING_HOURS_BEFORE)
    warning_cutoff = now - timedelta(hours=warning_hours)
    rejection_cutoff = now - timedelta(hours=UNPAID_ORDER_REJECTION_HOURS)

    # Subquery: Orders that have already received the cancellation warning email
    sent_warnings_query = (
        db.query(EmailEvent.order_id)
        .filter(
            EmailEvent.event_type == EVENT_TYPE_CANCELLATION_WARNING,
            EmailEvent.status == "SENT"
        )
    )

    # Note: Only Card orders have an associated Payment record. Cash on Delivery orders are never selected.
    orders = (
        db.query(Order)
        .join(Payment, Order.id == Payment.orderId)
        .filter(
            Order.status == OrderStatusEnum.IN_PROGRESS,
            Payment.status.in_([PaymentStatusEnum.PENDING, PaymentStatusEnum.FAILED]),
            or_(
                and_(Payment.updatedAt <= warning_cutoff, Payment.updatedAt > rejection_cutoff),
                and_(Payment.updatedAt == None, Payment.createdAt <= warning_cutoff, Payment.createdAt > rejection_cutoff)
            ),
            ~Order.id.in_(sent_warnings_query)
        )
        .all()
    )

    return orders


def find_expired_unpaid_orders(
    db: Session,
    now: Optional[datetime] = None
) -> List[Order]:
    """
    Query Card-payment orders with unresolved payment (PENDING or FAILED)
    that have remained unresolved for >= UNPAID_ORDER_REJECTION_HOURS.
    """
    if now is None:
        now = datetime.utcnow()

    rejection_cutoff = now - timedelta(hours=UNPAID_ORDER_REJECTION_HOURS)

    # Join Payment to ensure Cash on Delivery (COD) orders without a Payment record are excluded
    expired_orders = (
        db.query(Order)
        .join(Payment, Order.id == Payment.orderId)
        .filter(
            Order.status == OrderStatusEnum.IN_PROGRESS,
            Payment.status.in_([PaymentStatusEnum.PENDING, PaymentStatusEnum.FAILED]),
            or_(
                Payment.updatedAt <= rejection_cutoff,
                and_(Payment.updatedAt == None, Payment.createdAt <= rejection_cutoff)
            )
        )
        .all()
    )

    return expired_orders


def reject_and_restock_order(
    db: Session,
    order: Order,
    task_id: Optional[str] = None,
    reason: str = "Unpaid expiration deadline reached"
) -> bool:
    """
    Unified order rejection and inventory restocking function.
    Converges automatic Beat rejection and admin manual rejection on the exact same side-effects:
    1. Restores variant inventory atomically using row locks.
    2. Marks Order.status = REJECTED (soft-delete). All rows remain permanently in DB.
    3. Updates Payment.status = FAILED (if Card payment).
    4. Creates in-app Notification for the customer.
    Returns True if rejected, False if skipped (already processed).
    """
    if order.status != OrderStatusEnum.IN_PROGRESS:
        logger.info(f"Skipping rejection for order {order.id}: status is {order.status}")
        return False

    log_task_event(
        task_name="reject_and_restock_order",
        event="processing_rejection",
        task_id=task_id,
        order_id=order.id,
        extra={"reason": reason}
    )

    # 1. Restock each OrderItem back into ProductVariant.stock
    for item in order.items:
        target_variant_id = item.variantId
        if not target_variant_id:
            first_variant = (
                db.query(ProductVariant)
                .filter(ProductVariant.productId == item.productId)
                .first()
            )
            if first_variant:
                target_variant_id = first_variant.id

        if target_variant_id:
            variant = (
                db.query(ProductVariant)
                .filter(ProductVariant.id == target_variant_id)
                .with_for_update()
                .first()
            )
            if variant:
                variant.stock = variant.stock + item.quantity
                logger.info(
                    f"Restocked {item.quantity} units for variant {target_variant_id} (order item {item.id}). New stock: {variant.stock}"
                )

    # 2. Update Order status to REJECTED (Permanent DB record preserved)
    order.status = OrderStatusEnum.REJECTED
    order.updatedAt = datetime.utcnow()

    # 3. Update Payment record if present
    if order.payment:
        order.payment.status = PaymentStatusEnum.FAILED
        order.payment.errorMessage = f"Order rejected ({reason})."
        order.payment.updatedAt = datetime.utcnow()

    # 4. Create in-app notification for the customer
    notification = Notification(
        id=str(uuid.uuid4()),
        userId=order.userId,
        title="Order Expired and Cancelled",
        message=f"Your order #{order.orderNumber} was cancelled because payment was not completed within the time limit. Reserved stock has been returned.",
        type="ORDER_STATUS_UPDATED",
        orderId=order.id,
        isRead=False,
        createdAt=datetime.utcnow(),
        updatedAt=datetime.utcnow()
    )
    db.add(notification)

    log_task_event(
        task_name="reject_and_restock_order",
        event="rejected_and_restocked",
        task_id=task_id,
        order_id=order.id
    )
    return True


# Backward-compatibility alias
cancel_and_restock_order = reject_and_restock_order
