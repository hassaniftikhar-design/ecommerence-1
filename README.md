# E-commerce (Phase 1: Authentication + Landing + Account Portal)

Next.js App Router + TypeScript + Tailwind CSS + shadcn-style primitives.
**UI only** — no auth logic, no database, no API calls. Every submit
handler and service function is a documented placeholder (`TODO(backend-
integration)`) ready for the next phase (Route Handlers + Zod + NextAuth
+ Prisma + PostgreSQL).

## Getting started

```bash
npm install
npm run dev
```

Then open:
- `/` — Home / product landing page
- `/login`, `/signup`, `/forgot-password`, `/reset-password`
- `/cart` — Shopping bag
- `/orders` — Order history (paginated)
- `/orders/[orderId]` — Order detail (try `/orders/342599`)

## Design tokens

Colors were sampled directly (pixel-by-pixel with PIL) from the Figma
screenshots rather than eyeballed, and turned out to match Bootstrap's
default palette almost exactly:

| Token | Hex | Used for |
|---|---|---|
| `primary` | `#007bff` | Headings, buttons, links, price |
| `primary-hover` | `#0069d9` | Button hover |
| `danger` | `#dc3545` | Field error text, remove-item icon |
| `warning` | `#ffc107` | Confirm-dialog warning triangle |
| `ink` | `#212529` | Body / label text |
| `muted` | `#6c757d` | Placeholder text, secondary copy |
| `meta` | `#868e96` | De-emphasized metadata ("42 Total Count") |
| `graytext` | `#495057` | Table header/cell text (Cart, Orders) |
| `navy` | `#002050` | Order Detail headings (a distinct blue from `primary` — sampled, not a typo) |
| `charcoal` | `#272b41` | Dialog/dropdown body text, Order Detail field values |
| `border` | `#ced4da` | Input borders |
| `border-card` | `#dfdfdf` | Card/table borders |
| `surface-page` | `#f8f9fa` | Page background |
| `surface-card` | `#ffffff` | Card background |

These live in `tailwind.config.ts` as `theme.extend.colors`, so every
component references `bg-primary` / `text-muted` / etc. instead of raw
hex values.

## Folder structure and why

```
src/
├── app/                  Routes only. Route groups + colocated
│                         loading/error/not-found. No business logic.
│                         "(main)" holds Home/Cart/Orders/Order Detail
│                         behind a single shared layout (header + page
│                         container, so it's declared exactly once).
│                         "(auth)" holds the 4 auth screens behind their
│                         own centered layout.
├── components/
│   ├── ui/               Framework-agnostic primitives (Button, Input,
│   │                     Label, Checkbox, Card, Table, Pagination,
│   │                     AlertDialog, DropdownMenu) — shadcn-style, no
│   │                     app-specific knowledge.
│   ├── forms/            Generic form building blocks shared by any
│   │                     future form, not just auth (FormField today).
│   ├── auth/             Everything specific to auth screens.
│   ├── home/             Everything specific to the landing/product page.
│   ├── cart/             Everything specific to the shopping bag.
│   ├── orders/           Everything specific to Orders / Order Detail.
│   └── common/           Shared across areas (Logo, UserMenu,
│                         BackHeading, ConfirmDialog).
├── hooks/                Reusable stateful logic (useQuantity,
│                         useCartSelection).
├── lib/                  Small framework glue (cn(), font loader).
├── services/             auth/product/cart/order .service.ts — all
│                         throw "Not implemented" today, real fetch
│                         calls in the next phase. Components already
│                         import from here.
├── types/                Shared TS interfaces, written against the
│                         eventual backend shape, not just today's UI.
├── constants/            ROUTES map + mock product/cart/order data.
├── utils/                Pure functions (email/password format checks).
├── providers/            Currently a passthrough; where NextAuth's
│                         SessionProvider etc. will mount later.
├── styles/               Reserved (see styles/README.md).
└── assets/               Reserved (see assets/README.md).
```

## Rendering strategy

Every page, layout, and "dumb" composition component (`AuthCard`,
`ProductGrid`, `SiteHeader`) is a **Server Component** by default. `"use
client"` appears only on the leaves that actually need browser state or
event handlers:

- `LoginForm`, `SignupForm`, `ForgotPasswordForm`, `ResetPasswordForm` —
  controlled inputs (`useState`).
- `RememberMe`, `Checkbox` — Radix's checkbox manages its own internal
  state/keyboard handling client-side.
- `ProductCard`, `QuantitySelector` — per-card quantity state and the
  (placeholder) add-to-cart click handler.
- `ProductSearchBar`, `SortDropdown` — controlled `<input>`/`<select>`.
- `UserMenu` — Radix DropdownMenu manages open/close state client-side.
- `CartTable`, `CartItemRow`, `CartSummary`, `ConfirmDialog` — shared
  row-selection state and the remove/place-order handlers.
- `error.tsx` — Next.js requires this one to be a Client Component.

`OrdersTable`, `OrderSummaryFields`, `OrderProductsTable`, and
`components/ui/pagination.tsx` are all plain Server Components —
Orders/Order Detail have no interactivity in Phase 1, and pagination is
implemented as `<Link href="/orders?page=2">` so `OrdersPage` can read
`searchParams.page` directly instead of needing client-side state just
to turn a page.

This keeps the JS bundle shipped to the browser as small as the brief's
"Server Components by default" rule asks for, while still allowing
interactivity exactly where the Figma requires it.

## What's a placeholder, on purpose

- All four form submit handlers stop at `event.preventDefault()` plus a
  `TODO(backend-integration)` comment.
- `auth.service.ts` / `product.service.ts` functions all `throw new
  Error("Not implemented")`.
- Product images use `placehold.co` — swap for real product photography
  (or a Prisma-backed CDN URL) once available; `next.config.ts` already
  whitelists that domain for `next/image`.
- Product prices are `$0.00` because the Figma shows the same
  placeholder value on every card.
- `SiteHeader` shows the logged-in `UserMenu` (Orders/Logout) because
  of a hardcoded `IS_AUTHENTICATED = true` — swap for a real session
  check once auth exists.
- Cart's quantity stepper is the *same* `QuantitySelector` component
  used on the product grid, not a re-implementation — one place to fix
  stepper behavior everywhere it appears.
- `CartSummary`'s Sub Total/Tax/Total don't recompute live as you
  change a row's quantity (see the comment in that file) — real-time
  totals need either a lifted cart store or real prices, both of which
  belong to backend integration, not this UI pass.

None of this is meant to be shipped — it's the seam where Phase 2
(backend integration) plugs in without touching component markup.
