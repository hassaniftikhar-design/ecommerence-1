"""Email event tracking model for robust idempotency and audit logs."""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    Text,
    UniqueConstraint,
    Index
)
from app.models.base import Base


class EmailEvent(Base):
    __tablename__ = "email_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String, nullable=True, index=True)
    event_type = Column(String, nullable=False, index=True)
    recipient = Column(String, nullable=False, index=True)
    status = Column(String, default="PENDING", nullable=False)  # PENDING, SENT, FAILED
    attempts = Column(Integer, default=1, nullable=False)
    sent_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        # Ensures that a specific order event cannot be sent multiple times
        UniqueConstraint("order_id", "event_type", name="uq_email_events_order_event"),
        Index("ix_email_events_order_event", "order_id", "event_type"),
    )
