# STATUS.md

## Current State: v3 Dashboard Revamp — Phase 1 (POS Mode) + Phase 2 (Back Office) — ✅ CODE-COMPLETE + TEST-VERIFIED, ⚠️ NO LIVE/DEVICE PASS YET (branch `epidom-revamp`)

_(AI Agents: update the checklist below every time you finish a stage or a checklist item — check the box, don't re-describe finished work in prose. Keep this file scoped to the active phase; once both phases ship to `main`, fold a short summary into the changelog and reset this file for the next phase.)_

Specs: `docs/dashboard-revamp.md` (Phase 1), `docs/back-office-revamp.md` (Phase 2). Plan: `/Users/darwinprayoga/.claude/plans/stateful-juggling-seal.md`. Not deployed to production — isolated on `epidom-revamp`. **Stable preview URL (use this one, not a per-deploy hash link): https://epidom-git-epidom-revamp-prayogadevelopment-gmailcoms-projects.vercel.app** — always points at the latest deploy of this branch.

**Login on the preview URL was broken and is now fixed**: `NEXT_PUBLIC_APP_URL`/`BETTER_AUTH_URL`/`NEXTAUTH_URL` are project-wide Vercel env vars hardcoded to `https://epidom.fr` (production) with no prior per-branch override — `src/lib/auth.ts`'s `betterAuth({ baseURL: process.env.NEXT_PUBLIC_APP_URL })` uses that value to build every post-login redirect and OAuth callback URL, so any login attempt on the preview domain was completing then bouncing to production. Added a `gitBranch: "epidom-revamp"`-scoped override for all three, pointed at the stable preview URL above, via the Vercel API (`target: ["preview"]`, doesn't touch the shared production/other-branches value). **Caveat, not fixed**: if the login screen offers "Sign in with Google," that will likely still fail with a `redirect_uri_mismatch` — Google's OAuth client needs `https://epidom-git-epidom-revamp-prayogadevelopment-gmailcoms-projects.vercel.app/api/auth/callback/google` added to its authorized redirect URIs in Google Cloud Console, which is outside Vercel and this session has no access to fix. Email/password login should work correctly.

**Live testing on the preview found a real gap both phases' planning missed**: neither shell had a way to switch into the other. Phase 1's plan explicitly reasoned about POS→Back Office ("Cashier/Kitchen roles generally shouldn't be jumping into management pages") but never considered the reverse — an Owner/Manager legitimately needs a quick way from Back Office into the till. Added, all gated by role/plan the same way the rest of each shell already is:
- **Back Office → POS**: a prominent "switch to POS" CTA at the top of `sidebar.tsx`'s nav (both desktop rail and mobile drawer) — a filled button linking straight to `/store/{storeId}/pos` at POS tier or above, or a locked upgrade-styled variant below it, mirroring the existing locked-nav-item pattern. Hidden entirely for a staff persona without `/pos` access (defensive — in practice Cashier/Kitchen never reach Back Office at all).
- **POS Mode → Back Office**: a "Dashboard" link added to `pos-mode-overflow-menu.tsx`, visible only when the active persona's role is `OWNER` or `MANAGER` — Cashier/Kitchen don't see it, since their `allowedPages` has no Back Office page to land on.
- **`/stores` (before a store is even picked)**: each `StoreCard` now has a small "switch to POS" shortcut button (top-left corner, sibling to the existing edit/delete dropdown, not nested inside the card's own link) — shown when that business's shared subscription plan supports POS and the store isn't payment-blocked, linking directly to that specific store's `/pos`.

New tests: `sidebar.test.tsx` extended (switch-to-POS CTA plan-gating), `store-card.test.tsx` (new — 4 cases covering plan/blocked-state gating). Full suite: 117 files / 1292 tests passing.

**Three more fixes from the same live-testing round**:
1. **Denied-access fallback now lands on `/pos`, not `/dashboard`** (`require-staff-page-access.ts`) — the old fallback (`allowedPages[0] ?? "/dashboard"`) sent a denied staffer to `/dashboard`, a page most roles were never granted either; worse, an owner who'd unchecked every permission box on a staffer would infinite-loop them between two unreachable pages. Now prefers `/pos` unconditionally over array order (a customized `allowedPages` order shouldn't change where a denied user lands), falling back to their actual first allowed page only when `/pos` itself isn't granted (Kitchen → `/pos/kds`).
2. **Owner account labeled explicitly as the unrestricted "master" account** in Staff Management — the underlying behavior (role `OWNER` bypasses every `staffAllowedPages` check) already existed; added a one-line caption (`pages.staffOwnerMasterHint`, en/id/fr) making that explicit rather than implicit, so it's not mistaken for an ordinary staff row that happens to carry the `OWNER` role.
3. **POS Mode can now switch accounts / log out without detouring through Back Office's topbar.** That mechanism (switch to a different staffer, PIN-gated "back to Owner," full logout with cookie/service-worker-cache clearing) already existed, fully built, in `nav-user.tsx` — but was only reachable from Back Office's Topbar, which Cashier/Kitchen rarely if ever visit. Extracted the logic (untouched, same reload/clearing behavior) into `use-account-switcher.ts` so `nav-user.tsx` and the new `PosModeOverflowMenu` section share one implementation. Deliberately a separate section from Clock In/Out — clocking in/out is a timesheet action for the persona already active; switching is a different question ("who is this device speaking as").

New tests: `require-staff-page-access.test.ts` extended (3 new cases for the `/pos`-preferring fallback), `pos-mode-overflow-menu.test.tsx` (new — 7 cases covering the switcher section's role-based visibility). Full suite: 118 files / 1301 tests passing.

**Fourth request from the same round — date sort/filter on `/pos/schedule`'s "My History" list**: previously unscoped (server-side `take`-limited to the most recent 20 records, no date filter, no sort control). Added a `DateRangeField` (defaults to the last 30 days, matching the convention every other history/report view in the app already uses — `DateRangeField` has no "unset" state, so an unbounded default wasn't an option) plus a Newest/Oldest-first toggle (client-side reverse of the already-date-bounded, ≤50-row result set — no second query shape needed). Server side, `GET /stores/[id]/schedule/my-log` gained `from`/`to` query-param support, mirroring the manager-facing `/schedule/log` route's own parsing byte-for-byte — `fetchUnifiedLog` (the shared merge function both routes call) already supported date-range filtering, it just wasn't wired through this specific endpoint yet.

**Fifth request from the same round — "Back Office" resume CTA + "Back to Stores" + resumable POS shortcut**: three related live-testing asks, one underlying mechanism.
1. **POS Mode's "Dashboard" link restyled to a "Back Office" CTA** (`pos-mode-overflow-menu.tsx`) — was a plain outlined button; now a filled `bg-primary` (the same amber/gold used by `sidebar.tsx`'s reciprocal "switch to POS" CTA) button with a leading icon and trailing `ArrowRight`, visually matching that CTA exactly as requested (same yellow, same shape, same direction of travel).
2. **That button now resumes the last Back Office section actually visited in this store**, instead of always dropping onto `/dashboard`. New `LAST_VISITED_BACK_OFFICE_COOKIE` (`src/lib/last-visited.ts`) — separate from the existing app-wide `LAST_VISITED_COOKIE` because that one is legitimately overwritten by POS Mode pages too (a user currently sitting in POS Mode would just get bounced back into POS Mode if the "Back Office" button used the generic cookie). `LastVisitedTracker` now writes this second, narrower cookie/localStorage entry whenever the current path is a genuine Back Office (non-POS) page; `PosModeOverflowMenu` reads it client-side, validated against the current `storeId` so a stale value from a different store is never used. Same full-logout cleanup as the existing cookies (`use-account-switcher.ts`).
3. **The reciprocal mirror, POS→Back Office direction**: `/stores`' per-card POS shortcut (added in the third fix above) also now resumes the last POS screen (till, orders, KDS, or this store's own schedule view) instead of always opening the bare register — same mechanism, new `LAST_VISITED_POS_COOKIE` + `isPosAppPath()`.
4. **Added a "Back to Stores" action to POS Mode's account section** (`pos-mode-overflow-menu.tsx`) — same action, same `/stores` destination, same gating (`!actingAsStaff` — a staff PIN persona has no store list of its own) as the existing one in Back Office's `nav-user.tsx`, now reachable without leaving POS Mode first.
5. **Incidental fix surfaced while building this**: `RESUMABLE_STORE_SECTIONS` was missing `/pos/schedule` entirely — the "My Schedule" POS page existed as a real route but `isResumableAppPath`/the whole resume-on-sign-in mechanism didn't recognize it. Added.

New tests: `last-visited.test.ts` (new — 7 cases for `isBackOfficeAppPath`/`isPosAppPath`), `pos-mode-overflow-menu.test.tsx` extended (5 new cases — Back Office resume/fallback/cross-store rejection, Back to Stores visibility), `store-card.test.tsx` extended (2 new cases — POS resume/cross-store rejection). Full suite: 119 files / 1315 tests passing.

**Sequencing note**: `docs/dashboard-revamp.md` originally deferred Phase 2 until Phase 1 shipped with real usage data. The user explicitly chose to proceed with Phase 2 now anyway, fully aware there was no usage data yet and no existing wireframe brief for Back Office — Phase 2's first job was to *produce* that brief (`docs/back-office-revamp.md`), built with the same rigor as the original spec (real competitor research, real codebase audit), before implementing it.

**⚠️ Standing gap, both phases**: `tsc --noEmit` clean, `next build` succeeds locally and on Vercel, full `vitest run` passing (see each phase's own count below). Neither phase has been click-tested in a real browser or on a real device — this environment has no Playwright/browser automation available. Treat the unchecked items in each phase's own Stage 8/verification section as the real remaining work before merging to `main`.

### Summary table

| Phase | Stage | Status | Verified by |
|---|---|---|---|
| 1 | 0-7 (build) | ✅ Done | see Phase 1 detail below |
| 1 | 8 (verification) | ⚠️ Partial | `tsc`/`next build`/tests clean; real-device/browser pass outstanding |
| 2 | 1-4 (build) | ✅ Done | see Phase 2 detail below |
| 2 | 5-6 (audit + verification) | ⚠️ Partial | `tsc`/`next build`/tests clean; real-device/browser pass outstanding |

---

# Phase 1 — POS Mode

Split the dashboard into two shells — a bottom-tab-bar "POS Mode" for Cashier/Kitchen (iPad-first), and the existing left-rail "Back Office" for Owner/Manager. Confirmed decisions: upgrade-prompt CRO ships in both places (Back Office sidebar unchanged + a new POS Mode banner). Rollout is a clean one-shot route move, no runtime feature flag.

**A second verification pass caught 5 real regressions** the first pass's code-reading missed — writing and running actual tests found them within minutes. Removing `/pos`/`/pos/orders`/`/pos/kds`/`/tables` from `dashboardNavigation` (Stage 6) silently broke 5 other consumers that assumed that list meant "every page in the app" — including the PWA manifest's own installed `/go/pos` shortcut. All fixed, all now covered by a passing test.

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

- [x] `(pos-mode)/pos/schedule/page.tsx` rendering `MyScheduleList` (reused, not rebuilt). Sources `staffMemberId` server-side via the existing `getActiveStaffSession()` helper.
- [x] `ClockInOutDialog` reused unchanged, opened from the overflow menu.
- [x] `ROLE_DEFAULT_PAGES.CASHIER`/`.KITCHEN`/`.MANAGER`: `/pos/schedule` wired in.
- [x] `ALL_STAFF_PAGES` fix: `/pos/schedule` unioned in via `posModeNavItems` (confirmed real gap, not speculative).

## Stage 5 — Upgrade-prompt banner in POS Mode — ✅ done

- [x] `discounts: "OPERATIONS"` added to `FEATURE_MIN_PLAN` (confirmed: zero plan gating existed on discounts before this).
- [x] `pos-mode-upgrade-banner.tsx` — dismissible strip, every tap target h-11 (44px). `PosModeUpgradeProvider` (context/state) + `PosModeUpgradeBanner` (presentational).
- [x] `usePosModeUpgradeGate().requireFeature(minPlan, label)` mirrors `useUpgradeGate`'s plan logic with banner presentation instead of a blocking modal.
- [x] `pos-cart.tsx`'s discount popover gated in `openDiscountPopover`.
- [x] Banner CTA routes through the existing `upgradeHrefFor(minPlan)`.

## Stage 6 — Back Office nav trim (data only, not mechanism) — ✅ done, 5 regressions found+fixed

- [x] Removed `/pos`, `/pos/orders`, `/pos/kds`, `/tables` from `dashboardNavigation`'s "Point of Sale" section. Deleted the dead `POS_CASHIER_PATH` special case in `page-shell.tsx`.

**Regressions found by writing tests instead of re-reading code, all fixed**: `ALL_STAFF_PAGES`/`allowedPagesSchema` would reject `/pos`/`/pos/orders`/`/pos/kds`/`/tables` in a hand-edited staffer permission set; `PageAccessChecklist` would drop their checkboxes entirely; `AccountAccessDialog` would render an empty page list for Cashier/Kitchen; `FeedbackDialog`'s page picker would lose them; **`/go/*` PWA launcher would break the manifest's own installed `/go/pos`/`/go/pos/orders` shortcuts** (the most user-visible one). Fixed via `posModeNavItems` + `getAllAppNavItems()`, with every "all pages" consumer switched to the latter.

## Stage 7 — Touch-target and constraints audit — ✅ done

- [x] Converted bare `vh` → `dvh`: `tables-manager.tsx`, `pos-order-queue.tsx` empty states.
- [x] ≥40-44px pass: `pos-checkout-dialog.tsx`, `pos-hold-dialog.tsx`, `refund-dialog.tsx`, `pos-printer-menu.tsx`, `send-receipt-whatsapp.tsx` all bumped from the Button default's 32-36px.
- [x] New Stage 2/5 components built to ≥44px from the start. Zero `hover:`-only controls in `src/features/pos-mode/`.

## Stage 8 — Verification — ⚠️ partial

- [x] Role matrix, kitchen-display toggle, upgrade banner gating, schedule-split permission regression — all covered by passing component/unit tests (`pos-mode-tab-bar.test.tsx`, `pos-mode-upgrade-banner.test.tsx`, `staff-permissions.config.test.ts`).
- [ ] **Real-device/responsive pass, iPad landscape** — not possible in this environment. Needs a human pass before merge.
- [ ] **`loading.tsx`/`error.tsx` regression check under real throttled network** — not exercised live.
- [x] Pushed to `origin/epidom-revamp`, Vercel preview confirmed `READY`.
- [x] `tsc --noEmit` clean (1 pre-existing, unrelated error). `next build` clean, zero route collisions.

**What's left before Phase 1 can merge to `main`**: a real click-through on an iPad or iPad-sized viewport (PIN login, all 4 tabs, checkout, discount wall, overflow menu, clock in/out); confirm the `/go/pos` PWA shortcut fix launches from an installed home-screen icon; confirm the Staff dialog's POS Mode permission checkboxes work live.

---

# Phase 2 — Back Office

Built the brief (`docs/back-office-revamp.md`) the same way Phase 1's spec was built: a deep audit of every current Back Office page, live fetches of Moka/Square/Toast/sunday's *management*-side products, and a pass through STRATEGY.md/FEATURES.md/roadmap.md/AGENTS.md. Conclusion: the left-rail/drawer shell itself doesn't need replacing (all four competitors run equally dense management shells) — what needed fixing was IA debt Phase 1 left behind, plus a pre-existing completeness gap.

**Standout finding**: `/owner` (the flagship Enterprise multi-outlet rollup) lived entirely outside the shell being redesigned — no nav entry, no `PageShell` chrome, unreachable by any staff persona, discoverable only via one button buried in Finance, and not delivering the drill-down its own roadmap promised. The i18n key `nav.owner` existed, unused, in all three locales — evidence this was always the intended next step.

## Stage 1 — Nav config foundation — ✅ done

- [x] `dashboardNavigation` regrouped by job: General (Dashboard, Storefront), Operations (unchanged), Reports (Finance, Owner — renamed from "Enterprise"), Account (new — Profile, Billing, Custom Development). Net still 13 items, no single-item section, no grab-bag.
- [x] `lockedHintKey` added to `NavItem`; all 9 gated items given benefit-framed copy (e.g. Finance: "See P&L and margin by channel") in en/id/fr — matches `STRATEGY.md`'s written upsell philosophy ("explain the event... rather than the feature"), previously violated by a generic `"Upgrade to {plan}"` shown only as an invisible-on-mobile hover title.
- [x] `grantableOnlyNavItems` added (just `/menu`) — grantable, deliberately absent from the rail, same pattern as `posModeNavItems`.
- [x] `requireStaffPageAccess` broadened to accept `string | string[]` (verified backward-compatible against all prior call sites).
- [x] `page-access-checklist.tsx` — new "Other" section sourced from `grantableOnlyNavItems` so an owner can still grant/revoke `/menu` specifically.

## Stage 2 — `/owner` into the shell — ✅ done

- [x] New `(dashboard)/owner/{layout.tsx,page.tsx}`, gated exactly like `finance/` (`requirePlan(storeId, "ENTERPRISE")` + `requireStaffPageAccess`).
- [x] `OwnerDashboardClient` frame trimmed — dropped the hand-rolled `p-4 sm:p-6 lg:p-8` wrapper now that `PageShell` supplies its own padding; removed the now-dead client-side 403 banner (the layout gates server-side now, matching `FinanceClient`'s own pattern, which has no such branch either).
- [x] Per-row drill-down link added to the store table (→ that store's `/finance`, ≥44px tap target) — closes `roadmap.md`'s named, previously-unmet acceptance criterion.
- [x] Old bare `/owner` reduced to `redirect("/go/owner")` — verified `/go/*`'s `LAUNCHABLE_SECTIONS` (derived from `getAllAppNavItems()`) resolves it with zero other changes.
- [x] `finance-client.tsx`'s "All Outlets" button retargeted to `/store/${storeId}/owner`.

## Stage 3 — `/menu` ↔ `/storefront` consolidation — ✅ done

- [x] **Confirmed sharper than planned**: `/menu` required POS tier; Storefront's Menu tab had *no* plan gate at all (verified directly) — a FREE-tier user's only real path to publish a menu was already Storefront's tab, matching `STRATEGY.md`'s named activation metric.
- [x] `storefront-editor-client.tsx` — `?tab=` URL sync added (mirrors `finance-client.tsx`'s own `useSearchParams`/`useRouter` idiom).
- [x] `menu/page.tsx` reduced to a redirect (`/storefront?tab=menu`), plan-gate removed (the destination isn't gated either — a FREE-tier bookmark must still resolve). `menu/layout.tsx` deleted.
- [x] Menu-only-staff detection via `usePosSession()` — a persona granted `/menu` but not `/storefront` still sees bare `MenuManager`, no tabs, identical to the old page's behavior. `requireStaffPageAccess(storeId, ["/menu", "/storefront"])` — either grant works.
- [x] Cleaned up now-stale references: `offline-status.ts`'s `menuEditor` entry removed (redirect-only route needs no offline priming), `last-visited.ts`'s resumable-sections set swapped `/menu` for `/owner`.

## Stage 4 — Locked-nav copy — ✅ done

- [x] `sidebar.tsx`'s locked-item rendering now shows `lockedHintKey`'s text as an always-visible second line (not a `title` hover tooltip) — fixes invisibility on the mobile drawer.
- [x] Stale `~18 in view` comment fixed to the correct current count (13).

## Stage 5 — Constraints & touch-target audit — ✅ done

- [x] No new dialog/sheet/drawer introduced this phase — confirmed by diff review, so the `dvh`-vs-`vh` rule doesn't come into play here (and per direct verification, `page-shell.tsx`/`finance-client.tsx` both already use plain `vh` for in-flow content deliberately — that rule targets dialog/sheet/drawer chrome specifically, not this).
- [x] New locked-item second line verified to *increase*, not shrink, row tap height (two text lines + existing padding ≈ 50px+, well above the 40px floor).
- [x] `/owner`'s drill-down link: `size-11` (44px), not hover-gated.
- [x] No money/quantity value re-parsed into a raw float anywhere this phase touched.

## Stage 6 — Verification & docs — ⚠️ partial

- [x] New/updated tests: `require-staff-page-access.test.ts` (9 cases covering the new array-based grant logic), `navigation.config.test.ts` (extended — `/owner` present+gated, `/menu` grantable-only, every gated item has a `lockedHintKey`, no orphaned single-item section), `sidebar.test.tsx` (rewritten for the new section structure), `storefront-editor-client.test.tsx` (new — 6 cases covering `?tab=` sync and the menu-only-staff branch).
- [x] `docs/back-office-revamp.md` committed.
- [x] `tsc --noEmit` clean (same 1 pre-existing, unrelated error). `next build` clean, all routes compile including `/store/[storeId]/owner`, zero collisions.
- [x] `vitest run`: **116 test files / 1286 tests, all passing** (10 new this phase specifically).
- [ ] **Manual pass across FREE/POS/OPERATIONS/ENTERPRISE test accounts on the Vercel preview** — not done in this environment (no browser automation).
- [ ] **Confirm `/owner` reachability + drill-down, `/menu`'s redirect, and the new locked-hint copy render correctly live** — same honest gap as Phase 1.

**What's left before Phase 2 can merge to `main`**: the same class of human pass Phase 1 needs — click through all 4 plan tiers on the Vercel preview, confirm `/owner`'s drill-down link, confirm a menu-only staff PIN session sees the right (tab-less) view, confirm the id/fr locked-hint translations read naturally (drafted, not reviewed).

---

## Phase 5+ — Next Candidates (pre-v3 backlog, still valid, not scheduled)

- **E2E tests (Playwright)**: 5 critical journeys — sign-up → publish storefront, place online order, open shift → POS sale → close shift, finance report export, multi-outlet owner drill-down. **Both phases above are exactly the kind of work that would have caught what manual verification can't reach here.**
- **Custom domains**: map a merchant's own domain to their `@slug` storefront.
- **Stripe Connect**: 80/20 payment facilitation. Requires legal review for BI/OJK compliance before shipping.
- **Per-outlet manager permissions**: ENTERPRISE stores with multi-outlet need scoped access.
- **Aggregator v2 (official API)**: GoFood/GrabFood partner API. 6–12 month relationship-building track.
- **Cloudflare R2 migration**: swap Vercel Blob for R2 + Cloudflare Images.
- **Singapore DB region**: migrate Postgres when p95 latency from Jakarta exceeds 200ms.
- **`fr.ts` locale gap**: ~587 lines behind `en.ts` (confirmed again this session — several `nav.*` keys are missing entirely, e.g. `production`, `menu`, `customDevelopment`, `billing`, `schedule`), notably the entire `/schedule` page and the POS resume/hold/refund flow — full parity backfill not yet scheduled.
- **`finance-client.tsx` decomposition** (Phase 2's P1 finding): 2,850 lines, single largest component in the codebase. Split by tab into separate files — zero user-visible change, own PR.
