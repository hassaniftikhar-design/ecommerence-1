"""Centralized timing and automation constants for background job scheduler."""

from app.config import get_settings

settings = get_settings()

# Default timing durations (hours)
UNPAID_ORDER_REJECTION_HOURS: int = settings.UNPAID_ORDER_REJECTION_HOURS
CANCELLATION_WARNING_HOURS_BEFORE: int = settings.CANCELLATION_WARNING_HOURS_BEFORE

# Celery Beat check interval (minutes)
BEAT_UNPAID_ORDER_CHECK_INTERVAL_MINUTES: int = settings.BEAT_UNPAID_ORDER_CHECK_INTERVAL_MINUTES

# Email Event Type Constants
EVENT_TYPE_ORDER_PLACED = "ORDER_PLACED"
EVENT_TYPE_CANCELLATION_WARNING = "CANCELLATION_WARNING"
EVENT_TYPE_STATUS_PREFIX = "ORDER_STATUS_CHANGED"
