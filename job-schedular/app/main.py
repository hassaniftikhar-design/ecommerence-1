"""Main FastAPI application entry point."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.config import get_settings
from app.database import init_db
from app.utils.errors import register_exception_handlers
from app.utils.logging import logger

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    logger.info(f"Starting {settings.APP_NAME} in {settings.ENVIRONMENT} mode...")
    try:
        init_db()
        logger.info("Database models verified and tables initialized.")
    except Exception as e:
        logger.warning(f"Database initialization warning (will retry on queries): {e}")
    yield
    logger.info("Shutting down background scheduler API...")


def create_app() -> FastAPI:
    """Application factory for FastAPI."""
    app = FastAPI(
        title=settings.APP_NAME,
        description="Background job scheduler service for ecommerce application (Celery + Redis + Postgres)",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc"
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register standard exception handlers
    register_exception_handlers(app)

    # Mount API routes
    app.include_router(api_router)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
