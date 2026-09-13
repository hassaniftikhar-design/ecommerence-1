# 📚 Comprehensive Project Architecture & API Audit: Ecommerce Platform

**Document Version:** 1.0.0  
**Generated Date:** September 2026  
**Repository:** `ecommerce-app`  
**Tech Stack:** Next.js 15 (App Router, React 19, TypeScript, Tailwind CSS), FastAPI (Python 3.12), Celery 5.4, Redis, PostgreSQL (Prisma ORM & SQLAlchemy), Stripe API, Cloudinary, Mailtrap / SMTP.

---

## 📑 Table of Contents

1. [Executive Summary & High-Level Architecture](#1-executive-summary--high-level-architecture)
2. [Dual-Service System Architecture](#2-dual-service-system-architecture)
3. [Comprehensive Database Schema & Data Models](#3-comprehensive-database-schema--data-models)
4. [Authentication, Authorization & Security Architecture](#4-authentication-authorization--security-architecture)
5. [Complete Next.js REST API Reference](#5-complete-nextjs-rest-api-reference)
   - [5.1 Authentication Endpoints (`/api/auth/*`)](#51-authentication-endpoints-apiauth)
   - [5.2 User & Profile Endpoints (`/api/user/*`)](#52-user--profile-endpoints-apiuser)
   - [5.3 Product & Category Endpoints (`/api/products/*`, `/api/categories`)](#53-product--category-endpoints-apiproducts-apicategories)
   - [5.4 Shopping Cart Endpoints (`/api/cart/*`)](#54-shopping-cart-endpoints-apicart)
   - [5.5 Checkout & Payment Endpoints (`/api/checkout/*`, `/api/payment-methods/*`)](#55-checkout--payment-endpoints-apicheckout-apipayment-methods)
   - [5.6 Order Management Endpoints (`/api/orders/*`)](#56-order-management-endpoints-apiorders)
   - [5.7 Notifications Endpoints (`/api/notifications`)](#57-notifications-endpoints-apinotifications)
   - [5.8 Media Upload Endpoints (`/api/upload`)](#58-media-upload-endpoints-apiupload)
   - [5.9 Stripe Webhook Handlers (`/api/webhooks/stripe`, `/api/stripe/webhook`)](#59-stripe-webhook-handlers-apiwebhooksstripe-apistripewebhook)
   - [5.10 Admin Dashboard & Analytics (`/api/admin/dashboard`)](#510-admin-dashboard--analytics-apiadmindashboard)
   - [5.11 Admin Bulk Product Import Subsystem (`/api/admin/products/bulk/*`, `/api/admin/imports/*`)](#511-admin-bulk-product-import-subsystem-apiadminproductsbulk-apiadminimports)
6. [Complete FastAPI Job Scheduler API Reference](#6-complete-fastapi-job-scheduler-api-reference)
7. [Asynchronous Background Processing & Celery Task Engine](#7-asynchronous-background-processing--celery-task-engine)
8. [Bulk Product Import & Asset Ingestion Subsystem](#8-bulk-product-import--asset-ingestion-subsystem)
9. [Checkout, Payment Lifecycle & Webhook Processing](#9-checkout-payment-lifecycle--webhook-processing)
10. [Storefront Shopping Cart Engine & Pricing Rules](#10-storefront-shopping-cart-engine--pricing-rules)
11. [Configuration & Environment Variable Matrix](#11-configuration--environment-variable-matrix)
12. [Operations, Testing & Terminal Cheatsheet](#12-operations-testing--terminal-cheatsheet)

---

## 1. Executive Summary & High-Level Architecture

The **Ecommerce Platform** is a full-stack, enterprise-ready electronic commerce system architected with a decoupled microservice structure:

1. **Frontend & Core API Layer (Next.js 15 App Router):** Handles user interface, SSR/CSR rendering, customer storefront, admin dashboards, shopping cart management, Stripe checkout integration, and primary REST API endpoints.
2. **Asynchronous Background Processing Layer (FastAPI + Celery + Redis):** Handles computational tasks, high-volume CSV/Excel product imports, image ingestion to Cloudinary, transactional email rendering (Jinja2 templates), and scheduled cron jobs (e.g., unpaid order auto-cancellation and cancellation warnings).
3. **Unified Database Layer (PostgreSQL):** A single source of truth shared between the Next.js TypeScript server (via Prisma ORM) and the Python background worker (via SQLAlchemy 2.0).

```mermaid
flowchart TB
    subgraph Client [Client Browsers]
        Storefront[Storefront UI]
        AdminUI[Admin Dashboard]
    end

    subgraph Core [Next.js 15 Web Application - Port 3000]
        NextServer[Next.js App Router API Routes]
        NextAuth[NextAuth.js Session & OAuth]
        PrismaClient[Prisma ORM Client]
        SchedulerClient[Scheduler HTTP Client]
    end

    subgraph JobScheduler [FastAPI Scheduler Microservice - Port 8000]
        FastAPIApp[FastAPI REST API]
        SQLAlchemyApp[SQLAlchemy 2.0 Models]
    end

    subgraph TaskEngine [Celery & Redis Worker Cluster]
        RedisBroker[Redis Broker / Backend :6379]
        CeleryWorker[Celery Workers - 4 Concurrency]
        CeleryBeat[Celery Beat Cron Scheduler]
        CeleryFlower[Celery Flower Dashboard :5556]
    end

    subgraph External [External Services]
        StripeAPI[Stripe Payments API]
        CloudinaryAPI[Cloudinary CDN]
        MailtrapSMTP[Mailtrap / SMTP Server]
    end

    subgraph Database [Database Storage]
        Postgres[(PostgreSQL Database :5432)]
        LocalStorage[(Local Import Storage /storage)]
    end

    Client -->|HTTPS / NextAuth| Core
    NextServer -->|CRUD SQL Queries| Postgres
    NextServer -->|Token Authenticated POST /jobs/*| FastAPIApp
    FastAPIApp -->|Enqueue Tasks| RedisBroker
    RedisBroker -->|Consume Tasks| CeleryWorker
    CeleryBeat -->|Hourly Triggers| RedisBroker
    CeleryWorker -->|Direct SQL Updates| Postgres
    CeleryWorker -->|Send Emails| MailtrapSMTP
    CeleryWorker -->|Upload Assets| CloudinaryAPI
    CeleryWorker -->|Read Import Files| LocalStorage
    NextServer -->|Create PaymentIntent / SetupIntent| StripeAPI
    StripeAPI -->|Webhook Events| NextServer
    NextServer -->|Store Import Uploads| LocalStorage
```

---

## 2. Dual-Service System Architecture

The repository is partitioned into two cooperating codebases sharing database schemas and environment variables:

| Component | Technology | Directory | Primary Role |
| :--- | :--- | :--- | :--- |
| **Storefront & Admin API** | Next.js 15, React 19, TypeScript, Prisma 5, Tailwind CSS | `/` | Storefront UX, cart, checkout, NextAuth authentication, admin interfaces, synchronous REST APIs |
| **Job Scheduler Microservice** | FastAPI 0.115, Pydantic 2, SQLAlchemy 2 | `/job-schedular` | HTTP gateway for enqueuing async jobs, validating payloads, monitoring job status |
| **Worker Engine** | Celery 5.4, Kombu, Redis 5 | `/job-schedular` | Multi-queue async task processing, retries, Cloudinary uploads, HTML email compilation |
| **Periodic Scheduler** | Celery Beat | `/job-schedular` | Hourly cron executing order expiration, warning notifications, and stock restocking |
| **Task Monitoring** | Flower 2.0 | `/job-schedular` | Real-time visual monitoring dashboard for Celery tasks |

### Service-to-Service Security
All requests between the Next.js API server and the FastAPI microservice are protected with an **Internal Service Bearer Token** (`INTERNAL_SERVICE_TOKEN`). Any unauthenticated request or mismatch returns `HTTP 401 Unauthorized`.

---

## 3. Comprehensive Database Schema & Data Models

The PostgreSQL database is managed via Prisma schema definitions in `prisma/schema.prisma` and mapped to Python SQLAlchemy models in `job-schedular/app/models/`.

```mermaid
erDiagram
    User ||--o{ Account : "has"
    User ||--o{ Order : "places"
    User ||--o{ Notification : "receives"
    User ||--o{ PaymentMethod : "saves"
    User ||--o| Cart : "owns"
    User ||--o{ Product : "creates (Admin)"
    
    Category ||--o{ Product : "contains"
    Product ||--o{ ProductOption : "defines"
    Product ||--o{ ProductVariant : "has variants"
    Product ||--o{ CartItem : "in cart"
    Product ||--o{ OrderItem : "ordered"

    ProductOption ||--o{ ProductOptionValue : "has values"
    ProductVariant ||--o{ VariantOption : "links"
    ProductOptionValue ||--o{ VariantOption : "configured in"

    Cart ||--o{ CartItem : "contains"
    ProductVariant ||--o{ CartItem : "variant selection"

    Order ||--o{ OrderItem : "contains"
    Order ||--o| Payment : "settled by"
    ProductVariant ||--o{ OrderItem : "ordered variant"

    ImportJob ||--o{ ImportItem : "stages"
```

### Complete Models Reference

#### 1. `User`
* **Fields:** `id` (String CUID), `name` (String), `email` (String Unique), `phone` (String?), `password` (String? Bcrypt), `role` (`Role` enum: `USER`, `ADMIN`), `emailVerified` (DateTime?), `isActive` (Boolean), `resetToken` (String?), `resetTokenExpires` (DateTime?), `stripeCustomerId` (String? Unique), `addressLine` (String?), `city` (String?), `postalCode` (String?), `country` (String?), `createdAt`, `updatedAt`.
* **Relations:** One-to-Many with `Account`, `Product`, `Order`, `Notification`, `PaymentMethod`; One-to-One with `Cart`.

#### 2. `Account` (OAuth NextAuth Linkage)
* **Fields:** `id`, `userId` (FK -> User Cascade), `type`, `provider` (e.g. `facebook`, `google`), `providerAccountId`, `refresh_token`, `access_token`, `id_token`, `expires_at`, `token_type`, `scope`, `session_state`.
* **Constraints:** `@@unique([provider, providerAccountId])`.

#### 3. `Category`
* **Fields:** `id` (String CUID), `name` (String Unique).
* **Relations:** One-to-Many with `Product`.

#### 4. `Product`
* **Fields:** `id` (String CUID), `name` (String), `description` (String?), `price` (Decimal 10,2), `categoryId` (FK -> Category), `createdById` (FK -> User), `isActive` (Boolean @default(true)), `inactiveAt` (DateTime?), `createdAt`, `updatedAt`.
* **Relations:** Belongs to `Category`, `User`; Has many `ProductOption`, `ProductVariant`, `CartItem`, `OrderItem`.

#### 5. `ProductOption` & `ProductOptionValue`
* **ProductOption:** `id`, `productId` (FK -> Product Cascade), `name` (e.g. "Color", "Size"). `@@unique([productId, name])`.
* **ProductOptionValue:** `id`, `optionId` (FK -> ProductOption Cascade), `value` (e.g. "Red", "XL"). `@@unique([optionId, value])`.

#### 6. `ProductVariant` & `VariantOption`
* **ProductVariant:** `id`, `productId` (FK -> Product Cascade), `sku` (String Unique), `stock` (Int), `images` (String[] array of URLs), `createdAt`, `updatedAt`.
* **VariantOption:** `id`, `variantId` (FK -> ProductVariant Cascade), `optionValueId` (FK -> ProductOptionValue Cascade). `@@unique([variantId, optionValueId])`.

#### 7. `Cart` & `CartItem`
* **Cart:** `id`, `userId` (String? Unique FK -> User Cascade), `sessionId` (String? Unique for guests), `createdAt`, `updatedAt`.
* **CartItem:** `id`, `cartId` (FK -> Cart Cascade), `productId` (FK -> Product Cascade), `variantId` (FK -> ProductVariant? SetNull), `quantity` (Int @default(1)). `@@unique([cartId, productId, variantId])`.

#### 8. `Order` & `OrderItem`
* **Order:** `id`, `orderNumber` (String Unique 6-digit), `userId` (FK -> User Cascade), `status` (`OrderStatus` enum: `IN_PROGRESS`, `DISPATCHED`, `DELIVERED`, `REJECTED`), `subTotal` (Decimal 10,2), `tax` (Decimal 10,2), `totalAmount` (Decimal 10,2), `createdAt`, `updatedAt`.
* **OrderItem:** `id`, `orderId` (FK -> Order Cascade), `productId` (FK -> Product), `variantId` (FK -> ProductVariant?), `title` (String snapshot), `price` (Decimal snapshot), `quantity` (Int), `stock` (Int snapshot), `imageUrl` (String), `createdAt`.

#### 9. `Payment`
* **Fields:** `id`, `orderId` (Unique FK -> Order Cascade), `status` (`PaymentStatus` enum: `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `REFUNDED`, `PARTIALLY_REFUNDED`), `stripePaymentIntentId` (String? Unique), `stripePaymentMethodId` (String?), `stripeCustomerId` (String?), `idempotencyKey` (String? Unique), `attemptCount` (Int @default(1)), `amount` (Decimal 10,2), `currency` (String @default("usd")), `paidAt` (DateTime?), `refundedAt` (DateTime?), `errorMessage` (String?), `rawErrorCode` (String?), `createdAt`, `updatedAt`.

#### 10. `PaymentMethod` (Saved Customer Cards)
* **Fields:** `id`, `userId` (FK -> User Cascade), `stripePaymentMethodId` (String Unique), `brand` (String, e.g. "visa"), `last4` (String 4 digits), `expMonth` (Int), `expYear` (Int), `isDefault` (Boolean @default(false)), `createdAt`.

#### 11. `StripeWebhookEvent`
* **Fields:** `id` (String - Stripe Event ID e.g. `evt_...`), `type` (String e.g. `payment_intent.succeeded`), `processedAt` (DateTime @default(now())). Primary key prevents duplicate processing of retried Stripe webhooks.

#### 12. `EmailEvent`
* **Fields:** `id`, `order_id` (String?), `event_type` (String), `recipient` (String), `status` (String @default("PENDING")), `attempts` (Int @default(1)), `sent_at` (DateTime?), `error_message` (Text?), `created_at`, `updated_at`.
* **Constraints:** `@@unique([order_id, event_type])` to prevent duplicate emails for the same order lifecycle event.

#### 13. `ImportJob` & `ImportItem`
* **ImportJob:** `id` (String CUID/UUID), `filename` (String?), `csv_reference` (String?), `images_reference` (String?), `total_items` (Int), `processed_items` (Int), `successful_items` (Int), `failed_items` (Int), `status` (String: `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`), `created_by_id` (String), `started_at` (DateTime?), `completed_at` (DateTime?), `created_at`, `updated_at`.
* **ImportItem:** `id`, `job_id` (FK -> ImportJob Cascade), `row_index` (Int), `raw_data` (Json), `status` (String: `PENDING`, `SUCCESS`, `FAILED`), `error_type` (String?), `error_message` (Text?), `product_id` (String?), `resolution_status` (String: `PENDING`, `RESOLVED`), `resolved_at` (DateTime?), `created_at`, `updated_at`.

---

## 4. Authentication, Authorization & Security Architecture

### Authentication Strategies
1. **Credentials Authentication:** Email and password validated against Bcrypt hashes with automatic email verification checks.
2. **Facebook OAuth 2.0:** Single sign-on with Facebook Graph API.
3. **Facebook Email Fallback Flow (OTP 2FA):** If a Facebook profile does not supply a verified email, the user is redirected to `/facebook-email` to enter an email. A 6-digit OTP is generated, stored in `VerificationToken`, and asynchronously sent via Celery's `high_priority` queue. Once verified, the Facebook profile is safely linked to the user account.
4. **Password Reset Flow:** Cryptographic tokens generated via `crypto.randomBytes(32)` with a 1-hour expiration timestamp. Reset requests trigger an asynchronous email job.

### Role-Based Access Control (RBAC) & Middleware Protection
The application utilizes Next.js edge middleware (`src/middleware.ts`) and server-side session utilities (`src/lib/server-auth.ts`):

* **Guest Users:** Can view active products, categories, cart (guest session), login, and signup.
* **USER Role:** Can manage profile, addresses, cart items, checkout, Stripe payment methods, view and search own order history, and receive customer notifications. Blocked from `/admin/*`.
* **ADMIN Role:** Access to `/admin/*`, product creation/editing/soft-deletion, bulk CSV/Excel product imports, error resolution dashboards, order status dispatching, and system analytics. Automatically redirected from storefront index to `/admin/products`.

---

## 5. Complete Next.js REST API Reference

All Next.js REST endpoints are standard JSON APIs returning standardized response envelopes:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```
Or in case of failure:
```json
{
  "success": false,
  "message": "Validation or operation error message",
  "errors": ["Specific error detail"]
}
```

---

### 5.1 Authentication Endpoints (`/api/auth/*`)

#### `POST /api/auth/signup`
* **Access:** Public
* **Description:** Registers a new standard customer user.
* **Request Body:**
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "SecurePassword123!",
    "phone": "+1234567890"
  }
  ```
* **Validation:** Validates email format, minimum password length (6 characters), and checks for existing duplicate email.
* **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "data": { "id": "cuid...", "name": "Jane Doe", "email": "jane@example.com", "role": "USER" }
  }
  ```

#### `POST /api/auth/change-password`
* **Access:** Authenticated (`USER` or `ADMIN`)
* **Description:** Changes user password after validating the existing current password.
* **Request Body:**
  ```json
  {
    "currentPassword": "OldPassword123!",
    "newPassword": "NewSecurePassword456!"
  }
  ```
* **Response (200 OK):**
  ```json
  { "success": true, "message": "Password updated successfully" }
  ```

#### `POST /api/auth/forgot-password`
* **Access:** Public
* **Description:** Generates a secure reset token and triggers an asynchronous background email task via FastAPI.
* **Request Body:** `{ "email": "jane@example.com" }`
* **Response (200 OK):**
  ```json
  { "success": true, "message": "If this email is registered, a password reset link has been sent" }
  ```

#### `POST /api/auth/reset-password`
* **Access:** Public
* **Description:** Verifies password reset token and updates the user password.
* **Request Body:**
  ```json
  {
    "token": "a1b2c3d4e5f6...",
    "newPassword": "NewSecurePassword789!"
  }
  ```
* **Response (200 OK):**
  ```json
  { "success": true, "message": "Password reset successfully. You can now log in." }
  ```

#### `POST /api/auth/verify-email`
* **Access:** Public
* **Description:** Verifies an email verification token.
* **Request Body:** `{ "token": "verif_token_..." }`
* **Response (200 OK):** `{ "success": true, "message": "Email verified successfully" }`

#### `POST /api/auth/facebook/send-otp`
* **Access:** Public
* **Description:** Generates a 6-digit OTP for Facebook account linking without email and enqueues high-priority email delivery.
* **Request Body:** `{ "email": "user@example.com" }`
* **Response (200 OK):** `{ "success": true, "message": "Verification OTP sent to your email" }`

#### `POST /api/auth/facebook/verify-otp`
* **Access:** Public
* **Description:** Validates the OTP code, verifies or links the user account with Facebook credentials.
* **Request Body:** `{ "email": "user@example.com", "otp": "123456" }`
* **Response (200 OK):** `{ "success": true, "message": "Account verified and linked successfully" }`

#### `GET, POST /api/auth/[...nextauth]`
* **Access:** Public / Session
* **Description:** Standard NextAuth.js handlers managing OAuth callbacks, credentials sign-in, JWT generation, CSRF tokens, and session retrieval.

---

### 5.2 User & Profile Endpoints (`/api/user/*`)

#### `GET /api/user/address`
* **Access:** Authenticated
* **Description:** Retrieves the authenticated user's saved shipping address and contact info.
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "addressLine": "123 Main St",
      "city": "San Francisco",
      "postalCode": "94105",
      "country": "United States",
      "phone": "+14155552671"
    }
  }
  ```

#### `PUT /api/user/address`
* **Access:** Authenticated
* **Description:** Updates the user's default shipping address and phone.
* **Request Body:**
  ```json
  {
    "addressLine": "456 Market St, Suite 200",
    "city": "San Francisco",
    "postalCode": "94105",
    "country": "United States",
    "phone": "+14155559876"
  }
  ```
* **Response (200 OK):** `{ "success": true, "message": "Shipping address updated successfully" }`

---

### 5.3 Product & Category Endpoints (`/api/products/*`, `/api/categories`)

#### `GET /api/products`
* **Access:** Public (Returns active products) / Admin (Can filter active/inactive/all)
* **Query Parameters:**
  * `search` / `q` (string): Search filter matching name, description, category, or variant SKU.
  * `category` (string): Filter by Category ID or name.
  * `sort` (string): `newest`, `oldest`, `price-low`, `price-high`, `name-asc`, `name-desc`.
  * `status` (string): `active`, `inactive`, `all` (Admin only).
  * `page` (number): Page number (default: 1).
  * `limit` (number): Items per page (default: 20, max: 100).
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "products": [
        {
          "id": "prod_123",
          "name": "Classic Oxford Cotton Shirt",
          "description": "Premium 100% cotton shirt...",
          "price": "49.99",
          "isActive": true,
          "category": { "id": "cat_1", "name": "Apparel" },
          "options": [
            { "id": "opt_1", "name": "Size", "values": ["M", "L", "XL"] },
            { "id": "opt_2", "name": "Color", "values": ["Blue", "White"] }
          ],
          "variants": [
            {
              "id": "var_1",
              "sku": "SHIRT-BLU-M",
              "stock": 25,
              "images": ["https://res.cloudinary.com/.../shirt-blue.jpg"],
              "options": { "Size": "M", "Color": "Blue" }
            }
          ]
        }
      ],
      "pagination": { "total": 150, "page": 1, "limit": 20, "totalPages": 8 }
    }
  }
  ```

#### `POST /api/products`
* **Access:** Admin only
* **Description:** Creates a new product with multi-dimensional options and variant matrix.
* **Request Body:**
  ```json
  {
    "name": "Pro Wireless Headphones",
    "description": "Noise-cancelling over-ear headphones",
    "price": 199.99,
    "categoryId": "cat_electronics_id",
    "options": [
      { "name": "Color", "values": ["Matte Black", "Silver"] }
    ],
    "variants": [
      {
        "sku": "WH-1000-BLK",
        "stock": 50,
        "images": ["https://res.cloudinary.com/.../wh-black.jpg"],
        "options": { "Color": "Matte Black" }
      },
      {
        "sku": "WH-1000-SLV",
        "stock": 35,
        "images": ["https://res.cloudinary.com/.../wh-silver.jpg"],
        "options": { "Color": "Silver" }
      }
    ]
  }
  ```
* **Response (201 Created):** `{ "success": true, "message": "Product created successfully", "data": { ... } }`

#### `GET /api/products/[id]`
* **Access:** Public
* **Description:** Retrieves detailed product information, option definitions, variants, and stock counts.
* **Response (200 OK):** Detailed product object with options and variants.

#### `PUT /api/products/[id]`
* **Access:** Admin only
* **Description:** Updates product metadata, base price, category, options, and synchronizes variants.
* **Response (200 OK):** `{ "success": true, "message": "Product updated successfully", "data": { ... } }`

#### `DELETE /api/products/[id]`
* **Access:** Admin only
* **Description:** Soft-deletes (sets `isActive = false`, `inactiveAt = now()`) or hard-deletes product if no order dependencies exist.
* **Response (200 OK):** `{ "success": true, "message": "Product deactivated successfully" }`

#### `PATCH /api/products/[id]/status`
* **Access:** Admin only
* **Description:** Toggles product active / inactive visibility state.
* **Request Body:** `{ "isActive": true }`
* **Response (200 OK):** `{ "success": true, "data": { "id": "prod_123", "isActive": true } }`

#### `GET /api/categories`
* **Access:** Public
* **Description:** Retrieves all available product categories with product counts.
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      { "id": "cat_1", "name": "Apparel", "productCount": 42 },
      { "id": "cat_2", "name": "Electronics", "productCount": 18 }
    ]
  }
  ```

#### `POST /api/categories`
* **Access:** Admin only
* **Description:** Creates a new category name.
* **Request Body:** `{ "name": "Home & Kitchen" }`
* **Response (201 Created):** `{ "success": true, "data": { "id": "cat_3", "name": "Home & Kitchen" } }`

---

### 5.4 Shopping Cart Endpoints (`/api/cart/*`)

#### `GET /api/cart`
* **Access:** Authenticated
* **Description:** Fetches current user's cart, items, live product details, selected variant images, variant stock availability, and calculated subtotals.
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "id": "cart_123",
      "items": [
        {
          "id": "cart_item_1",
          "productId": "prod_1",
          "productName": "Classic Oxford Cotton Shirt",
          "variantId": "var_1",
          "sku": "SHIRT-BLU-M",
          "price": 49.99,
          "quantity": 2,
          "itemTotal": 99.98,
          "stock": 25,
          "imageUrl": "https://res.cloudinary.com/.../shirt.jpg",
          "selectedOptions": { "Size": "M", "Color": "Blue" }
        }
      ],
      "subTotal": 99.98,
      "itemCount": 2
    }
  }
  ```

#### `POST /api/cart`
* **Access:** Authenticated
* **Description:** Adds an item or updates quantity of existing variant in user's cart with real-time stock validation.
* **Request Body:**
  ```json
  {
    "productId": "prod_1",
    "variantId": "var_1",
    "quantity": 1
  }
  ```
* **Response (200 OK):** `{ "success": true, "message": "Item added to cart", "data": { ... } }`

#### `DELETE /api/cart`
* **Access:** Authenticated
* **Description:** Clears all items from the user's cart or deletes a specific array of item IDs.
* **Request Body (Optional):** `{ "itemIds": ["cart_item_1", "cart_item_2"] }`
* **Response (200 OK):** `{ "success": true, "message": "Cart cleared successfully" }`

#### `PATCH /api/cart/items/[id]`
* **Access:** Authenticated
* **Description:** Updates the quantity of a specific cart item. If quantity <= 0, deletes the item.
* **Request Body:** `{ "quantity": 3 }`
* **Response (200 OK):** `{ "success": true, "message": "Cart item quantity updated", "data": { ... } }`

#### `DELETE /api/cart/items/[id]`
* **Access:** Authenticated
* **Description:** Removes a single cart item by ID.
* **Response (200 OK):** `{ "success": true, "message": "Cart item removed" }`

---

### 5.5 Checkout & Payment Endpoints (`/api/checkout/*`, `/api/payment-methods/*`)

#### `POST /api/checkout/create-intent`
* **Access:** Authenticated
* **Description:** Primary checkout endpoint. Validates inventory, creates or retrieves canonical pending Order, calculates subtotal and tax (`10%`), reserves stock, creates or updates a Stripe `PaymentIntent`, and returns the `clientSecret` for Stripe Elements.
* **Request Body:**
  ```json
  {
    "itemIds": ["cart_item_1", "cart_item_2"],
    "expectedTotal": 109.98,
    "savedPaymentMethodId": "pm_1N4...",
    "saveCardForFuture": true,
    "idempotencyKey": "idem_uuid_12345"
  }
  ```
* **Response (200 OK / 201 Created):**
  ```json
  {
    "success": true,
    "message": "PaymentIntent created successfully",
    "data": {
      "clientSecret": "pi_3N4..._secret_...",
      "orderId": "order_cuid_123",
      "orderNumber": "847291",
      "amount": 109.98
    }
  }
  ```

#### `POST /api/orders/[id]/payment-intent`
* **Access:** Authenticated
* **Description:** Generates or refreshes a Stripe `PaymentIntent` for an existing unpaid/failed order to allow immediate payment retry.
* **Response (200 OK):** `{ "success": true, "data": { "clientSecret": "pi_...", "orderId": "...", "amount": 109.98 } }`

#### `POST /api/payment-methods/setup-intent`
* **Access:** Authenticated
* **Description:** Creates a Stripe `SetupIntent` associated with the customer's `stripeCustomerId` to collect and save payment card details for future 1-click checkouts.
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": { "clientSecret": "seti_1N4..._secret_..." }
  }
  ```

#### `GET /api/payment-methods`
* **Access:** Authenticated
* **Description:** Lists all saved credit/debit cards attached to the user's account.
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "pm_cuid_1",
        "stripePaymentMethodId": "pm_1N4...",
        "brand": "visa",
        "last4": "4242",
        "expMonth": 12,
        "expYear": 2028,
        "isDefault": true
      }
    ]
  }
  ```

#### `POST /api/payment-methods`
* **Access:** Authenticated
* **Description:** Attaches a newly verified Stripe PaymentMethod to the customer in Stripe and records it in the PostgreSQL database.
* **Request Body:** `{ "paymentMethodId": "pm_1N4...", "isDefault": true }`
* **Response (201 Created):** `{ "success": true, "message": "Payment method saved successfully" }`

#### `PATCH /api/payment-methods/[id]/default`
* **Access:** Authenticated
* **Description:** Sets a saved payment card as the default payment method.
* **Response (200 OK):** `{ "success": true, "message": "Default payment method updated" }`

#### `DELETE /api/payment-methods/[id]`
* **Access:** Authenticated
* **Description:** Detaches payment method from Stripe customer and deletes it from database.
* **Response (200 OK):** `{ "success": true, "message": "Payment method deleted successfully" }`

---

### 5.6 Order Management Endpoints (`/api/orders/*`)

#### `GET /api/orders`
* **Access:** Authenticated
* **Description:** Retrieves paginated order list. Regular users only see their own orders; Admins see all store orders with customer names and email filters.
* **Query Parameters:** `page` (number), `limit` (number), `query` / `search` (string).
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "orders": [
        {
          "id": "order_123",
          "orderNumber": "847291",
          "status": "IN_PROGRESS",
          "subTotal": 99.98,
          "tax": 10.00,
          "totalAmount": 109.98,
          "createdAt": "2026-09-12T10:00:00.000Z",
          "paymentStatus": "SUCCEEDED",
          "user": { "name": "Jane Doe", "email": "jane@example.com" },
          "itemCount": 2,
          "items": [ ... ]
        }
      ],
      "pagination": { "total": 24, "page": 1, "limit": 10, "totalPages": 3 },
      "metrics": { "totalRevenue": 2480.50, "totalUnits": 58 }
    }
  }
  ```

#### `POST /api/orders`
* **Access:** Authenticated
* **Description:** Direct order creation from selected cart items (typically used in cash-on-delivery or staging workflows).
* **Request Body (Optional):** `{ "itemIds": ["cart_item_1"], "expectedTotal": 109.98 }`
* **Response (201 Created):** `{ "success": true, "data": { "orderId": "order_123", "orderNumber": "847291" } }`

#### `GET /api/orders/[id]`
* **Access:** Authenticated (Owner or Admin)
* **Description:** Retrieves canonical single order breakdown, line items, prices, shipping address, and payment status.
* **Response (200 OK):** Detailed order snapshot.

#### `PATCH /api/orders/[id]`
* **Access:** Admin only
* **Description:** Updates the status of an order (`IN_PROGRESS` -> `DISPATCHED` -> `DELIVERED` -> `REJECTED`). Automatically triggers an asynchronous order status notification email to the customer via Celery.
* **Request Body:** `{ "status": "DISPATCHED" }`
* **Response (200 OK):** `{ "success": true, "message": "Order status updated to DISPATCHED", "data": { ... } }`

#### `DELETE /api/orders/[id]`
* **Access:** Admin only
* **Description:** Deletes or cancels an order and restocks inventory back to product variants.
* **Response (200 OK):** `{ "success": true, "message": "Order cancelled and inventory replenished" }`

---

### 5.7 Notifications Endpoints (`/api/notifications`)

#### `GET /api/notifications`
* **Access:** Authenticated
* **Description:** Returns real-time customer notifications (e.g. order placed, dispatched, payment reminders).
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "notifications": [
        {
          "id": "notif_1",
          "title": "Order Dispatched",
          "message": "Your order #847291 has been dispatched!",
          "type": "ORDER_DISPATCHED",
          "orderId": "order_123",
          "isRead": false,
          "createdAt": "2026-09-12T14:30:00.000Z"
        }
      ],
      "unreadCount": 1
    }
  }
  ```

#### `PATCH /api/notifications`
* **Access:** Authenticated
* **Description:** Marks one or all notifications as read.
* **Request Body:** `{ "notificationId": "notif_1" }` or `{ "markAllAsRead": true }`
* **Response (200 OK):** `{ "success": true, "message": "Notifications updated" }`

---

### 5.8 Media Upload Endpoints (`/api/upload`)

#### `POST /api/upload`
* **Access:** Authenticated / Admin
* **Description:** Uploads an image file to Cloudinary CDN and returns secure URL.
* **Request:** Multipart FormData with `file` field.
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "url": "https://res.cloudinary.com/cloudname/image/upload/v12345/ecommerce/item.jpg",
      "publicId": "ecommerce/item"
    }
  }
  ```

---

### 5.9 Stripe Webhook Handlers (`/api/webhooks/stripe`, `/api/stripe/webhook`)

#### `POST /api/webhooks/stripe`
* **Access:** Stripe Webhook Signature (`stripe-signature` header)
* **Description:** Primary production webhook listener. Verifies HMAC-SHA256 signature using `STRIPE_WEBHOOK_SECRET`. Performs idempotent execution using the `StripeWebhookEvent` table.
* **Events Handled:**
  * `payment_intent.succeeded`: Marks `Payment.status = SUCCEEDED`, updates `Order.status = IN_PROGRESS`, clears user cart items, records `paidAt`, and enqueues order placement confirmation email.
  * `payment_intent.payment_failed`: Marks `Payment.status = FAILED`, records failure error code and message.
  * `charge.refunded`: Marks `Payment.status = REFUNDED` or `PARTIALLY_REFUNDED` and records `refundedAt`.
* **Response (200 OK):** `{ "received": true }` or `{ "received": true, "duplicate": true }`

---

### 5.10 Admin Dashboard & Analytics (`/api/admin/dashboard`)

#### `GET /api/admin/dashboard`
* **Access:** Admin only
* **Description:** Computes aggregated KPI metrics for the store administration interface.
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "totalRevenue": 48920.50,
      "totalOrders": 342,
      "totalProducts": 86,
      "totalCustomers": 210,
      "ordersByStatus": {
        "IN_PROGRESS": 14,
        "DISPATCHED": 28,
        "DELIVERED": 290,
        "REJECTED": 10
      },
      "lowStockVariants": [
        { "id": "var_12", "sku": "SHOES-BLK-10", "stock": 2, "productName": "Running Shoes" }
      ],
      "recentOrders": [ ... ],
      "recentImports": [ ... ]
    }
  }
  ```

---

### 5.11 Admin Bulk Product Import Subsystem (`/api/admin/products/bulk/*`, `/api/admin/imports/*`)

#### `POST /api/admin/products/bulk`
* **Access:** Admin only
* **Description:** Accepts a `.csv` or `.xlsx` file (and optional accompanying raw image files). Writes upload files to durable local storage (`storage/imports/<jobId>/`), creates an `ImportJob` record, and enqueues a background job in Celery's `bulk_queue`.
* **Request:** Multipart FormData (`file` or `csvFile`, optional `images` / `files` array).
* **Response (202 Accepted):**
  ```json
  {
    "success": true,
    "message": "Product import has been queued for background processing",
    "data": {
      "jobId": "8f3e2b1a-...",
      "taskId": "celery-task-uuid",
      "filename": "products_spring_2026.csv",
      "status": "QUEUED"
    }
  }
  ```

#### `GET /api/admin/products/bulk/template`
* **Access:** Public / Admin
* **Description:** Downloads a canonical, pre-formatted sample CSV template containing required and optional headers (`Name`, `Description`, `Category`, `Price`, `SKU`, `Stock`, `Option1_Name`, `Option1_Value`, `Images`, etc.).
* **Response (200 OK):** Streamed `text/csv` file download.

#### `GET /api/admin/imports/[id]` & `GET /api/admin/products/import/[jobId]`
* **Access:** Admin only
* **Description:** Polls real-time import progress from the scheduler microservice.
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "id": "8f3e2b1a-...",
      "filename": "products.csv",
      "status": "PROCESSING",
      "total_items": 500,
      "processed_items": 350,
      "successful_items": 340,
      "failed_items": 10,
      "created_at": "2026-09-13T10:00:00",
      "errors": [
        {
          "id": "item_uuid_1",
          "row_index": 42,
          "product_name": "Leather Belt",
          "error_type": "VALIDATION_ERROR",
          "error": "Price must be a positive number",
          "resolution_status": "PENDING"
        }
      ]
    }
  }
  ```

#### `GET /api/admin/imports/[id]/review`
* **Access:** Admin only
* **Description:** Retrieves deep audit review for a completed or failed import job, including paginated list of failed rows, error classifications, and raw input data.
* **Response (200 OK):** Detailed review object with resolution statuses.

#### `PATCH /api/admin/imports/items/[itemId]/resolve`
* **Access:** Admin only
* **Description:** Marks a previously failed import row as resolved after an administrator corrects the product manually.
* **Request Body:** `{ "productId": "prod_new_123" }`
* **Response (200 OK):** `{ "success": true, "message": "Import item marked as resolved" }`

#### `GET /api/admin/imports/[id]/export-errors`
* **Access:** Admin only
* **Description:** Generates and streams a downloadable CSV file containing only the failed rows from the specified import job, prepended with an `Import_Error_Reason` column.
* **Response (200 OK):** Streamed `text/csv` download (`import_errors_<jobId>.csv`).

---

## 6. Complete FastAPI Job Scheduler API Reference

The FastAPI microservice runs on port `8000` (interactive OpenAPI docs at `http://localhost:8000/docs`). All `/jobs/*` endpoints require the `Authorization: Bearer <INTERNAL_SERVICE_TOKEN>` header.

| Endpoint | HTTP | Auth | Celery Queue | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `/health` | `GET` | Public | None | Validates database and Redis connectivity |
| `/jobs/forgot-password` | `POST` | Bearer Token | `high_priority` | Enqueues password reset email task |
| `/jobs/facebook-otp` | `POST` | Bearer Token | `high_priority` | Enqueues Facebook OAuth OTP verification email |
| `/jobs/order-placed` | `POST` | Bearer Token | `default` | Enqueues order placement confirmation email |
| `/jobs/order-status` | `POST` | Bearer Token | `default` | Enqueues order status transition email |
| `/jobs/product-import` | `POST` | Bearer Token | `bulk_queue` | Creates `ImportJob` and enqueues batch CSV processor |
| `/jobs/product-import/{job_id}` | `GET` | Bearer Token | None | Returns real-time counts, status, and failed items |
| `/jobs/product-import/{job_id}/items/{item_id}/resolve` | `PATCH` | Bearer Token | None | Marks import error row as resolved |

---

## 7. Asynchronous Background Processing & Celery Task Engine

### Priority Queues & Task Routing

Celery is configured with 3 dedicated queues to prevent long-running tasks from blocking interactive customer communications:

```mermaid
flowchart LR
    subgraph Queues [Celery Queue Architecture]
        Q1[Queue: high_priority]
        Q2[Queue: default]
        Q3[Queue: bulk_queue]
    end

    subgraph HighTasks [High Priority Tasks]
        T1[send_forgot_password_email]
        T2[send_facebook_otp_email]
    end

    subgraph DefaultTasks [Default Priority Tasks]
        T3[send_order_placed_email]
        T4[send_order_status_email]
        T5[send_cancellation_warning_email]
        T6[process_unpaid_orders_lifecycle]
    end

    subgraph BulkTasks [Bulk Priority Tasks]
        T7[process_bulk_import]
    end

    HighTasks --> Q1
    DefaultTasks --> Q2
    BulkTasks --> Q3
```

1. **`high_priority`:** Interactive authentication (Password reset emails, Facebook OAuth 2FA OTP codes). Max response time < 2 seconds.
2. **`default`:** Transactional storefront notifications (Order confirmations, dispatch emails, cancellation warning reminders) and order lifecycle maintenance.
3. **`bulk_queue`:** Long-running data ingestion (CSV/XLSX imports, image fetching, Cloudinary uploads).

### Celery Beat Periodic Automation
Celery Beat executes a periodic cron task: **`process_unpaid_orders_lifecycle`** (Interval configurable via `BEAT_UNPAID_ORDER_CHECK_INTERVAL_MINUTES`, default: 60 minutes):

* **Phase 1 (Cancellation Warning):** Queries orders in `IN_PROGRESS` with `Payment.status = PENDING` that are older than `(UNPAID_ORDER_REJECTION_HOURS - CANCELLATION_WARNING_HOURS_BEFORE)` (e.g. 96 hours / 4 days). Checks `email_events` table to ensure an email has not already been sent, then dispatches a reminder email warning the customer of order cancellation.
* **Phase 2 (Automatic Cancellation & Stock Replenishment):** Queries orders in `IN_PROGRESS` with `Payment.status = PENDING` older than `UNPAID_ORDER_REJECTION_HOURS` (120 hours / 5 days). Automatically sets `Order.status = REJECTED`, `Payment.status = FAILED`, returns the reserved inventory quantities to `ProductVariant.stock`, and sends a rejection status email.

### Transactional Email Templates (Jinja2)
All emails are rendered using Jinja2 HTML templates in `job-schedular/app/templates/emails/`:
* `forgot_password.html`: Branded password reset email with secure action button.
* `facebook_otp.html`: Clean 6-digit OTP verification email.
* `order_placed.html`: Complete order summary with itemized line items, unit prices, tax, and delivery address.
* `order_status.html`: Real-time tracking update for status transitions (`IN_PROGRESS`, `DISPATCHED`, `DELIVERED`, `REJECTED`).
* `cancellation_warning.html`: Urgent warning email with direct payment link before automated order cancellation.

---

## 8. Bulk Product Import & Asset Ingestion Subsystem

The bulk product importer is designed for enterprise data ingestion capable of processing thousands of products:

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Admin User
    participant Web as Next.js Web App
    participant Disk as Local Storage (/storage)
    participant Fast as FastAPI Microservice
    participant Worker as Celery Worker (bulk_queue)
    participant Cloud as Cloudinary CDN
    participant DB as PostgreSQL

    Admin->>Web: Uploads products.csv + images zip/files
    Web->>Disk: Saves files to /storage/imports/<jobId>/
    Web->>Fast: POST /jobs/product-import (csvPath, imagesPath)
    Fast->>DB: Inserts ImportJob (status: QUEUED)
    Fast->>Worker: Enqueues process_bulk_import.delay(jobId)
    Fast-->>Web: Returns HTTP 202 Accepted (jobId)
    Web-->>Admin: Displays Live Progress Modal

    Worker->>DB: Updates ImportJob (status: PROCESSING, started_at)
    Worker->>Disk: Reads CSV & streams rows in batches of 50
    loop For Each Row in Batch
        alt Validation Passed
            Worker->>Cloud: Uploads image file or URL (if configured)
            Cloud-->>Worker: Returns secure CDN URL
            Worker->>DB: Upserts Category, Product, Options & ProductVariant
            Worker->>DB: Inserts ImportItem (status: SUCCESS, product_id)
        else Validation Failed
            Worker->>DB: Inserts ImportItem (status: FAILED, error_message, raw_data)
        end
    end
    Worker->>DB: Updates ImportJob (status: COMPLETED, processed_items, failed_items)
    Web->>Fast: Polls GET /jobs/product-import/<jobId>
    Fast-->>Web: Returns progress counts and failed row details
    Web-->>Admin: Renders Error Review Table & CSV Error Export
```

### Key Import Features
* **Chunked Batch Processing:** Processes rows in configurable chunks (`BULK_IMPORT_BATCH_SIZE = 50`) inside atomic database transactions.
* **Option & Variant Matrix Generator:** Automatically generates `ProductOption` records and combines them into multi-variant SKUs.
* **Smart Image Ingestion:** Supports local image files (uploaded in multipart payload) and external image URLs, automatically uploading them to Cloudinary CDN with fallback to local static assets.
* **Error Isolation & Review UI:** If a row fails validation (e.g. invalid price, missing name, duplicate SKU), only that row is logged in `ImportItem`; all valid rows in the batch are committed.
* **Inline Resolution & Failed Rows Re-export:** Admins can review raw JSON errors in the admin UI, fix individual products, or download a CSV containing only the failed rows with prepended error explanations.

---

## 9. Checkout, Payment Lifecycle & Webhook Processing

```mermaid
stateDiagram-v2
    [*] --> Cart: Customer adds items
    Cart --> Checkout: Initiates Checkout
    Checkout --> StripeIntent: createCheckoutPaymentIntentServer()
    
    state StripeIntent {
        [*] --> OrderCreated: Order (IN_PROGRESS), Payment (PENDING)
        OrderCreated --> StockReserved: Decrements Variant Stock
        StockReserved --> IntentReturned: Returns clientSecret
    }
    
    IntentReturned --> PaymentModal: Customer enters Card / 1-Click
    PaymentModal --> StripeProcessing: Stripe confirms payment

    state StripeWebhook {
        StripeProcessing --> Succeeded: payment_intent.succeeded
        StripeProcessing --> Failed: payment_intent.payment_failed
        Succeeded --> OrderConfirmed: Payment (SUCCEEDED), Cart Cleared
        Failed --> PaymentPending: Payment (FAILED), Order remains retryable
    }

    OrderConfirmed --> DeliveryFlow: Admin dispatches order
    DeliveryFlow --> Delivered: Order (DELIVERED)
    
    PaymentPending --> AutoCancel: Celery Beat 120h Expired
    AutoCancel --> Rejected: Order (REJECTED), Stock Replenished
    Rejected --> [*]
    Delivered --> [*]
```

### Idempotency & Stock Safety
1. **Stock Reservation:** Inventory is verified and decremented when the checkout `PaymentIntent` is initialized.
2. **Webhook Deduplication:** Every webhook event is checked against the `StripeWebhookEvent` table by its unique Stripe event ID (`evt_...`). If already processed, the endpoint returns `200 OK (duplicate)` immediately.
3. **Automatic Restock on Failure/Cancellation:** If an order is cancelled by an administrator or rejected by the Celery Beat unpaid lifecycle cron, stock is automatically returned to each `ProductVariant`.

---

## 10. Storefront Shopping Cart Engine & Pricing Rules

* **Dual Guest/User State:** Guest carts track items using an anonymous `sessionId` cookie; upon logging in, guest cart items are merged into the user's persistent database cart.
* **Dynamic Pricing & Tax Calculation:**
  * **Subtotal:** Sum of `(Product.price * quantity)` across all selected cart items.
  * **Tax Rate:** Defined by `TAX_RATE = 0.10` (10% standard sales tax).
  * **Total Amount:** `Subtotal + (Subtotal * TAX_RATE)`.
* **Stock Clamping:** Quantity increments are checked against live `ProductVariant.stock`.

---

## 11. Configuration & Environment Variable Matrix

### Next.js Core Application (`ecommerce-app/.env`)

| Variable Name | Required | Default / Example | Purpose |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | Yes | `postgresql://postgres:password@localhost:5432/ecommerce_db` | PostgreSQL connection string for Prisma |
| `NEXTAUTH_SECRET` | Yes | `your-32-character-nextauth-secret` | NextAuth JWT encryption key |
| `NEXTAUTH_URL` | Yes | `http://localhost:3000` | Canonical frontend origin |
| `FACEBOOK_CLIENT_ID` | No | `1234567890` | Facebook OAuth App ID |
| `FACEBOOK_CLIENT_SECRET`| No | `abcdef...` | Facebook OAuth App Secret |
| `STRIPE_SECRET_KEY` | Yes | `sk_test_...` | Stripe API Secret Key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | `pk_test_...` | Stripe Public Key for Elements |
| `STRIPE_WEBHOOK_SECRET`| Yes | `whsec_...` | Stripe Webhook signing secret |
| `JOB_SCHEDULER_URL` | Yes | `http://localhost:8000` | URL to FastAPI microservice |
| `INTERNAL_SERVICE_TOKEN`| Yes | `supersecret_internal_service_token_default` | Shared service-to-service token |
| `CLOUDINARY_CLOUD_NAME`| No | `my-cloud` | Cloudinary CDN cloud name |
| `CLOUDINARY_API_KEY` | No | `123456789` | Cloudinary API Key |
| `CLOUDINARY_API_SECRET`| No | `secret...` | Cloudinary API Secret |

### Job Scheduler & Celery Worker (`ecommerce-app/job-schedular/.env`)

| Variable Name | Required | Default / Example | Purpose |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | Yes | `postgresql+psycopg://postgres:password@localhost:5432/ecommerce_db` | PostgreSQL connection string for SQLAlchemy |
| `REDIS_URL_BROKER` | Yes | `redis://localhost:6379/0` | Celery message broker URL |
| `REDIS_URL_BACKEND` | Yes | `redis://localhost:6379/1` | Celery task result backend URL |
| `INTERNAL_SERVICE_TOKEN`| Yes | `supersecret_internal_service_token_default` | Shared service-to-service token |
| `APP_FRONTEND_URL` | Yes | `http://localhost:3000` | Frontend URL for links in email templates |
| `SMTP_HOST` | Yes | `smtp.mailtrap.io` | SMTP Mail server hostname |
| `SMTP_PORT` | Yes | `2525` | SMTP port (e.g. 587 or 2525) |
| `SMTP_USER` | Yes | `mailtrap_user` | SMTP username |
| `SMTP_PASS` | Yes | `mailtrap_pass` | SMTP password |
| `SMTP_USE_TLS` | Yes | `True` | Enable TLS for SMTP |
| `EMAIL_FROM` | Yes | `Ecommerce Store <noreply@ecommerceapp.com>` | Sender header in outgoing emails |
| `CELERY_TIMEZONE` | Yes | `Asia/Karachi` | Celery Beat timezone |
| `UNPAID_ORDER_REJECTION_HOURS` | No | `120` (5 Days) | Threshold for auto-cancelling unpaid orders |
| `CANCELLATION_WARNING_HOURS_BEFORE` | No | `24` | Hours before rejection to send warning email |
| `BEAT_UNPAID_ORDER_CHECK_INTERVAL_MINUTES` | No | `60` | Celery Beat cron check interval |
| `BULK_IMPORT_BATCH_SIZE` | No | `50` | Row chunk size for bulk product import |
| `CLOUDINARY_CLOUD_NAME`| No | `my-cloud` | Cloudinary CDN cloud name |
| `CLOUDINARY_API_KEY` | No | `123456789` | Cloudinary API Key |
| `CLOUDINARY_API_SECRET`| No | `secret...` | Cloudinary API Secret |

---

## 12. Operations, Testing & Terminal Cheatsheet

### Terminal Execution Reference Table

| # | Service Name | Working Directory | Command Line | Port / URL |
| :- | :--- | :--- | :--- | :--- |
| **0** | **Redis Server** | System | `brew services start redis` | `localhost:6379` |
| **1** | **Next.js Web App** | `ecommerce-app` | `npm run dev` | `http://localhost:3000` |
| **2** | **FastAPI Scheduler** | `ecommerce-app/job-schedular` | `source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload` | `http://localhost:8000` |
| **3** | **Celery Worker** | `ecommerce-app/job-schedular` | `source .venv/bin/activate && celery -A app.celery_app.celery_app worker --loglevel=info -Q high_priority,default,bulk_queue --concurrency=4` | Background Worker |
| **4** | **Celery Beat** | `ecommerce-app/job-schedular` | `source .venv/bin/activate && celery -A app.celery_app.celery_app beat --loglevel=info` | Background Cron |
| **5** | **Celery Flower** | `ecommerce-app/job-schedular` | `source .venv/bin/activate && celery -A app.celery_app.celery_app flower --port=5556 --basic_auth=admin:password` | `http://localhost:5556` |
| **6** | **Prisma Studio** | `ecommerce-app` | `npx prisma studio` | `http://localhost:5555` |
| **7** | **Stripe Webhook Listener** | `ecommerce-app` | `stripe listen --forward-to localhost:3000/api/webhooks/stripe` | Local CLI Forwarder |

---

### Automated Testing Suites

#### 1. Next.js Frontend & API Tests (Jest)
```bash
# Run all Jest unit & integration tests
npm test

# Run tests in watch mode
npm run test:watch
```

#### 2. Python Scheduler & Celery Tests (Pytest)
```bash
cd job-schedular
source .venv/bin/activate

# Run full test suite with mocked Redis & SQLite/Postgres DB
pytest -v
```

---

*This document serves as the complete technical specification and operational audit for the entire Ecommerce Platform codebase.*
