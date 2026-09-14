"""SQLAlchemy mapped models reflecting the Prisma schema in PostgreSQL."""

import enum
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    Numeric,
    Integer,
    ForeignKey,
    Text,
    Enum as SAEnum,
    UniqueConstraint
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import relationship

from app.models.base import Base


class RoleEnum(str, enum.Enum):
    USER = "USER"
    ADMIN = "ADMIN"


class OrderStatusEnum(str, enum.Enum):
    IN_PROGRESS = "IN_PROGRESS"
    DISPATCHED = "DISPATCHED"
    DELIVERED = "DELIVERED"
    REJECTED = "REJECTED"


class PaymentStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"
    PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED"


class User(Base):
    __tablename__ = "User"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    phone = Column(String, nullable=True)
    password = Column(String, nullable=True)
    role = Column(SAEnum(RoleEnum, name="Role", create_type=False), default=RoleEnum.USER, nullable=False)
    emailVerified = Column(DateTime, nullable=True)
    isActive = Column(Boolean, default=True, nullable=False)

    resetToken = Column(String, nullable=True)
    resetTokenExpires = Column(DateTime, nullable=True)

    stripeCustomerId = Column(String, unique=True, nullable=True)

    addressLine = Column(String, default="", nullable=True)
    city = Column(String, default="", nullable=True)
    postalCode = Column(String, default="", nullable=True)
    country = Column(String, default="", nullable=True)

    createdAt = Column(DateTime, default=datetime.utcnow, nullable=False)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    orders = relationship("Order", back_populates="user", cascade="all, delete-orphan")
    products = relationship("Product", back_populates="createdBy")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "Category"

    id = Column(String, primary_key=True)
    name = Column(String, unique=True, nullable=False)

    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "Product"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    price = Column(Numeric(10, 2), default=0.00, nullable=False)

    categoryId = Column(String, ForeignKey("Category.id"), nullable=False)
    category = relationship("Category", back_populates="products")

    createdById = Column(String, ForeignKey("User.id"), nullable=False)
    createdBy = relationship("User", back_populates="products")

    isActive = Column(Boolean, default=True, nullable=False)
    inactiveAt = Column(DateTime, nullable=True)

    options = relationship("ProductOption", back_populates="product", cascade="all, delete-orphan")
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    orderItems = relationship("OrderItem", back_populates="product")

    createdAt = Column(DateTime, default=datetime.utcnow, nullable=False)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class ProductOption(Base):
    __tablename__ = "ProductOption"

    id = Column(String, primary_key=True)
    productId = Column(String, ForeignKey("Product.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)

    product = relationship("Product", back_populates="options")
    values = relationship("ProductOptionValue", back_populates="option", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("productId", "name", name="ProductOption_productId_name_key"),
    )


class ProductOptionValue(Base):
    __tablename__ = "ProductOptionValue"

    id = Column(String, primary_key=True)
    optionId = Column(String, ForeignKey("ProductOption.id", ondelete="CASCADE"), nullable=False)
    value = Column(String, nullable=False)

    option = relationship("ProductOption", back_populates="values")
    variantOptions = relationship("VariantOption", back_populates="optionValue", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("optionId", "value", name="ProductOptionValue_optionId_value_key"),
    )


class ProductVariant(Base):
    __tablename__ = "ProductVariant"

    id = Column(String, primary_key=True)
    productId = Column(String, ForeignKey("Product.id", ondelete="CASCADE"), nullable=False)
    sku = Column(String, unique=True, nullable=False)
    stock = Column(Integer, nullable=False, default=0)
    images = Column(ARRAY(String), default=list, nullable=False)

    product = relationship("Product", back_populates="variants")
    variantOptions = relationship("VariantOption", back_populates="variant", cascade="all, delete-orphan")
    orderItems = relationship("OrderItem", back_populates="variant")

    createdAt = Column(DateTime, default=datetime.utcnow, nullable=False)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class VariantOption(Base):
    __tablename__ = "VariantOption"

    id = Column(String, primary_key=True)
    variantId = Column(String, ForeignKey("ProductVariant.id", ondelete="CASCADE"), nullable=False)
    optionValueId = Column(String, ForeignKey("ProductOptionValue.id", ondelete="CASCADE"), nullable=False)

    variant = relationship("ProductVariant", back_populates="variantOptions")
    optionValue = relationship("ProductOptionValue", back_populates="variantOptions")

    __table_args__ = (
        UniqueConstraint("variantId", "optionValueId", name="VariantOption_variantId_optionValueId_key"),
    )


class Order(Base):
    __tablename__ = "Order"

    id = Column(String, primary_key=True)
    orderNumber = Column(String, unique=True, nullable=False)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    status = Column(
        SAEnum(OrderStatusEnum, name="OrderStatus", create_type=False),
        default=OrderStatusEnum.IN_PROGRESS,
        nullable=False
    )
    subTotal = Column(Numeric(10, 2), nullable=False)
    tax = Column(Numeric(10, 2), nullable=False)
    totalAmount = Column(Numeric(10, 2), nullable=False)

    createdAt = Column(DateTime, default=datetime.utcnow, nullable=False)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    payment = relationship("Payment", back_populates="order", uselist=False, cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "OrderItem"

    id = Column(String, primary_key=True)
    orderId = Column(String, ForeignKey("Order.id", ondelete="CASCADE"), nullable=False)
    productId = Column(String, ForeignKey("Product.id"), nullable=False)
    variantId = Column(String, ForeignKey("ProductVariant.id"), nullable=True)

    title = Column(String, nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    quantity = Column(Integer, nullable=False)
    stock = Column(Integer, default=0, nullable=False)
    imageUrl = Column(String, nullable=False)

    createdAt = Column(DateTime, default=datetime.utcnow, nullable=False)

    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="orderItems")
    variant = relationship("ProductVariant", back_populates="orderItems")


class Payment(Base):
    __tablename__ = "Payment"

    id = Column(String, primary_key=True)
    orderId = Column(String, ForeignKey("Order.id", ondelete="CASCADE"), unique=True, nullable=False)
    status = Column(
        SAEnum(PaymentStatusEnum, name="PaymentStatus", create_type=False),
        default=PaymentStatusEnum.PENDING,
        nullable=False
    )
    stripePaymentIntentId = Column(String, unique=True, nullable=True)
    stripePaymentMethodId = Column(String, nullable=True)
    stripeCustomerId = Column(String, nullable=True)
    idempotencyKey = Column(String, unique=True, nullable=True)
    attemptCount = Column(Integer, default=1, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String, default="usd", nullable=False)
    paidAt = Column(DateTime, nullable=True)
    refundedAt = Column(DateTime, nullable=True)
    errorMessage = Column(String, nullable=True)
    rawErrorCode = Column(String, nullable=True)

    createdAt = Column(DateTime, default=datetime.utcnow, nullable=False)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    order = relationship("Order", back_populates="payment")


class Notification(Base):
    __tablename__ = "Notification"

    id = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    type = Column(String, nullable=False)
    orderId = Column(String, nullable=True)
    isRead = Column(Boolean, default=False, nullable=False)

    createdAt = Column(DateTime, default=datetime.utcnow, nullable=False)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="notifications")
