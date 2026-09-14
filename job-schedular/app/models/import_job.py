"""Bulk product import tracking models."""

import enum
import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    Text,
    ForeignKey,
    Index
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.models.base import Base


class ImportJobStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    COMPLETED_WITH_ERRORS = "COMPLETED_WITH_ERRORS"
    FAILED = "FAILED"


class ImportItemStatus(str, enum.Enum):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"


class ImportJob(Base):
    __tablename__ = "import_jobs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String, nullable=True)
    csv_reference = Column(String, nullable=True)
    images_reference = Column(String, nullable=True)
    total_items = Column(Integer, default=0, nullable=False)
    processed_items = Column(Integer, default=0, nullable=False)
    successful_items = Column(Integer, default=0, nullable=False)
    failed_items = Column(Integer, default=0, nullable=False)
    status = Column(String, default=ImportJobStatus.QUEUED.value, nullable=False)
    created_by_id = Column(String, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    items = relationship("ImportItem", back_populates="job", cascade="all, delete-orphan", order_by="ImportItem.row_index")


class ImportItem(Base):
    __tablename__ = "import_items"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id = Column(String, ForeignKey("import_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    row_index = Column(Integer, nullable=False)
    raw_data = Column(JSONB, nullable=False)
    status = Column(String, default=ImportItemStatus.PENDING.value, nullable=False)
    error_type = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)
    product_id = Column(String, nullable=True)
    resolution_status = Column(String, default="PENDING", nullable=False)
    resolved_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    job = relationship("ImportJob", back_populates="items")

    __table_args__ = (
        Index("ix_import_items_job_status", "job_id", "status"),
        Index("ix_import_items_job_resolution", "job_id", "resolution_status"),
    )
