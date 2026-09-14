"""Job triggering and management endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import verify_service_token
from app.database import get_db
from app.models.ecommerce import Order, User
from app.models.import_job import ImportJob, ImportItem
from app.schemas.common import TaskEnqueueResponse
from app.schemas.jobs import (
    ForgotPasswordJobRequest,
    OrderPlacedJobRequest,
    OrderStatusJobRequest,
    FacebookOtpJobRequest
)
from app.schemas.import_schemas import (
    BulkProductImportRequest,
    BulkProductImportFileRequest,
    ImportJobStatusResponse,
    ImportErrorItem
)
from app.services.import_service import (
    create_import_job,
    create_file_import_job,
    resolve_import_item
)
from app.tasks.email_tasks import (
    send_forgot_password_email_task,
    send_order_placed_email_task,
    send_order_status_email_task,
    send_facebook_otp_email_task
)
from app.tasks.import_tasks import process_bulk_import_task
from app.utils.logging import logger
from typing import Union, Optional

router = APIRouter(prefix="/jobs", tags=["Jobs"], dependencies=[Depends(verify_service_token)])


@router.post(
    "/forgot-password",
    response_model=TaskEnqueueResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue Password Reset Email"
)
def enqueue_forgot_password_email(
    payload: ForgotPasswordJobRequest,
    db: Session = Depends(get_db)
):
    """
    Accepts minimal user identifier and secure reset token.
    Enqueues background task to render and send password reset email.
    """
    # Verify user exists in database
    user = None
    if payload.user_id:
        user = db.query(User).filter(User.id == payload.user_id).first()
    elif payload.email:
        user = db.query(User).filter(User.email == payload.email.strip().lower()).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found for password reset"
        )

    task = send_forgot_password_email_task.delay(
        reset_token=payload.reset_token,
        user_id=user.id,
        email=user.email
    )

    return TaskEnqueueResponse(
        task_id=task.id,
        status="QUEUED",
        message="Password reset email job enqueued successfully"
    )


@router.post(
    "/facebook-otp",
    response_model=TaskEnqueueResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue Facebook Verification OTP Email"
)
def enqueue_facebook_otp_email(
    payload: FacebookOtpJobRequest
):
    """
    Accepts recipient email and 6-digit OTP code.
    Enqueues high-priority background task to render and send verification email.
    """
    task = send_facebook_otp_email_task.delay(
        email=payload.email,
        otp=payload.otp
    )

    return TaskEnqueueResponse(
        task_id=task.id,
        status="QUEUED",
        message="Facebook OTP email job enqueued successfully"
    )



@router.post(
    "/order-placed",
    response_model=TaskEnqueueResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue Order Confirmation Email"
)
def enqueue_order_placed_email(
    payload: OrderPlacedJobRequest,
    db: Session = Depends(get_db)
):
    """
    Accepts order_id.
    Enqueues task to load canonical order details and dispatch order confirmation email.
    """
    order = db.query(Order).filter(Order.id == payload.order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID {payload.order_id} not found"
        )

    task = send_order_placed_email_task.delay(order_id=payload.order_id)

    return TaskEnqueueResponse(
        task_id=task.id,
        status="QUEUED",
        message="Order placed confirmation email job enqueued successfully"
    )


@router.post(
    "/order-status",
    response_model=TaskEnqueueResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue Order Status Update Email"
)
def enqueue_order_status_email(
    payload: OrderStatusJobRequest,
    db: Session = Depends(get_db)
):
    """
    Accepts order_id and optional status transition info.
    Enqueues task to dispatch status update notification to customer.
    """
    order = db.query(Order).filter(Order.id == payload.order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID {payload.order_id} not found"
        )

    target_status = payload.new_status or (order.status.value if hasattr(order.status, 'value') else str(order.status))

    task = send_order_status_email_task.delay(
        order_id=payload.order_id,
        previous_status=payload.previous_status,
        new_status=target_status
    )

    return TaskEnqueueResponse(
        task_id=task.id,
        status="QUEUED",
        message="Order status email job enqueued successfully"
    )


@router.post(
    "/product-import",
    response_model=TaskEnqueueResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue Bulk Product Import"
)
def enqueue_bulk_product_import(
    payload: Union[BulkProductImportFileRequest, BulkProductImportRequest],
    db: Session = Depends(get_db)
):
    """
    Accepts either a durable file import request (CSV + image folder path)
    or a direct JSON products payload.
    Creates persistent ImportJob and enqueues background Celery task.
    Returns HTTP 202 Accepted immediately.
    """
    # Verify creator is a valid user
    admin_user = db.query(User).filter(User.id == payload.created_by_id).first()
    if not admin_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Created-by user '{payload.created_by_id}' does not exist"
        )

    if isinstance(payload, BulkProductImportFileRequest) or hasattr(payload, "csv_path"):
        job = create_file_import_job(
            db=db,
            created_by_id=payload.created_by_id,
            filename=payload.filename or "products.csv",
            csv_path=payload.csv_path,
            images_path=payload.images_path,
            job_id=payload.job_id
        )
    else:
        job = create_import_job(
            db=db,
            created_by_id=payload.created_by_id,
            products_data=payload.products
        )

    task = process_bulk_import_task.delay(job_id=job.id)

    return TaskEnqueueResponse(
        task_id=task.id,
        status="QUEUED",
        message=f"Product import job {job.id} enqueued successfully."
    )


@router.get(
    "/product-import/{job_id}",
    response_model=ImportJobStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Bulk Product Import Progress"
)
def get_bulk_product_import_status(
    job_id: str,
    db: Session = Depends(get_db)
):
    """
    Returns real-time progress of bulk product import job, including counts and detailed error items.
    """
    job = db.query(ImportJob).filter(ImportJob.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Import job with ID {job_id} not found"
        )

    failed_items = (
        db.query(ImportItem)
        .filter(ImportItem.job_id == job_id, ImportItem.status == "FAILED")
        .order_by(ImportItem.row_index)
        .all()
    )

    errors = []
    for item in failed_items:
        prod_name = item.raw_data.get("name") if isinstance(item.raw_data, dict) else None
        errors.append(
            ImportErrorItem(
                id=item.id,
                row_index=item.row_index,
                product_name=prod_name,
                error_type=item.error_type or "VALIDATION_ERROR",
                error=item.error_message or "Unknown import error",
                product_id=item.product_id,
                resolution_status=item.resolution_status or "PENDING",
                resolved_at=item.resolved_at.isoformat() if item.resolved_at else None,
                raw_data=item.raw_data if isinstance(item.raw_data, dict) else None
            )
        )

    return ImportJobStatusResponse(
        id=job.id,
        filename=job.filename,
        status=job.status,
        total_items=job.total_items,
        processed_items=job.processed_items,
        successful_items=job.successful_items,
        failed_items=job.failed_items,
        created_at=job.created_at.isoformat(),
        updated_at=job.updated_at.isoformat(),
        started_at=job.started_at.isoformat() if job.started_at else None,
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
        errors=errors
    )


@router.patch(
    "/product-import/{job_id}/items/{item_id}/resolve",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Mark Import Item as Resolved"
)
def resolve_import_job_item(
    job_id: str,
    item_id: str,
    product_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Mark a failed import item as resolved after successful admin correction."""
    item = resolve_import_item(db=db, item_id=item_id, product_id=product_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Import item with ID {item_id} not found"
        )

    return {
        "success": True,
        "message": "Import item marked as resolved",
        "item_id": item.id,
        "resolution_status": item.resolution_status,
        "product_id": item.product_id
    }
