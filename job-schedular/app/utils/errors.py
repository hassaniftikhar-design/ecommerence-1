"""Error definitions and global exception handlers."""

from typing import Any, Dict
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.utils.logging import logger


class JobSchedulerException(Exception):
    """Base exception for Job Scheduler."""
    def __init__(self, message: str, code: str = "INTERNAL_ERROR", status_code: int = 500):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


class TransientEmailError(JobSchedulerException):
    """Transient SMTP or network failure that should trigger automatic retry."""
    def __init__(self, message: str):
        super().__init__(message, code="TRANSIENT_EMAIL_ERROR", status_code=503)


class PermanentEmailError(JobSchedulerException):
    """Permanent email failure (e.g. invalid recipient, missing user) that should not retry."""
    def __init__(self, message: str):
        super().__init__(message, code="PERMANENT_EMAIL_ERROR", status_code=400)


class OrderNotFoundError(JobSchedulerException):
    def __init__(self, order_id: str):
        super().__init__(f"Order with ID {order_id} not found", code="ORDER_NOT_FOUND", status_code=404)


class InvalidOrderStateError(JobSchedulerException):
    def __init__(self, message: str):
        super().__init__(message, code="INVALID_ORDER_STATE", status_code=400)


def create_error_response(code: str, message: str, status_code: int = 400) -> JSONResponse:
    """Format consistent error JSON."""
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message
            }
        }
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Register uniform error handlers on FastAPI application."""

    @app.exception_handler(JobSchedulerException)
    async def job_scheduler_exception_handler(request: Request, exc: JobSchedulerException):
        logger.error(f"JobSchedulerException: code={exc.code} message={exc.message}")
        return create_error_response(code=exc.code, message=exc.message, status_code=exc.status_code)

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        code_map = {
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            405: "METHOD_NOT_ALLOWED",
            409: "CONFLICT",
            500: "INTERNAL_SERVER_ERROR"
        }
        code = code_map.get(exc.status_code, "HTTP_ERROR")
        return create_error_response(
            code=code,
            message=str(exc.detail) if exc.detail else "An HTTP error occurred",
            status_code=exc.status_code
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        first_error = exc.errors()[0] if exc.errors() else {"msg": "Validation failed", "loc": []}
        loc = " -> ".join(str(l) for l in first_error.get("loc", []))
        msg = f"{first_error.get('msg')} ({loc})" if loc else str(first_error.get('msg'))
        return create_error_response(
            code="VALIDATION_ERROR",
            message=msg,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logger.exception(f"Unhandled internal server error: {exc}")
        return create_error_response(
            code="INTERNAL_SERVER_ERROR",
            message="An unexpected server error occurred",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
