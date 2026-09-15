"""Test suite for transactional email templates, delivery, and idempotency."""

from datetime import datetime
from decimal import Decimal
import pytest
from sqlalchemy.orm import Session

from app.models.ecommerce import (
    User,
    Order,
    OrderItem,
    Payment,
    OrderStatusEnum,
    PaymentStatusEnum
)
from app.models.email_event import EmailEvent
from app.services.email_service import (
    render_email_template,
    process_forgot_password_email,
    process_order_placed_email,
    process_order_status_email,
    process_cancellation_warning_email,
    process_facebook_otp_email
)
from app.constants import EVENT_TYPE_CANCELLATION_WARNING
from app.utils.errors import TransientEmailError, PermanentEmailError, OrderNotFoundError


def test_forgot_password_template_rendering():
    """Verify Jinja2 template rendering for forgot password."""
    rendered = render_email_template(
        "forgot_password.html",
        {
            "user_name": "Alice Smith",
            "user_email": "alice@example.com",
            "reset_url": "http://localhost:3000/reset-password?token=secret123",
            "expiry_minutes": 10
        }
    )
    assert "Alice Smith" in rendered
    assert "alice@example.com" in rendered
    assert "http://localhost:3000/reset-password?token=secret123" in rendered
    assert "10 minutes" in rendered


def test_order_placed_template_rendering():
    """Verify Jinja2 template rendering for order placed confirmation."""
    rendered = render_email_template(
        "order_placed.html",
        {
            "order_number": "987654",
            "order_date": "07 September 2026",
            "order_status": "IN_PROGRESS",
            "customer_name": "Bob Builder",
            "items": [
                {
                    "title": "Smart Watch",
                    "variant_info": "Color: Black",
                    "price": 99.99,
                    "quantity": 2,
                    "total_price": 199.98,
                    "image_url": "/watch.png"
                }
            ],
            "sub_total": 199.98,
            "tax": 10.00,
            "total_amount": 209.98,
            "shipping_address": "456 Oak Lane, Lahore",
            "payment_method": "Card",
            "payment_status": "SUCCEEDED",
            "order_url": "http://localhost:3000/orders/ord_123"
        }
    )
    assert "987654" in rendered
    assert "Bob Builder" in rendered
    assert "Smart Watch" in rendered
    assert "209.98" in rendered
    assert "456 Oak Lane" in rendered


def test_cancellation_warning_template_rendering():
    """Verify Jinja2 template rendering for cancellation warning email."""
    rendered = render_email_template(
        "cancellation_warning.html",
        {
            "order_number": "554433",
            "customer_name": "Charlie Chaplin",
            "total_amount": 129.99,
            "items_count": 3,
            "hours_remaining": 24,
            "order_url": "http://localhost:3000/orders/ord_554433"
        }
    )
    assert "554433" in rendered
    assert "Charlie Chaplin" in rendered
    assert "129.99" in rendered
    assert "24 hours" in rendered
    assert "Complete Payment Now" in rendered


def test_process_forgot_password_email_success(db: Session, seed_user: User, mocker):
    """Test successful forgot-password processing."""
    mock_smtp = mocker.patch("app.services.email_service.send_smtp_email")

    success = process_forgot_password_email(
        db=db,
        reset_token="my_secure_token_abc",
        user_id=seed_user.id
    )

    assert success is True
    mock_smtp.assert_called_once()
    args, kwargs = mock_smtp.call_args
    assert kwargs["to_email"] == seed_user.email
    assert "my_secure_token_abc" in kwargs["html_body"]
    assert "10 minutes" in kwargs["html_body"]


def test_process_forgot_password_email_non_existent_user(db: Session):
    """Test error raised when user cannot be found."""
    with pytest.raises(PermanentEmailError):
        process_forgot_password_email(
            db=db,
            reset_token="some_token",
            user_id="invalid_user_id_999"
        )


def test_process_order_placed_email_with_idempotency(
    db: Session,
    seed_user: User,
    seed_product_with_variant,
    mocker
):
    """Test order placed email creates EmailEvent and respects idempotency on repeat runs."""
    mock_smtp = mocker.patch("app.services.email_service.send_smtp_email")

    order = Order(
        id="order_test_placed_1",
        orderNumber="654321",
        userId=seed_user.id,
        status=OrderStatusEnum.IN_PROGRESS,
        subTotal=Decimal("150.00"),
        tax=Decimal("15.00"),
        totalAmount=Decimal("165.00")
    )
    db.add(order)
    db.flush()

    item = OrderItem(
        id="item_test_1",
        orderId=order.id,
        productId=seed_product_with_variant.id,
        variantId=seed_product_with_variant.variants[0].id,
        title="Wireless Headphones",
        price=Decimal("150.00"),
        quantity=1,
        stock=50,
        imageUrl="/headphones.png"
    )
    db.add(item)

    payment = Payment(
        id="pay_test_1",
        orderId=order.id,
        status=PaymentStatusEnum.SUCCEEDED,
        amount=Decimal("165.00"),
        currency="usd"
    )
    db.add(payment)
    db.commit()

    result1 = process_order_placed_email(db=db, order_id=order.id)
    assert result1 is True
    assert mock_smtp.call_count == 1

    event = db.query(EmailEvent).filter(
        EmailEvent.order_id == order.id,
        EmailEvent.event_type == "ORDER_PLACED"
    ).first()
    assert event is not None
    assert event.status == "SENT"
    assert event.recipient == seed_user.email

    result2 = process_order_placed_email(db=db, order_id=order.id)
    assert result2 is True
    assert mock_smtp.call_count == 1


def test_process_order_status_email_with_idempotency(
    db: Session,
    seed_user: User,
    mocker
):
    """Test order status changed email idempotency per transition."""
    mock_smtp = mocker.patch("app.services.email_service.send_smtp_email")

    order = Order(
        id="order_test_status_1",
        orderNumber="112233",
        userId=seed_user.id,
        status=OrderStatusEnum.DISPATCHED,
        subTotal=Decimal("50.00"),
        tax=Decimal("5.00"),
        totalAmount=Decimal("55.00")
    )
    db.add(order)
    db.commit()

    res1 = process_order_status_email(
        db=db,
        order_id=order.id,
        previous_status="IN_PROGRESS",
        new_status="DISPATCHED"
    )
    assert res1 is True
    assert mock_smtp.call_count == 1

    res2 = process_order_status_email(
        db=db,
        order_id=order.id,
        previous_status="IN_PROGRESS",
        new_status="DISPATCHED"
    )
    assert res2 is True
    assert mock_smtp.call_count == 1

    res3 = process_order_status_email(
        db=db,
        order_id=order.id,
        previous_status="DISPATCHED",
        new_status="DELIVERED"
    )
    assert res3 is True
    assert mock_smtp.call_count == 2


def test_process_cancellation_warning_email_with_idempotency(
    db: Session,
    seed_user: User,
    seed_product_with_variant,
    mocker
):
    """Test cancellation warning email is sent exactly once per order."""
    mock_smtp = mocker.patch("app.services.email_service.send_smtp_email")

    order = Order(
        id="order_test_warning_1",
        orderNumber="778899",
        userId=seed_user.id,
        status=OrderStatusEnum.IN_PROGRESS,
        subTotal=Decimal("100.00"),
        tax=Decimal("10.00"),
        totalAmount=Decimal("110.00")
    )
    db.add(order)
    db.flush()

    payment = Payment(
        id="pay_test_warning_1",
        orderId=order.id,
        status=PaymentStatusEnum.PENDING,
        amount=Decimal("110.00"),
        currency="usd"
    )
    db.add(payment)
    db.commit()

    # First Run: Sent and recorded in EmailEvent
    res1 = process_cancellation_warning_email(db=db, order_id=order.id)
    assert res1 is True
    assert mock_smtp.call_count == 1

    event = db.query(EmailEvent).filter(
        EmailEvent.order_id == order.id,
        EmailEvent.event_type == EVENT_TYPE_CANCELLATION_WARNING
    ).first()
    assert event is not None
    assert event.status == "SENT"

    # Second Run: Skipped (Idempotent)
    res2 = process_cancellation_warning_email(db=db, order_id=order.id)
    assert res2 is True
    assert mock_smtp.call_count == 1


def test_facebook_otp_template_rendering():
    """Verify Jinja2 template rendering for Facebook OAuth OTP."""
    rendered = render_email_template(
        "facebook_otp.html",
        {
            "recipient_email": "facebookuser@example.com",
            "otp_code": "847291"
        }
    )
    assert "facebookuser@example.com" in rendered
    assert "847291" in rendered
    assert "10 minutes" in rendered


def test_process_facebook_otp_email_success(mocker):
    """Test successful Facebook OTP email processing and delivery."""
    mock_smtp = mocker.patch("app.services.email_service.send_smtp_email")

    success = process_facebook_otp_email(
        email="testuser@example.com",
        otp="123456"
    )

    assert success is True
    mock_smtp.assert_called_once()
    args, kwargs = mock_smtp.call_args
    assert kwargs["to_email"] == "testuser@example.com"
    assert "123456" in kwargs["html_body"]
    assert "Verify your email for Facebook login" in kwargs["subject"]

