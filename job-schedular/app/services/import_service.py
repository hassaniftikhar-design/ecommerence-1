"""Bulk product import processing service supporting durable file imports, partial success, Cloudinary uploads, and progress tracking."""

import csv
import os
import re
import shutil
import secrets
import time
import uuid
from decimal import Decimal
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, FrozenSet
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.config import get_settings
from app.models.ecommerce import (
    Category,
    Product,
    ProductOption,
    ProductOptionValue,
    ProductVariant,
    VariantOption,
    User,
    Notification
)
from app.models.import_job import (
    ImportJob,
    ImportItem,
    ImportJobStatus,
    ImportItemStatus
)
from app.schemas.import_schemas import ProductImportItemSchema
from app.utils.logging import logger, log_task_event
from app.utils.cloudinary_helper import upload_image_to_cloudinary, is_cloudinary_configured

DEFAULT_PRODUCT_IMAGE = "/placeholder-product.png"
settings = get_settings()


def cleanup_import_storage_folder(
    job_id: str,
    csv_path: Optional[str] = None,
    images_path: Optional[str] = None
) -> None:
    """
    Safely removes the physical import folder from disk (storage/imports/<jobId>)
    once the import has 100% succeeded or all error items have been resolved.
    """
    candidates = []
    if csv_path and os.path.exists(csv_path):
        candidates.append(os.path.dirname(os.path.abspath(csv_path)))
    if images_path and os.path.exists(images_path):
        # images_path is typically storage/imports/<jobId>/images
        parent = os.path.dirname(os.path.abspath(images_path))
        candidates.append(parent)
        candidates.append(os.path.abspath(images_path))

    # Standard relative/workspace paths
    base_storage_dir = os.path.join(os.getcwd(), "storage", "imports", job_id)
    candidates.append(base_storage_dir)
    parent_storage_dir = os.path.join(os.getcwd(), "..", "storage", "imports", job_id)
    candidates.append(parent_storage_dir)

    for path in set(candidates):
        norm_path = path.replace("\\", "/")
        if os.path.isdir(path) and "storage/imports" in norm_path:
            try:
                shutil.rmtree(path, ignore_errors=True)
                logger.info(f"Cleaned up physical import storage directory for job {job_id}: {path}")
            except Exception as e:
                logger.warning(f"Failed to clean up storage folder {path} for job {job_id}: {e}")



def generate_sku() -> str:
    """Generate unique SKU string."""
    rand_hex = secrets.token_hex(3).upper()
    timestamp = hex(int(time.time()))[2:].upper()
    return f"SKU-{timestamp}-{rand_hex}"


def create_file_import_job(
    db: Session,
    created_by_id: str,
    filename: str,
    csv_path: str,
    images_path: Optional[str] = None,
    job_id: Optional[str] = None
) -> ImportJob:
    """Create persistent ImportJob referencing durable CSV file and image folder."""
    job_id = job_id or str(uuid.uuid4())
    job = ImportJob(
        id=job_id,
        filename=filename,
        csv_reference=csv_path,
        images_reference=images_path,
        total_items=0,
        processed_items=0,
        successful_items=0,
        failed_items=0,
        status=ImportJobStatus.QUEUED.value,
        created_by_id=created_by_id
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def create_import_job(
    db: Session,
    created_by_id: str,
    products_data: List[ProductImportItemSchema],
    filename: Optional[str] = "products.json",
    job_id: Optional[str] = None
) -> ImportJob:
    """Create ImportJob and associated ImportItem records from memory payload (backward-compatibility)."""
    job_id = job_id or str(uuid.uuid4())
    job = ImportJob(
        id=job_id,
        filename=filename,
        total_items=len(products_data),
        processed_items=0,
        successful_items=0,
        failed_items=0,
        status=ImportJobStatus.QUEUED.value,
        created_by_id=created_by_id
    )
    db.add(job)

    for idx, item in enumerate(products_data):
        import_item = ImportItem(
            id=str(uuid.uuid4()),
            job_id=job_id,
            row_index=idx + 1,
            raw_data=item.model_dump(mode="json"),
            status=ImportItemStatus.PENDING.value,
            resolution_status="PENDING"
        )
        db.add(import_item)

    db.commit()
    db.refresh(job)
    return job


def parse_csv_into_grouped_products(csv_path: str) -> List[Dict[str, Any]]:
    """
    Parse a CSV file and group rows into product definitions.
    Strictly preserves CASE-SENSITIVE product titles:
    Matching key = (exact title, exact price, exact categoryName).
    """
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"CSV file not found at path: {csv_path}")

    raw_rows: List[Dict[str, Any]] = []
    with open(csv_path, mode="r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader):
            # Normalize column names (case-insensitive for header keys, but preserve value case)
            clean_row = {}
            for k, v in row.items():
                if k is not None:
                    clean_row[k.strip().lower()] = v.strip() if isinstance(v, str) else v
            clean_row["_original_row_index"] = idx + 2  # 1-indexed, header is row 1
            raw_rows.append(clean_row)

    if not raw_rows:
        return []

    # Group by (exact_title, exact_price, exact_category)
    grouped: Dict[Tuple[str, str, str], Dict[str, Any]] = {}

    for row in raw_rows:
        # Preserve EXACT casing for title and category
        title = (row.get("title") or row.get("name") or "").strip()
        price_str = str(row.get("price") or "0").strip()
        cat_name = (row.get("categoryname") or row.get("category") or "").strip()
        desc = (row.get("description") or "").strip()
        sku = (row.get("sku") or "").strip()
        stock_str = str(row.get("stock") or "0").strip()
        img_path = (row.get("imagepath") or row.get("imageurl") or row.get("image") or "").strip()
        color = (row.get("colorname") or row.get("color") or "").strip()
        size = (row.get("sizename") or row.get("size") or "").strip()

        try:
            stock = max(0, int(stock_str))
        except Exception:
            stock = 0

        group_key = (title, price_str, cat_name)

        if group_key not in grouped:
            grouped[group_key] = {
                "row_index": row.get("_original_row_index", 2),
                "name": title,
                "price": price_str,
                "categoryName": cat_name,
                "description": desc or None,
                "imageUrl": img_path or None,
                "options": {},
                "variants": []
            }

        prod_entry = grouped[group_key]
        if not prod_entry["description"] and desc:
            prod_entry["description"] = desc

        # Build variant specs
        attributes = {}
        if color:
            attributes["Color"] = color
            if "Color" not in prod_entry["options"]:
                prod_entry["options"]["Color"] = set()
            prod_entry["options"]["Color"].add(color)

        if size:
            attributes["Size"] = size
            if "Size" not in prod_entry["options"]:
                prod_entry["options"]["Size"] = set()
            prod_entry["options"]["Size"].add(size)

        # Deduplicate identical SKUs within the same product group in CSV
        if sku:
            existing_var = next(
                (v for v in prod_entry["variants"] if v.get("sku") and v["sku"].upper() == sku.upper()),
                None
            )
            if existing_var:
                existing_var["stock"] += stock
                if img_path and img_path not in existing_var["images"]:
                    existing_var["images"].append(img_path)
                continue

        variant_entry = {
            "sku": sku or None,
            "stock": stock,
            "images": [img_path] if img_path else [],
            "attributes": attributes,
            "original_image_path": img_path
        }
        prod_entry["variants"].append(variant_entry)

    # Format into canonical product payload list
    result = []
    for (t, p, c), prod_dict in grouped.items():
        # Convert options dict of sets to list of dicts
        options_list = []
        for opt_name, vals in prod_dict["options"].items():
            options_list.append({
                "name": opt_name,
                "values": list(vals)
            })

        result.append({
            "row_index": prod_dict["row_index"],
            "name": prod_dict["name"],
            "price": prod_dict["price"],
            "categoryName": prod_dict["categoryName"],
            "description": prod_dict["description"],
            "imageUrl": prod_dict["imageUrl"],
            "options": options_list,
            "variants": prod_dict["variants"]
        })

    return result


def resolve_and_upload_image(
    image_ref: Optional[str],
    images_folder: Optional[str],
    image_cache: Optional[Dict[str, str]] = None
) -> Optional[str]:
    """
    Resolve image path and upload to Cloudinary if local.
    Returns secure Cloudinary URL or original URL if already remote.
    Supports exact, basename, case-insensitive, and prefix-tolerant image resolution.
    """
    if not image_ref:
        return None

    trimmed = str(image_ref).strip()
    if not trimmed:
        return None

    # If already a remote URL or data URL, return as is
    if trimmed.startswith("http://") or trimmed.startswith("https://") or trimmed.startswith("data:"):
        return trimmed

    # If images folder is provided, look for matching local image
    if images_folder and os.path.exists(images_folder):
        base_name = os.path.basename(trimmed).lstrip("/\\")

        # 1. Direct candidate paths
        candidate_paths = [
            os.path.join(images_folder, trimmed.lstrip("/\\")),
            os.path.join(images_folder, base_name),
        ]

        for candidate in candidate_paths:
            if os.path.isfile(candidate):
                if image_cache is not None and candidate in image_cache:
                    return image_cache[candidate]
                uploaded_url = upload_image_to_cloudinary(candidate)
                if uploaded_url:
                    if image_cache is not None:
                        image_cache[candidate] = uploaded_url
                    return uploaded_url
                break

        # 2. Case-insensitive and prefix-tolerant folder search
        try:
            folder_files = os.listdir(images_folder)
            target_lower = base_name.lower()

            for fname in folder_files:
                f_path = os.path.join(images_folder, fname)
                if not os.path.isfile(f_path):
                    continue

                fname_lower = fname.lower()
                # Match exact filename (case-insensitive) OR folder-prefixed filename (e.g. foldername_image.png)
                if (
                    fname_lower == target_lower
                    or fname_lower.endswith(f"_{target_lower}")
                    or fname_lower.endswith(f"-{target_lower}")
                    or fname_lower.endswith(target_lower)
                ):
                    if image_cache is not None and f_path in image_cache:
                        return image_cache[f_path]
                    uploaded_url = upload_image_to_cloudinary(f_path)
                    if uploaded_url:
                        if image_cache is not None:
                            image_cache[f_path] = uploaded_url
                        return uploaded_url
                    break
        except Exception as scan_err:
            logger.warning(f"Error scanning images folder '{images_folder}': {scan_err}")

    return None


def get_next_available_product_code(db: Session, name: str, category_name: Optional[str] = None) -> str:
    clean = "".join([c for c in name if c.isalnum()]).upper()
    prefix = clean[:4] if len(clean) >= 4 else (clean or "PROD")
    if len(prefix) < 2:
        prefix = "PROD"

    existing = db.query(Product.productCode).filter(
        Product.productCode.ilike(f"{prefix}-%")
    ).all()

    used_seqs = set()
    for (p_code,) in existing:
        if p_code:
            match = re.match(rf"^{prefix}-([0-9]+)$", p_code, re.IGNORECASE)
            if match:
                try:
                    num = int(match.group(1))
                    if num > 0:
                        used_seqs.add(num)
                except Exception:
                    pass

    next_seq = 1
    while next_seq in used_seqs:
        next_seq += 1

    return f"{prefix}-{str(next_seq).zfill(3)}"


def process_single_product_import(
    db: Session,
    raw_data: Dict[str, Any],
    created_by_id: str,
    images_folder: Optional[str] = None,
    image_cache: Optional[Dict[str, str]] = None
) -> Tuple[Optional[Product], Optional[str], Optional[str]]:
    """
    Process a single product import payload in its own transaction.
    Returns: (Product instance or None, error_type or None, error_message or None)
    If validation fails but product can be safely created, creates product with isActive=False.
    """
    name = (raw_data.get("name") or "").strip()
    if not name:
        return None, "VALIDATION_ERROR", "Product title/name is required and cannot be empty"

    price_val = raw_data.get("price", 0)
    invalid_price_error = None
    try:
        price = Decimal(str(price_val))
        if price < 1:
            invalid_price_error = f"Price must be at least $1.00 (received: ${price_val}). Price cannot be 0, negative, or less than 1."
    except Exception:
        return None, "VALIDATION_ERROR", f"Invalid price value: {price_val}"

    # 1. Resolve Category (Case-insensitive search in DB, but category must exist)
    category_id = raw_data.get("categoryId")
    category_name = (raw_data.get("categoryName") or raw_data.get("category") or "").strip()

    category = None
    if category_id:
        category = db.query(Category).filter(Category.id == category_id).first()
    elif category_name:
        category = db.query(Category).filter(func.lower(Category.name) == category_name.lower()).first()

    if not category:
        # Category missing: foreign key constraint prevents safe DB product insert without valid category
        return None, "CATEGORY_NOT_FOUND", f"Category '{category_name or category_id}' does not exist in the system. Please create the category or correct the spelling."

    # 2. Check if created_by_id is valid user
    user = db.query(User).filter(User.id == created_by_id).first()
    if not user:
        return None, "AUTHENTICATION_ERROR", f"User with ID {created_by_id} does not exist"

    description = raw_data.get("description")
    raw_image_url = raw_data.get("imageUrl")
    uploaded_image_url = resolve_and_upload_image(raw_image_url, images_folder, image_cache)
    if not uploaded_image_url:
        if raw_image_url and (raw_image_url.startswith("http://") or raw_image_url.startswith("https://") or raw_image_url.startswith("/")):
            uploaded_image_url = raw_image_url
        elif raw_image_url:
            uploaded_image_url = f"/{raw_image_url.strip()}"
        else:
            uploaded_image_url = DEFAULT_PRODUCT_IMAGE

    # 3. Create or Match Product (Upsert by EXACT name, EXACT categoryId, and price)
    product = db.query(Product).filter(
        Product.name == name,
        Product.categoryId == category.id
    ).first()

    raw_product_code = (raw_data.get("productCode") or "").strip().upper()
    if not raw_product_code:
        raw_product_code = get_next_available_product_code(db, name, category_name)

    if not product:
        # Check productCode uniqueness
        existing_code = db.query(Product).filter(Product.productCode == raw_product_code).first()
        if existing_code:
            raw_product_code = get_next_available_product_code(db, name, category_name)

        product = Product(
            id=str(uuid.uuid4()),
            productCode=raw_product_code,
            name=name,
            description=description,
            price=price,
            categoryId=category.id,
            createdById=created_by_id,
            isActive=True
        )
        db.add(product)
        db.flush()
    else:
        if not product.productCode:
            product.productCode = raw_product_code
        if description:
            product.description = description
        if price is not None and price > 0:
            product.price = price
        db.flush()

    # 4. Handle Options (Merge with existing product options)
    options_data = raw_data.get("options") or []
    option_value_map: Dict[str, str] = {}  # "color:Red" -> option_value_id

    existing_options = db.query(ProductOption).filter(ProductOption.productId == product.id).all()
    existing_option_by_name = {opt.name.lower(): opt for opt in existing_options}

    for opt_data in options_data:
        opt_name = (opt_data.get("name") or "").strip()
        if not opt_name:
            continue

        product_opt = existing_option_by_name.get(opt_name.lower())
        if not product_opt:
            product_opt = ProductOption(
                id=str(uuid.uuid4()),
                productId=product.id,
                name=opt_name
            )
            db.add(product_opt)
            db.flush()
            existing_option_by_name[opt_name.lower()] = product_opt

        existing_values = db.query(ProductOptionValue).filter(ProductOptionValue.optionId == product_opt.id).all()
        existing_value_by_str = {v.value.lower(): v for v in existing_values}

        for val_str in opt_data.get("values") or []:
            val_trimmed = str(val_str).strip()
            if not val_trimmed:
                continue

            opt_val = existing_value_by_str.get(val_trimmed.lower())
            if not opt_val:
                opt_val = ProductOptionValue(
                    id=str(uuid.uuid4()),
                    optionId=product_opt.id,
                    value=val_trimmed
                )
                db.add(opt_val)
                db.flush()
                existing_value_by_str[val_trimmed.lower()] = opt_val

            option_value_map[f"{opt_name.lower()}:{val_trimmed.lower()}"] = opt_val.id

    # 5. Build Index of Existing Variants & their attribute signatures
    existing_variants = db.query(ProductVariant).filter(ProductVariant.productId == product.id).all()
    existing_variant_by_sig: Dict[FrozenSet[Tuple[str, str]], ProductVariant] = {}

    for ev in existing_variants:
        sig_list = []
        for vo in ev.variantOptions:
            if vo.optionValue and vo.optionValue.option:
                sig_list.append((vo.optionValue.option.name.strip().lower(), vo.optionValue.value.strip().lower()))
        sig = frozenset(sig_list)
        existing_variant_by_sig[sig] = ev

    # 6. Handle Variants (Stock increment if matching SKU or specs, else create new variant)
    variants_data = raw_data.get("variants") or []
    stock_val = raw_data.get("stock", 0)
    base_stock = int(stock_val) if stock_val is not None else 0

    if variants_data:
        for v_data in variants_data:
            attributes = v_data.get("attributes") or {}
            incoming_sig = frozenset([
                (str(k).strip().lower(), str(v).strip().lower())
                for k, v in attributes.items()
                if str(k).strip() and str(v).strip()
            ])

            sku = (v_data.get("sku") or "").strip().upper()
            v_stock = int(v_data.get("stock", 0))
            if v_stock < 1:
                if product:
                    product.isActive = False
                return product, "VALIDATION_ERROR", f"Stock for variant '{sku or name}' must be at least 1 (received: {v_stock}). Stock cannot be 0 or negative."

            # Resolve variant image
            orig_img = v_data.get("original_image_path") or (v_data.get("images", [None])[0] if v_data.get("images") else None)
            v_uploaded_img = resolve_and_upload_image(orig_img, images_folder, image_cache)
            if not v_uploaded_img:
                if orig_img and (orig_img.startswith("http://") or orig_img.startswith("https://") or orig_img.startswith("/")):
                    v_uploaded_img = orig_img
                elif orig_img:
                    v_uploaded_img = f"/{orig_img.strip()}"
                else:
                    v_uploaded_img = uploaded_image_url
            v_images = [v_uploaded_img] if v_uploaded_img else [uploaded_image_url]

            # 1. Check if SKU already exists anywhere in the DB -> Increment its stock
            existing_sku_var = None
            if sku:
                existing_sku_var = db.query(ProductVariant).filter(
                    func.lower(ProductVariant.sku) == sku.lower()
                ).first()

            if existing_sku_var:
                existing_sku_var.stock += v_stock
                current_imgs = list(existing_sku_var.images or [])
                for img in v_images:
                    if img and img not in current_imgs:
                        current_imgs.append(img)
                existing_sku_var.images = current_imgs
            else:
                # 2. Check if matching variant exists on this product by attributes
                matching_variant = existing_variant_by_sig.get(incoming_sig)
                if not matching_variant and not incoming_sig and len(existing_variants) == 1 and frozenset() in existing_variant_by_sig:
                    matching_variant = existing_variant_by_sig[frozenset()]

                if matching_variant:
                    matching_variant.stock += v_stock
                    current_imgs = list(matching_variant.images or [])
                    for img in v_images:
                        if img and img not in current_imgs:
                            current_imgs.append(img)
                    matching_variant.images = current_imgs
                    if sku and not matching_variant.sku:
                        matching_variant.sku = sku
                else:
                    if not sku:
                        # Auto-generate default SKU
                        color_val = attributes.get("Color") or attributes.get("color") or ""
                        size_val = attributes.get("Size") or attributes.get("size") or ""
                        color_code = "".join([c for c in color_val if c.isalnum()][:3]).upper() or "DEF"
                        size_code = size_val.strip().upper() or "DEF"
                        sku = f"{product.productCode or 'PROD'}-{color_code}-{size_code}"

                    # Final check before insert
                    existing_check = db.query(ProductVariant).filter(
                        func.lower(ProductVariant.sku) == sku.lower()
                    ).first()
                    if existing_check:
                        existing_check.stock += v_stock
                    else:
                        variant = ProductVariant(
                            id=str(uuid.uuid4()),
                            productId=product.id,
                            sku=sku,
                            stock=v_stock,
                            images=v_images
                        )
                        db.add(variant)
                        db.flush()

                        for attr_name, attr_val in attributes.items():
                            key = f"{str(attr_name).strip().lower()}:{str(attr_val).strip().lower()}"
                            val_id = option_value_map.get(key)
                            if val_id:
                                vo = VariantOption(
                                    id=str(uuid.uuid4()),
                                    variantId=variant.id,
                                    optionValueId=val_id
                                )
                                db.add(vo)

                        existing_variant_by_sig[incoming_sig] = variant
                        existing_variants.append(variant)
    else:
        if base_stock < 1:
            if product:
                product.isActive = False
            return product, "VALIDATION_ERROR", f"Stock for product '{name}' must be at least 1 (received: {base_stock}). Stock cannot be 0 or negative."

        std_sig = frozenset()
        matching_variant = existing_variant_by_sig.get(std_sig)
        if not matching_variant and len(existing_variants) == 1 and frozenset() in existing_variant_by_sig:
            matching_variant = existing_variant_by_sig[frozenset()]

        if matching_variant:
            matching_variant.stock += base_stock
            if uploaded_image_url and uploaded_image_url not in (matching_variant.images or []):
                matching_variant.images = list(matching_variant.images or []) + [uploaded_image_url]
        elif len(existing_variants) == 0:
            sku = f"{product.productCode or 'PROD'}-DEF"
            existing_check = db.query(ProductVariant).filter(
                func.lower(ProductVariant.sku) == sku.lower()
            ).first()
            if existing_check:
                existing_check.stock += base_stock
            else:
                variant = ProductVariant(
                    id=str(uuid.uuid4()),
                    productId=product.id,
                    sku=sku,
                    stock=base_stock,
                    images=[uploaded_image_url]
                )
                db.add(variant)
                db.flush()
                existing_variant_by_sig[std_sig] = variant
                existing_variants.append(variant)
        else:
            existing_variants[0].stock += base_stock

    if invalid_price_error:
        if product:
            product.isActive = False
        return product, "VALIDATION_ERROR", invalid_price_error

    db.flush()
    return product, None, None


def process_import_job(
    db: Session,
    job_id: str,
    task_id: Optional[str] = None
) -> ImportJob:
    """Execute import job with file reading, internal 50-item batching, and partial success tolerance."""
    job = db.query(ImportJob).filter(ImportJob.id == job_id).first()
    if not job:
        raise ValueError(f"ImportJob {job_id} not found")

    job.status = ImportJobStatus.PROCESSING.value
    job.started_at = datetime.utcnow()
    db.commit()

    log_task_event(
        task_name="process_bulk_import",
        event="started",
        task_id=task_id,
        job_id=job_id,
        extra={"filename": job.filename, "csv_path": job.csv_reference}
    )

    # 1. If job has a csv_reference file, parse rows and create ImportItems if not yet created
    if job.csv_reference and os.path.exists(job.csv_reference):
        existing_items = db.query(ImportItem).filter(ImportItem.job_id == job_id).all()
        if not existing_items:
            try:
                parsed_products = parse_csv_into_grouped_products(job.csv_reference)
                for idx, p_data in enumerate(parsed_products):
                    import_item = ImportItem(
                        id=str(uuid.uuid4()),
                        job_id=job_id,
                        row_index=p_data.get("row_index", idx + 1),
                        raw_data=p_data,
                        status=ImportItemStatus.PENDING.value,
                        resolution_status="PENDING"
                    )
                    db.add(import_item)
                db.commit()
                job.total_items = len(parsed_products)
                db.commit()
            except Exception as parse_err:
                logger.error(f"Failed to parse CSV file for job {job_id}: {parse_err}", exc_info=True)
                job.status = ImportJobStatus.FAILED.value
                job.completed_at = datetime.utcnow()
                db.commit()
                raise parse_err

    # 2. Fetch all ImportItems for this job
    items = db.query(ImportItem).filter(ImportItem.job_id == job_id).order_by(ImportItem.row_index).all()
    batch_size = getattr(settings, "BULK_IMPORT_BATCH_SIZE", 50)
    job_image_cache: Dict[str, str] = {}

    # Process items in internal batches
    for i in range(0, len(items), batch_size):
        batch_items = items[i:i + batch_size]

        for item in batch_items:
            # Idempotency check: Skip already successfully imported items on retries
            if item.status == ImportItemStatus.SUCCESS.value:
                continue

            try:
                with db.begin_nested():
                    product, err_type, err_msg = process_single_product_import(
                        db=db,
                        raw_data=item.raw_data,
                        created_by_id=job.created_by_id,
                        images_folder=job.images_reference,
                        image_cache=job_image_cache
                    )

                    if err_msg:
                        # Product failed validation
                        item.status = ImportItemStatus.FAILED.value
                        item.error_type = err_type or "VALIDATION_ERROR"
                        item.error_message = err_msg
                        if product:
                            # Set product inactive if created
                            product.isActive = False
                            item.product_id = product.id
                        else:
                            item.product_id = None
                        logger.warning(f"Import item row {item.row_index} failed in job {job_id}: {err_msg}")
                    else:
                        # Product succeeded
                        item.status = ImportItemStatus.SUCCESS.value
                        item.product_id = product.id if product else None
                        item.error_type = None
                        item.error_message = None
            except Exception as e:
                item.status = ImportItemStatus.FAILED.value
                item.error_type = "PROCESSING_ERROR"
                item.error_message = str(e)
                logger.warning(f"Import item row {item.row_index} encountered exception in job {job_id}: {e}")

            item.updated_at = datetime.utcnow()
            job.updated_at = datetime.utcnow()
            db.commit()

        # Update running counters after each batch
        job.processed_items = sum(1 for it in items if it.status != ImportItemStatus.PENDING.value)
        job.successful_items = sum(1 for it in items if it.status == ImportItemStatus.SUCCESS.value)
        job.failed_items = sum(1 for it in items if it.status == ImportItemStatus.FAILED.value)
        job.updated_at = datetime.utcnow()
        db.commit()

    # 3. Finalize Job Status & Metrics
    total_count = len(items)
    success_count = sum(1 for it in items if it.status == ImportItemStatus.SUCCESS.value)
    failed_count = sum(1 for it in items if it.status == ImportItemStatus.FAILED.value)
    processed_count = sum(1 for it in items if it.status != ImportItemStatus.PENDING.value)

    job.total_items = total_count
    job.successful_items = success_count
    job.failed_items = failed_count
    job.processed_items = processed_count
    job.completed_at = datetime.utcnow()

    if failed_count == 0 and processed_count == total_count:
        job.status = ImportJobStatus.COMPLETED.value
        # 100% Success: Cleanup physical import storage directory immediately
        cleanup_import_storage_folder(
            job_id=job.id,
            csv_path=job.csv_reference,
            images_path=job.images_reference
        )
    elif success_count > 0 or failed_count > 0:
        job.status = ImportJobStatus.COMPLETED_WITH_ERRORS.value
        # Create or Update Admin Notification if errors exist (Idempotent for retries)
        if failed_count > 0:
            try:
                existing_notif = db.query(Notification).filter(
                    Notification.userId == job.created_by_id,
                    Notification.type == "IMPORT_ERRORS",
                    Notification.orderId == job.id
                ).first()

                notif_msg = f"{failed_count} products from {job.filename or 'products.csv'} could not be imported and need review."

                if existing_notif:
                    existing_notif.message = notif_msg
                    existing_notif.isRead = False
                    existing_notif.updatedAt = datetime.utcnow()
                else:
                    notif = Notification(
                        id=str(uuid.uuid4()),
                        userId=job.created_by_id,
                        title="Product Import Needs Attention",
                        message=notif_msg,
                        type="IMPORT_ERRORS",
                        orderId=job.id,
                        isRead=False,
                        createdAt=datetime.utcnow(),
                        updatedAt=datetime.utcnow()
                    )
                    db.add(notif)
            except Exception as notif_err:
                logger.error(f"Failed to create/update admin notification for job {job_id}: {notif_err}")
    else:
        job.status = ImportJobStatus.FAILED.value

    job.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(job)

    log_task_event(
        task_name="process_bulk_import",
        event="completed",
        task_id=task_id,
        job_id=job_id,
        extra={
            "status": job.status,
            "successful": job.successful_items,
            "failed": job.failed_items
        }
    )
    return job


def resolve_import_item(
    db: Session,
    item_id: str,
    product_id: Optional[str] = None
) -> Optional[ImportItem]:
    """Mark an import item as RESOLVED and link corrected product_id."""
    item = db.query(ImportItem).filter(ImportItem.id == item_id).first()
    if not item:
        return None

    item.resolution_status = "RESOLVED"
    item.resolved_at = datetime.utcnow()
    if product_id:
        item.product_id = product_id

    # Check if all failed items for this job are now resolved
    unresolved_count = (
        db.query(ImportItem)
        .filter(
            ImportItem.job_id == item.job_id,
            ImportItem.status == "FAILED",
            ImportItem.resolution_status != "RESOLVED"
        )
        .count()
    )

    if unresolved_count == 0:
        job = db.query(ImportJob).filter(ImportJob.id == item.job_id).first()
        if job:
            filename = job.filename if job.filename else "products.csv"
            # Cleanup physical import storage directory now that all errors are resolved
            cleanup_import_storage_folder(
                job_id=job.id,
                csv_path=job.csv_reference,
                images_path=job.images_reference
            )
        else:
            filename = "products.csv"

        notif = db.query(Notification).filter(
            Notification.type == "IMPORT_ERRORS",
            Notification.orderId == item.job_id
        ).first()
        if notif:
            notif.title = "Import Errors Resolved"
            notif.message = f"All product import errors for {filename} have been resolved."
            notif.isRead = True

    db.commit()
    db.refresh(item)
    return item
