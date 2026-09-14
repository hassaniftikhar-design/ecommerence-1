"""Authentication and dependency injection for API routes."""

import secrets
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import get_settings

settings = get_settings()
security = HTTPBearer(auto_error=False)


def verify_service_token(
    credentials: HTTPAuthorizationCredentials | None = Security(security)
) -> str:
    """
    Validate that the incoming request contains Authorization: Bearer <INTERNAL_SERVICE_TOKEN>.
    Performs constant-time comparison to prevent timing attacks.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization Header or Bearer Token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = credentials.credentials
    expected_token = settings.INTERNAL_SERVICE_TOKEN

    if not secrets.compare_digest(token, expected_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid service authorization token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    return token
