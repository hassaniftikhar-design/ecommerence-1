# ShopFast Assistant

ShopFast Assistant runs inside the existing Next.js server. It uses the existing NextAuth session, Prisma client, PostgreSQL database, ProductService, OrderService, CartService, React Query provider, and Redis broker. FastAPI/Celery remains responsible for its existing email, order lifecycle, and bulk import jobs.

## Embedding model

The selected local model is `Xenova/multilingual-e5-base`, run by `@huggingface/transformers` and ONNX Runtime in Node.js. It returns 768-dimensional vectors. Query and document inputs use the model's `query:` and `passage:` prefixes.

Local benchmark on the development Mac (Node 24, quantized `q8` model):

| Measure | Result |
| --- | ---: |
| First model load | 14.5 seconds |
| Warm embedding latency | 6–20 ms per query |
| Vector dimension | 768 |
| Peak process RSS | 571 MB |

The benchmark included the eight requested English and Roman Urdu queries. A small synthetic retrieval set ranked the intended running shoe, winter jacket, and black jacket highest; an unrelated refrigerator query scored 0.799, so the initial semantic acceptance threshold is 0.81. Recalibrate it with real catalog queries before relying on production conversion metrics.

The singleton is warmed before the custom Next.js server starts listening. Startup runs in degraded mode if model loading fails: the store remains available, exact product retrieval remains usable, and `/api/chatbot/health` reports the failed embedding state. The first model load needs access to the Hugging Face model artifact cache or network; keep model files in the deployment cache to avoid repeated downloads.

## Configuration and database

Set `GROQ_API_KEY` in the server environment. `GROQ_MODEL` defaults to `openai/gpt-oss-20b`. The key is only read by server modules and is never returned from the health route.

Ensure pgvector is available on the configured PostgreSQL server, then apply the additive Prisma migrations in `prisma/migrations` with `npx prisma migrate deploy`. The first migration enables pgvector and creates a 384-dimensional HNSW vector index, product/order ownership constraints, and the embedding document table. The second adds owned chat sessions and persistent messages. The local PostgreSQL service was unavailable during implementation, so these migrations have been validated by Prisma schema validation and SQL generation but have not been applied to a live database.

After the migration is applied, build existing product vectors with:

```bash
npm run backfill:chatbot-embeddings
```

The command is safe to rerun; it pages through active products and skips documents whose content hash and model are unchanged. Failed records are logged and retried on a later run.

## API and UI

- `POST /api/chatbot` authenticates, applies guardrails and Redis-backed rate limiting, persists messages, and invokes the server orchestrator.
- `GET /api/chatbot/sessions` and `POST /api/chatbot/sessions` list and create only the current user's sessions.
- `GET /api/chatbot/sessions/:sessionId` checks ownership and pages history.
- `GET /api/chatbot/health` reports only subsystem readiness.
- The floating customer widget is part of the existing main storefront layout. Product cards re-fetch current product data when old conversations are opened. Add-to-cart buttons use the existing cart client service, which calls CartService and refreshes the existing cart provider/navbar count.

Admin analytics use fixed Prisma aggregations and recheck the current database role. Customer order retrieval filters on the authenticated owner before lexical or semantic lookup. Order vectors omit mutable status; status queries filter the live OrderService data. The LLM receives prepared data only; it cannot access Prisma, issue SQL, or execute mutations.
