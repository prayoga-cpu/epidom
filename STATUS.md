# STATUS.md

## Current State: v3 Dashboard Revamp — Phase 1 (POS Mode) — ✅ CODE-COMPLETE, ⚠️ AWAITING LIVE VERIFICATION (branch `epidom-revamp`)

_(AI Agents: update the checklist below every time you finish a stage or a checklist item — check the box, don't re-describe finished work in prose. Keep this file scoped to the active phase; once Phase 1 ships to `main`, fold a short summary into the changelog and reset this file for the next phase.)_

Spec: `docs/dashboard-revamp.md`. Plan: `/Users/darwinprayoga/.claude/plans/stateful-juggling-seal.md`. Not deployed to production — isolated on `epidom-revamp`, commit `5ee9248`. Vercel preview: **https://epidom-mqlnfpp9j-prayogadevelopment-gmailcoms-projects.vercel.app** (`readyState: READY`, confirmed this session).

**What this phase is**: split the dashboard into two shells — a bottom-tab-bar "POS Mode" for Cashier/Kitchen (iPad-first), and the existing left-rail "Back Office" for Owner/Manager, left untouched. POS Mode ships first per the spec's own sequencing; Back Office's shell redesign is Phase 2, deferred until Phase 1 has real usage data.

**Confirmed decisions**: upgrade-prompt CRO ships in both places (Back Office sidebar unchanged + a new POS Mode banner for real feature-wall gaps found during planning, e.g. discounts). Rollout is a clean one-shot route move on this branch, no runtime feature flag — git branch isolation + Vercel preview are the safety net before merging to `main`.

**⚠️ Honest gap**: everything below is verified at the code level — `tsc --noEmit` clean, `next build` succeeds locally AND on Vercel with all `/store/[storeId]/*` routes compiling with no collisions, every permission/gating path traced by hand. None of it has been click-tested in a real browser or on a real iPad — this environment has no Playwright/browser automation available. Role-matrix behavior, the upgrade banner firing, and the Dapur-tab live-toggle are all reasoned from code, not observed running. Treat Stage 8's unchecked items as the real remaining work before merging to `main`.

### Summary table

| Stage | Status | Verified by |
|---|---|---|
| 0 — Baseline | ✅ Done | branch/tree checked |
| 1 — Route-group move | ✅ Done | `next build` route list, zero collisions (caught+fixed one) |
| 2 — POS Mode shell chrome | ✅ Done | code review, `tsc` |
| 3 — PIN gate consolidation | ✅ Done | code review, `tsc` |
| 4 — Schedule split | ✅ Done | code review, `tsc` |
| 5 — Upgrade banner | ✅ Done | code review, `tsc` |
| 6 — Back Office nav trim | ✅ Done | grep sweep, `tsc` |
| 7 — Touch-target audit | ✅ Done | grep sweep + manual dialog review |
| 8 — Verification | ⚠️ Partial | `tsc`/`next build` local + Vercel both clean; role-matrix/live-device/banner-firing/loading-error-boundary items NOT click-tested (no browser automation available) |
| 9 — Phase 2 (Back Office) | ⏸ Deferred | by design, per spec |

---

## Stage 0 — Baseline

- [x] On `epidom-revamp`, working tree tracked.
- [x] Vercel preview verified green for this branch.
- [x] No DB migration needed (`Store.kitchenDisplayEnabled` already exists).

## Stage 1 — Route-group restructuring (one-shot move) — ✅ done

- [x] `(pos-mode)/layout.tsx` created — single `requirePlan(storeId, "POS")`, session/ownership checks mirrored from `(dashboard)/layout.tsx`, `StoreAccessGate` → `OfflineSyncProvider` → `PosStaffGate` → `PosModeShell` nesting.
- [x] `pos/page.tsx`, `pos/orders/page.tsx`, `pos/kds/page.tsx`, `tables/page.tsx` moved from `(dashboard)/` into `(pos-mode)/`, dropping the now-redundant page-header titles and the per-page `bypassStaffGate` logic (layout owns it now).
- [x] Old `(dashboard)/pos/`, `(dashboard)/tables/` directories deleted (including their `layout.tsx` `requirePlan` duplicates).
- [x] `pos-page-headers.tsx` deleted (fully unused after the move).
- [x] `(pos-mode)/loading.tsx` added — POS-Mode-shaped skeleton (item grid + cart), not the dashboard list skeleton.
- [x] `(pos-mode)/error.tsx` added — same stale-chunk recovery as `(dashboard)/error.tsx`, "back to safety" link points at `/pos` instead of `/dashboard`.
- [x] No hardcoded links assume `(dashboard)` in the path — confirmed via grep, `new-orders-card.tsx` and all others already use bare `/store/{id}/pos/...` URLs.
- [x] `src/proxy.ts` matcher confirmed to have no route-group-name dependency (untouched).
- [x] `/pos/display`, `/pos/orders/print`, `/pos/orders/daily-report` confirmed still resolving — `next build`'s route list shows all as distinct routes alongside `(pos-mode)`'s, zero collisions. **One real bug this caught and fixed**: the light schedule view was first placed at `(pos-mode)/schedule/page.tsx`, which resolved to `/schedule` and collided with Back Office's existing route — `next build` failed with an explicit parallel-pages error. Moved to `(pos-mode)/pos/schedule/page.tsx` → `/pos/schedule`, matching every other reference to it.

## Stage 2 — POS Mode shell chrome — ✅ done

- [x] `src/features/pos-mode/pos-mode-shell.tsx` — status bar → banner → `<main>` → tab bar, `calc(100dvh/var(--app-zoom,1))` per convention.
- [x] `pos-mode-status-bar.tsx` — store name (via `useCurrentStore()`)/online badge/staff badge (ported from `pos-header.tsx`'s desktop branch) + printer menu.
- [x] `pos-mode-tab-bar.tsx` — Kasir/Antrian/Dapur/Meja + `⋯` overflow, all targets ≥44px, Dapur visibility driven by `kitchenDisplayEnabled`, tabs filtered by `allowedPages` (mirrors `sidebar.tsx`'s own pattern).
- [x] `pos-mode-overflow-menu.tsx` — customer-display trigger (reuses `useCustomerDisplaySettings`), clock in/out (`ClockInOutDialog`), link to `/pos/schedule`.
- [x] `pos-shell.tsx`/`pos-header.tsx` trimmed — `PosHeader` is now just the mobile cart-trigger button (12px bar, `md:hidden`); store name/online/staff/printer/customer-display moved to the shell-level status bar + overflow menu.

## Stage 3 — Staff PIN gate consolidation — ✅ done

- [x] `PosStaffGate` lifted to `(pos-mode)/layout.tsx` (wraps the whole shell, not just `/pos`'s own children) — closes the gap where `/pos/orders`, `/pos/kds`, `/tables` previously had no PIN re-verify.
- [x] Removed the redundant `<PosStaffGate>` wrapper and `bypassStaffGate` prop from `pos-shell.tsx`/`PosShellProps` — layout owns it exclusively now.
- [x] Fixed `pos-staff-gate.tsx`'s two bare `min-h-[calc((100vh-200px)/var(--app-zoom,1))]` heights → `calc(100dvh/var(--app-zoom,1))`.

## Stage 4 — Schedule split (light "my shift" view) — ✅ done

- [x] `(pos-mode)/pos/schedule/page.tsx` rendering `MyScheduleList` (reused, not rebuilt). **Simpler than planned**: sources `staffMemberId` server-side via the existing `getActiveStaffSession()` helper (same `StaffSession` cookie the verify-pin API already sets), not a client-side `usePosSession()` read — Owner's synthetic bypass login never sets that cookie, so it redirects Owner/mismatched sessions to full `/schedule` for free, no extra guard code needed.
- [x] `ClockInOutDialog` reused unchanged, opened from the overflow menu.
- [x] `ROLE_DEFAULT_PAGES.CASHIER`/`.KITCHEN`: `"/schedule"` → `"/pos/schedule"`. Also added `/pos/schedule` to `MANAGER`'s list (not originally planned) — the overflow menu's "My Shift" link is role-agnostic, and without this a Manager PIN persona tapping it would dead-end at `requireStaffPageAccess`.
- [x] `ALL_STAFF_PAGES` fix: added `POS_MODE_ONLY_PAGES = ["/pos/schedule"]`, unioned in — confirmed via direct code read this was a real gap (`allowedPagesSchema` rejects unknown pages), not speculative.

## Stage 5 — Upgrade-prompt banner in POS Mode — ✅ done

- [x] `discounts: "OPERATIONS"` added to `FEATURE_MIN_PLAN` (confirmed: zero plan gating existed on discounts before this).
- [x] `pos-mode-upgrade-banner.tsx` — dismissible strip, every tap target h-11 (44px). Split into a `PosModeUpgradeProvider` (context/state) + separate `PosModeUpgradeBanner` (presentational) so `PosModeShell` controls exactly where it renders (below the status bar), not wherever the provider happens to inject it.
- [x] `usePosModeUpgradeGate().requireFeature(minPlan, label)` mirrors `useUpgradeGate`'s plan logic with banner presentation instead of a blocking modal — Back Office's modal path is untouched.
- [x] `pos-cart.tsx`'s discount popover gated in `openDiscountPopover` — checks before opening, not after filling out the form.
- [x] Banner CTA routes through the existing `upgradeHrefFor(minPlan)`.

## Stage 6 — Back Office nav trim (data only, not mechanism) — ✅ done

- [x] Removed `/pos`, `/pos/orders`, `/pos/kds`, `/tables` from `dashboardNavigation`'s "Point of Sale" section (`/menu` stays). Unused icon imports (`Monitor`, `UtensilsCrossed`, `ChefHat`, `Grid2X2`) cleaned up.
- [x] `new-orders-card.tsx`'s existing `/dashboard` summary-card link to `/pos/orders` confirmed unchanged/working — zero code needed, exactly as the spec predicted.
- [x] Deleted the dead `POS_CASHIER_PATH` special case in `page-shell.tsx` (and the `isPosCashier`-conditional `cn()` it drove) — `/pos` no longer renders through `PageShell` at all.

## Stage 7 — Touch-target and constraints audit — ✅ done

- [x] Converted bare `vh` → `dvh`: `tables-manager.tsx:327` (50vh), `pos-order-queue.tsx:337,349` (60vh).
- [x] Decided + documented: "dvh never vh" targets dialog/sheet/drawer chrome (mobile browser UI shifting the visible viewport), not chrome-free print roots — `order-history-print-view.tsx`/`shift-report-print-view.tsx` keep `vh` deliberately, now with an inline comment explaining why.
- [x] ≥40-44px pass, real findings: `pos-checkout-dialog.tsx` (Cancel/Confirm footer buttons + the post-checkout print-prompt's two buttons, all were the Button default's 36px → h-11), `pos-hold-dialog.tsx` (footer buttons → h-11), `refund-dialog.tsx` (footer buttons → h-11), `pos-printer-menu.tsx` (trigger icon 36px→44px, paper-width/connect/reprint/history buttons 32px→40px), `send-receipt-whatsapp.tsx` (32px→40px). `pos-item-grid.tsx` checked — cells are already `min-h-[120px]`, well clear, no fix needed.
- [x] New Stage 2/5 components (`pos-mode-tab-bar.tsx`, `pos-mode-overflow-menu.tsx`, banner) built to ≥44px from the start — confirmed by re-reading what was written, not retrofitted.
- [x] `:hover`-only spot-check: zero `hover:` usages in any new `src/features/pos-mode/` file.
- [x] `w-full`/`flex-1` and `min-h-0`/`min-w-0` conventions followed in every new component (checked against what was written).
- [x] No new code formats currency from a raw `number` — banner/status-bar have no money display; existing `formatPrice` calls elsewhere untouched.

## Stage 8 — Verification — ⚠️ partial, see the gap note above

- [ ] **Role matrix (OWNER/MANAGER/CASHIER/KITCHEN) × new shell** — code-traced (allowedPages filtering, `requireStaffPageAccess` calls), not click-tested live.
- [ ] **Kitchen-display toggle live-hides/shows the Dapur tab** — hook wiring confirmed in code, not observed toggling live.
- [ ] **Upgrade banner fires correctly** — gate logic + wiring confirmed in code, not triggered live against a real POS-tier store.
- [ ] **Schedule split permission regression** — `ALL_STAFF_PAGES` fix confirmed correct by direct code read, not exercised via the actual Staff permission-edit UI.
- [x] Spec's "Constraints carried over, unchanged" list re-checked against every touched file (see Stage 7).
- [ ] **Real-device/responsive pass, iPad landscape** — not possible in this environment (no device, no browser automation). Needs a human pass before merge.
- [ ] **`loading.tsx`/`error.tsx` regression check** — files exist and reference correct patterns, not exercised via a real throttled-network navigation.
- [x] Pushed to `origin/epidom-revamp` (commit `5ee9248`); Vercel preview rebuild confirmed `readyState: READY` at https://epidom-mqlnfpp9j-prayogadevelopment-gmailcoms-projects.vercel.app.
- [x] `tsc --noEmit` clean (1 pre-existing, unrelated error in `use-push-notifications.ts`, untouched by this work). `next build` succeeds, all routes compile, zero collisions.

## Stage 9 — Deferred: Phase 2 (Back Office shell)

Not started. Revisit once Phase 1 has shipped with real usage data, per the spec's own sequencing rule.

---

## Phase 5+ — Next Candidates (pre-v3 backlog, still valid, not scheduled)

- **E2E tests (Playwright)**: 5 critical journeys — sign-up → publish storefront, place online order, open shift → POS sale → close shift, finance report export, multi-outlet owner drill-down. **This phase is exactly the kind of work that would have caught what manual verification can't reach here.**
- **Custom domains**: map a merchant's own domain to their `@slug` storefront.
- **Stripe Connect**: 80/20 payment facilitation. Requires legal review for BI/OJK compliance before shipping.
- **Per-outlet manager permissions**: ENTERPRISE stores with multi-outlet need scoped access.
- **Aggregator v2 (official API)**: GoFood/GrabFood partner API. 6–12 month relationship-building track.
- **Cloudflare R2 migration**: swap Vercel Blob for R2 + Cloudflare Images.
- **Singapore DB region**: migrate Postgres when p95 latency from Jakarta exceeds 200ms.
- **`fr.ts` locale gap**: ~587 lines behind `en.ts`, notably the entire `/schedule` page and the POS resume/hold/refund flow — full parity backfill not yet scheduled.
