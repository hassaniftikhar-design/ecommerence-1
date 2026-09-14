"""Cloudinary helper for background image uploads."""

import os
from typing import Optional, Union, BinaryIO
import cloudinary
import cloudinary.uploader
from app.config import get_settings
from app.utils.logging import logger


def is_cloudinary_configured() -> bool:
    """Check if Cloudinary environment variables are set."""
    settings = get_settings()
    return bool(
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    )


def init_cloudinary() -> None:
    """Initialize Cloudinary SDK with current settings."""
    settings = get_settings()
    if is_cloudinary_configured():
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True
        )


def upload_image_to_cloudinary(
    file_source: Union[str, bytes, BinaryIO],
    folder: str = "ecommerce_products"
) -> Optional[str]:
    """
    Upload an image to Cloudinary from a file path or binary buffer.
    Returns the secure URL on success, or None on failure/missing credentials.
    """
    if not is_cloudinary_configured():
        logger.warning("Cloudinary credentials are not configured. Skipping remote image upload.")
        return None

    try:
        init_cloudinary()
        response = cloudinary.uploader.upload(
            file_source,
            folder=folder,
            resource_type="image"
        )
        secure_url = response.get("secure_url") or response.get("url")
        return secure_url
    except Exception as exc:
        logger.error(f"Failed to upload image to Cloudinary: {exc}", exc_info=True)
        return None
