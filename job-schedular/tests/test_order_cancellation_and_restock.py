"""Test suite for unpaid-order lifecycle, cancellation warning reminder, rejection, and stock restoration."""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Tuple
import pytest
from sqlalchemy.orm import Session

from app.constants import (
    UNPAID_ORDER_REJECTION_HOURS,
    CANCELLATION_WARNING_HOURS_BEFORE,
    EVENT_TYPE_CANCELLATION_WARNING
)
from app.models.ecommerce import (
    User,
    Order,
    OrderItem,
    ProductVariant,
    Payment,
    Notification,
    OrderStatusEnum,
    PaymentStatusEnum
)
from app.models.email_event import EmailEvent
from app.services.order_service import (
    find_orders_needing_cancellation_warning,
    find_expired_unpaid_orders,
    reject_and_restock_order
)


def create_order_with_payment_timestamp(
    db: Session,
    user: User,
    product_with_variant,
    hours_ago: float,
    payment_status: PaymentStatusEnum | None,
    order_status: OrderStatusEnum = OrderStatusEnum.IN_PROGRESS,
    order_id: str = "ord_test_timestamp",
    is_card_payment: bool = True
) -> Tuple[Order, ProductVariant]:
    """Helper to set up order with exact payment age and payment type."""
    timestamp = datetime.utcnow() - timedelta(hours=hours_ago)

    variant = product_with_variant.variants[0]
    initial_stock = variant.stock

    order = Order(
        id=order_id,
        orderNumber=f"ORD-{order_id}",
        userId=user.id,
        status=order_status,
        subTotal=Decimal("150.00"),
        tax=Decimal("15.00"),
        totalAmount=Decimal("165.00"),
        createdAt=timestamp,
        updatedAt=timestamp
    )
    db.add(order)
    db.flush()

    item = OrderItem(
        id=f"item_{order_id}",
        orderId=order.id,
        productId=product_with_variant.id,
        variantId=variant.id,
        title="Wireless Headphones",
        price=Decimal("150.00"),
        quantity=3,
        stock=initial_stock,
        imageUrl="/headphones.png",
        createdAt=timestamp
    )
    db.add(item)

    if is_card_payment and payment_status is not None:
        payment = Payment(
            id=f"pay_{order_id}",
            orderId=order.id,
            status=payment_status,
            amount=Decimal("165.00"),
            currency="usd",
            createdAt=timestamp,
            updatedAt=timestamp
        )
        db.add(payment)

    db.commit()
    db.refresh(order)
    db.refresh(variant)
    return order, variant


def test_unpaid_order_before_warning_window_not_selected(
    db: Session,
    seed_user: User,
    seed_product_with_variant
):
    """Orders younger than warning threshold (e.g. 50h < 96h) should NOT get warning and NOT be rejected."""
    warning_threshold = UNPAID_ORDER_REJECTION_HOURS - CANCELLATION_WARNING_HOURS_BEFORE
    order, variant = create_order_with_payment_timestamp(
        db=db,
        user=seed_user,
        product_with_variant=seed_product_with_variant,
        hours_ago=warning_threshold - 5,
        payment_status=PaymentStatusEnum.PENDING,
        order_id="ord_young"
    )

    warnings = find_orders_needing_cancellation_warning(db)
    expired = find_expired_unpaid_orders(db)

    assert order not in warnings
    assert order not in expired


def test_unpaid_order_in_warning_window_gets_warning(
    db: Session,
    seed_user: User,
    seed_product_with_variant
):
    """Orders in the warning window (>= 96h and < 120h) get selected for cancellation warning email."""
    warning_threshold = UNPAID_ORDER_REJECTION_HOURS - CANCELLATION_WARNING_HOURS_BEFORE
    order, variant = create_order_with_payment_timestamp(
        db=db,
        user=seed_user,
        product_with_variant=seed_product_with_variant,
        hours_ago=warning_threshold + 2,
        payment_status=PaymentStatusEnum.PENDING,
        order_id="ord_warning_eligible"
    )

    warnings = find_orders_needing_cancellation_warning(db)
    expired = find_expired_unpaid_orders(db)

    assert order in warnings
    assert order not in expired


def test_warning_email_not_sent_twice(
    db: Session,
    seed_user: User,
    seed_product_with_variant
):
    """Once a warning email has been sent, it is not selected on subsequent Beat runs."""
    warning_threshold = UNPAID_ORDER_REJECTION_HOURS - CANCELLATION_WARNING_HOURS_BEFORE
    order, variant = create_order_with_payment_timestamp(
        db=db,
        user=seed_user,
        product_with_variant=seed_product_with_variant,
        hours_ago=warning_threshold + 5,
        payment_status=PaymentStatusEnum.PENDING,
        order_id="ord_warning_duplicate_check"
    )

    # First run: eligible
    warnings1 = find_orders_needing_cancellation_warning(db)
    assert order in warnings1

    # Simulate EmailEvent SENT
    event = EmailEvent(
        order_id=order.id,
        event_type=EVENT_TYPE_CANCELLATION_WARNING,
        recipient=seed_user.email,
        status="SENT"
    )
    db.add(event)
    db.commit()

    # Second run: skipped because EmailEvent exists
    warnings2 = find_orders_needing_cancellation_warning(db)
    assert order not in warnings2


def test_cod_orders_are_never_warned_or_auto_rejected(
    db: Session,
    seed_user: User,
    seed_product_with_variant
):
    """Cash on Delivery orders (no Payment record) must never be auto-rejected or sent warning emails."""
    order_cod, _ = create_order_with_payment_timestamp(
        db=db,
        user=seed_user,
        product_with_variant=seed_product_with_variant,
        hours_ago=UNPAID_ORDER_REJECTION_HOURS + 50,
        payment_status=None,
        is_card_payment=False,
        order_id="ord_cod_1"
    )

    warnings = find_orders_needing_cancellation_warning(db)
    expired = find_expired_unpaid_orders(db)

    assert order_cod not in warnings
    assert order_cod not in expired


def test_unpaid_order_at_deadline_rejected_and_restocked(
    db: Session,
    seed_user: User,
    seed_product_with_variant
):
    """At deadline (>= 120h), order is rejected (status REJECTED), stock is restored, rows remain in DB."""
    initial_stock = seed_product_with_variant.variants[0].stock
    order, variant = create_order_with_payment_timestamp(
        db=db,
        user=seed_user,
        product_with_variant=seed_product_with_variant,
        hours_ago=UNPAID_ORDER_REJECTION_HOURS,
        payment_status=PaymentStatusEnum.PENDING,
        order_id="ord_at_deadline"
    )

    expired = find_expired_unpaid_orders(db)
    assert order in expired

    # Execute shared reject logic
    success = reject_and_restock_order(db=db, order=order)
    db.commit()

    assert success is True
    db.refresh(order)
    db.refresh(variant)

    # Soft delete verification: Order row and items still exist
    assert order.status == OrderStatusEnum.REJECTED
    assert order.payment.status == PaymentStatusEnum.FAILED
    assert len(order.items) == 1
    assert variant.stock == initial_stock + 3  # Restocked!

    # Verify notification created
    notif = db.query(Notification).filter(Notification.orderId == order.id).first()
    assert notif is not None
    assert "Cancelled" in notif.title


def test_admin_and_beat_paths_share_identical_side_effects(
    db: Session,
    seed_user: User,
    seed_product_with_variant
):
    """Both admin manual rejection and Beat auto-rejection execute identical state changes and restock."""
    initial_stock = seed_product_with_variant.variants[0].stock

    # Admin path simulation
    order_admin, variant_admin = create_order_with_payment_timestamp(
        db=db,
        user=seed_user,
        product_with_variant=seed_product_with_variant,
        hours_ago=10,
        payment_status=PaymentStatusEnum.PENDING,
        order_id="ord_admin_reject"
    )

    reject_and_restock_order(db=db, order=order_admin, reason="Admin manually rejected order")
    db.commit()
    db.refresh(order_admin)
    db.refresh(variant_admin)

    # Beat path simulation
    order_beat, variant_beat = create_order_with_payment_timestamp(
        db=db,
        user=seed_user,
        product_with_variant=seed_product_with_variant,
        hours_ago=UNPAID_ORDER_REJECTION_HOURS + 1,
        payment_status=PaymentStatusEnum.PENDING,
        order_id="ord_beat_reject"
    )

    reject_and_restock_order(db=db, order=order_beat, reason="Unpaid expiration deadline reached")
    db.commit()
    db.refresh(order_beat)
    db.refresh(variant_beat)

    # Compare side-effects
    assert order_admin.status == order_beat.status == OrderStatusEnum.REJECTED
    assert order_admin.payment.status == order_beat.payment.status == PaymentStatusEnum.FAILED
    assert variant_admin.stock == initial_stock + 6  # Cumulative 3 + 3 units restocked on shared variant
    assert variant_beat.stock == initial_stock + 6


def test_double_run_idempotency(
    db: Session,
    seed_user: User,
    seed_product_with_variant
):
    """Executing reject_and_restock_order twice on same order does not double-restock."""
    initial_stock = seed_product_with_variant.variants[0].stock
    order, variant = create_order_with_payment_timestamp(
        db=db,
        user=seed_user,
        product_with_variant=seed_product_with_variant,
        hours_ago=UNPAID_ORDER_REJECTION_HOURS + 10,
        payment_status=PaymentStatusEnum.FAILED,
        order_id="ord_double_run"
    )

    # First run
    expired1 = find_expired_unpaid_orders(db)
    assert len(expired1) == 1
    res1 = reject_and_restock_order(db=db, order=expired1[0])
    db.commit()
    assert res1 is True
    db.refresh(variant)
    assert variant.stock == initial_stock + 3

    # Second run
    expired2 = find_expired_unpaid_orders(db)
    assert len(expired2) == 0  # Ignored because status is REJECTED
    res2 = reject_and_restock_order(db=db, order=order)
    assert res2 is False  # Guard skips already rejected order
    db.refresh(variant)
    assert variant.stock == initial_stock + 3  # Stock unchanged!


def test_dynamic_rejection_hours_override(
    db: Session,
    seed_user: User,
    seed_product_with_variant,
    monkeypatch
):
    """Lowering UNPAID_ORDER_REJECTION_HOURS dynamically is honored by the query logic."""
    # Temporarily set rejection hours to 2 hours for fast testing
    monkeypatch.setattr("app.services.order_service.UNPAID_ORDER_REJECTION_HOURS", 2)

    order, variant = create_order_with_payment_timestamp(
        db=db,
        user=seed_user,
        product_with_variant=seed_product_with_variant,
        hours_ago=3,
        payment_status=PaymentStatusEnum.PENDING,
        order_id="ord_custom_2h"
    )

    expired = find_expired_unpaid_orders(db)
    assert order in expired
