"""Test suite for bulk product import, validation, partial failures, and progress tracking."""

from decimal import Decimal
import uuid
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.ecommerce import User, Product, Category
from app.models.import_job import ImportJob, ImportJobStatus, ImportItemStatus
from app.services.import_service import (
    create_import_job,
    process_import_job
)
from app.schemas.import_schemas import ProductImportItemSchema


def test_bulk_product_import_full_success(
    db: Session,
    seed_admin_user: User,
    seed_category: Category
):
    """Test full successful import of multiple valid products with options and variants."""
    products = [
        ProductImportItemSchema(
            name="Mechanical Keyboard",
            description="RGB mechanical keyboard",
            price=Decimal("89.99"),
            categoryName=seed_category.name,
            stock=20,
            imageUrl="/images/keyboard.png"
        ),
        ProductImportItemSchema(
            name="Gaming Mouse",
            description="Ultra lightweight mouse",
            price=Decimal("49.99"),
            categoryName=seed_category.name,
            options=[{"name": "Color", "values": ["Black", "White"]}],
            variants=[
                {"sku": "SKU-GM-BLK-001", "stock": 15, "attributes": {"Color": "Black"}},
                {"sku": "SKU-GM-WHT-001", "stock": 10, "attributes": {"Color": "White"}}
            ]
        )
    ]

    job = create_import_job(db=db, created_by_id=seed_admin_user.id, products_data=products)
    assert job.status == ImportJobStatus.QUEUED.value
    assert job.total_items == 2

    # Execute processing
    processed_job = process_import_job(db=db, job_id=job.id)

    assert processed_job.status == ImportJobStatus.COMPLETED.value
    assert processed_job.successful_items == 2
    assert processed_job.failed_items == 0
    assert processed_job.processed_items == 2

    # Verify created products in DB
    created_prod = db.query(Product).filter(Product.name == "Gaming Mouse").first()
    assert created_prod is not None
    assert len(created_prod.variants) == 2
    assert len(created_prod.options) == 1


def test_bulk_product_import_partial_failure(
    db: Session,
    seed_admin_user: User,
    seed_category: Category
):
    """Test partial success where valid items succeed and invalid items fail without rolling back the entire batch."""
    # Seed required categories
    cat_displays = Category(id=str(uuid.uuid4()), name="Displays")
    cat_accessories = Category(id=str(uuid.uuid4()), name="Accessories")
    db.add_all([cat_displays, cat_accessories])
    db.commit()

    products = [
        ProductImportItemSchema(
            name="Valid Monitor",
            price=Decimal("250.00"),
            categoryName="Displays",
            stock=10
        ),
        ProductImportItemSchema(
            name="",  # Invalid: empty name
            price=Decimal("100.00"),
            categoryName="Displays",
            stock=5
        ),
        ProductImportItemSchema(
            name="Valid Webcam",
            price=Decimal("75.00"),
            categoryName="Accessories",
            stock=15
        )
    ]

    job = create_import_job(db=db, created_by_id=seed_admin_user.id, products_data=products)
    processed_job = process_import_job(db=db, job_id=job.id)

    assert processed_job.status == ImportJobStatus.COMPLETED_WITH_ERRORS.value
    assert processed_job.successful_items == 2
    assert processed_job.failed_items == 1
    assert processed_job.processed_items == 3

    # Check that the 2 valid products were created
    assert db.query(Product).filter(Product.name == "Valid Monitor").first() is not None
    assert db.query(Product).filter(Product.name == "Valid Webcam").first() is not None


def test_bulk_product_import_non_existent_category_fails(
    db: Session,
    seed_admin_user: User
):
    """Importing with non-existent category fails."""
    products = [
        ProductImportItemSchema(
            name="Mystery Item",
            price=Decimal("50.00"),
            categoryName="UnlistedCategory"
        )
    ]

    job = create_import_job(db=db, created_by_id=seed_admin_user.id, products_data=products)
    processed_job = process_import_job(db=db, job_id=job.id)

    assert processed_job.status == ImportJobStatus.COMPLETED_WITH_ERRORS.value
    assert processed_job.failed_items == 1
    assert "does not exist" in processed_job.items[0].error_message


def test_bulk_product_import_duplicate_sku_protection(
    db: Session,
    seed_admin_user: User,
    seed_product_with_variant
):
    """Duplicate SKU in import payload should fail that specific product row."""
    existing_sku = seed_product_with_variant.variants[0].sku

    cat_general = Category(id=str(uuid.uuid4()), name="General")
    db.add(cat_general)
    db.commit()

    products = [
        ProductImportItemSchema(
            name="Duplicate Product",
            price=Decimal("30.00"),
            categoryName="General",
            variants=[{"sku": existing_sku, "stock": 5}]
        )
    ]

    job = create_import_job(db=db, created_by_id=seed_admin_user.id, products_data=products)
    processed_job = process_import_job(db=db, job_id=job.id)

    assert processed_job.status == ImportJobStatus.COMPLETED_WITH_ERRORS.value
    assert processed_job.failed_items == 1
    assert "already exists" in processed_job.items[0].error_message


def test_import_job_progress_api_endpoint(
    client: TestClient,
    auth_headers: dict,
    db: Session,
    seed_admin_user: User
):
    """Test GET /jobs/product-import/{job_id} returns accurate progress and row-level errors."""
    cat_a = Category(id=str(uuid.uuid4()), name="Cat A")
    cat_b = Category(id=str(uuid.uuid4()), name="Cat B")
    db.add_all([cat_a, cat_b])
    db.commit()

    products = [
        ProductImportItemSchema(name="Item 1", price=Decimal("10.00"), categoryName="Cat A", stock=10),
        ProductImportItemSchema(name="", price=Decimal("10.00"), categoryName="Cat B", stock=5)
    ]

    job = create_import_job(db=db, created_by_id=seed_admin_user.id, products_data=products)
    process_import_job(db=db, job_id=job.id)

    response = client.get(f"/jobs/product-import/{job.id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()

    assert data["id"] == job.id
    assert data["status"] == ImportJobStatus.COMPLETED_WITH_ERRORS.value
    assert data["total_items"] == 2
    assert data["successful_items"] == 1
    assert data["failed_items"] == 1
    assert len(data["errors"]) == 1
    assert data["errors"][0]["row_index"] == 2


def test_case_sensitive_product_titles_can_coexist(
    db: Session,
    seed_admin_user: User,
    seed_category: Category
):
    """Verify 'jacket', 'Jacket', and 'JACKET' are treated as 3 separate products and coexist in DB."""
    products = [
        ProductImportItemSchema(name="jacket", price=Decimal("1000.00"), categoryName=seed_category.name, stock=5),
        ProductImportItemSchema(name="Jacket", price=Decimal("1000.00"), categoryName=seed_category.name, stock=5),
        ProductImportItemSchema(name="JACKET", price=Decimal("1000.00"), categoryName=seed_category.name, stock=5)
    ]

    job = create_import_job(db=db, created_by_id=seed_admin_user.id, products_data=products)
    processed_job = process_import_job(db=db, job_id=job.id)

    assert processed_job.status == ImportJobStatus.COMPLETED.value
    assert processed_job.successful_items == 3

    # Check that 3 distinct products exist in the database with exact case preserved
    prod_lower = db.query(Product).filter(Product.name == "jacket").first()
    prod_title = db.query(Product).filter(Product.name == "Jacket").first()
    prod_upper = db.query(Product).filter(Product.name == "JACKET").first()

    assert prod_lower is not None
    assert prod_title is not None
    assert prod_upper is not None
    assert prod_lower.id != prod_title.id
    assert prod_title.id != prod_upper.id
    assert prod_lower.id != prod_upper.id


def test_retry_idempotency_full_success_does_not_duplicate(
    db: Session,
    seed_admin_user: User,
    seed_category: Category
):
    """Retrying a completed job skips already successful items and creates 0 duplicates."""
    products = [
        ProductImportItemSchema(name="T-Shirt Alpha", price=Decimal("25.00"), categoryName=seed_category.name, stock=10),
        ProductImportItemSchema(name="T-Shirt Beta", price=Decimal("30.00"), categoryName=seed_category.name, stock=15)
    ]

    job = create_import_job(db=db, created_by_id=seed_admin_user.id, products_data=products)
    processed_1 = process_import_job(db=db, job_id=job.id)
    assert processed_1.status == ImportJobStatus.COMPLETED.value
    assert processed_1.successful_items == 2

    # Record product count before retry
    count_before = db.query(Product).filter(Product.name.in_(["T-Shirt Alpha", "T-Shirt Beta"])).count()
    assert count_before == 2

    # Retry the job
    processed_2 = process_import_job(db=db, job_id=job.id)
    assert processed_2.status == ImportJobStatus.COMPLETED.value
    assert processed_2.successful_items == 2
    assert processed_2.failed_items == 0

    # Ensure count remains 2 (0 duplicates created)
    count_after = db.query(Product).filter(Product.name.in_(["T-Shirt Alpha", "T-Shirt Beta"])).count()
    assert count_after == 2


def test_retry_idempotency_partial_failure_processes_only_unfinished(
    db: Session,
    seed_admin_user: User
):
    """Retrying a partial-failure job skips successful items and processes only unfinished items."""
    cat_clothing = Category(id=str(uuid.uuid4()), name="Clothing")
    db.add(cat_clothing)
    db.commit()

    products = [
        ProductImportItemSchema(name="Item Good 1", price=Decimal("20.00"), categoryName="Clothing", stock=10),
        ProductImportItemSchema(name="Item Good 2", price=Decimal("25.00"), categoryName="Clothing", stock=15),
        ProductImportItemSchema(name="Item Fail 3", price=Decimal("30.00"), categoryName="PendingCategory", stock=5)
    ]

    job = create_import_job(db=db, created_by_id=seed_admin_user.id, products_data=products)
    processed_1 = process_import_job(db=db, job_id=job.id)

    assert processed_1.status == ImportJobStatus.COMPLETED_WITH_ERRORS.value
    assert processed_1.successful_items == 2
    assert processed_1.failed_items == 1

    good1_prod = db.query(Product).filter(Product.name == "Item Good 1").first()
    assert good1_prod is not None
    original_good1_id = good1_prod.id

    # Fix the missing category condition
    cat_pending = Category(id=str(uuid.uuid4()), name="PendingCategory")
    db.add(cat_pending)
    db.commit()

    # Retry the job
    processed_2 = process_import_job(db=db, job_id=job.id)
    assert processed_2.status == ImportJobStatus.COMPLETED.value
    assert processed_2.successful_items == 3
    assert processed_2.failed_items == 0

    # Item Good 1 was not recreated
    good1_prod_after = db.query(Product).filter(Product.name == "Item Good 1").first()
    assert good1_prod_after.id == original_good1_id
    assert db.query(Product).filter(Product.name == "Item Good 1").count() == 1

    # Item Fail 3 is now created
    fail3_prod = db.query(Product).filter(Product.name == "Item Fail 3").first()
    assert fail3_prod is not None


def test_process_bulk_import_celery_task_success(
    db: Session,
    seed_admin_user: User,
    seed_category: Category
):
    """Verify Celery task execution returns serializable dictionary without DetachedInstanceError."""
    from app.tasks.import_tasks import process_bulk_import_task

    products = [
        ProductImportItemSchema(name="Celery Keyboard", price=Decimal("99.99"), categoryName=seed_category.name, stock=10)
    ]
    job = create_import_job(db=db, created_by_id=seed_admin_user.id, products_data=products)

    # Invoke Celery task function directly
    result = process_bulk_import_task(job_id=job.id)

    assert isinstance(result, dict)
    assert result["status"] == ImportJobStatus.COMPLETED.value
    assert result["job_id"] == job.id
    assert result["total"] == 1
    assert result["successful"] == 1
    assert result["failed"] == 0


def test_import_existing_product_increments_matching_variant_stock(
    db: Session,
    seed_admin_user: User,
    seed_category: Category
):
    """If product with same title and category exists, increment stock on matching variants."""
    from app.schemas.import_schemas import ProductOptionImportSchema, ProductVariantImportSchema

    # 1. First import: Product with Black/M (stock 10)
    item_1 = ProductImportItemSchema(
        name="Signature Hoodie",
        price=Decimal("59.99"),
        categoryName=seed_category.name,
        options=[
            ProductOptionImportSchema(name="Color", values=["Black"]),
            ProductOptionImportSchema(name="Size", values=["M"])
        ],
        variants=[
            ProductVariantImportSchema(attributes={"Color": "Black", "Size": "M"}, stock=10, images=["hoodie_black.jpg"])
        ]
    )

    job1 = create_import_job(db=db, created_by_id=seed_admin_user.id, products_data=[item_1])
    res1 = process_import_job(db=db, job_id=job1.id)
    assert res1.status == ImportJobStatus.COMPLETED.value

    prod = db.query(Product).filter(Product.name == "Signature Hoodie").first()
    assert prod is not None
    assert len(prod.variants) == 1
    assert prod.variants[0].stock == 10

    # 2. Second import: Same Product with Black/M (stock 15) and new image
    item_2 = ProductImportItemSchema(
        name="Signature Hoodie",
        price=Decimal("59.99"),
        categoryName=seed_category.name,
        options=[
            ProductOptionImportSchema(name="Color", values=["Black"]),
            ProductOptionImportSchema(name="Size", values=["M"])
        ],
        variants=[
            ProductVariantImportSchema(attributes={"Color": "Black", "Size": "M"}, stock=15, images=["hoodie_black_back.jpg"])
        ]
    )

    job2 = create_import_job(db=db, created_by_id=seed_admin_user.id, products_data=[item_2])
    res2 = process_import_job(db=db, job_id=job2.id)
    assert res2.status == ImportJobStatus.COMPLETED.value

    # Refresh product and check: still 1 product, 1 variant, stock is 25, both images present
    db.refresh(prod)
    assert db.query(Product).filter(Product.name == "Signature Hoodie").count() == 1
    assert len(prod.variants) == 1
    assert prod.variants[0].stock == 25
    assert len(prod.variants[0].images) > 0


def test_import_existing_product_appends_new_variant(
    db: Session,
    seed_admin_user: User,
    seed_category: Category
):
    """If product exists but incoming variant has new specs (e.g. Red/L), append it to the product."""
    from app.schemas.import_schemas import ProductOptionImportSchema, ProductVariantImportSchema

    # Initial import: Black/M
    item_1 = ProductImportItemSchema(
        name="Running Shorts",
        price=Decimal("29.99"),
        categoryName=seed_category.name,
        options=[
            ProductOptionImportSchema(name="Color", values=["Black"]),
            ProductOptionImportSchema(name="Size", values=["M"])
        ],
        variants=[
            ProductVariantImportSchema(attributes={"Color": "Black", "Size": "M"}, stock=20)
        ]
    )
    job1 = create_import_job(db=db, created_by_id=seed_admin_user.id, products_data=[item_1])
    process_import_job(db=db, job_id=job1.id)

    # Second import: Red/L for same product
    item_2 = ProductImportItemSchema(
        name="Running Shorts",
        price=Decimal("29.99"),
        categoryName=seed_category.name,
        options=[
            ProductOptionImportSchema(name="Color", values=["Red"]),
            ProductOptionImportSchema(name="Size", values=["L"])
        ],
        variants=[
            ProductVariantImportSchema(attributes={"Color": "Red", "Size": "L"}, stock=12)
        ]
    )
    job2 = create_import_job(db=db, created_by_id=seed_admin_user.id, products_data=[item_2])
    res2 = process_import_job(db=db, job_id=job2.id)
    assert res2.status == ImportJobStatus.COMPLETED.value

    # Product should now have 2 variants
    prod = db.query(Product).filter(Product.name == "Running Shorts").first()
    assert prod is not None
    assert len(prod.variants) == 2
    total_stock = sum(v.stock for v in prod.variants)
    assert total_stock == 32


def test_import_standard_product_no_color_no_size_and_increments_stock(
    db: Session,
    seed_admin_user: User,
    seed_category: Category
):
    """Standard product (no color, no size) is imported with no options, and subsequent import increments stock."""
    from app.schemas.import_schemas import ProductVariantImportSchema

    item_1 = ProductImportItemSchema(
        name="Ceramic Coffee Mug",
        price=Decimal("14.50"),
        categoryName=seed_category.name,
        options=[],
        variants=[
            ProductVariantImportSchema(attributes={}, stock=30, images=["mug_front.jpg"])
        ]
    )
    job1 = create_import_job(db=db, created_by_id=seed_admin_user.id, products_data=[item_1])
    process_import_job(db=db, job_id=job1.id)

    prod = db.query(Product).filter(Product.name == "Ceramic Coffee Mug").first()
    assert prod is not None
    assert len(prod.options) == 0
    assert len(prod.variants) == 1
    assert prod.variants[0].stock == 30

    # Second import with 20 additional stock
    item_2 = ProductImportItemSchema(
        name="Ceramic Coffee Mug",
        price=Decimal("14.50"),
        categoryName=seed_category.name,
        options=[],
        variants=[
            ProductVariantImportSchema(attributes={}, stock=20, images=["mug_side.jpg"])
        ]
    )
    job2 = create_import_job(db=db, created_by_id=seed_admin_user.id, products_data=[item_2])
    process_import_job(db=db, job_id=job2.id)

    db.refresh(prod)
    assert len(prod.variants) == 1
    assert prod.variants[0].stock == 50
    assert len(prod.variants[0].images) > 0


def test_file_based_bulk_product_import_from_csv(
    db: Session,
    seed_admin_user: User,
    seed_category: Category,
    tmp_path
):
    """Test importing products directly from a CSV file via create_file_import_job and process_import_job."""
    from app.services.import_service import create_file_import_job
    csv_file = tmp_path / "test_products.csv"
    csv_content = (
        "title,price,category,color,size,stock,sku,imagePath,description\n"
        f"Wireless Headphones,99.99,{seed_category.name},Black,Standard,25,SKU-WH-001,headphones.jpg,Noise cancelling\n"
        f"Wireless Headphones,99.99,{seed_category.name},White,Standard,15,SKU-WH-002,headphones_w.jpg,Noise cancelling\n"
        f"Smart Watch,199.99,{seed_category.name},Black,M,10,SKU-SW-001,watch.jpg,Fitness tracker\n"
    )
    csv_file.write_text(csv_content, encoding="utf-8")

    job = create_file_import_job(
        db=db,
        created_by_id=seed_admin_user.id,
        filename="test_products.csv",
        csv_path=str(csv_file)
    )
    assert job.status == ImportJobStatus.QUEUED.value

    processed_job = process_import_job(db=db, job_id=job.id)
    assert processed_job.status == ImportJobStatus.COMPLETED.value
    assert processed_job.total_items == 2  # 2 grouped products: Wireless Headphones & Smart Watch
    assert processed_job.successful_items == 2
    assert processed_job.failed_items == 0
    assert processed_job.completed_at is not None

    # Verify Wireless Headphones has 2 variants
    headphones = db.query(Product).filter(Product.name == "Wireless Headphones").first()
    assert headphones is not None
    assert len(headphones.variants) == 2
    assert headphones.isActive is True


def test_file_based_bulk_import_with_errors_creates_admin_notification(
    db: Session,
    seed_admin_user: User,
    seed_category: Category,
    tmp_path
):
    """Test that failed products in a file import result in COMPLETED_WITH_ERRORS and create an admin notification."""
    from app.services.import_service import create_file_import_job
    from app.models.ecommerce import Notification

    csv_file = tmp_path / "flawed_products.csv"
    csv_content = (
        "title,price,category,color,size,stock,sku,imagePath,description\n"
        f"Valid Backpack,49.99,{seed_category.name},Blue,L,20,SKU-BP-001,bag.jpg,Durable pack\n"
        "Broken Backpack,49.99,NonExistentCategory,Blue,L,10,SKU-BP-002,bag2.jpg,Broken category\n"
    )
    csv_file.write_text(csv_content, encoding="utf-8")

    job = create_file_import_job(
        db=db,
        created_by_id=seed_admin_user.id,
        filename="flawed_products.csv",
        csv_path=str(csv_file)
    )

    processed_job = process_import_job(db=db, job_id=job.id)
    assert processed_job.status == ImportJobStatus.COMPLETED_WITH_ERRORS.value
    assert processed_job.successful_items == 1
    assert processed_job.failed_items == 1

    # Verify admin notification was created in PostgreSQL
    notif = db.query(Notification).filter(
        Notification.userId == seed_admin_user.id,
        Notification.type == "IMPORT_ERRORS"
    ).first()
    assert notif is not None
    assert "flawed_products.csv" in notif.message
    assert notif.orderId == job.id


def test_case_sensitive_jacket_titles_distinct_products(
    db: Session,
    seed_admin_user: User,
    seed_category: Category,
    tmp_path
):
    """Verify that 'jacket', 'Jacket', and 'JACKET' are treated as three distinct products."""
    from app.services.import_service import create_file_import_job

    csv_file = tmp_path / "jackets.csv"
    csv_content = (
        "title,price,category,color,size,stock,sku,imagePath,description\n"
        f"jacket,100.00,{seed_category.name},Black,M,10,SKU-JKT-1,,Lower jacket\n"
        f"Jacket,100.00,{seed_category.name},Black,M,10,SKU-JKT-2,,Title Jacket\n"
        f"JACKET,100.00,{seed_category.name},Black,M,10,SKU-JKT-3,,Upper JACKET\n"
    )
    csv_file.write_text(csv_content, encoding="utf-8")

    job = create_file_import_job(
        db=db,
        created_by_id=seed_admin_user.id,
        filename="jackets.csv",
        csv_path=str(csv_file)
    )

    processed_job = process_import_job(db=db, job_id=job.id)
    assert processed_job.status == ImportJobStatus.COMPLETED.value
    assert processed_job.successful_items == 3

    # Ensure 3 distinct product records exist with matching exact casing
    p1 = db.query(Product).filter(Product.name == "jacket").first()
    p2 = db.query(Product).filter(Product.name == "Jacket").first()
    p3 = db.query(Product).filter(Product.name == "JACKET").first()

    assert p1 is not None
    assert p2 is not None
    assert p3 is not None
    assert p1.id != p2.id
    assert p2.id != p3.id


def test_resolve_import_item_endpoint(
    client: TestClient,
    auth_headers: dict,
    db: Session,
    seed_admin_user: User,
    seed_category: Category
):
    """Test PATCH /jobs/product-import/{job_id}/items/{item_id}/resolve."""
    products = [
        ProductImportItemSchema(name="", price=Decimal("10.00"), categoryName=seed_category.name)
    ]
    job = create_import_job(db=db, created_by_id=seed_admin_user.id, products_data=products)
    process_import_job(db=db, job_id=job.id)

    item = job.items[0]
    assert item.status == ImportItemStatus.FAILED.value
    assert item.resolution_status == "PENDING"

    # Call resolution endpoint
    res = client.patch(
        f"/jobs/product-import/{job.id}/items/{item.id}/resolve?product_id=prod-123",
        headers=auth_headers
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["resolution_status"] == "RESOLVED"
    assert data["product_id"] == "prod-123"

    db.refresh(item)
    assert item.resolution_status == "RESOLVED"
    assert item.product_id == "prod-123"
    assert item.resolved_at is not None


def test_bulk_product_import_price_less_than_1_fails(
    db: Session,
    seed_admin_user: User,
    seed_category: Category
):
    """Product with price < 1.00 (e.g. 0.00, negative, or 0.50) fails validation and creates inactive product."""
    products = [
        ProductImportItemSchema(name="Free Sample Item", price=Decimal("0.00"), categoryName=seed_category.name, stock=10),
        ProductImportItemSchema(name="Negative Price Item", price=Decimal("-5.00"), categoryName=seed_category.name, stock=10),
        ProductImportItemSchema(name="Pennies Item", price=Decimal("0.75"), categoryName=seed_category.name, stock=10)
    ]
    job = create_import_job(db=db, created_by_id=seed_admin_user.id, products_data=products)
    res = process_import_job(db=db, job_id=job.id)

    assert res.status == ImportJobStatus.COMPLETED_WITH_ERRORS.value
    assert res.failed_items == 3
    assert res.successful_items == 0
    for it in res.items:
        assert it.status == ImportItemStatus.FAILED.value
        assert it.error_type == "VALIDATION_ERROR"
        assert "Price must be at least $1.00" in it.error_message


def test_bulk_product_import_stock_less_than_1_fails(
    db: Session,
    seed_admin_user: User,
    seed_category: Category
):
    """Product with stock < 1 (e.g. 0 or negative) fails validation."""
    products = [
        ProductImportItemSchema(name="Zero Stock Item", price=Decimal("25.00"), categoryName=seed_category.name, stock=0),
        ProductImportItemSchema(name="Negative Stock Item", price=Decimal("25.00"), categoryName=seed_category.name, stock=-3)
    ]
    job = create_import_job(db=db, created_by_id=seed_admin_user.id, products_data=products)
    res = process_import_job(db=db, job_id=job.id)

    assert res.status == ImportJobStatus.COMPLETED_WITH_ERRORS.value
    assert res.failed_items == 2
    assert res.successful_items == 0
    for it in res.items:
        assert it.status == ImportItemStatus.FAILED.value
        assert it.error_type == "VALIDATION_ERROR"
        assert "Stock" in it.error_message and "must be at least 1" in it.error_message


def test_file_based_bulk_import_with_image_upload_to_cloudinary(
    db: Session,
    seed_admin_user: User,
    seed_category: Category,
    tmp_path,
    monkeypatch
):
    """Test importing CSV referencing local image files uploads them to Cloudinary and saves the secure URL."""
    import os
    from app.services.import_service import create_file_import_job, process_import_job

    # Mock Cloudinary upload to return deterministic remote URL
    def mock_upload(file_source, folder="ecommerce_products"):
        filename = os.path.basename(file_source)
        return f"https://res.cloudinary.com/demo/image/upload/v12345/ecommerce_products/{filename}"

    monkeypatch.setattr("app.services.import_service.upload_image_to_cloudinary", mock_upload)

    # Create CSV file and images folder
    csv_file = tmp_path / "products_with_images.csv"
    images_dir = tmp_path / "images"
    images_dir.mkdir()

    # Create dummy image files (one plain, one with folder prefix)
    (images_dir / "red_sneakers.jpg").write_text("fake_image_data")
    (images_dir / "myfolder_blue_sneakers.jpg").write_text("fake_image_data_2")

    csv_content = (
        "title,price,categoryName,colorName,sizeName,stock,imagePath\n"
        f"Pro Running Shoes,89.99,{seed_category.name},Red,10,20,red_sneakers.jpg\n"
        f"Pro Running Shoes,89.99,{seed_category.name},Blue,11,15,blue_sneakers.jpg\n"
    )
    csv_file.write_text(csv_content)

    job = create_file_import_job(
        db=db,
        created_by_id=seed_admin_user.id,
        filename="products_with_images.csv",
        csv_path=str(csv_file),
        images_path=str(images_dir)
    )

    result_job = process_import_job(db=db, job_id=job.id)

    assert result_job.status == ImportJobStatus.COMPLETED.value
    assert result_job.successful_items == 1
    assert result_job.failed_items == 0

    # Verify product and variant images in DB
    prod = db.query(Product).filter(Product.name == "Pro Running Shoes").first()
    assert prod is not None
    assert len(prod.variants) == 2

    # Both variants should have Cloudinary URLs
    for v in prod.variants:
        assert len(v.images) >= 1
        for img in v.images:
            assert img.startswith("https://res.cloudinary.com/demo/image/upload/")


def test_import_with_zero_errors_creates_no_notification(
    db: Session,
    seed_admin_user: User,
    seed_category: Category,
    tmp_path
):
    """Verify that a 100% successful import creates NO error notification."""
    from app.services.import_service import create_file_import_job, process_import_job
    from app.models.ecommerce import Notification

    csv_file = tmp_path / "perfect_products.csv"
    csv_content = (
        "title,price,category,stock\n"
        f"Perfect Leather Wallet,45.00,{seed_category.name},50\n"
    )
    csv_file.write_text(csv_content, encoding="utf-8")

    job = create_file_import_job(
        db=db,
        created_by_id=seed_admin_user.id,
        filename="perfect_products.csv",
        csv_path=str(csv_file)
    )

    result_job = process_import_job(db=db, job_id=job.id)
    assert result_job.status == ImportJobStatus.COMPLETED.value
    assert result_job.failed_items == 0

    # No notification should exist for this job
    notif = db.query(Notification).filter(
        Notification.userId == seed_admin_user.id,
        Notification.orderId == job.id,
        Notification.type == "IMPORT_ERRORS"
    ).first()
    assert notif is None


def test_import_retry_does_not_create_duplicate_notifications(
    db: Session,
    seed_admin_user: User,
    seed_category: Category,
    tmp_path
):
    """Verify that retrying a failed import updates the existing notification instead of creating duplicates."""
    from app.services.import_service import create_file_import_job, process_import_job
    from app.models.ecommerce import Notification

    csv_file = tmp_path / "retry_test.csv"
    csv_content = (
        "title,price,category,stock\n"
        "Failed Item 1,0.00,InvalidCat,10\n"
    )
    csv_file.write_text(csv_content, encoding="utf-8")

    job = create_file_import_job(
        db=db,
        created_by_id=seed_admin_user.id,
        filename="retry_test.csv",
        csv_path=str(csv_file)
    )

    # First run
    process_import_job(db=db, job_id=job.id)
    notifs_run_1 = db.query(Notification).filter(
        Notification.userId == seed_admin_user.id,
        Notification.orderId == job.id,
        Notification.type == "IMPORT_ERRORS"
    ).all()
    assert len(notifs_run_1) == 1

    # Second run (retry)
    process_import_job(db=db, job_id=job.id)
    notifs_run_2 = db.query(Notification).filter(
        Notification.userId == seed_admin_user.id,
        Notification.orderId == job.id,
        Notification.type == "IMPORT_ERRORS"
    ).all()
    assert len(notifs_run_2) == 1


def test_resolve_import_item_preserves_historical_job_status_and_error(
    db: Session,
    seed_admin_user: User,
    seed_category: Category
):
    """Verify that resolving an item marks it RESOLVED, preserves original error message, and leaves ImportJob as COMPLETED_WITH_ERRORS."""
    from app.services.import_service import create_import_job, process_import_job, resolve_import_item

    products = [
        ProductImportItemSchema(name="Flawed Watch", price=Decimal("0.00"), categoryName=seed_category.name, stock=10)
    ]
    job = create_import_job(db=db, created_by_id=seed_admin_user.id, products_data=products)
    process_import_job(db=db, job_id=job.id)

    assert job.status == ImportJobStatus.COMPLETED_WITH_ERRORS.value
    item = job.items[0]
    orig_error = item.error_message
    assert orig_error is not None

    # Resolve the item
    resolved = resolve_import_item(db=db, item_id=item.id, product_id="prod-fixed-999")
    assert resolved is not None
    assert resolved.resolution_status == "RESOLVED"
    assert resolved.resolved_at is not None
    assert resolved.product_id == "prod-fixed-999"
    assert resolved.error_message == orig_error  # Error message preserved

    # Historical job status remains COMPLETED_WITH_ERRORS
    db.refresh(job)
    assert job.status == ImportJobStatus.COMPLETED_WITH_ERRORS.value


def test_parse_csv_ignores_duplicate_skus_across_rows(tmp_path):
    """Verify that duplicate SKUs in a CSV (both on the same product and across different products) are ignored in parsing."""
    from app.services.import_service import parse_csv_into_grouped_products

    csv_file = tmp_path / "products.csv"
    csv_content = (
        "title,sku,price,categoryName,colorName,sizeName,stock,imagePath\n"
        "Product A,SKU-A-001,25.00,Apparel,Black,M,10,img1.png\n"
        "Product A,SKU-A-001,25.00,Apparel,Black,M,20,img1_dup.png\n"
        "Product B,SKU-A-001,30.00,Apparel,Red,L,15,img2.png\n"
        "Product B,SKU-B-002,30.00,Apparel,Blue,XL,5,img3.png\n"
    )
    csv_file.write_text(csv_content, encoding="utf-8")

    parsed = parse_csv_into_grouped_products(str(csv_file))

    # Product A should have exactly 1 variant with stock 10 (2nd row ignored, stock not added to 30)
    prod_a = next((p for p in parsed if p["name"] == "Product A"), None)
    assert prod_a is not None
    assert len(prod_a["variants"]) == 1
    assert prod_a["variants"][0]["sku"] == "SKU-A-001"
    assert prod_a["variants"][0]["stock"] == 10

    # Product B should have only SKU-B-002 (the duplicate SKU-A-001 row was silently skipped)
    prod_b = next((p for p in parsed if p["name"] == "Product B"), None)
    assert prod_b is not None
    assert len(prod_b["variants"]) == 1
    assert prod_b["variants"][0]["sku"] == "SKU-B-002"
    assert prod_b["variants"][0]["stock"] == 5


def test_csv_import_increments_existing_db_stock(
    db: Session,
    seed_admin_user: User,
    seed_category: Category,
    tmp_path
):
    """Verify that when a CSV variant already exists in DB, its stock is incremented."""
    from app.services.import_service import create_file_import_job, process_import_job
    from app.models.ecommerce import ProductVariant

    # First CSV creates Product and Variant with stock 10
    csv_file_1 = tmp_path / "first_batch.csv"
    csv_file_1.write_text(
        f"title,sku,price,categoryName,colorName,sizeName,stock,imagePath\n"
        f"Sneakers,SNK-BLK-42,120.00,{seed_category.name},Black,42,10,s1.png\n",
        encoding="utf-8"
    )

    job1 = create_file_import_job(
        db=db,
        created_by_id=seed_admin_user.id,
        filename="first_batch.csv",
        csv_path=str(csv_file_1)
    )
    process_import_job(db=db, job_id=job1.id)

    var = db.query(ProductVariant).filter(ProductVariant.sku == "SNK-BLK-42").first()
    assert var is not None
    assert var.stock == 10

    # Second CSV with same SKU and stock 15 -> should increment DB stock to 25
    csv_file_2 = tmp_path / "second_batch.csv"
    csv_file_2.write_text(
        f"title,sku,price,categoryName,colorName,sizeName,stock,imagePath\n"
        f"Sneakers,SNK-BLK-42,120.00,{seed_category.name},Black,42,15,s1.png\n",
        encoding="utf-8"
    )

    job2 = create_file_import_job(
        db=db,
        created_by_id=seed_admin_user.id,
        filename="second_batch.csv",
        csv_path=str(csv_file_2)
    )
    process_import_job(db=db, job_id=job2.id)

    db.refresh(var)
    assert var.stock == 25


