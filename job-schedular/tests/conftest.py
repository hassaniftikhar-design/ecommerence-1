"""Pytest configuration and test fixtures."""

import os
import sys
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Generator
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, JSON
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from sqlalchemy.dialects.postgresql import ARRAY, JSONB

# Ensure app package is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app as fastapi_app
from app.config import get_settings
from app.database import get_db
from app.models.base import Base
from app.models.ecommerce import (
    User,
    Category,
    Product,
    ProductOption,
    ProductOptionValue,
    ProductVariant,
    VariantOption,
    Order,
    OrderItem,
    Payment,
    Notification,
    RoleEnum,
    OrderStatusEnum,
    PaymentStatusEnum
)
from app.models.email_event import EmailEvent
from app.models.import_job import ImportJob, ImportItem, ImportJobStatus, ImportItemStatus

from app.celery_app import celery_app
import app.database

settings = get_settings()

# Use SQLite in-memory database for rapid unit testing
TEST_DATABASE_URL = "sqlite:///:memory:"

# Adapt PostgreSQL ARRAY and JSONB types for SQLite testing
@event.listens_for(Base.metadata, "before_create")
def adapt_postgres_types(target, connection, **kw):
    for table in target.tables.values():
        for column in table.columns:
            if isinstance(column.type, ARRAY):
                column.type = JSON()
            elif isinstance(column.type, JSONB):
                column.type = JSON()


test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Point app.database to test database during tests
app.database.SessionLocal = TestingSessionLocal
app.database.engine = test_engine


@pytest.fixture(scope="session", autouse=True)
def setup_test_celery():
    """Configure Celery eager mode for the test session."""
    celery_app.conf.update(
        task_always_eager=True,
        task_eager_propagates=True
    )


@pytest.fixture(autouse=True)
def mock_smtp_during_tests(monkeypatch):
    """Automatically mock send_smtp_email during test suite to prevent external network timeouts."""
    monkeypatch.setattr("app.services.email_service.send_smtp_email", lambda *args, **kwargs: None)


@pytest.fixture(autouse=True)
def clean_db():
    """Recreate tables before each test for complete isolation."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db() -> Generator[Session, None, None]:
    """Provide a clean database session for each test."""
    session = TestingSessionLocal()
    yield session
    session.close()


@pytest.fixture
def client(db: Session) -> Generator[TestClient, None, None]:
    """FastAPI TestClient with overridden database dependency."""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    fastapi_app.dependency_overrides[get_db] = override_get_db
    with TestClient(fastapi_app) as test_client:
        yield test_client
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def auth_headers() -> dict:
    """Valid authorization headers with bearer token."""
    return {"Authorization": f"Bearer {settings.INTERNAL_SERVICE_TOKEN}"}


@pytest.fixture
def seed_user(db: Session) -> User:
    """Create a sample user in DB."""
    user = User(
        id="user_test_123",
        name="John Doe",
        email="john.doe@example.com",
        phone="+1234567890",
        role=RoleEnum.USER,
        isActive=True,
        addressLine="123 Main St",
        city="Lahore",
        postalCode="54000",
        country="Pakistan"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def seed_admin_user(db: Session) -> User:
    """Create a sample admin user in DB."""
    admin = User(
        id="admin_test_456",
        name="Admin Boss",
        email="admin@example.com",
        phone="+1234567899",
        role=RoleEnum.ADMIN,
        isActive=True
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


@pytest.fixture
def seed_category(db: Session) -> Category:
    """Create a sample category in DB."""
    category = Category(
        id="cat_test_electronics",
        name="Electronics"
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@pytest.fixture
def seed_product_with_variant(db: Session, seed_admin_user: User, seed_category: Category) -> Product:
    """Create a sample product with variant and stock."""
    product = Product(
        id="prod_test_headphones",
        name="Wireless Headphones",
        description="Noise cancelling headphones",
        price=Decimal("150.00"),
        categoryId=seed_category.id,
        createdById=seed_admin_user.id,
        isActive=True
    )
    db.add(product)
    db.flush()

    variant = ProductVariant(
        id="var_test_black",
        productId=product.id,
        sku="SKU-HEADPHONES-BLK",
        stock=50,
        images=["/images/headphones.png"]
    )
    db.add(variant)
    db.commit()
    db.refresh(product)
    return product
