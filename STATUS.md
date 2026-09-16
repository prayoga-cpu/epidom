# STATUS.md

## Current State: v3 Dashboard Revamp — Phase 1 (POS Mode) — 🚧 IN PROGRESS (branch `epidom-revamp`)

_(AI Agents: update the checklist below every time you finish a stage or a checklist item — check the box, don't re-describe finished work in prose. Keep this file scoped to the active phase; once Phase 1 ships to `main`, fold a short summary into the changelog and reset this file for the next phase.)_

Spec: `docs/dashboard-revamp.md`. Plan: `/Users/darwinprayoga/.claude/plans/stateful-juggling-seal.md`. Not deployed to production — isolated on `epidom-revamp`, previewed via Vercel (`https://epidom-fszx1lepf-prayogadevelopment-gmailcoms-projects.vercel.app`, rebuilds on every push to this branch).

**What this phase is**: split the dashboard into two shells — a bottom-tab-bar "POS Mode" for Cashier/Kitchen (iPad-first), and the existing left-rail "Back Office" for Owner/Manager, left untouched. POS Mode ships first per the spec's own sequencing; Back Office's shell redesign is Phase 2, deferred until Phase 1 has real usage data.

**Confirmed decisions**: upgrade-prompt CRO ships in both places (Back Office sidebar unchanged + a new POS Mode banner for real feature-wall gaps found during planning, e.g. discounts). Rollout is a clean one-shot route move on this branch, no runtime feature flag — git branch isolation + Vercel preview are the safety net before merging to `main`.

---

## Stage 0 — Baseline

- [x] On `epidom-revamp`, working tree tracked.
- [x] Vercel preview verified green for this branch.
- [x] No DB migration needed (`Store.kitchenDisplayEnabled` already exists).

## Stage 1 — Route-group restructuring (one-shot move)

- [x] `(pos-mode)/layout.tsx` created — single `requirePlan(storeId, "POS")`, session/ownership checks mirrored from `(dashboard)/layout.tsx`, `StoreAccessGate` → `OfflineSyncProvider` → `PosStaffGate` → `PosModeShell` nesting.
- [x] `pos/page.tsx`, `pos/orders/page.tsx`, `pos/kds/page.tsx`, `tables/page.tsx` moved from `(dashboard)/` into `(pos-mode)/`, dropping the now-redundant page-header titles and the per-page `bypassStaffGate` logic (layout owns it now).
- [x] Old `(dashboard)/pos/`, `(dashboard)/tables/` directories deleted (including their `layout.tsx` `requirePlan` duplicates).
- [x] `pos-page-headers.tsx` deleted (fully unused after the move).
- [x] `(pos-mode)/loading.tsx` added — POS-Mode-shaped skeleton (item grid + cart), not the dashboard list skeleton.
- [x] `(pos-mode)/error.tsx` added — same stale-chunk recovery as `(dashboard)/error.tsx`, "back to safety" link points at `/pos` instead of `/dashboard`.
- [ ] Confirm no hardcoded links assume `(dashboard)` in the path (should be a no-op — route groups don't appear in URLs).
- [ ] Confirm `src/proxy.ts` matcher has no route-group-name dependency.
- [ ] `/pos/display`, `/pos/orders/print`, `/pos/orders/daily-report` re-verified untouched and still resolving correctly alongside the new group.

## Stage 2 — POS Mode shell chrome

- [ ] `src/features/pos-mode/pos-mode-shell.tsx` — status bar → `<main>` → tab bar, `dvh`/`app-zoom` per convention.
- [ ] `pos-mode-status-bar.tsx` — store name/online badge/staff badge (ported from `pos-header.tsx`'s desktop branch) + printer menu.
- [ ] `pos-mode-tab-bar.tsx` — Kasir/Antrian/Dapur/Meja + `⋯` overflow, ≥44px targets, Dapur visibility driven by `kitchenDisplayEnabled`, tab filtering driven by `allowedPages`.
- [ ] `pos-mode-overflow-menu.tsx` — customer-display trigger, clock in/out, link to light schedule view.
- [ ] Trim `pos-shell.tsx`/`pos-header.tsx` down to just the mobile cart-trigger button (status info now lives in the shell-level status bar).

## Stage 3 — Staff PIN gate consolidation

- [x] `PosStaffGate` lifted to `(pos-mode)/layout.tsx` (wraps the whole shell, not just `/pos`'s own children) — closes the gap where `/pos/orders`, `/pos/kds`, `/tables` previously had no PIN re-verify.
- [ ] Remove the now-redundant `<PosStaffGate>` wrapper and `bypassStaffGate` prop from inside `pos-shell.tsx`/`PosShellProps`.
- [ ] Fix `pos-staff-gate.tsx`'s two bare `min-h-[calc((100vh-200px)/var(--app-zoom,1))]` heights → `calc(100dvh/var(--app-zoom,1))` (the 200px offset no longer matches anything once the gate renders above the whole shell).

## Stage 4 — Schedule split (light "my shift" view)

- [ ] `(pos-mode)/schedule/page.tsx` rendering `MyScheduleList` (reused, not rebuilt), sourcing `staffMemberId` from `usePosSession().staffId`.
- [ ] `ClockInOutDialog` reused unchanged, opened from the overflow menu.
- [ ] `ROLE_DEFAULT_PAGES.CASHIER`/`.KITCHEN`: `"/schedule"` → `"/pos/schedule"`.
- [ ] `ALL_STAFF_PAGES` fix: add `POS_MODE_ONLY_PAGES = ["/pos/schedule"]`, union into `ALL_STAFF_PAGES` — without this, an owner editing any staffer's permissions silently drops their clock-in access (confirmed real, not speculative).

## Stage 5 — Upgrade-prompt banner in POS Mode

- [ ] `discounts: "OPERATIONS"` added to `FEATURE_MIN_PLAN` (confirmed: zero plan gating exists on discounts today).
- [ ] `pos-mode-upgrade-banner.tsx` — dismissible strip below the status bar.
- [ ] `triggerWall(minPlan, featureLabel)` provider mounted in the POS Mode shell, mirroring `useUpgradeGate`'s plan logic with banner presentation instead of a blocking modal.
- [ ] `pos-cart.tsx`'s discount popover gated on `planAtLeast(currentPlan, FEATURE_MIN_PLAN.discounts)` — triggers the banner instead of opening, when below tier.
- [ ] Banner CTA routes through the existing `upgradeHrefFor(minPlan)`.

## Stage 6 — Back Office nav trim (data only, not mechanism)

- [ ] Remove `/pos`, `/pos/orders`, `/pos/kds`, `/tables` from `dashboardNavigation`'s "Point of Sale" section (`/menu` stays).
- [ ] Verify `new-orders-card.tsx`'s existing `/dashboard` summary-card link to `/pos/orders` still resolves (no code change expected).
- [ ] Delete the now-dead `POS_CASHIER_PATH` special case in `page-shell.tsx` once Stage 1 is verified end-to-end.

## Stage 7 — Touch-target and constraints audit

- [ ] Convert bare `vh` heights to `dvh`: `tables-manager.tsx:327`, `pos-order-queue.tsx:337,349` (empty states).
- [ ] Decide + document whether "dvh never vh" covers chrome-free print roots (`order-history-print-view.tsx`, `shift-report-print-view.tsx`) or is scoped to dialogs/sheets/drawers only.
- [ ] ≥44px pass: `pos-checkout-dialog.tsx`, `pos-hold-dialog.tsx`, `refund-dialog.tsx`, `pos-printer-menu.tsx`, `send-receipt-whatsapp.tsx`, `pos-item-grid.tsx` cells.
- [ ] New Stage 2/5 components built to ≥44px from the start.
- [ ] Spot-check `:hover`-only affordances have a tap/focus equivalent.
- [ ] `w-full` vs `flex-1` check on new/touched button rows.
- [ ] `min-h-0`/`min-w-0` on new nested flex/scroll containers.
- [ ] No new code formats currency from a raw `number` instead of `formatPrice`.

## Stage 8 — Verification

- [ ] Role matrix (OWNER/MANAGER/CASHIER/KITCHEN) × new shell.
- [ ] Kitchen-display toggle live-hides/shows the Dapur tab; non-owner can't flip it.
- [ ] Upgrade banner fires correctly, dismissible, doesn't block checkout; Back Office lock unaffected.
- [ ] Schedule split: default AND customized staff permissions both retain `/pos/schedule` access.
- [ ] Spec's "Constraints carried over, unchanged" list re-checked against every touched file.
- [ ] Real-device/responsive pass, iPad landscape primary.
- [ ] `loading.tsx`/`error.tsx` regression check across `/pos` → `/pos/orders` → `/pos/kds` → `/tables`.
- [ ] Push branch, Vercel preview rebuilds clean, full manual pass before merging to `main`.
- [ ] `tsc`/build/lint clean.

## Stage 9 — Deferred: Phase 2 (Back Office shell)

Not started. Revisit once Phase 1 has shipped with real usage data, per the spec's own sequencing rule.

---

## Phase 5+ — Next Candidates (pre-v3 backlog, still valid, not scheduled)

- **E2E tests (Playwright)**: 5 critical journeys — sign-up → publish storefront, place online order, open shift → POS sale → close shift, finance report export, multi-outlet owner drill-down.
- **Custom domains**: map a merchant's own domain to their `@slug` storefront.
- **Stripe Connect**: 80/20 payment facilitation. Requires legal review for BI/OJK compliance before shipping.
- **Per-outlet manager permissions**: ENTERPRISE stores with multi-outlet need scoped access.
- **Aggregator v2 (official API)**: GoFood/GrabFood partner API. 6–12 month relationship-building track.
- **Cloudflare R2 migration**: swap Vercel Blob for R2 + Cloudflare Images.
- **Singapore DB region**: migrate Postgres when p95 latency from Jakarta exceeds 200ms.
- **`fr.ts` locale gap**: ~587 lines behind `en.ts`, notably the entire `/schedule` page and the POS resume/hold/refund flow — full parity backfill not yet scheduled.
