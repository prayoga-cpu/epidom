# STATUS.md

## Current Phase: Phase 5 (Aggregator + Finance) — ✅ CODE COMPLETE, PENDING VERIFICATION

*(AI Agents: Update this checklist every time you finish a task)*

---

## ✅ Phase 3 — Lightweight POS (all milestones done)

Milestones completed: POS Cashier + Order Queue, KDS + Table Management, Offline PWA + Thermal Printing, Payment/Notification/Inngest/SSE integrations, Public order routes.

---

## ✅ Phase 4 — Operations Layer (code complete)

Milestones completed: Schema + Plan Gating, Stock Deduction Service, Staff + Shifts, Re-expose Operations Routes.

### Phase 4 Verification — Pending

- [ ] Verify: Stock auto-decrements when an order is marked DELIVERED.
- [ ] Verify: Low-stock alert fires when material goes below threshold.
- [ ] Verify: Shift open/close reconciliation matches cash drawer expectations within 1%.
- [ ] Verify: A cashier with a PIN can clock in/out without a manager.
- [ ] Verify: HPP (cost per dish) is calculated correctly to 2 decimal places in recipe view.

---

## ✅ Phase 5 — Aggregator + Finance (code complete)

Milestones completed: Schema + Aggregator Foundation, Email Ingestion, Finance Reports, Multi-Outlet Dashboard, Navigation + i18n.

### Phase 5 Acceptance Criteria — Pending Verification

- [ ] Verify: ENTERPRISE merchant sees orders from all sources in one queue.
- [ ] Verify: Finance reports balance to the penny against raw order data.
- [ ] Verify: Multi-outlet owner can drill down from rollup → outlet → shift → order.
- [ ] Verify: Email parsing accuracy >95% on common GoFood/GrabFood/ShopeeFood templates.

### Phase 5 Definition of Done — Pending

- [ ] All acceptance criteria above pass.
- [ ] Tests cover critical paths added in Phase 5 (aggregator ingestion, finance summary, owner rollup).
- [ ] `/docs` updated to reflect Phase 5 changes (ARCHITECTURE, FEATURES, DATABASE).
- [ ] `docs/CHANGELOG.md` has Phase 5 entry.
- [ ] At least 5 friendly users have used aggregator + finance without manual intervention.

---

## Developer / Operator To-Do

*(Tasks that require action outside the codebase — all below are still open)*

- [ ] **Database**: Apply Phase 5 migration `phase5_aggregator_finance` to production DB.
- [ ] **Email Ingestion**: Configure Resend inbound email. Set forwarding address to `orders@epidom.id`. Add `EMAIL_WEBHOOK_SECRET` to `.env`. Register `/api/webhooks/email` as inbound webhook URL in Resend.
- [ ] **AI Parsing**: Add `OPENAI_API_KEY` to `.env` for aggregator email parsing. Without it, emails are stored with `parseStatus = "manual"` for review.
- [ ] **Aggregator**: Instruct merchants to forward aggregator order emails to `orders@epidom.id` with subject prefix `[@their-slug] Original subject`.
- [ ] **Payments (Xendit)**: Add `XENDIT_SECRET_KEY` + `XENDIT_WEBHOOK_TOKEN` to `.env`. In Xendit dashboard, set webhook URL to `https://yourdomain.com/api/webhooks/xendit`.
- [ ] **Notifications**: Add `FONNTE_API_TOKEN` to `.env`. Ensure the Fonnte device is online and linked to the merchant's WhatsApp.
- [ ] **Background Jobs (Inngest)**: Add `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` to `.env`. Register the serve URL (`/api/inngest`) in the Inngest dashboard.
- [ ] **Storefront**: Enable `acceptsOrders: true` on any storefront that should show the Order & Pay flow.
- [ ] **Store phone**: Ensure the `Store.phone` field is filled in — used as merchant WhatsApp number for notifications.

---

## Dummy Data / Stubs Notes

- **Payment providers**: If `XENDIT_SECRET_KEY` is missing, `initiatePayment()` returns a no-op stub. Orders still created in DB — merchant must collect payment manually.
- **WhatsApp notifications**: If `FONNTE_API_TOKEN` is missing, notifications are silently skipped. Orders still complete normally.
- **Inngest**: If `INNGEST_EVENT_KEY` is missing, `inngest.send()` fails silently. Order creation continues.
- **`whatsapp-business.ts`**: Stub only — throws on use. Fonnte is the active provider.
- **Aggregator email parser**: If `OPENAI_API_KEY` is missing, `AggregatorEmail.parseStatus = "manual"` — no order created, body stored for manual review.
- **Finance COGS**: COGS is computed from `StockMovement` records of type `SALE`. Shows 0 if no recipes are linked to menu items.
- **Owner dashboard**: Returns 403 for non-ENTERPRISE plans — UI shows a locked-plan message gracefully.

---

## Testing / Verification Results

### Automated Tests (2026-05-21)
- **Unit + integration tests**: 170/170 ✅ (`pnpm test`)
- **TypeScript type-check**: 0 errors ✅ (`pnpm type-check`)

### Live API Tests (2026-05-21, localhost:3000)

| Test | Endpoint | Result |
|------|----------|--------|
| Storefront page load | `GET /@demo-verified` | ✅ HTTP 200 |
| Storefront API | `GET /api/public/storefront/demo-verified` | ✅ Returns store + 2 categories + 4 items |
| Menu page | `GET /@demo-verified/menu` | ✅ HTTP 200 |
| Checkout page | `GET /@demo-verified/order` | ✅ HTTP 200 |
| Validation: empty items | `POST /api/public/orders` | ✅ 400 INVALID_INPUT |
| CASH order creation | `POST /api/public/orders` | ✅ 201 `ORD-20260521-10YYJJ` — CONFIRMED/PAID |
| Order status polling | `GET /api/public/orders/[id]/status` | ✅ `{status: CONFIRMED, paymentStatus: PAID}` |

---

## Phase 5+ — Next Candidates (post-roadmap)

These are not committed to any phase. Decide after Phase 5 Definition of Done is fully cleared.

- **E2E tests (Playwright)**: Cross-phase goal from roadmap never implemented. Write tests for 5 critical journeys: sign-up → publish storefront, place online order, open shift → POS sale → close shift, finance report export, multi-outlet owner drill-down.
- **Custom domains**: Map merchant's own domain (e.g. `menu.warungbu.com`) to their `@slug` storefront.
- **Stripe Connect**: 80/20 payment facilitation. Requires legal review for BI/OJK compliance before shipping.
- **Per-outlet manager permissions**: ENTERPRISE stores with multi-outlet need scoped access (manager sees only their outlet).
- **Aggregator v2 (official API)**: GoFood/GrabFood partner API. 6–12 month relationship-building track.
- **Cloudflare R2 migration**: Swap Vercel Blob for R2 + Cloudflare Images (lower cost, better IDN latency). Deferred from Phase 3+.
- **Singapore DB region**: Migrate Postgres to Singapore region when p95 latency from Jakarta exceeds 200ms.
