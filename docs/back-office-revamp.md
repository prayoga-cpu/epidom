# Epidom, Back Office Revamp — Phase 2 of the Dashboard Revamp

Companion to `docs/dashboard-revamp.md` (Phase 1, POS Mode — shipped). That document explicitly deferred Back Office's own shell to "Phase 2, revisit once POS Mode has shipped and real usage data exists." This is that phase, built the same way Phase 1 and the website redesign brief were: a deep audit of the current code, four live competitor fetches (Moka, Square, Toast, sunday — their *management*-side products specifically this time, not their POS terminals), and a pass through this project's own strategy docs (STRATEGY.md, FEATURES.md, roadmap.md, AGENTS.md).

---

## Opening stance

**Agree with the original spec's shell call. Disagree that Back Office is otherwise fine.**

`dashboard-revamp.md` said Back Office "earns density, it doesn't need the operator-mode simplification," and "what moves here that wasn't here before: nothing." The first sentence still holds — nothing in this research argues for replacing the left-rail/drawer shell. Square, Toast, and Moka's own back-office products are all dense, desktop-first, left-nav/top-nav shells; none of them simplify their management surface the way a POS terminal simplifies.

The second sentence was wrong, and it's why this brief exists. Splitting POS Mode out was a real edit to the same nav config this phase touches, and it left three concrete scars: a nav section reduced to one item, a stale comment, and — unrelated to Phase 1 but never addressed — a pre-existing completeness gap in `/owner`, the flagship Enterprise multi-outlet page.

None of the fixes below touch the shell's structure. All are nav-config, one relocated page, and one page's tab consolidation.

---

## Tier 1 — Structural completeness (P0)

### `/owner` — the multi-outlet rollup, orphaned outside the shell

**Current:** Lives at `src/app/(app)/owner/page.tsx`, outside `store/[storeId]/(dashboard)/` entirely. No `PageShell`, no `Sidebar`/`Topbar`. Gated only by session presence — the real ENTERPRISE check lived inside `GET /api/owner/summary`, surfaced as a 403 rendered client-side. Not in `ALL_STAFF_PAGES` — no staff persona could ever reach it. One entry point in the whole UI: a single "All Outlets" button inside `finance-client.tsx`, shown only when a business has more than one store. The page's own table had no drill-down, despite `roadmap.md`'s own Phase 5 acceptance criterion ("drill down from rollup to outlet to shift to order"). The i18n key `nav.owner` ("Owner Dashboard") existed in all three locale files and was used nowhere — evidence this integration was always the intended next step.

**Direction:** Moved into the shell at `/store/{storeId}/owner`, gated exactly like Finance (`requirePlan(storeId, "ENTERPRISE")` + `requireStaffPageAccess`). Added to the nav rail. The old bare `/owner` now redirects via `/go/owner` so existing bookmarks resolve. Each row in the rollup table now links to that store's own Finance page — the cheapest possible fix for the roadmap's named drill-down gap. The "All Outlets" button in Finance stays (a contextual shortcut is a legitimate second affordance alongside a nav-reachable page, not a duplicate — see the competitor synthesis below), just retargeted to the new store-scoped URL.

**Reference:** Square/Toast/sunday all converge on the same pattern — multi-location always has two distinct, coexisting UI patterns: a context-switcher (pick one store) and a separate comparison/rollup view (see several/all at once). Never merged into one control. Epidom's `store-switcher.tsx` is the former; `/owner` is now properly the latter.
**Priority:** P0. Shipped this phase.

---

## Tier 2 — Nav debt from Phase 1 (P0)

### Section regrouping

**Current:** "Point of Sale" held exactly one item (`/menu`) since Phase 1 removed the other four routes. "General" (Profile, Storefront, Dashboard, Billing) shared only "always visible," not a job. "Enterprise" paired a dense reporting suite (Finance) with an unrelated support-ticket form (Custom Development).

**Direction:** Regrouped by job, keeping the plan-tier skeleton (right call — `STRATEGY.md`'s own tier table groups the same way):

| Section | Before | After |
|---|---|---|
| General | Profile, Storefront, Dashboard, Billing | Dashboard, Storefront |
| Point of Sale | `/menu` | *(removed)* |
| Operations | Data, Management, Production, Alerts, Staff, Schedule | unchanged |
| Reports *(renamed from Enterprise)* | Finance, Custom Development | Finance, Owner |
| Account *(new)* | — | Profile, Billing, Custom Development |

**Reference:** Square's Reports / Items+Customers+Team / Account & Settings split, with Banking pulled out of Settings for being a daily-glance concern (Epidom's version: Finance/Owner get their own "Reports" bucket, not buried in Account).
**Priority:** P0. Shipped this phase.

### `/menu` ↔ `/storefront` duplication

**Current:** `/menu` and Storefront's Menu tab rendered the identical `MenuManager` tree — but weren't equally gated. `/menu` required POS tier; Storefront's tab had no gate at all, just a hint banner below POS. A FREE-tier user's only real path to publish a menu was already Storefront's tab — directly matching `STRATEGY.md`'s named activation metric (>40% of signups publish a menu in week 1) and its #1 acquisition channel (self-serve PLG). The `/menu`-as-a-POS-tier-fast-path design (confirmed via `menu/layout.tsx`'s own comment) was deliberate, not accidental — but a separate nav rail entry isn't required to preserve that: a direct link/bookmark to a specific tab does the same job.

**Direction:** Collapsed `/menu` into Storefront's Menu tab. `storefront-editor-client.tsx` now syncs its active tab to a `?tab=` query param, so `/storefront?tab=menu` is the same fast, focused entry point `/menu` used to be — just not a duplicate nav item with an inconsistent gate. `/menu` itself is now a redirect (no plan gate, since the destination isn't gated either). A staffer previously grantable only `/menu` (a narrower permission than `/storefront`, which also exposes WhatsApp number, hours, and other settings) keeps that exact narrower access: `/menu` stays grantable via a new `grantableOnlyNavItems` export (mirroring how `posModeNavItems` already work — grantable, deliberately absent from the rail), and `storefront-editor-client.tsx` detects a menu-only staff session and renders bare `MenuManager` with no tabs, identical to the old page's behavior.

**Reference:** Moka's Perpustakaan (item/promo/tax definitions) vs. Bahan Baku/Inventaris (stock levels) split — precedent for keeping menu *definitions* as one canonical place rather than two competing entry points.
**Priority:** P0. Shipped this phase.

### Locked-nav copy — event/benefit framing

**Current:** Every locked item's copy was the same generic `"Upgrade to {plan}"`, rendered only as a hover `title` attribute — contradicting `STRATEGY.md`'s own explicit upsell philosophy ("upgrade prompts should explain the event... rather than the feature") and invisible on the mobile drawer, the exact device this shell's own spec names for "a solo owner checking in."

**Direction:** Added `lockedHintKey` to every gated nav item, rendered as an always-visible second line under the label (not a hover tooltip). Benefit-framed, e.g. Finance: "See P&L and margin by channel," Owner: "Compare revenue across every outlet." Drafted in English, Indonesian, and French — route through translation review before treating the id/fr copy as final.

**Reference:** `STRATEGY.md` §5's own written philosophy.
**Priority:** P0. Shipped this phase.

---

## Tier 3 — Technical debt worth naming, not urgent (P1)

### `finance-client.tsx` — 2,850-line, 11-tab monolith

**Current:** One file, the single largest component in the entire codebase — 2x the next-biggest (`public-menu.tsx`, 1,451 lines) and 2.6x POS's own largest (`order-history-tab.tsx`, 1,083 lines). `docs/dashboard-revamp.md`'s own premise, that the cashier screen was "already the single largest, most complex client component in the app," no longer holds.

Checked whether Square's Banking-vs-Reports split (pull a daily-glance workflow out to its own first-class nav item) applies here: the closest candidate, Cash Reconciliation, is a retrospective report of a POS shift-close, not a live workflow. No IA change indicated — this is purely a code-structure problem, not a navigation one.

**Direction (not shipped this phase — separate PR, zero user-visible change):** Decompose by tab into `src/features/dashboard/finance/components/tabs/*.tsx`, each receiving already-resolved query results plus shared filter state as props. `FinanceClient` stays the thin orchestrator.

**Priority:** P1. Deferred.

---

## Explicitly deprioritized (P2) / not recommended

- **Workflow-shaped pages** (Management's Stock tab, Production, Schedule) — genuinely dense, closer to dedicated apps than dashboard pages, but nothing in this research gives a stronger reason to restructure them than "noticeably dense." Competitors have equally dense sub-sections inside equally dense shells.
- **`/dashboard`** — already matches the cross-competitor convergence on cards/widgets at the top level (Square's Home, Moka's Dasbor, Toast Now's widget-first home). No change.
- **Codebase-wide feature-framed upgrade copy** (`storefront-settings.tsx`, `custom-products-section.tsx`, `onboarding-content.tsx` all have the same STRATEGY.md-violating pattern this phase fixed in the nav rail specifically) — true event-framing needs a live per-site signal, which is new feature work, not a copy edit. Flagged for its own pass.
- **sunday as a reference** — thin public docs, contributed one usable data point (consolidate multi-venue finance into one view over a switcher) and nothing else.
- **Section-title i18n** (`"General"`, `"Operations"`, etc. are hardcoded, never `t()`-wrapped) — pre-existing, unrelated, cosmetic.
- **Full drill-down UI polish on `/owner`'s table** (sorting, filters matching Finance's own) — this phase closes the roadmap's named gap with one link; a fuller UI has no forcing function yet.

## What's already working — don't touch

The left-rail/drawer shell itself (density, `xl:` breakpoint). `/data`'s 5-tab structure, `/staff`, `/billing`, `/alerts` (deliberately thin, correctly deep-links to Management). The locked-item visual language (amber, lock icon) — this phase changes its copy source only, not its look. Finance's actual report content and correctness.

---

## Competitor research notes (Moka, Square, Toast, sunday — management side)

- **Moka**: separates item/promo/tax *definitions* (Perpustakaan/Library) from stock *levels* (Bahan Baku/Inventaris) as distinct top-level sections.
- **Square**: cleanest 3-way split — Reports (numbers) / Items+Customers+Team (lists) / Account & Settings (config) — with Banking pulled out of Settings into first-class nav because it's daily-glance, not one-time config. Multi-location settings scale per-entity (profile, hours, bank account, branding per location) with a shared item library across all locations.
- **Toast**: 9-category, 40+-report suite with per-category permission gating. A location-dropdown context-switcher sits separately from a "Locations" comparison filter inside reports — two different jobs, two different UI. Toast is the cautionary tale, not a pattern to copy: splitting functions into separately-branded, separately-logged-in products (Payroll/Marketing/xtraCHEF/Team Management) is something Toast's own docs say they're now unwinding ("consolidating logins"). Lesson for Epidom: nav-section boundaries within one shell, not fragmentation into separate products.
- **sunday**: weak IA reference (thin public docs), but validates "consolidate multi-venue finance into one report view over a location-switcher."
- **Cross-competitor synthesis**: multi-location always has two distinct, coexisting UI patterns — context-switcher and comparison/rollup view — never merged into one control. Dashboard homepages converge on cards/widgets at the top level, never a dense table, across all four.

## Strategy grounding

Plan tier ladder maps directly to nav groupings (FREE→storefront only, POS→cashier, OPERATIONS→Data/Staff/Schedule/Management, ENTERPRISE→Finance/Owner). Upsell philosophy is explicitly event-framed, not feature-framed (`STRATEGY.md` §5). Named activation metric (>40% of signups publish a menu in week 1) directly prioritized the `/menu`↔`/storefront` fix. `/owner`'s gap between documented ("shipped," full drill-down) and actual (flat table, no nav entry) was independently confirmed by both a codebase audit and a strategy-doc audit.
