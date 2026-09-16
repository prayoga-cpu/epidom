# STATUS.md

## Current State: v3 Dashboard Revamp — Phase 1 (POS Mode) — ✅ CODE-COMPLETE + TEST-VERIFIED, ⚠️ NO LIVE/DEVICE PASS YET (branch `epidom-revamp`)

_(AI Agents: update the checklist below every time you finish a stage or a checklist item — check the box, don't re-describe finished work in prose. Keep this file scoped to the active phase; once Phase 1 ships to `main`, fold a short summary into the changelog and reset this file for the next phase.)_

Spec: `docs/dashboard-revamp.md`. Plan: `/Users/darwinprayoga/.claude/plans/stateful-juggling-seal.md`. Not deployed to production — isolated on `epidom-revamp`. Vercel preview: **https://epidom-44xq5yshn-prayogadevelopment-gmailcoms-projects.vercel.app** (`readyState: READY`, confirmed after the regression-fix commit).

**What this phase is**: split the dashboard into two shells — a bottom-tab-bar "POS Mode" for Cashier/Kitchen (iPad-first), and the existing left-rail "Back Office" for Owner/Manager, left untouched. POS Mode ships first per the spec's own sequencing; Back Office's shell redesign is Phase 2, deferred until Phase 1 has real usage data.

**Confirmed decisions**: upgrade-prompt CRO ships in both places (Back Office sidebar unchanged + a new POS Mode banner for real feature-wall gaps found during planning, e.g. discounts). Rollout is a clean one-shot route move on this branch, no runtime feature flag — git branch isolation + Vercel preview are the safety net before merging to `main`.

**A second verification pass on this same phase caught 5 real regressions** the first pass's code-reading missed — writing and running actual tests (not just re-reading code) found them within minutes. Detailed below (Stage 8's "5 regressions" note); the short version: removing `/pos`/`/pos/orders`/`/pos/kds`/`/tables` from `dashboardNavigation` (Stage 6) silently broke 5 other consumers that assumed that list meant "every page in the app" — including the PWA manifest's own installed `/go/pos` shortcut. All fixed, all now covered by a passing test.

**⚠️ Still-honest gap**: 113 test files / 1266 tests pass, `tsc --noEmit` is clean, `next build` succeeds locally and on Vercel. Role-matrix tab filtering, the kitchen-display toggle, and the upgrade-banner gating logic now have real component-level test coverage (rendered, asserted, passing) — not just code reading. What's still **not** verified: a real browser session, a real iPad, real PIN-login click-through, or the `loading.tsx`/`error.tsx` boundaries under real network conditions. This environment has no Playwright/browser automation available — that pass needs a human before merging to `main`.

### Summary table

| Stage | Status | Verified by |
|---|---|---|
| 0 — Baseline | ✅ Done | branch/tree checked |
| 1 — Route-group move | ✅ Done | `next build` route list, zero collisions (caught+fixed one) |
| 2 — POS Mode shell chrome | ✅ Done | code review, `tsc`, component tests |
| 3 — PIN gate consolidation | ✅ Done | code review, `tsc` |
| 4 — Schedule split | ✅ Done | `staff-permissions.config.test.ts` (proves the exact permission-schema regression is fixed) |
| 5 — Upgrade banner | ✅ Done | `pos-mode-upgrade-banner.test.tsx`, `entitlements.test.ts` |
| 6 — Back Office nav trim | ✅ Done, **5 regressions found+fixed** | `navigation.config.test.ts`, `sidebar.test.tsx` (updated), manual audit of every `getAllDashboardNavItems` consumer |
| 7 — Touch-target audit | ✅ Done | grep sweep + manual dialog review |
| 8 — Verification | ⚠️ Partial | 113 files/1266 tests pass, `tsc`/`next build` clean local+Vercel; real-device/browser pass still outstanding |
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

## Stage 6 — Back Office nav trim (data only, not mechanism) — ✅ done, 5 regressions found+fixed

- [x] Removed `/pos`, `/pos/orders`, `/pos/kds`, `/tables` from `dashboardNavigation`'s "Point of Sale" section (`/menu` stays). Unused icon imports (`Monitor`, `UtensilsCrossed`, `ChefHat`, `Grid2X2`) cleaned up.
- [x] `new-orders-card.tsx`'s existing `/dashboard` summary-card link to `/pos/orders` confirmed unchanged/working — zero code needed, exactly as the spec predicted.
- [x] Deleted the dead `POS_CASHIER_PATH` special case in `page-shell.tsx` (and the `isPosCashier`-conditional `cn()` it drove) — `/pos` no longer renders through `PageShell` at all.

**Regressions this trim caused, found by writing tests instead of re-reading code, all fixed:**

Five other places treated `getAllDashboardNavItems()` as "every page in the app" — true before this trim, false after. Fix: `posModeNavItems` (new, in `navigation.config.ts` — the single source of truth for POS Mode's routes, including `/pos/schedule`) + `getAllAppNavItems()` (= `dashboardNavigation` items + `posModeNavItems`), and every "all pages" consumer below switched to the latter.

1. `ALL_STAFF_PAGES`/`allowedPagesSchema` — would reject `/pos`, `/pos/orders`, `/pos/kds`, `/tables` (not just the new `/pos/schedule`) the moment an owner hand-edited an existing Cashier/Kitchen staffer's permissions. Caught by a failing assertion in `staff-permissions.config.test.ts`.
2. `PageAccessChecklist` (Staff dialog's permission UI) — would render zero checkboxes for those 4 pages, silently removing an owner's ability to grant/revoke them at all. Fixed: a new "POS Mode" section sourced from `posModeNavItems`.
3. `AccountAccessDialog` ("what can I see right now") — would render an **empty page list** for any Cashier/Kitchen persona, since it filters `getAllDashboardNavItems()` by the persona's `allowedPages`.
4. `FeedbackDialog`'s page picker — would lose `/pos`, `/pos/orders`, `/pos/kds`, `/tables`, `/pos/schedule` as selectable feedback-context pages, falling back to "Other".
5. **The `/go/*` PWA launcher** — `LAUNCHABLE_SECTIONS` would reject `/go/pos` and `/go/pos/orders`, falling back to the default landing instead of launching POS Mode. Confirmed via `src/app/manifest.ts`: these are the manifest's own **installed home-screen shortcuts** — this would have been the single most user-visible regression of the five, silently breaking an already-shipped PWA feature for exactly the audience this phase targets.

New coverage: `navigation.config.test.ts` (proves `dashboardNavigation` excludes POS Mode routes, `posModeNavItems` includes all 5, `getAllAppNavItems` reunites both with no gaps/dupes). `sidebar.test.tsx`'s 3 tests that encoded the *old* behavior (`/pos` as a Back Office sidebar item) rewritten to assert the new one.

## Stage 7 — Touch-target and constraints audit — ✅ done

- [x] Converted bare `vh` → `dvh`: `tables-manager.tsx:327` (50vh), `pos-order-queue.tsx:337,349` (60vh).
- [x] Decided + documented: "dvh never vh" targets dialog/sheet/drawer chrome (mobile browser UI shifting the visible viewport), not chrome-free print roots — `order-history-print-view.tsx`/`shift-report-print-view.tsx` keep `vh` deliberately, now with an inline comment explaining why.
- [x] ≥40-44px pass, real findings: `pos-checkout-dialog.tsx` (Cancel/Confirm footer buttons + the post-checkout print-prompt's two buttons, all were the Button default's 36px → h-11), `pos-hold-dialog.tsx` (footer buttons → h-11), `refund-dialog.tsx` (footer buttons → h-11), `pos-printer-menu.tsx` (trigger icon 36px→44px, paper-width/connect/reprint/history buttons 32px→40px), `send-receipt-whatsapp.tsx` (32px→40px). `pos-item-grid.tsx` checked — cells are already `min-h-[120px]`, well clear, no fix needed.
- [x] New Stage 2/5 components (`pos-mode-tab-bar.tsx`, `pos-mode-overflow-menu.tsx`, banner) built to ≥44px from the start — confirmed by re-reading what was written, not retrofitted.
- [x] `:hover`-only spot-check: zero `hover:` usages in any new `src/features/pos-mode/` file.
- [x] `w-full`/`flex-1` and `min-h-0`/`min-w-0` conventions followed in every new component (checked against what was written).
- [x] No new code formats currency from a raw `number` — banner/status-bar have no money display; existing `formatPrice` calls elsewhere untouched.

## Stage 8 — Verification — ⚠️ partial, see the gap note above

- [x] **Role matrix (OWNER/MANAGER/CASHIER/KITCHEN) × new shell** — `pos-mode-tab-bar.test.tsx` renders the real component with each role's `allowedPages` and asserts exactly which tabs appear (Owner all 4, Cashier 3 minus Dapur, Kitchen only Dapur, Manager all 4, an Owner-role StaffMember row treated as unrestricted). Component-level, not a live click-through.
- [x] **Kitchen-display toggle live-hides/shows the Dapur tab** — same test file, asserts Dapur present/absent as `kitchenDisplayEnabled` flips, independent of role.
- [x] **Upgrade banner fires correctly** — `pos-mode-upgrade-banner.test.tsx`: renders nothing until gated, surfaces below tier, silent at tier, dismissible, CTA links to the right pricing URL. Component-level, not a live checkout flow.
- [x] **Schedule split permission regression** — `staff-permissions.config.test.ts` reproduces the exact failure mode through `updateStaffSchema` directly (the schema the API route uses), not just the resolver — proves a hand-edited Cashier `allowedPages` array keeps `/pos/schedule`.
- [x] Spec's "Constraints carried over, unchanged" list re-checked against every touched file (see Stage 7).
- [ ] **Real-device/responsive pass, iPad landscape** — not possible in this environment (no device, no browser automation). Needs a human pass before merge.
- [ ] **`loading.tsx`/`error.tsx` regression check** — files exist and reference correct patterns, not exercised via a real throttled-network navigation.
- [x] Pushed to `origin/epidom-revamp`; Vercel preview rebuild triggered after the regression-fix commit, confirmed reaching `readyState: READY` (see Current State line for the URL).
- [x] `tsc --noEmit` clean (1 pre-existing, unrelated error in `use-push-notifications.ts`, untouched by this work). `next build` succeeds, all routes compile, zero collisions. `vitest run`: **113 test files / 1266 tests, all passing** (1261 pre-existing/updated + 21 new across 5 new test files for this phase specifically).

**What's left before this can merge to `main`, in order of what actually needs a human**: (1) a real click-through on an iPad or iPad-sized browser viewport — PIN login, all 4 tabs, checkout, discount wall, overflow menu, clock in/out; (2) confirm the `/go/pos` PWA shortcut fix actually launches correctly from an installed home-screen icon; (3) confirm an owner can still toggle Cashier/Kitchen POS permissions via the Staff dialog's new "POS Mode" checklist section. Everything else in this phase now has either a passing automated test or a clean production build behind it.

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
