"""Celery tasks for transactional emails."""

from app.celery_app import celery_app
from app.database import get_db_context
from app.services.email_service import (
    process_forgot_password_email,
    process_order_placed_email,
    process_order_status_email,
    process_cancellation_warning_email,
    process_facebook_otp_email
)
from app.utils.errors import TransientEmailError, PermanentEmailError
from app.utils.logging import logger, log_task_event


@celery_app.task(
    bind=True,
    name="app.tasks.email_tasks.send_forgot_password_email",
    autoretry_for=(TransientEmailError,),
    retry_backoff=True,
    retry_backoff_max=300,
    max_retries=5,
    retry_jitter=True,
    acks_late=True
)
def send_forgot_password_email_task(
    self,
    reset_token: str,
    user_id: str | None = None,
    email: str | None = None,
    expiry_minutes: int | None = None
) -> dict:
    """Send password reset email to user."""
    log_task_event(
        task_name="send_forgot_password_email",
        event="received",
        task_id=self.request.id,
        attempt=self.request.retries + 1
    )

    with get_db_context() as db:
        process_forgot_password_email(
            db=db,
            reset_token=reset_token,
            user_id=user_id,
            email=email,
            expiry_minutes=expiry_minutes,
            task_id=self.request.id
        )

    return {"status": "SUCCESS", "task_id": self.request.id}


@celery_app.task(
    bind=True,
    name="app.tasks.email_tasks.send_facebook_otp_email",
    autoretry_for=(TransientEmailError,),
    retry_backoff=True,
    retry_backoff_max=300,
    max_retries=5,
    retry_jitter=True,
    acks_late=True
)
def send_facebook_otp_email_task(
    self,
    email: str,
    otp: str
) -> dict:
    """Send Facebook OAuth email verification OTP."""
    log_task_event(
        task_name="send_facebook_otp_email",
        event="received",
        task_id=self.request.id,
        attempt=self.request.retries + 1
    )

    process_facebook_otp_email(
        email=email,
        otp=otp,
        task_id=self.request.id
    )

    return {"status": "SUCCESS", "task_id": self.request.id}



@celery_app.task(
    bind=True,
    name="app.tasks.email_tasks.send_order_placed_email",
    autoretry_for=(TransientEmailError,),
    retry_backoff=True,
    retry_backoff_max=300,
    max_retries=5,
    retry_jitter=True,
    acks_late=True
)
def send_order_placed_email_task(
    self,
    order_id: str
) -> dict:
    """Send order confirmation email to customer upon placing order."""
    log_task_event(
        task_name="send_order_placed_email",
        event="received",
        task_id=self.request.id,
        order_id=order_id,
        attempt=self.request.retries + 1
    )

    with get_db_context() as db:
        process_order_placed_email(
            db=db,
            order_id=order_id,
            task_id=self.request.id
        )

    return {"status": "SUCCESS", "task_id": self.request.id, "order_id": order_id}


@celery_app.task(
    bind=True,
    name="app.tasks.email_tasks.send_order_status_email",
    autoretry_for=(TransientEmailError,),
    retry_backoff=True,
    retry_backoff_max=300,
    max_retries=5,
    retry_jitter=True,
    acks_late=True
)
def send_order_status_email_task(
    self,
    order_id: str,
    previous_status: str | None = None,
    new_status: str | None = None
) -> dict:
    """Send order status change notification email to customer."""
    log_task_event(
        task_name="send_order_status_email",
        event="received",
        task_id=self.request.id,
        order_id=order_id,
        attempt=self.request.retries + 1,
        extra={"previous": previous_status, "new": new_status}
    )

    with get_db_context() as db:
        process_order_status_email(
            db=db,
            order_id=order_id,
            previous_status=previous_status,
            new_status=new_status,
            task_id=self.request.id
        )

    return {
        "status": "SUCCESS",
        "task_id": self.request.id,
        "order_id": order_id,
        "new_status": new_status
    }


@celery_app.task(
    bind=True,
    name="app.tasks.email_tasks.send_cancellation_warning_email",
    autoretry_for=(TransientEmailError,),
    retry_backoff=True,
    retry_backoff_max=300,
    max_retries=5,
    retry_jitter=True,
    acks_late=True
)
def send_cancellation_warning_email_task(
    self,
    order_id: str
) -> dict:
    """Send expiration warning / reminder email for pending unpaid card order."""
    log_task_event(
        task_name="send_cancellation_warning_email",
        event="received",
        task_id=self.request.id,
        order_id=order_id,
        attempt=self.request.retries + 1
    )

    with get_db_context() as db:
        process_cancellation_warning_email(
            db=db,
            order_id=order_id,
            task_id=self.request.id
        )

    return {
        "status": "SUCCESS",
        "task_id": self.request.id,
        "order_id": order_id
    }
