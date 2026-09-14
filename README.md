# 🛍️ ShopFastStore: Enterprise E-Commerce Platform & Distributed Asynchronous Architecture

A high-performance, enterprise-grade E-Commerce platform built with **Next.js 15 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS**, **Prisma ORM**, **PostgreSQL**, and a distributed background job processing engine powered by **FastAPI**, **Celery 5.4**, **Redis**, and **Flower**.

---

## 📑 Table of Contents

- [System Architecture Overview](#-system-architecture-overview)
- [Key Features & Subsystems](#-key-features--subsystems)
- [Technology Stack](#-technology-stack)
- [Database Schema & Models](#-database-schema--models)
- [Complete REST API Reference](#-complete-rest-api-reference)
- [Asynchronous Worker & Background Processing](#-asynchronous-worker--background-processing)
- [🖥️ Terminal Operations & Running the Services](#️-terminal-operations--running-the-services)
- [⚙️ Installation & Prerequisites](#️-installation--prerequisites)
- [🔐 Environment Configuration Matrix](#-environment-configuration-matrix)
- [🧪 Testing & Quality Assurance](#-testing--quality-assurance)

---

## 🏗️ System Architecture Overview

The system employs a decoupled, multi-service architecture:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                      Next.js 15 App (Port 3000)                         │
│  • Modern Storefront (Catalog, Dynamic Variants, Cart, Checkout)        │
│  • Admin Console (Product Matrix, Bulk Imports, KPI Dashboard)          │
│  • NextAuth.js (Credentials, Facebook OAuth + OTP Fallback)             │
│  • Stripe Elements & 1-Click Saved Payment Methods                      │
└────────────────┬───────────────────────────────────────┬────────────────┘
                 │                                       │
        HTTP (Bearer Token)                      Prisma ORM (Direct SQL)
                 │                                       │
                 ▼                                       ▼
┌────────────────────────────────┐       ┌────────────────────────────────┐
│  FastAPI Gateway (Port 8000)   │       │      PostgreSQL Database       │
│   • /jobs/forgot-password      │       │     (Port 5432, shared DB)     │
│   • /jobs/facebook-otp         │       └────────────────▲───────────────┘
│   • /jobs/order-placed         │                        │
│   • /jobs/order-status         │                 SQLAlchemy 2.0 /
│   • /jobs/product-import       │                 Psycopg3 Batch
└────────────────┬───────────────┘                        │
                 │                                        │
           Task Enqueue                                   │
                 │                                        │
                 ▼                                        │
┌────────────────────────────────┐                        │
│    Redis Broker (Port 6379)    │                        │
│  DB 0: Tasks | DB 1: Results   │                        │
└────────────────┬───────────────┘                        │
                 │                                        │
          Consume Tasks                                   │
                 │                                        │
                 ▼                                        │
┌─────────────────────────────────────────────────────────┴───────────────┐
│                    Celery Distributed Workers                           │
│   • high_priority: Auth OTP, Password Reset Emails (< 2s latency)       │
│   • default: Order Confirmations, Status Changes, Warning Reminders     │
│   • bulk_queue: CSV Product & Variant Ingestion, Cloudinary Uploads     │
│                                                                         │
│  • Celery Beat: Hourly cron for 24h cancellation warnings & 120h auto   │
│                 rejection with inventory restocking                     │
│  • Celery Flower: Real-time visual monitoring dashboard on Port 5556    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features & Subsystems

### 1. 🛒 Storefront & Shopping Cart
* **Dynamic Variant Matrix**: Products support multiple dynamic options (e.g. Size, Color, Material) with independent SKU, pricing, image galleries, and real-time inventory tracking.
* **Persistent Cart Management**: Supports both guest sessions (cookie-backed) and authenticated user carts (PostgreSQL-backed) with automatic item merging upon sign-in.
* **Tax & Price Calculation**: Real-time subtotal, itemized line totals, and configurable sales tax (`TAX_RATE = 10%`).

### 2. 💳 Stripe Checkout & Saved Payment Methods
* **Stripe PaymentIntent Integration**: Secure payment processing with server-side inventory verification and stock reservation.
* **1-Click Checkout (SetupIntent)**: Customers can securely save multiple credit/debit cards (`PaymentMethod`) for fast repeat checkouts.
* **Idempotent Webhook Listener**: Verifies Stripe HMAC-SHA256 signatures and guards against duplicate event replays using the `StripeWebhookEvent` table.

### 3. 📦 Order Management & Automated Lifecycle (Celery Beat)
* **Status Transitions**: `IN_PROGRESS` ➔ `DISPATCHED` ➔ `DELIVERED` ➔ `REJECTED`.
* **24h Cancellation Warning**: Sends reminder emails to customers whose unpaid orders are approaching expiration.
* **120h Auto-Rejection & Restock**: Automatically marks abandoned unpaid orders as `REJECTED` and returns reserved inventory to variant stock.

### 4. 🚀 High-Volume Bulk Product Importer
* **Multipart CSV/XLSX & Image Upload**: Ingests spreadsheets alongside raw image folders in `storage/imports/<jobId>/`.
* **Asynchronous Chunking**: Background processing in batches (`BULK_IMPORT_BATCH_SIZE = 50`) inside isolated database transactions.
* **Cloudinary Asset Ingestion**: Automatically uploads referenced images to Cloudinary CDN with local fallback.
* **Error Review & Resolution**: Row-level failure tracking (`ImportItem`), inline admin error editing, downloadable error CSV export, and **automatic storage directory cleanup upon completion or resolution**.

### 5. 🔐 Authentication & Role-Based Access Control
* **NextAuth.js Credentials & Facebook OAuth**: Secure sessions with Bcrypt password hashing.
* **Facebook 2FA / OTP Fallback**: Generates and emails a 6-digit OTP code to verify and link accounts when Facebook does not provide an email.
* **Password Reset**: Cryptographic reset tokens with 1-hour expiration and background email dispatch.
* **Role Guards**: Edge middleware protecting `/admin/*`, `/orders/*`, `/cart`, and `/checkout`.

---

## 🛠️ Technology Stack

| Domain | Technology |
| :--- | :--- |
| **Web Framework** | Next.js 15 (App Router, React 19, TypeScript) |
| **Styling & Icons** | Tailwind CSS, Lucide React, Radix UI Primitives |
| **Microservice Framework** | FastAPI 0.115, Pydantic 2, Uvicorn |
| **Task Queue & Cron** | Celery 5.4, Celery Beat, Celery Flower 2.0 |
| **Message Broker** | Redis 5.2 |
| **Databases & ORMs** | PostgreSQL, Prisma ORM 5.22, SQLAlchemy 2.0, Psycopg3 |
| **Payments** | Stripe API, Stripe Elements, Stripe Webhooks |
| **Media & CDN** | Cloudinary SDK |
| **Transactional Email** | Jinja2 HTML Templates, SMTP TLS/SSL, Mailtrap |
| **Testing** | Jest (Next.js/TypeScript), Pytest (FastAPI/Celery) |

---

## 🗄️ Database Schema & Models

The PostgreSQL database is shared between **Prisma ORM** (TypeScript) and **SQLAlchemy** (Python):

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

### Models Overview
- `User`: Roles (`USER`, `ADMIN`), Stripe Customer ID, embedded shipping address.
- `Account`: OAuth provider connections (Facebook, etc.).
- `Category`: Categorization for product discovery.
- `Product`: Base product entity with title, description, base price, and active state.
- `ProductOption` & `ProductOptionValue`: Configurable attributes (e.g. Size: S, M, L; Color: Red, Blue).
- `ProductVariant` & `VariantOption`: Concrete sellable SKUs with stock counts and image arrays.
- `Cart` & `CartItem`: Multi-item shopping cart linked to users or guest sessions.
- `Order` & `OrderItem`: Immutable order records, line items, prices, and tax computations.
- `Payment`: Stripe `PaymentIntent` records, idempotency keys, and payment status history.
- `PaymentMethod`: Tokenized customer cards saved for 1-click checkout.
- `StripeWebhookEvent`: Deduplication table for Stripe webhook event replays.
- `EmailEvent`: Delivery log ensuring no duplicate order lifecycle emails are sent.
- `ImportJob` & `ImportItem`: Staging and row-by-row tracking for bulk CSV imports.
- `VerificationToken`: 6-digit OTP codes and password reset tokens.

---

## 📡 Complete REST API Reference

### 1. Next.js Core APIs (`/api/*`)

| Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/signup` | Public | Register new customer account |
| `POST` | `/api/auth/change-password` | Authenticated | Update user password |
| `POST` | `/api/auth/forgot-password` | Public | Generate reset token & enqueue email |
| `POST` | `/api/auth/reset-password` | Public | Verify token & set new password |
| `POST` | `/api/auth/facebook/send-otp` | Public | Send 6-digit OTP for Facebook account linking |
| `POST` | `/api/auth/facebook/verify-otp` | Public | Verify OTP & link Facebook account |
| `GET, PUT` | `/api/user/address` | Authenticated | Get or update saved shipping address |
| `GET, POST`| `/api/categories` | Public / Admin | List or create product categories |
| `GET, POST`| `/api/products` | Public / Admin | Query catalog (search/sort/page) or create product |
| `GET, PUT, DELETE`| `/api/products/[id]` | Public / Admin | Get details, update, or soft-delete product |
| `PATCH`| `/api/products/[id]/status` | Admin | Toggle product active/inactive visibility |
| `GET, POST, DELETE`| `/api/cart` | Authenticated | Fetch cart, add variant to cart, clear cart |
| `PATCH, DELETE`| `/api/cart/items/[id]` | Authenticated | Update quantity or remove cart item |
| `POST` | `/api/checkout/create-intent` | Authenticated | Create Stripe PaymentIntent & reserve stock |
| `POST` | `/api/orders/[id]/payment-intent` | Authenticated | Retry payment for pending order |
| `POST` | `/api/payment-methods/setup-intent` | Authenticated | Create Stripe SetupIntent to save a card |
| `GET, POST`| `/api/payment-methods` | Authenticated | List or attach saved payment methods |
| `PATCH`| `/api/payment-methods/[id]/default` | Authenticated | Set card as default payment method |
| `DELETE`| `/api/payment-methods/[id]` | Authenticated | Delete saved card from DB & Stripe |
| `GET, POST`| `/api/orders` | Authenticated | List user/admin orders or place direct order |
| `GET, PATCH, DELETE`| `/api/orders/[id]` | Authenticated / Admin | View order details, update status, or cancel |
| `GET, PATCH`| `/api/notifications` | Authenticated | View in-app notifications or mark as read |
| `POST` | `/api/upload` | Authenticated / Admin | Upload single image to Cloudinary |
| `POST` | `/api/webhooks/stripe` | Stripe Signature | Idempotent webhook receiver (`payment_intent.succeeded`) |
| `GET`  | `/api/admin/dashboard` | Admin | KPI metrics (revenue, orders, low-stock alerts) |
| `POST` | `/api/admin/products/bulk` | Admin | Upload CSV & image folder for background import |
| `GET`  | `/api/admin/products/bulk/template`| Public / Admin | Download sample CSV product import template |
| `GET`  | `/api/admin/imports/[id]` | Admin | Poll real-time import progress |
| `GET`  | `/api/admin/imports/[id]/review` | Admin | Inspect failed import rows & raw data |
| `PATCH`| `/api/admin/imports/items/[itemId]/resolve` | Admin | Mark failed row as resolved & trigger auto cleanup |
| `GET`  | `/api/admin/imports/[id]/export-errors` | Admin | Download CSV containing only failed rows |

---

### 2. FastAPI Job Scheduler APIs (`http://localhost:8000`)

Protected with `Authorization: Bearer <INTERNAL_SERVICE_TOKEN>`:

| Method | Endpoint | Celery Queue | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | None | Public health check (validates DB & Redis) |
| `POST`| `/jobs/forgot-password` | `high_priority` | Enqueue password reset email |
| `POST`| `/jobs/facebook-otp` | `high_priority` | Enqueue Facebook OAuth OTP email |
| `POST`| `/jobs/order-placed` | `default` | Enqueue order confirmation email |
| `POST`| `/jobs/order-status` | `default` | Enqueue status transition email |
| `POST`| `/jobs/product-import` | `bulk_queue` | Enqueue bulk product import task |
| `GET` | `/jobs/product-import/{job_id}` | None | Get real-time job progress & error list |
| `PATCH`| `/jobs/product-import/{job_id}/items/{item_id}/resolve` | None | Mark error item as resolved |

---

## ⚡ Asynchronous Worker & Background Processing

### Multi-Queue Architecture

```text
┌───────────────────────┐
│     high_priority     │ ➔ Auth OTPs & Password Resets (< 2s latency)
└───────────────────────┘
┌───────────────────────┐
│        default        │ ➔ Order Confirmation, Status Transitions, Warning Emails
└───────────────────────┘
┌───────────────────────┐
│      bulk_queue       │ ➔ CSV Product Import, Cloudinary Ingestion, Batch Parsing
└───────────────────────┘
```

### Celery Beat Periodic Cron (`process_unpaid_orders_lifecycle`)
* **Frequency**: Configurable via `BEAT_UNPAID_ORDER_CHECK_INTERVAL_MINUTES` (Default: 60 minutes).
* **Phase 1 (24h Cancellation Warning)**: Finds unpaid orders older than 96 hours and dispatches an urgent payment reminder.
* **Phase 2 (120h Expiration Rejection)**: Finds unpaid orders older than 120 hours, marks them `REJECTED`, and replenishes inventory back to `ProductVariant.stock`.

---

## 🖥️ Terminal Operations & Running the Services

To run the complete system locally, start the background Redis service and open the following **7 terminals**:

```
📁 Root Directory:          ecommerce-app
📁 Job Scheduler Directory: ecommerce-app/job-schedular
```

| # | Terminal Name | Working Directory | Command Line | Port / URL | Purpose |
| :- | :--- | :--- | :--- | :--- | :--- |
| **0** | **Redis Server** | System | `brew services start redis` | `localhost:6379` | Broker & Result Backend |
| **1** | **Next.js Web App** | `ecommerce-app` | `npm run dev` | `http://localhost:3000` | Storefront, Admin & APIs |
| **2** | **FastAPI Scheduler**| `job-schedular` | `source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload` | `http://localhost:8000` | Job Gateway API |
| **3** | **Celery Worker** | `job-schedular` | `source .venv/bin/activate && celery -A app.celery_app.celery_app worker --loglevel=info -Q high_priority,default,bulk_queue --concurrency=4` | N/A | Task Worker Engine |
| **4** | **Celery Beat** | `job-schedular` | `source .venv/bin/activate && celery -A app.celery_app.celery_app beat --loglevel=info` | N/A | Periodic Cron Daemon |
| **5** | **Celery Flower** | `job-schedular` | `source .venv/bin/activate && celery -A app.celery_app.celery_app flower --port=5556 --basic_auth=admin:password` | `http://localhost:5556` | Task Monitor GUI |
| **6** | **Prisma Studio** | `ecommerce-app` | `npx prisma studio` | `http://localhost:5555` | Database GUI Browser |
| **7** | **Stripe Webhook** | `ecommerce-app` | `stripe listen --forward-to localhost:3000/api/webhooks/stripe` | N/A | Stripe Webhook Forwarder |

---

## ⚙️ Installation & Prerequisites

### 1. Prerequisites
- **Node.js**: v18.0+
- **Python**: v3.10+ (Recommended: Python 3.12)
- **PostgreSQL**: v14+ running on `localhost:5432`
- **Redis**: running on `localhost:6379`
- **Stripe CLI**: (optional, for local webhook forwarding)

---

### 2. Next.js Web App Setup
```bash
# In project root:
cd ecommerce-app

# Install dependencies:
npm install

# Push database schema & generate client:
npx prisma db push
npx prisma generate
```

---

### 3. Job Scheduler Setup
```bash
# Navigate to job-schedular:
cd ecommerce-app/job-schedular

# Create and activate Python virtual environment:
python3 -m venv .venv
source .venv/bin/activate

# Install requirements:
pip install -r requirements.txt
```

---

## 🔐 Environment Configuration Matrix

### Root Application (`ecommerce-app/.env`)
```env
# Database (Prisma)
DATABASE_URL="postgresql://postgres:password@localhost:5432/ecommerce_db?schema=public"

# NextAuth
NEXTAUTH_SECRET="your_32_character_nextauth_secret_key"
NEXTAUTH_URL="http://localhost:3000"

# Background Job Scheduler Microservice
JOB_SCHEDULER_URL="http://localhost:8000"
INTERNAL_SERVICE_TOKEN="supersecret_internal_service_token_default"

# Stripe Payments
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# Cloudinary (Optional Image Storage)
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"

# OAuth (Optional)
FACEBOOK_CLIENT_ID="your_facebook_client_id"
FACEBOOK_CLIENT_SECRET="your_facebook_client_secret"
```

### Job Scheduler (`ecommerce-app/job-schedular/.env`)
```env
# Database (SQLAlchemy psycopg3 format)
DATABASE_URL=postgresql+psycopg://postgres:password@localhost:5432/ecommerce_db

# Redis Broker (DB 0) & Backend (DB 1)
REDIS_URL_BROKER=redis://localhost:6379/0
REDIS_URL_BACKEND=redis://localhost:6379/1

# Security
INTERNAL_SERVICE_TOKEN=supersecret_internal_service_token_default

# Frontend Origin (Used in transactional email action links)
APP_FRONTEND_URL=http://localhost:3000

# SMTP Email Delivery (Mailtrap or standard SMTP)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your_mailtrap_user
SMTP_PASS=your_mailtrap_password
SMTP_USE_TLS=true
EMAIL_FROM=Ecommerce Store <noreply@ecommerceapp.com>

# Celery Configuration
CELERY_TIMEZONE=Asia/Karachi
LOG_LEVEL=INFO

# Lifecycle Automation
UNPAID_ORDER_REJECTION_HOURS=120
CANCELLATION_WARNING_HOURS_BEFORE=24
BEAT_UNPAID_ORDER_CHECK_INTERVAL_MINUTES=60

# Cloudinary (Background worker uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## 🧪 Testing & Quality Assurance

### Run Frontend & Full-Stack Tests (Jest)
```bash
npm test
```
*Executes all **245 unit & integration tests** covering Authentication, Facebook OTP, Cart, Checkout, Order Management, Stripe Webhooks, and Bulk Import Templates.*

---

### Run Job Scheduler & Celery Worker Tests (Pytest)
```bash
cd job-schedular
source .venv/bin/activate
pytest -v
```
*Executes all **49 tests** covering FastAPI Endpoints, Celery Task Queues, Bulk CSV Ingestion, Cloudinary Fallbacks, and Beat Unpaid Order Lifecycle.*

---

*Maintained by the Engineering Team — ShopFastStore E-Commerce Platform.*
