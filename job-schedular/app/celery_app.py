"""Celery application configuration and Beat schedule."""

from celery import Celery
from kombu import Queue
from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "ecommerce_scheduler",
    broker=settings.REDIS_URL_BROKER,
    backend=settings.REDIS_URL_BACKEND,
    include=[
        "app.tasks.email_tasks",
        "app.tasks.order_tasks",
        "app.tasks.import_tasks",
    ]
)

# Schedule interval in seconds based on configured minutes
beat_interval_seconds = max(10, settings.BEAT_UNPAID_ORDER_CHECK_INTERVAL_MINUTES * 60)

celery_app.conf.update(
    # Serialization
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    result_accept_content=["json"],

    # Timezone
    timezone=settings.CELERY_TIMEZONE,
    enable_utc=True,

    # Priority Queues Configuration
    task_default_queue="default",
    task_queues=(
        Queue("high_priority"),
        Queue("default"),
        Queue("bulk_queue"),
    ),
    task_routes={
        # High Priority: Interactive Authentication (OTP & Password Reset)
        "app.tasks.email_tasks.send_forgot_password_email": {"queue": "high_priority"},
        "app.tasks.email_tasks.send_facebook_otp_email": {"queue": "high_priority"},

        # Medium / Default Priority: Transactional Store Notifications & Lifecycle
        "app.tasks.email_tasks.send_order_placed_email": {"queue": "default"},
        "app.tasks.email_tasks.send_order_status_email": {"queue": "default"},
        "app.tasks.email_tasks.send_cancellation_warning_email": {"queue": "default"},
        "app.tasks.order_tasks.process_unpaid_orders_lifecycle": {"queue": "default"},

        # Low / Bulk Priority: Long-running Data Processing
        "app.tasks.import_tasks.process_bulk_import": {"queue": "bulk_queue"},
    },

    # Task tracking & reliability
    task_track_started=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    broker_connection_retry_on_startup=True,
    result_expires=86400,  # 24 hours

    # Concurrency and prefetch
    worker_prefetch_multiplier=1,
    worker_concurrency=4,

    # Beat Periodic Schedule (Interval dynamically sourced from settings)
    beat_schedule={
        "process-unpaid-orders-lifecycle": {
            "task": "app.tasks.order_tasks.process_unpaid_orders_lifecycle",
            "schedule": float(beat_interval_seconds),
            "options": {"expires": max(30, beat_interval_seconds - 10)}
        }
    }
)
