"""Health check endpoints."""

import redis
from fastapi import APIRouter, Depends, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.schemas.common import HealthCheckResponse

router = APIRouter(tags=["Health"])
settings = get_settings()


@router.get(
    "/health",
    response_model=HealthCheckResponse,
    status_code=status.HTTP_200_OK,
    summary="Health and Readiness Check"
)
def health_check(db: Session = Depends(get_db)):
    """
    Public health check endpoint validating database connectivity and Redis availability.
    """
    # 1. Database Check
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = "disconnected"

    # 2. Redis Check
    redis_status = "connected"
    try:
        r = redis.Redis.from_url(settings.REDIS_URL_BROKER, socket_timeout=2)
        r.ping()
    except Exception:
        redis_status = "disconnected"

    overall_status = "healthy" if db_status == "connected" and redis_status == "connected" else "degraded"

    return HealthCheckResponse(
        status=overall_status,
        db=db_status,
        redis=redis_status,
        version="1.0.0"
    )
