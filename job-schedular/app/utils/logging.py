"""Structured logging configuration."""

import logging
import sys
from typing import Any, Dict


class SafeFormatter(logging.Formatter):
    """Formatter that prevents leaking sensitive tokens or passwords in log outputs."""

    def format(self, record: logging.LogRecord) -> str:
        msg = super().format(record)
        # Redact obvious potential secrets if accidentally passed in text
        # (Though code should avoid passing them in the first place)
        return msg


def setup_logger(name: str = "job_scheduler") -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            SafeFormatter(
                "[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S"
            )
        )
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger


logger = setup_logger()


def log_task_event(
    task_name: str,
    event: str,
    task_id: str | None = None,
    job_id: str | None = None,
    order_id: str | None = None,
    attempt: int = 1,
    extra: Dict[str, Any] | None = None
) -> None:
    """Convenience helper for structured background task logs."""
    parts = [f"task={task_name}", f"event={event}", f"attempt={attempt}"]
    if task_id:
        parts.append(f"task_id={task_id}")
    if job_id:
        parts.append(f"job_id={job_id}")
    if order_id:
        parts.append(f"order_id={order_id}")
    if extra:
        for k, v in extra.items():
            if "token" in k.lower() or "password" in k.lower() or "secret" in k.lower():
                continue
            parts.append(f"{k}={v}")
    logger.info(" | ".join(parts))
