"""Common response schemas."""

from typing import Any, Generic, List, Optional, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class APIErrorDetails(BaseModel):
    code: str
    message: str


class APIErrorResponse(BaseModel):
    error: APIErrorDetails


class TaskEnqueueResponse(BaseModel):
    task_id: str
    status: str = "QUEUED"
    message: str


class HealthCheckResponse(BaseModel):
    status: str
    db: str
    redis: str
    version: str = "1.0.0"
