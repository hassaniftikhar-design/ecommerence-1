"""Tasks package."""

from app.tasks.email_tasks import (
    send_forgot_password_email_task,
    send_order_placed_email_task,
    send_order_status_email_task,
    send_facebook_otp_email_task
)
from app.tasks.order_tasks import cancel_expired_failed_orders
from app.tasks.import_tasks import process_bulk_import_task

__all__ = [
    "send_forgot_password_email_task",
    "send_order_placed_email_task",
    "send_order_status_email_task",
    "send_facebook_otp_email_task",
    "cancel_expired_failed_orders",
    "process_bulk_import_task"
]
