"""Email service for Jinja2 rendering, SMTP delivery, and event tracking."""

import os
import smtplib
from datetime import datetime
from email.message import EmailMessage
from pathlib import Path
from typing import Any, Dict, Optional
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy.orm import Session

from app.config import get_settings
from app.constants import (
    EVENT_TYPE_ORDER_PLACED,
    EVENT_TYPE_CANCELLATION_WARNING,
    EVENT_TYPE_STATUS_PREFIX,
    UNPAID_ORDER_REJECTION_HOURS,
    DEFAULT_PASSWORD_RESET_EXPIRY_MINUTES
)
from app.models.ecommerce import Order, User, PaymentStatusEnum, OrderStatusEnum
from app.models.email_event import EmailEvent
from app.utils.logging import logger, log_task_event
from app.utils.errors import (
    TransientEmailError,
    PermanentEmailError,
    OrderNotFoundError
)

settings = get_settings()

# Setup Jinja2 Template Environment
TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"
jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"])
)


def render_email_template(template_name: str, context: Dict[str, Any]) -> str:
    """Render a Jinja2 HTML template with the given context."""
    template = jinja_env.get_template(template_name)
    context.setdefault("current_year", datetime.utcnow().year)
    return template.render(**context)


def send_smtp_email(
    to_email: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None
) -> None:
    """Send an email using configured SMTP credentials with TLS or SSL."""
    if not settings.SMTP_HOST or not settings.SMTP_USER or "placeholder" in settings.SMTP_USER.lower():
        logger.info(f"[SMTP Dev Mode / Mock] Email to {to_email} | Subject: {subject}")
        return

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to_email

    if text_body:
        msg.set_content(text_body)
        msg.add_alternative(html_body, subtype="html")
    else:
        msg.set_content("Please view this email in an HTML-compatible client.")
        msg.add_alternative(html_body, subtype="html")

    try:
        if settings.SMTP_PORT == 465:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
                if settings.SMTP_USER and settings.SMTP_PASS:
                    server.login(settings.SMTP_USER, settings.SMTP_PASS)
                server.send_message(msg)
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()
                if settings.SMTP_USER and settings.SMTP_PASS:
                    server.login(settings.SMTP_USER, settings.SMTP_PASS)
                server.send_message(msg)
    except (smtplib.SMTPConnectError, smtplib.SMTPServerDisconnected, TimeoutError, OSError) as e:
        logger.warning(f"Transient SMTP error sending email to {to_email}: {e}")
        raise TransientEmailError(f"Transient SMTP error: {str(e)}") from e
    except smtplib.SMTPException as e:
        logger.error(f"Permanent SMTP failure for {to_email}: {e}")
        raise PermanentEmailError(f"Permanent SMTP failure: {str(e)}") from e


def process_forgot_password_email(
    db: Session,
    reset_token: str,
    user_id: Optional[str] = None,
    email: Optional[str] = None,
    task_id: Optional[str] = None
) -> bool:
    """Process forgot password email job."""
    # 1. Fetch user canonically from database
    user = None
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
    elif email:
        user = db.query(User).filter(User.email == email.strip().lower()).first()

    if not user:
        raise PermanentEmailError(f"User not found for forgot-password identifier")

    if not user.isActive:
        raise PermanentEmailError(f"User account is inactive")

    user_email = user.email
    user_name = user.name

    # 2. Build Reset URL
    frontend_url = settings.APP_FRONTEND_URL.rstrip("/")
    reset_url = f"{frontend_url}/reset-password?token={reset_token}"

    # 3. Render Template
    html_content = render_email_template(
        "forgot_password.html",
        {
            "user_name": user_name,
            "user_email": user_email,
            "reset_url": reset_url,
            "expiry_minutes": DEFAULT_PASSWORD_RESET_EXPIRY_MINUTES
        }
    )

    # 4. Dispatch Email
    log_task_event(
        task_name="send_forgot_password_email",
        event="sending",
        task_id=task_id,
        extra={"recipient": user_email}
    )

    send_smtp_email(
        to_email=user_email,
        subject="Reset your ShopFastStore password",
        html_body=html_content
    )

    log_task_event(
        task_name="send_forgot_password_email",
        event="sent",
        task_id=task_id,
        extra={"recipient": user_email}
    )
    return True


def process_order_placed_email(
    db: Session,
    order_id: str,
    task_id: Optional[str] = None
) -> bool:
    """Process order placed confirmation email with strict database-backed idempotency."""
    # 1. Check idempotency
    event_type = EVENT_TYPE_ORDER_PLACED
    existing_event = db.query(EmailEvent).filter(
        EmailEvent.order_id == order_id,
        EmailEvent.event_type == event_type
    ).first()

    if existing_event and existing_event.status == "SENT":
        log_task_event(
            task_name="send_order_placed_email",
            event="skipped_duplicate",
            task_id=task_id,
            order_id=order_id
        )
        return True

    # 2. Load canonical order from Postgres
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise OrderNotFoundError(order_id)

    user = order.user
    if not user:
        raise PermanentEmailError(f"No user associated with order {order_id}")

    recipient_email = user.email

    # 3. Create or update pending EmailEvent
    if not existing_event:
        email_event = EmailEvent(
            order_id=order_id,
            event_type=event_type,
            recipient=recipient_email,
            status="PENDING",
            attempts=1
        )
        db.add(email_event)
        db.commit()
    else:
        email_event = existing_event
        email_event.attempts += 1
        db.commit()

    # 4. Build context
    formatted_date = order.createdAt.strftime("%d %B %Y")
    shipping_address_parts = [user.addressLine, user.city, user.postalCode, user.country]
    shipping_address = ", ".join(p for p in shipping_address_parts if p)

    payment_method = "Card" if order.payment else "Cash on Delivery"
    payment_status = order.payment.status.value if (order.payment and hasattr(order.payment.status, 'value')) else (order.payment.status if order.payment else "PENDING")

    items_data = []
    for item in order.items:
        variant_info = ""
        if item.variant and item.variant.variantOptions:
            opts = [vo.optionValue.value for vo in item.variant.variantOptions if vo.optionValue]
            if opts:
                variant_info = ", ".join(opts)

        unit_price = float(item.price)
        total_price = round(unit_price * item.quantity, 2)

        items_data.append({
            "title": item.title,
            "variant_info": variant_info,
            "price": unit_price,
            "quantity": item.quantity,
            "total_price": total_price,
            "image_url": item.imageUrl or "https://placehold.co/100x100?text=Product"
        })

    order_url = f"{settings.APP_FRONTEND_URL.rstrip('/')}/orders/{order.id}"

    html_content = render_email_template(
        "order_placed.html",
        {
            "order_number": order.orderNumber,
            "order_date": formatted_date,
            "order_status": order.status.value if hasattr(order.status, 'value') else str(order.status),
            "customer_name": user.name or "Valued Customer",
            "items": items_data,
            "sub_total": float(order.subTotal),
            "tax": float(order.tax),
            "total_amount": float(order.totalAmount),
            "shipping_address": shipping_address,
            "payment_method": payment_method,
            "payment_status": payment_status,
            "order_url": order_url
        }
    )

    # 5. Send email
    try:
        send_smtp_email(
            to_email=recipient_email,
            subject=f"Order Confirmation #{order.orderNumber} - ShopFast Store",
            html_body=html_content
        )
        email_event.status = "SENT"
        email_event.sent_at = datetime.utcnow()
        email_event.error_message = None
        db.commit()

        log_task_event(
            task_name="send_order_placed_email",
            event="sent",
            task_id=task_id,
            order_id=order_id,
            extra={"recipient": recipient_email}
        )
        return True
    except TransientEmailError as e:
        email_event.status = "FAILED"
        email_event.error_message = str(e)
        db.commit()
        raise


def process_order_status_email(
    db: Session,
    order_id: str,
    previous_status: Optional[str] = None,
    new_status: Optional[str] = None,
    task_id: Optional[str] = None
) -> bool:
    """Process order status change email, ensuring no duplicates per real transition."""
    # 1. Fetch Order
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise OrderNotFoundError(order_id)

    user = order.user
    if not user:
        raise PermanentEmailError(f"No user associated with order {order_id}")

    current_status = order.status.value if hasattr(order.status, "value") else str(order.status)
    target_status = new_status or current_status

    # 2. Check Idempotency for this specific transition
    event_type = f"{EVENT_TYPE_STATUS_PREFIX}:{target_status}"
    existing_event = db.query(EmailEvent).filter(
        EmailEvent.order_id == order_id,
        EmailEvent.event_type == event_type
    ).first()

    if existing_event and existing_event.status == "SENT":
        log_task_event(
            task_name="send_order_status_email",
            event="skipped_duplicate",
            task_id=task_id,
            order_id=order_id,
            extra={"status": target_status}
        )
        return True

    recipient_email = user.email

    if not existing_event:
        email_event = EmailEvent(
            order_id=order_id,
            event_type=event_type,
            recipient=recipient_email,
            status="PENDING",
            attempts=1
        )
        db.add(email_event)
        db.commit()
    else:
        email_event = existing_event
        email_event.attempts += 1
        db.commit()

    human_status_map = {
        "IN_PROGRESS": "in progress",
        "DISPATCHED": "dispatched and on the way",
        "DELIVERED": "delivered",
        "REJECTED": "cancelled"
    }
    human_status = human_status_map.get(target_status, target_status.lower().replace("_", " "))

    order_url = f"{settings.APP_FRONTEND_URL.rstrip('/')}/orders/{order.id}"

    html_content = render_email_template(
        "order_status_changed.html",
        {
            "order_number": order.orderNumber,
            "customer_name": user.name or "Customer",
            "human_status": human_status,
            "new_status": target_status,
            "status_slug": target_status.lower(),
            "updated_date": datetime.utcnow().strftime("%d %B %Y"),
            "total_amount": float(order.totalAmount),
            "items_count": len(order.items),
            "order_url": order_url
        }
    )

    try:
        send_smtp_email(
            to_email=recipient_email,
            subject=f"Update on Order #{order.orderNumber}: {human_status.capitalize()} - ShopFast Store",
            html_body=html_content
        )
        email_event.status = "SENT"
        email_event.sent_at = datetime.utcnow()
        email_event.error_message = None
        db.commit()

        log_task_event(
            task_name="send_order_status_email",
            event="sent",
            task_id=task_id,
            order_id=order_id,
            extra={"status": target_status}
        )
        return True
    except TransientEmailError as e:
        email_event.status = "FAILED"
        email_event.error_message = str(e)
        db.commit()
        raise


def process_cancellation_warning_email(
    db: Session,
    order_id: str,
    task_id: Optional[str] = None
) -> bool:
    """
    Process warning reminder email sent to customer when a card order payment
    remains unresolved approaching the expiration deadline.
    Strictly idempotent: exactly ONE reminder per order.
    """
    event_type = EVENT_TYPE_CANCELLATION_WARNING
    existing_event = db.query(EmailEvent).filter(
        EmailEvent.order_id == order_id,
        EmailEvent.event_type == event_type
    ).first()

    if existing_event and existing_event.status == "SENT":
        log_task_event(
            task_name="send_cancellation_warning_email",
            event="skipped_duplicate",
            task_id=task_id,
            order_id=order_id
        )
        return True

    # Load canonical order
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise OrderNotFoundError(order_id)

    # Must be active card payment order
    if order.status != OrderStatusEnum.IN_PROGRESS:
        logger.info(f"Skipping warning email for order {order_id}: status is {order.status}")
        return False

    if not order.payment or order.payment.status not in [PaymentStatusEnum.PENDING, PaymentStatusEnum.FAILED]:
        logger.info(f"Skipping warning email for order {order_id}: not an unresolved card payment")
        return False

    user = order.user
    if not user:
        raise PermanentEmailError(f"No user associated with order {order_id}")

    recipient_email = user.email

    if not existing_event:
        email_event = EmailEvent(
            order_id=order_id,
            event_type=event_type,
            recipient=recipient_email,
            status="PENDING",
            attempts=1
        )
        db.add(email_event)
        db.commit()
    else:
        email_event = existing_event
        email_event.attempts += 1
        db.commit()

    # Calculate remaining hours
    now = datetime.utcnow()
    payment_time = order.payment.updatedAt or order.payment.createdAt or order.createdAt
    age_hours = (now - payment_time).total_seconds() / 3600.0
    hours_remaining = max(1, int(round(UNPAID_ORDER_REJECTION_HOURS - age_hours)))

    order_url = f"{settings.APP_FRONTEND_URL.rstrip('/')}/orders/{order.id}"

    html_content = render_email_template(
        "cancellation_warning.html",
        {
            "order_number": order.orderNumber,
            "customer_name": user.name or "Customer",
            "total_amount": float(order.totalAmount),
            "items_count": len(order.items),
            "hours_remaining": hours_remaining,
            "order_url": order_url
        }
    )

    try:
        send_smtp_email(
            to_email=recipient_email,
            subject=f"Action Required: Pending Payment for Order #{order.orderNumber} - ShopFast Store",
            html_body=html_content
        )
        email_event.status = "SENT"
        email_event.sent_at = datetime.utcnow()
        email_event.error_message = None
        db.commit()

        log_task_event(
            task_name="send_cancellation_warning_email",
            event="sent",
            task_id=task_id,
            order_id=order_id,
            extra={"recipient": recipient_email, "hours_remaining": hours_remaining}
        )
        return True
    except TransientEmailError as e:
        email_event.status = "FAILED"
        email_event.error_message = str(e)
        db.commit()
        raise


def process_facebook_otp_email(
    email: str,
    otp: str,
    task_id: Optional[str] = None
) -> bool:
    """Process Facebook OAuth email verification OTP job."""
    recipient_email = email.strip().lower()

    # Render Template
    html_content = render_email_template(
        "facebook_otp.html",
        {
            "recipient_email": recipient_email,
            "otp_code": otp
        }
    )

    log_task_event(
        task_name="send_facebook_otp_email",
        event="sending",
        task_id=task_id,
        extra={"recipient": recipient_email}
    )

    send_smtp_email(
        to_email=recipient_email,
        subject="Verify your email for Facebook login - ShopFast Store",
        html_body=html_content
    )

    log_task_event(
        task_name="send_facebook_otp_email",
        event="sent",
        task_id=task_id,
        extra={"recipient": recipient_email}
    )
    return True

