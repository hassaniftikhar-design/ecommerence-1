# 🖥️ Terminal Commands & Execution Cheatsheet

Quick-reference cheatsheet for all 7 application terminals and the background Redis service.

---

## 📋 Quick Terminal Reference Table

| # | Terminal Name | Working Directory | Command Line | Port / URL | Purpose |
| :- | :--- | :--- | :--- | :--- | :--- |
| **0** | **Redis Server** | System (Homebrew) | `brew services start redis` | `localhost:6379` | Message broker & Celery backend |
| **1** | **Next.js Web App** | `ecommerce-app` | `npm run dev` | `http://localhost:3000` | Main storefront, admin UI & API |
| **2** | **FastAPI Scheduler** | `ecommerce-app/job-schedular` | `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload` | `http://localhost:8000` | REST API for enqueuing async jobs |
| **3** | **Celery Worker** | `ecommerce-app/job-schedular` | `celery -A app.celery_app.celery_app worker --loglevel=info -Q high_priority,default,bulk_queue --concurrency=4` | N/A | Multi-queue async task processor |
| **4** | **Celery Beat** | `ecommerce-app/job-schedular` | `celery -A app.celery_app.celery_app beat --loglevel=info` | N/A | Periodic cron scheduler |
| **5** | **Celery Flower** | `ecommerce-app/job-schedular` | `celery -A app.celery_app.celery_app flower --port=5556 --basic_auth=admin:password` | `http://localhost:5556` | Visual task monitoring dashboard |
| **6** | **Prisma Studio** | `ecommerce-app` | `npx prisma studio` | `http://localhost:5555` | PostgreSQL visual database GUI |
| **7** | **Stripe Webhook** | `ecommerce-app` | `stripe listen --forward-to localhost:3000/api/webhooks/stripe` | N/A | Local Stripe payment webhook forwarder |

---

## 🚀 Terminal-by-Terminal Details

### ⚡ Background Service: Redis Server
Ensure Redis is running before starting Celery workers or FastAPI:
```bash
brew services start redis
# Check if running:
redis-cli ping
# Expected output: PONG
```

---

### 💻 Terminal 1: Next.js Web Application
* **Working Directory:** `/Users/hasssaniftikhar/Desktop/Training/Project/ecommerce-app`
* **Port:** `http://localhost:3000`
```bash
npm run dev
```

---

### 💻 Terminal 2: FastAPI Job Scheduler Microservice
* **Working Directory:** `/Users/hasssaniftikhar/Desktop/Training/Project/ecommerce-app/job-schedular`
* **Port:** `http://localhost:8000` *(Docs at `http://localhost:8000/docs`)*
```bash
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

### 💻 Terminal 3: Celery Worker (Async Task Engine)
* **Working Directory:** `/Users/hasssaniftikhar/Desktop/Training/Project/ecommerce-app/job-schedular`
* **Queues:** `high_priority` (Auth OTP/Reset), `default` (Order/Notifications), `bulk_queue` (Product CSV imports)
```bash
source .venv/bin/activate
celery -A app.celery_app.celery_app worker --loglevel=info -Q high_priority,default,bulk_queue --concurrency=4
```

---

### 💻 Terminal 4: Celery Beat (Cron Scheduler)
* **Working Directory:** `/Users/hasssaniftikhar/Desktop/Training/Project/ecommerce-app/job-schedular`
* **Purpose:** Hourly unpaid order auto-cancellation & 24h warning checks
```bash
source .venv/bin/activate
celery -A app.celery_app.celery_app beat --loglevel=info
```

---

### 💻 Terminal 5: Celery Flower (Monitoring Dashboard)
* **Working Directory:** `/Users/hasssaniftikhar/Desktop/Training/Project/ecommerce-app/job-schedular`
* **Port:** `http://localhost:5556` *(Login: admin / password)*
```bash
source .venv/bin/activate
celery -A app.celery_app.celery_app flower --port=5556 --basic_auth=admin:password
```

---

### 💻 Terminal 6: Prisma Studio (Database GUI)
* **Working Directory:** `/Users/hasssaniftikhar/Desktop/Training/Project/ecommerce-app`
* **Port:** `http://localhost:5555`
```bash
npx prisma studio
```

---

### 💻 Terminal 7: Stripe CLI Webhook Listener
* **Working Directory:** `/Users/hasssaniftikhar/Desktop/Training/Project/ecommerce-app`
* **Purpose:** Forwards Stripe payment events to local webhook route
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
