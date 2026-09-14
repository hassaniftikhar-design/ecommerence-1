"""Application configuration settings using pydantic-settings."""

import os
from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Service Information
    APP_NAME: str = "Ecommerce Job Scheduler"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # Security
    INTERNAL_SERVICE_TOKEN: str = "supersecret_internal_service_token_default"

    # Database
    DATABASE_URL: str = "postgresql+psycopg://postgres:6856@localhost:5432/ecommerce_db"

    # Redis Broker & Backend
    REDIS_URL_BROKER: str = "redis://localhost:6379/0"
    REDIS_URL_BACKEND: str = "redis://localhost:6379/1"

    # Frontend Origin
    APP_FRONTEND_URL: str = "http://localhost:3000"

    # SMTP Configuration
    SMTP_HOST: str = "smtp.mailtrap.io"
    SMTP_PORT: int = 2525
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    SMTP_USE_TLS: bool = True
    EMAIL_FROM: str = "Ecommerce Store <noreply@ecommerceapp.com>"

    # Celery Configuration
    CELERY_TIMEZONE: str = "Asia/Karachi"

    # Automation & Lifecycle Timing Constants (Configurable via ENV)
    UNPAID_ORDER_REJECTION_HOURS: int = 120
    CANCELLATION_WARNING_HOURS_BEFORE: int = 24
    BEAT_UNPAID_ORDER_CHECK_INTERVAL_MINUTES: int = 60

    # Bulk Import Configuration
    BULK_IMPORT_BATCH_SIZE: int = 50

    # Cloudinary Configuration
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def sqlalchemy_database_url(self) -> str:
        """Ensure database URL is using psycopg3 dialect for SQLAlchemy."""
        url = self.DATABASE_URL
        # If url begins with postgresql:// and doesn't specify +psycopg, normalize it
        if url.startswith("postgresql://") and not url.startswith("postgresql+psycopg://"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        # Strip ?schema=... if present, as psycopg handles schemas via search_path or schema prefix
        if "?schema=" in url:
            url = url.split("?schema=")[0]
        return url


@lru_cache()
def get_settings() -> Settings:
    return Settings()
