"""Bulk product import schemas."""

from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class ProductOptionImportSchema(BaseModel):
    name: str = Field(..., min_length=1)
    values: List[str] = Field(..., min_length=1)


class ProductVariantImportSchema(BaseModel):
    sku: Optional[str] = None
    stock: int = Field(default=0, ge=0)
    images: List[str] = Field(default_factory=list)
    attributes: Optional[Dict[str, str]] = Field(default_factory=dict)


class ProductImportItemSchema(BaseModel):
    name: Optional[str] = ""
    description: Optional[str] = None
    price: Optional[Decimal] = None
    categoryId: Optional[str] = None
    categoryName: Optional[str] = None
    category: Optional[str] = None
    stock: Optional[int] = None
    imageUrl: Optional[str] = None
    options: Optional[List[ProductOptionImportSchema]] = Field(default_factory=list)
    variants: Optional[List[ProductVariantImportSchema]] = Field(default_factory=list)

    model_config = {"extra": "allow"}


class BulkProductImportRequest(BaseModel):
    created_by_id: str = Field(..., description="Admin User ID creating the products")
    products: List[ProductImportItemSchema] = Field(..., min_length=1, max_length=500)


class BulkProductImportFileRequest(BaseModel):
    job_id: Optional[str] = None
    created_by_id: str = Field(..., description="Admin User ID creating the products")
    filename: Optional[str] = Field(default="products.csv", description="Original filename")
    csv_path: str = Field(..., description="Path to CSV file in durable storage")
    images_path: Optional[str] = Field(default=None, description="Path to folder containing product images")


class ImportErrorItem(BaseModel):
    id: Optional[str] = None
    row_index: int
    product_name: Optional[str] = None
    error_type: Optional[str] = None
    error: str
    product_id: Optional[str] = None
    resolution_status: Optional[str] = "PENDING"
    resolved_at: Optional[str] = None
    raw_data: Optional[Dict[str, Any]] = None


class ImportJobStatusResponse(BaseModel):
    id: str
    filename: Optional[str] = None
    status: str
    total_items: int
    processed_items: int
    successful_items: int
    failed_items: int
    created_at: str
    updated_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    errors: List[ImportErrorItem] = Field(default_factory=list)
