"""Test suite for Celery configuration and Beat periodic schedule."""

from app.celery_app import celery_app
from app.config import get_settings

settings = get_settings()


def test_celery_configuration_settings():
    """Verify Celery application config parameters."""
    conf = celery_app.conf

    assert conf.task_serializer == "json"
    assert conf.result_serializer == "json"
    assert "json" in conf.accept_content
    assert conf.timezone == "Asia/Karachi"
    assert conf.enable_utc is True
    assert conf.task_track_started is True
    assert conf.task_acks_late is True
    assert conf.task_reject_on_worker_lost is True


def test_celery_beat_schedule_configuration():
    """Verify that the unpaid-order lifecycle task is configured in Celery Beat."""
    schedule = celery_app.conf.beat_schedule

    assert "process-unpaid-orders-lifecycle" in schedule
    entry = schedule["process-unpaid-orders-lifecycle"]

    assert entry["task"] == "app.tasks.order_tasks.process_unpaid_orders_lifecycle"
    # Schedule interval matches configured minutes * 60
    expected_interval = float(settings.BEAT_UNPAID_ORDER_CHECK_INTERVAL_MINUTES * 60)
    assert entry["schedule"] == expected_interval


def test_celery_queue_routing_configuration():
    """Verify that tasks are routed to appropriate priority queues."""
    conf = celery_app.conf
    routes = conf.task_routes

    # High Priority queue for interactive authentication
    assert routes["app.tasks.email_tasks.send_forgot_password_email"]["queue"] == "high_priority"
    assert routes["app.tasks.email_tasks.send_facebook_otp_email"]["queue"] == "high_priority"

    # Default queue for transactional notifications
    assert routes["app.tasks.email_tasks.send_order_placed_email"]["queue"] == "default"
    assert routes["app.tasks.email_tasks.send_order_status_email"]["queue"] == "default"
    assert routes["app.tasks.email_tasks.send_cancellation_warning_email"]["queue"] == "default"
    assert routes["app.tasks.order_tasks.process_unpaid_orders_lifecycle"]["queue"] == "default"

    # Bulk queue for heavy product imports
    assert routes["app.tasks.import_tasks.process_bulk_import"]["queue"] == "bulk_queue"

