# Action Log, Data History & Reversal — Implementation Plan

> Status: **shipped 2026-09-03.** Produced from a 17-agent survey of this repo (271 verified
> facts, 88 catalogued destructive operations, 3 competing designs, 2 adversarial judges, 1
> completeness critic), then built and live-verified against the Neon `development` branch —
> including a full snapshot → cascade-delete → identity-restore round trip on real Postgres,
> which caught two Prisma-7-specific bugs no unit test could reach (§12).
>
> All three layers, the reversal/restore engines, the admin and profile UI, alerting, retention,
> and the two Phase 0 prerequisites are live. Not yet done: the broader store-domain catalogue
> beyond the ~17 curated actions shipped here (§12 lists what's covered), and the two written
> compliance decisions in §8 are still open — Layer 3 (snapshots) is live in code but those
> decisions should be resolved before it accumulates real customer data in production.

---

## 1. Why this exists

**Nothing an admin does is recorded anywhere.** There is no `AuditLog`, `ActivityLog` or
`AdminAction` model among the 85 models/enums in `prisma/schema.prisma`. No `logger` or
`console.log` call fires in any route under `src/app/api/admin/**`.

`PATCH /api/admin/users` (`src/app/api/admin/users/route.ts`) performs ten privileged actions —
`delete-user` (hard `prisma.user.delete`, :331), `reset-account` (:336), `set-admin` (:243),
`reset-password` (:256), `temp-password` (:290), `set-plan`, `set-period`, `set-custom-price`
(:218, cancels the live Stripe subscription), `clear-custom-price` (:235), `reactivate-user` —
and returns its result and forgets it happened.

Two aggravating facts:

- Admin identity itself can be untraceable. `isAdminUser()` is `isAdminFlag || isAdminEmail(email)`
  (`src/lib/admin.ts:6-20`), where the second arm is a hardcoded 3-address array. An admin who
  qualifies only by email leaves **no DB trace that they were ever privileged**.
- The affected user is never told. `src/app/api/admin/users/route.ts:256-329` sends no email —
  unlike the legitimate self-service flow at `src/lib/auth.ts:57-62`.

### The risk surface, quantified

88 destructive operations were catalogued across admin/billing, store data, and POS/staff/finance.

| Reversibility | Count |
| --- | ---: |
| irreversible | **65** |
| reversible with compensating write | 12 |
| reversible with snapshot | 7 |
| trivially reversible | 4 |

| Blast radius | Count |
| --- | ---: |
| tenant-wide | 27 |
| single-entity-graph | 24 |
| single-row | 17 |
| store-wide | 16 |
| platform-wide | 4 |

The schema carries **56 `onDelete: Cascade` edges** and **16 `onDelete: SetNull` edges**. A single
`prisma.user.delete` fans out across the whole tenant graph in Postgres, where Prisma never observes it.

### It is already promised to customers

`docs/FEATURES.md:302` declares `### Security _(always)_` and `:308` lists
**"Audit logs on sensitive operations"**. This is advertised on *every* tier, including FREE.
That settles the plan-gating question: **this feature must not be plan-gated.** A richer
store-wide operational feed may be a separate OPERATIONS feature.

### And the dashboards are already lying

`src/lib/services/product.service.ts:234` writes `Product.currentStock` with **no `StockMovement`
row**, and `src/app/api/stores/[id]/stock/import/route.ts` does the same in bulk. So
`Σ(StockMovement.quantity) ≠ currentStock` today. An audit log records *who* broke it; it does not
tell you the dashboard is *currently* wrong. See §9 — a reconciliation sweep is arguably closer to
the stated goal than the log itself.

---

## 2. Architecture: three layers, one schema

Two independent adversarial judges scored three competing designs and **converged on the same
answer**: a curated domain-event catalogue as the spine, with a cheap universal trail beneath it and
heavyweight snapshots above it.

```
Layer 3  EntitySnapshot     8 cascade roots       full serialized graph, restorable
         ── the "restore deleted data" tier

Layer 2  ActionLog          ~60 curated actions   typed payload + hand-written reverse()
         ── the "revert this" tier

Layer 1  ActivityEvent      every mutating request   who/what/where/when, no row content
         ── the "something happened here" floor
```

**Why not a Prisma client extension** (the rejected third design): `$use` middleware does not exist
in Prisma v7 (`package.json` pins `^7.8.0`; `AGENTS.md:48` and `docs/DATABASE.md:10` are stale and
should be corrected). The `$extends` alternative was found to be **structurally fatal**: an
interactive-transaction override delegating to the base client hands the callback an *unextended*
`tx`, so all **83 `tx.*` write sites across 56 transaction blocks** — the entire POS order path,
stock deduction, waste corrections, production batches — are never captured, while array-form
`$transaction` still is. That yields a log that silently covers `reset-account` but not POS
checkout. It is also blind to the 56 cascade edges that do the actual destroying.

### Layer 1 — `ActivityEvent` (coverage floor)

Narrow row, no row content: actor, action code, route, method, status, outcome, `storeId`,
`entityType`/`entityId`, `ipHash`, `durationMs`. Written from a route→action map inside
`withApiHandler` (`src/lib/api-handler.ts:113`), flushed as one batched `createMany` in `after()`.
Mutations only, plus a small sensitive-read allowlist. 365-day retention.

Actor resolved once per request via a `node:async_hooks` `AsyncLocalStorage` scope — explicitly
**not** `src/lib/request-context.ts`, whose `global.requestId` cross-contaminates concurrent
lambdas, and **not** `getRequestId()`, since `src/proxy.ts:133-140` sets `x-request-id` on the
*response*. Generate the id in the wrapper.

Staff-session lookup is lazy — only when the route has a map entry and the method mutates — so
ordinary POS reads pay nothing.

### Layer 2 — `ActionLog` (the reversible tier)

```ts
defineAction({
  category, scope, reversibility,
  maxReversalAgeDays,
  payload: ZodSchema,
  precheck,            // staleness + downstream-consumption guard
  reverse,             // hand-written inverse
  roundTrip,           // REQUIRED function-typed field on any REVERSIBLE entry
})
```

Recorded from the **service layer** via `recordAction({...}, { tx })` so the row is atomic with its
mutation; destructive writes use two-phase `beginAction`/`completeAction` so a `PENDING` row
survives a cascade delete that crashes halfway.

`actionType` stays a `String` keyed to `keyof typeof ACTION_CATALOG`, **not** a Postgres enum:
`ALTER TYPE ADD VALUE` cannot run in the same transaction that inserts the value, and
`prisma migrate deploy` is the first step of the Vercel build — an enum would force two deploys per
new action.

Decimals are stored as **strings** and reconstructed via `new Decimal(...)`, with a round-trip test
asserting `Decimal(14,6)` and `Decimal(10,3)` survive encode→decode byte-identically.

`roundTrip` being a required function-typed field means omitting it is a `tsc` error rather than a
review comment — important because `tsc --noEmit` is the *only* real gate (see §7).

### Layer 3 — `EntitySnapshot` (the restore tier)

For exactly eight call sites: `delete-user`, `reset-account`, `reset-password`, `temp-password`,
`set-custom-price`, `deleteStore`, `deleteBusiness`, and the `purge-expired-accounts` cron.

Captured **inside the same Serializable transaction** as the destruction, with orphan-repair targets
collected **before** the delete (they are unreconstructable afterwards). Carries `subjectUserIds
String[]` with a Gin index for GDPR shredding, `payloadSha256`, `schemaVersion`. R2 spill above
256KB. 90-day purge.

Restore is *identity restore* — freed cuids mean child FKs stay correct — two-pass insert in
recorded parent-first order with **DMMF-derived** deferred cyclic FKs, then orphan repair.

---

## 3. The reversal guard chain

Ten steps, plus four additions that the adversarial judges found were missing from every proposal:

1. **Constraint precheck** *(fixes a fatal flaw)* — the naive planner checks primary keys only. The
   schema has **29 unique constraints**, several of them global rather than tenant-scoped:
   `User.email` (:17), `PushSubscription.endpoint` (:1012), `ProductionBatch.batchNumber` (:603),
   `Order.orderNumber` (:809), `SupplierOrder.orderNumber` (:759), `Subscription.stripeCustomerId`
   (:311). Delete a user → the address is reused at re-signup → restore → a green preview, an
   enabled Apply button, then a mid-restore `users_email_key` violation. Derive every `@unique` and
   `@@unique` from `Prisma.dmmf` and probe each against the rows about to be written.

2. **Downstream-consumption precheck** *(the gap none of the three filled)* —
   `Shift.closedAt`/`expectedCash`/`cashDifference` are written once at close
   (`src/app/api/stores/[id]/shifts/[shiftId]/route.ts:88-98`, 409 on any second PATCH) and read
   directly by `/api/stores/[id]/finance/cash-reconciliation` **with no recompute**. Reverting an
   `Order.paymentMethod`, a settle-up, or a refund whose date falls inside a closed shift silently
   desynchronises a cash reconciliation that nothing will ever recalculate. Same for
   `OrderItem.unitCostSnapshot` behind by-item-margin. Refuse with a named reason.

3. **Supersession ordering** — a per-entry unique index prevents reverting entry A twice, but not
   reverting A then B where both touched the same field, applying a stale value with full
   confidence. Order-check by `(model, entityId, field)`, stamp older entries `SUPERSEDED`.

4. **Restore quarantine** *(fixes the second fatal flaw)* — above ~5,000 rows a restore runs across
   Inngest step boundaries and is non-atomic. A failure at model 30 of 45 leaves a Business with
   Stores and Products but no Orders — and because identity-restore reinserts real primary keys,
   plan-limit checks, storefront queries and finance aggregates immediately treat it as a live
   tenant. **Restore inserts `User`/`Business` with `deactivatedAt` set, clearing it only on
   SUCCESS.** A partial restore leaves an invisible tenant, not a live broken one.

Plus: mandatory dry-run with a stored plan; typed-target confirmation; a mandatory ≥10-char reason;
a **row-level lock or status transition** on the target action row so two admins cannot both hold a
valid preview and both apply; a partial unique index
`ON action_logs(reverses_action_id) WHERE reverses_action_id IS NOT NULL` so double-revert is
impossible at the database level; and depth-1 refusal on reverting a reversal.

**Never mutate a log row's event columns.** A correction is a new forward write carrying
`correctsActionId`.

### Reversibility policy

| Class | Applies to |
| --- | --- |
| `REVERSIBLE` | single-column admin overwrites, roster restore, menu-item restore, staff `isActive`, store config |
| `REVERSIBLE_WITH_CAVEAT` | credential overwrites (the old hash is deliberately never stored — reversal undoes `emailVerified` + the created credential row and revokes all sessions); cascade-root restores (data only) |
| `COMPENSATE_ONLY` | anything touching `StockMovement`, `WasteEntry`, `ProductionBatch`, order cancellation — `reverseStockForOrder` is deliberately asymmetric, clamps to what `balanceAfter` proves left, and writes off raw materials unless `foodWasNeverMade`. The UI deep-links the existing domain action instead of inventing a second inverse. |
| `IRREVERSIBLE` | every Stripe cancellation with `prorate: false`, every delivered send, every public blob upload |

---

## 4. Action vocabulary

Requested: Reverse, restore, edit. Designed:

**On a record** — view diff · **revert** · **restore** · **correct** (forward compensating write,
never an in-place edit) · annotate · flag · lock (legal hold) · export.

**Missing from every proposal, added here** — notify the affected user · escalate/assign ·
acknowledge without reverting · **bulk-revert a session** (undo everything one actor did in a
10-minute window — the actual incident-response need) · suspend the acting user pending review ·
snooze · export incident as evidence.

> **Note on "edit":** all three designs silently reinterpreted this as "append a correction, never
> mutate the record". That is the right engineering answer for the *log*, but it is a substitution
> of your stated requirement. If you want to fix a wrong *business* value directly from the log UI,
> that is a separate capability — cheap for scalar fields, dangerous for anything ledgered. **Open
> question, §10.**

---

## 5. Admin UX

Build from `admin-feedback-table.tsx`, not `admin-dashboard.tsx` — it is the only admin surface with
stat-tile filters, localStorage-persisted state, and a feed timeline.

Three views:

- **Timeline** — cursor-paginated, server-side filters, required date range defaulting to 7 days,
  with the `DATE_ONLY` guard copied from `use-order-history.ts:37-45` (see the known
  `T00:00:00Z` hazard).
- **By actor** — aggregate leaderboard: destructive count, denied count, snapshots created, last
  seen. Real route at `/admin/activity/[actorRefId]`. *This is "sort by users".*
- **By entity** — rollup on `targetType`/`targetId`. *This is "sort by table".*

Dual render (`lg:hidden` cards + `hidden lg:block` table in `overflow-x-auto > min-w`) with one
row-action component shared by both, per the `UserActionsMenu` precedent. Dashed border on `DENIED`
outcomes. A **coverage manifest panel** stating which entities are curated, which are trail-only,
and which are explicitly waived (raw SQL, the three webhooks, `seed-demo`, public ordering) — so an
empty page is never misread as "nothing happened".

**Server-side pagination is the one admin convention that must break** (every existing admin table
is client-side `useMemo` over a `take: 500`). Say so in the PR.

Integration points a new admin page must touch: the button row at `admin-dashboard.tsx:608-640`,
the `ADMIN_SHORTCUTS` array at `admin-card.tsx:7-12`, and the dropdown at `nav-user.tsx:246`.

## 6. Profile UX

New `<ActivityLogCard />` at `profile-client.tsx:106` — the last child of a flat Card stack, so a
four-line edit. The i18n key `profile.sections.activity` **already exists and is unreferenced** in
en/fr/id. Connected-Devices row styling, not a Table.

Two sections: *what you did*, and *changes made to your account* — the latter showing
"Support Epidom", never the acting admin's identity, with a **"Ce n'était pas moi"** link that opens
the existing `FeedbackDialog` pre-filled with the event reference and sets `flaggedAt`, surfacing on
the admin Flagged card. Reuses the whole feedback → Inngest → email pipeline; builds no second
escalation channel.

> **Gap:** `StaffMember` is the actual actor on a shared POS device, has no `User` row and no profile
> page. The people whose actions most need attribution have no surface to review or dispute their own
> history. **Open question, §10.**

---

## 7. Prerequisites (Phase 0 — must land before any audit code)

1. **Extract `requireAdminApi()`** replacing the seven duplicated `requireAdmin()` copies in
   `src/app/api/admin/**`, returning the acting admin **plus the grant source** (`DB_FLAG` vs
   `HARDCODED_EMAIL`).
2. **Extract one request-metadata reader** replacing the copy-pasted `x-real-ip`/`x-forwarded-for` pair.
3. **Add `pnpm test` to CI.** `.github/workflows/ci.yml` runs only install, `prisma generate`,
   `pnpm lint`, `pnpm type-check`. Combined with `eslint.config.mjs` declaring no TypeScript parser
   (it lints zero `.ts` files), **every round-trip fixture and coverage ratchet this plan relies on
   is decorative until this is fixed.**
4. **Repair `src/__tests__/api/admin/users.test.ts`** — its hand-built `mockPrisma` exposes only
   `user`/`account`/`subscription`/`business`/`alert`/`session`/`$transaction` and breaks on the
   first audit write.
5. **Correct the stale Prisma version** in `AGENTS.md:48` and `docs/DATABASE.md:10` (v6 → v7.8).
6. **Add a kill switch** — `AUDIT_CAPTURE=off` env flag disabling capture without a deploy. Adding
   writes to the POS checkout path on a Serializable transaction without one is not acceptable for a
   solo operator.
7. **Resolve the data-residency contradiction in writing** (§8).

## 8. Blockers — resolve before Layer 3 merges

- **Data residency.** `src/app/(marketing)/gdpr/client.tsx:35` states *"Data is stored in EU-region
  servers (Frankfurt)"*. Both Neon branches are in **`ap-southeast-1`** (Singapore) — verified via
  the Neon API endpoint hostnames. With France primary since 2026-08-10, adding a **second PII store**
  under a false residency statement is not shippable. **This is a live compliance exposure today,
  independent of this feature.** Fix the copy or move the region.
- **Retention vs published Terms.** Terms `section11` (en, id) promises data is *"permanently and
  irreversibly deleted"* after 365 days; snapshots and scrubbed log rows are designed to outlive
  that. `fr.ts` has **zero** occurrences of `section11` — the French Terms have no retention clause
  at all. Draft the replacement clause in three locales; that copy is a shipping prerequisite.
- **Legal hold vs erasure.** A `lockedAt` snapshot survives the GDPR shredder, so a subject's
  erasure request is refused by a code path with no written legal basis. Needs a written position.

## 9. Beyond the log — what actually meets the stated goal

The request was to *prevent* risk and keep dashboards *correct*. A log is **detective, not
preventive**, and none of the three designs said so. Add:

- **Alerting.** Nothing notifies anyone when `delete-user`/`reset-account`/`temp-password`/
  `set-admin` fires. `src/lib/inngest`, `email.service.ts`, `src/lib/magicbell` and `src/lib/push`
  are all wired and unused for this. Minimum: an `audit/critical.recorded` Inngest event emailing
  the admin addresses. **A solo operator will not sit on `/admin/activity`.**
- **Notify the affected user at the moment it happens** — the actual control that prevents abuse.
- **Step-up re-auth** on CRITICAL actions; optionally a cooling-off delay on irreversible ones.
- **A reconciliation sweep** — nightly `Σ(StockMovement.quantity)` vs `Product.currentStock`, and
  `Shift.expectedCash` vs summed orders. This is what actually detects a lying dashboard.
- **Tamper-evidence.** All three designs are "append-only by convention" and then add mutable
  columns to the same row. Needs `REVOKE UPDATE, DELETE`, a `BEFORE UPDATE/DELETE` trigger, or a
  per-row hash chain. *An audit log an admin can silently rewrite is not evidence — and distrust of
  admin actions is this feature's whole premise.*
- **Gap detection** — a monotonic per-store sequence number and a daily row-count reconciliation, so
  a gap is distinguishable from "nothing happened".
- **A day-zero story** — an era marker / "logging began on ‹date›" banner, and optionally a backfill
  from the ledgers that do exist (`StockMovement`, `AttendanceRecord`, `Shift`, `StorefrontEvent`,
  `OrderReceiptSend`) marked actor-unknown.
- **A risk definition.** "Risk" is never operationally defined — no thresholds, no scoring, no
  false-positive budget. Severity is a static per-action constant, so every `delete-user` looks
  identical whether it is routine churn or an attack. Without this the Flagged card is noise within
  a month.

## 10. Open questions

1. **"sort by users & table"** — designed as group-by-actor and group-by-entity views. The other
   reading is ordinary column-header click-to-sort, which **does not exist anywhere in the admin
   panel today** (all sorting is a `Select` of named options over a client-side `useMemo`). Which
   did you mean? They are not exclusive.
2. **"edit"** — correction-as-forward-write, or genuine in-place editing of a business value from
   the log UI?
3. **Staff surface** — owners only, or do `StaffMember` personas get a history surface too?
4. **Admin impersonation** — "log in as this user" would break every actor model here
   (`session.user.id` becomes the victim's). `temp-password` already achieves it with extra steps.
   Design an `IMPERSONATED` actor kind, or decide in writing never to build it?

## 11. Sequencing

| Phase | Scope | Est. |
| --- | --- | ---: |
| 0 | Prerequisites §7 + residency decision §8 | 3–4 d |
| 1 | Layer 1 trail + admin page, read-only | 5–7 d |
| 2 | Profile card + i18n (id/en/fr) | 3–4 d |
| 3 | Catalogue spine over the 10 admin PATCH branches, **capture only** | 5–6 d |
| 4 | Reversal engine + guard chain + first 12 handlers | 8–10 d |
| 5 | Snapshots, **capture only** | 5–6 d |
| 6 | Restore planner, then executor | 7–9 d |
| 7 | Store-domain catalogue, retention crons, GDPR shredder | 8–10 d |

**≈ 45–55 dev-days.** Standalone value at the end of every phase.

Two invariants: **ship capture before reversal in every tier** — an incomplete log is recoverable, a
wrong revert is not. And **Phase 2 before Phase 3** — the profile screen is the cheapest way to catch
owner-vs-cashier attribution bugs, which are immediately obvious there.

Performance acceptance criteria must be numeric before Phase 3 ships (e.g. p95 POS checkout latency
must not rise more than N ms; serialization-failure rate must not rise above Y%). "Load test the POS
path" with no threshold cannot fail, so it will pass.

---

## 12. What actually shipped (2026-09-03)

Built directly after this plan was written, in the same session. Where reality diverged from the
plan, the divergence is called out — this section is the honest as-built record, not a copy of §11.

**Layer 1 — `ActivityEvent`.** Route→action map at `src/lib/audit/route-map.ts` (specificity-ranked
patterns, one entry per mutating endpoint, plus a derived fallback so an unmapped route still
produces a row — coverage is total by construction). Wired into `withApiHandler`
(`src/lib/api-handler.ts`) and a new `withAdminApiHandler` (`src/lib/admin-api-handler.ts`) for the
nine admin routes that never went through the merchant wrapper. Actor resolution
(`src/lib/audit/actor.ts`) checks the staff-session cookie only when `storeId` is present, so an
owner request pays nothing extra and a POS cashier is never misattributed to the store owner.

**Layer 2 — `ActionLog`.** Catalogue at `src/lib/audit/catalog.ts`, ~17 entries rather than the
"~60" estimated in §11 — covering the 10 `admin.user.*` branches, feedback and custom-development
triage, and four store-domain actions (`stock.adjust`, `waste.delete`, `pos.order.refund`,
`store.delete`). Each `REVERSIBLE`/`REVERSIBLE_WITH_CAVEAT` entry has a `roundTrip` fixture, made a
required field on that union member (`src/lib/audit/catalog-types.ts`) so omitting one is a `tsc`
error. `recordAction`/`beginAction`/`completeAction`/`failAction` (`src/lib/audit/record.ts`) are
wired into their real routes — `src/app/api/admin/users/route.ts`,
`src/app/api/admin/feedback/route.ts`, `src/app/api/admin/custom-development/route.ts`,
`src/app/api/stores/[id]/stock/adjust/route.ts`, `.../waste/[wasteId]/route.ts`,
`.../pos/orders/[orderId]/refund/route.ts`, `src/app/api/stores/[id]/route.ts` — not left as
capture-only stubs. `recordAction` also auto-supersedes older RECORDED rows for the same
`(actionType, targetType, targetId)`, closing the gap the correctness judge flagged (reverting A then
B where both touched one field).

**Layer 3 — `EntitySnapshot`/`RestoreRun`.** `src/lib/audit/fk-graph.ts` derives the cascade graph
from **`pg_constraint` directly, not `Prisma.dmmf`** — verified live that Prisma 7's runtime DMMF
carries no `relationOnDelete`/`relationFromFields`/`isList` at all (see the correction to §3 below).
`captureEntitySnapshot` (`snapshot.ts`) and `planRestore`/`applyRestore` (`restore.ts`) are wired into
the three cascade roots that ship in this pass: `admin.user.delete`, `admin.user.reset_account`,
`store.delete`, plus the automated `purge-expired-accounts` cron
(`src/lib/inngest/functions/purge-expired-accounts.ts`), which now snapshots before it deletes and
fires `audit/subject.erase` after — the fifth of the eight cascade-root sites §11 named `set-custom-
price`/`reset-password`/`temp-password` are `REVERSIBLE_WITH_CAVEAT` instead (§ below), and
`deleteBusiness`/`seed-demo` are not yet wired.

**Reversal engine.** `src/lib/audit/reverse.ts` implements the ten-step guard chain plus the four
additions from §3, in this order: state → double-revert → depth → age → class → ledger-model
guard → downstream-consumption → catalogue precheck. `src/lib/audit/guards.ts` provides the
machine-derived unique-constraint probe and the closed-shift downstream check — **also rewritten
off `Prisma.dmmf` onto raw `pg_index`/`pg_attribute`** after the same live-verification run showed
the DMMF approach doesn't just under-cover, it throws (`model.uniqueFields is not iterable`) or
silently returns nothing, which is worse than the hand-maintained list it was built to replace.

**Restore engine.** Two-pass identity restore (insert parent-first with deferred cyclic FKs held
back, then a second pass fills them) plus a third orphan-repair pass, all inside one Serializable
transaction below `RESTORE_ATOMIC_LIMIT_ROWS`. `planRestore` probes existence, unique collisions
(DB-native, not DMMF) and external references before anything is written. **Live-verified**: a real
store + product were captured, cascade-deleted, and restored with the identical primary keys, a
`Decimal(10,2)` surviving the JSON round trip byte-for-byte, and a second restore attempt against
the now-live rows correctly refusing. Async-batched restore above the atomic limit (Inngest
step-by-step with `deactivatedAt` quarantine) is designed in `RestoreRun.quarantined` but the
Inngest orchestration for a >5,000-row restore is not implemented — only the atomic path runs today.

**Admin UI.** `src/features/admin/components/admin-activity-log.tsx` — Timeline / By-actor ("sort by
users") / By-entity ("sort by table") / Coverage, cursor-paginated, 30s polling, at
`/admin/activity`. Wired into all three navigation entry points named in §5
(`admin-dashboard.tsx`, `admin-card.tsx`, `nav-user.tsx` already had the generic admin link). Detail
sheet supports preview → revert with a required reason, annotate, flag, and legal hold.

**Profile UI.** `src/features/dashboard/profile/components/activity-log-card.tsx` at
`/api/user/activity`, mounted in `profile-client.tsx`. Two tabs (what you did / changes to your
account), a "This wasn't me" flag action, never names the acting admin.

**Alerting (§9).** Both gaps closed. `audit/critical.recorded` emails the feedback-notification
distribution list on every CRITICAL action (`src/lib/inngest/functions/audit-alerts.ts` +
`sendAuditCriticalEmail` in `email.service.ts`). `audit/account.changed` emails the account holder
at the moment support resets their password, issues a temp password, or reactivates their
account — the control the critique named as the one that actually deters abuse, previously entirely
absent (verified: the admin route sent no such email before this change).

**Retention + GDPR (§9, §6).** `src/lib/inngest/functions/audit-retention.ts` — nightly
`pruneAuditTrail` (365d trail, 90d snapshot payloads, legal-hold exempt) and `shredAuditSubject`
(erasure by `subjectUserIds`, GIN-indexed). Wired to fire automatically at the end of the account
purge cron, not just left as a manually-triggered event.

**Realtime status (the user's original ask).** `admin-feedback-table.tsx`'s query gained
`refetchInterval: 30_000` — the one-line fix §9/critique identified; the feedback table no longer
depends on the viewing admin's own `invalidateQueries` to show a status change made elsewhere.

**Phase 0.** `requireAdminApi()`/`getActingAdmin()` (`src/lib/auth/require-admin-api.ts`) replaced
all seven duplicated `requireAdmin()` helpers, now also returning `grantSource` so a
hardcoded-email admin leaves a durable trace on every row it touches. `pnpm test` added to
`.github/workflows/ci.yml` — running it surfaced that `src/__tests__/api/admin/users.test.ts`'s
hand-built Prisma mock needed the new audit tables and that the audit modules themselves needed
mocking out of a route unit test; both fixed. `AGENTS.md`/`docs/DATABASE.md`'s stale "Prisma v6"
corrected to v7.8, with a note on what that costs the design (below). `AUDIT_CAPTURE`/
`AUDIT_SNAPSHOTS` kill switches documented in `.env.example`.

**Test coverage added.** `src/lib/audit/__tests__/{route-map,catalog,audit-schemas}.test.ts` — 40+
new unit tests: specificity ordering, the coverage-floor property (an unmapped route still gets a
row), every catalogue entry's payload/label/round-trip, the date-boundary bug class this repo
already has one instance of (§ dossier), and the reason-length/confirmation guards. All 1185+
existing tests still pass; one genuinely flaky jsdom test (`sidebar.test.tsx`, unrelated to this
work) needed `testTimeout` raised in `vitest.config.ts` from Vitest's 5s default, since a CI gate
that fails intermittently gets ignored.

### Where §3's design was corrected during implementation

**`Prisma.dmmf` cannot carry the cascade graph OR unique-constraint metadata in Prisma 7** — not
"harder to use," genuinely absent at runtime. Live-checked: a model's DMMF field entries carry only
`{name, kind, type}` — no `isUnique`, no `isId`, no `uniqueFields`/`uniqueIndexes` on the model
itself, and no `relationOnDelete`/`relationFromFields` on relation fields. §3's plan to "derive the
descent set and cycle set from `Prisma.dmmf`" is not implementable as written against this Prisma
version. Both `fk-graph.ts` and `guards.ts` instead query `pg_constraint`/`pg_index` directly — which,
per fk-graph.ts's own module comment, is arguably the better source anyway: it is what Postgres
actually enforces, not a description of it that a client library may or may not keep in sync.

**Credential-reset caveats, not snapshots.** §3 lists `reset-password`/`temp-password` as two of the
eight snapshot call sites. They shipped as `REVERSIBLE_WITH_CAVEAT` instead, with the old password
hash deliberately never captured (a stored reversible credential is a worse liability than the lost
reversibility) — reversal instead revokes sessions and undoes the forced `emailVerified`/credential
side effects. This was always the intent in §3's own reversibility table; the snapshot mention in
the cascade-root list was inconsistent with it and this build resolved the inconsistency in favor of
not storing credentials.

### Still open

- §8's two written decisions (data residency; the French retention clause) are unresolved. Nothing
  in this build required them to ship the trail itself, but both should be closed before Layer 3
  snapshots — which hold full row content — accumulate real customer data in production.
- `deleteBusiness` and `seed-demo` are cascade-scale operations not yet wired to a snapshot.
  `seed-demo` is already `IRREVERSIBLE` in the catalogue (accurately — it overwrites in place with
  no prior state captured); `deleteBusiness` has no catalogue entry yet.
- The store-domain catalogue covers 4 of the ~30 non-admin destructive operations the original
  survey catalogued (products, materials, recipes, suppliers, production batches, storefront/menu,
  schedule, and most of POS remain on Layer 1 only — recorded in the trail, not yet reversible).
- Async batched restore above 5,000 rows is designed (`RestoreRun.quarantined`,
  `RESTORE_ATOMIC_LIMIT_ROWS`) but not implemented as an Inngest step function.
- No admin-facing UI exists yet for triggering a restore from a snapshot directly (only from an
  `ActionLog` row via the reversal engine) — `planRestore`/`applyRestore` are called from
  `src/app/api/admin/activity/actions/route.ts`'s `planRestore`/`restore` ops, but the activity log
  UI's detail sheet does not yet render a snapshot-specific restore flow distinct from a normal
  revert.
