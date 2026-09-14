"""Celery tasks for bulk product import."""

from datetime import datetime
from app.celery_app import celery_app
from app.database import get_db_context
from app.models.import_job import ImportJob, ImportJobStatus
from app.services.import_service import process_import_job
from app.utils.logging import logger, log_task_event


@celery_app.task(
    bind=True,
    name="app.tasks.import_tasks.process_bulk_import",
    acks_late=True
)
def process_bulk_import_task(self, job_id: str) -> dict:
    """Asynchronously process bulk product import job."""
    task_id = self.request.id
    log_task_event(
        task_name="process_bulk_import",
        event="received",
        task_id=task_id,
        job_id=job_id
    )

    try:
        with get_db_context() as db:
            job = process_import_job(db=db, job_id=job_id, task_id=task_id)
            result = {
                "status": str(job.status),
                "task_id": str(task_id),
                "job_id": str(job.id),
                "total": int(job.total_items),
                "successful": int(job.successful_items),
                "failed": int(job.failed_items)
            }
        return result
    except Exception as exc:
        logger.error(f"Bulk product import task {task_id} failed for job {job_id}: {exc}", exc_info=True)
        try:
            with get_db_context() as db_err:
                err_job = db_err.query(ImportJob).filter(ImportJob.id == job_id).first()
                if err_job and err_job.status not in (
                    ImportJobStatus.COMPLETED.value,
                    ImportJobStatus.COMPLETED_WITH_ERRORS.value
                ):
                    err_job.status = ImportJobStatus.FAILED.value
                    err_job.updated_at = datetime.utcnow()
                    db_err.commit()
        except Exception as update_err:
            logger.error(f"Failed to record FAILED status for job {job_id}: {update_err}")
        raise exc

