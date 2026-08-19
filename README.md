# Full-Stack Production E-Commerce Application

## Tech Stack
- Next.js 15
- TypeScript
- PostgreSQL
- Prisma
- NextAuth.js
- Tailwind CSS

## Description

The application is designed around a layered architecture that separates the **HTTP/API layer**, **backend business logic**, **frontend API clients**, and **database access**. It includes variant-aware inventory management, transactional order processing, role-based administration, authentication, price-change protection, and defensive cart/order handling.

---

## ✨ Features

* 🛍️ Product catalog with search, filtering, sorting, and category browsing
* 🎨 Multi-option product variants such as **Color** and **Size**
* 📦 Variant-level inventory management
* 🛒 Persistent cart with quantity and stock validation
* 💰 Price-change protection during checkout
* 🔄 Defensive handling of deleted/inactive products and variants
* 🧾 Transactional order creation and inventory updates
* 👨‍💼 Dedicated admin portal
* 🔐 Credentials-based authentication with JWT sessions
* 🛡️ Role-based access control for administrative operations
* 🔑 Password reset and email verification flows
* 🔔 In-app order and status notifications
* 📊 Admin dashboard with revenue and order analytics
* ⚡ Atomic inventory updates to prevent overselling
* ✅ Zod-based request validation
* 🧱 Layered backend architecture for maintainability

---

# 🏗️ Architecture

The application follows a layered three-tier architecture:

```text
┌──────────────────────────────────────────────┐
│                 CLIENT / UI                  │
│                                              │
│  React Components / Server Components        │
│                    │                         │
│                    ▼                         │
│       Frontend Service Layer                 │
│       src/services/                          │
│                    │                         │
│                fetch()                       │
└────────────────────┼─────────────────────────┘
                     │ HTTP
                     ▼
┌──────────────────────────────────────────────┐
│               API / HTTP LAYER               │
│                                              │
│       src/app/api/**/route.ts                │
│                                              │
│  • Authentication / authorization            │
│  • Request parsing                           │
│  • Input validation                          │
│  • HTTP status / response handling           │
└────────────────────┼─────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────┐
│            BACKEND SERVICE LAYER             │
│                                              │
│       src/server/services/                   │
│                                              │
│  • Business logic                            │
│  • Transactions                              │
│  • Inventory validation                      │
│  • Cart/order processing                     │
└────────────────────┼─────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────┐
│              DATA ACCESS LAYER               │
│                                              │
│                  Prisma                      │
│                     │                        │
│                     ▼                        │
│                 PostgreSQL                   │
└──────────────────────────────────────────────┘
```


# 🛠️ Technology Stack

| Technology         | Purpose                    |
| ------------------ | -------------------------- |
| **Next.js 15**     | Full-stack React framework |
| **React**          | User interface             |
| **TypeScript**     | Type safety                |
| **Tailwind CSS**   | Styling                    |
| **Prisma ORM**     | Database access            |
| **PostgreSQL**     | Relational database        |
| **NextAuth.js**    | Authentication             |
| **bcryptjs**       | Password hashing           |
| **Zod**            | Runtime validation         |
| **Lucide React**   | Icons                      |
| **Prisma Migrate** | Database migrations        |

---

# ⚙️ Getting Started

## Prerequisites

Make sure you have:

* Node.js 18+
* npm
* PostgreSQL
* Git

---

## 1. Clone the Repository

```bash
git clone https://github.com/hassaniftikhar-design/ecommerence-1.git
cd ecommerence-1
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Configure Environment Variables

create env file 

### Database
DATABASE_URL="postgresql://postgres:6856@localhost:5432/ecommerce_db?schema=public"

### NextAuth
NEXTAUTH_SECRET="supersecretkey_change_in_production_12345"
NEXTAUTH_URL="http://localhost:3000"

### SMTP Configuration
SMTP_HOST="smtp.mailtrap.io"
SMTP_PORT="2525"
SMTP_USER="smtp_user_placeholder"
SMTP_PASS="smtp_pass_placeholder"
EMAIL_FROM="noreply@ecommerceapp.com"

### Cloudinary Storage Configuration 
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"




---

## 4. Run Database Migrations

```bash
npx prisma migrate dev
```

Generate the Prisma client:

```bash
npx prisma generate
```

---

## 5. Start the Development Server

```bash
npm run dev
```

The application will be available at:

```text
http://localhost:3000
```

---

# 🧪 Verification

Before submitting or deploying the application, run:

### TypeScript

```bash
npx tsc --noEmit
```

### ESLint

```bash
npm run lint
```

### Production Build

```bash
npm run build
```

A successful production build should complete without TypeScript, ESLint, or compilation errors.

---


# 🔒 Production Considerations

Before deploying to production, configure:

* Production PostgreSQL database
* Secure `NEXTAUTH_SECRET`
* Production environment variables
* SMTP/email provider
* Database connection pooling where required
* Secure CORS/origin configuration where applicable
* Production logging and monitoring
* Image storage configuration


