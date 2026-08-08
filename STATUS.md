# STATUS.md

## Current State: Phase 5 + Maintenance — ✅ PRODUCTION LIVE (2026-05-29)

_(AI Agents: Update this checklist every time you finish a task)_

---

## ✅ 2026-08-08 — Currency-Conversion Bug: Menu Prices, Smart Import, Finance Reports

Operator reported (with screenshots, on a real EUR-currency customer account) that a product priced at ~€1 in Data → Products showed as "€20,833.33" on the linked POS menu item, and asked for a comprehensive audit of currency handling ("these data must be accurate"), not just a one-off fix.

- [x] **Root cause**: `Product.costPrice`/`sellingPrice` and `Material.unitCost` are stored in IDR (the platform base currency) everywhere; several write paths copied that raw IDR number directly into places that must hold a literal value in the store owner's own currency, with no conversion.
- [x] **Menu sync fixed** at the source: `autoLinkProductToMenu` (create/import auto-add) and `updateProduct`'s `menuItem.updateMany` sync now convert via new `storefrontService.convertBaseCurrencyToOwner`/`convertBaseToOwnerSync`; client-side `useAddProductToMenu`/`useBulkAddProductsToMenu` (added earlier this session) convert via `useCurrency().convertPrice()` before POSTing.
- [x] **Found and fixed the actual race**: `getStorefrontByStoreId`'s find-then-create let two near-simultaneous product creations both pass the existence check and race to create a store's first `Storefront` — the loser's error was silently caught by `autoLinkProductToMenu`, so that product's menu item was just never made. Now an atomic `prisma.storefront.upsert({ where: { storeId } })`.
- [x] **Backfilled 31 already-corrupted `MenuItem.price` rows across 4 real stores** (read-only diagnostic first, confirmed scope with operator via AskUserQuestion before writing) — only rows where the stored price was an *exact* unconverted copy of the linked product's IDR value were touched (unambiguous bug signature); one non-matching row was left alone rather than guessed at.
- [x] **Smart Import / CSV import was also currency-blind**: `costPrice`/`sellingPrice`/`unitCost` were stored as the raw parsed number with no conversion, unlike the Add/Edit Product form (which applies `convertToBase`). Fixed via a new `convertOwnerToBaseSync` helper, rate fetched once per import batch. Existing bad imported data was *not* backfilled — too ambiguous to distinguish from a deliberately low price — flagged to the operator instead so affected merchants can re-enter.
- [x] **Finance reports were mixing currencies in the same subtraction**: `grossProfit = revenue - cogs` (and `netProfit`) combined literal-currency `revenue` (`Order.total`) with genuinely-IDR `cogs`/`wasteLoss` (`Material.unitCost`/`WasteEntry`) with no conversion — wrong for any non-IDR store. Fixed in `/api/stores/[id]/finance/summary`, `/api/owner/summary`, `/api/stores/[id]/finance/by-item-margin`, and `finance/print/page.tsx` (independently re-runs the same queries, per its own established pattern). Also found and fixed: the print page read `Business.currency` (a legacy field nothing ever syncs — confirmed via grep, no write path touches it) instead of the live `User.currency`, the actual source of truth for an owner's display currency throughout the app.
- [x] **Dashboard revenue displays audited via a parallel research agent**, then fixed by hand per-field (not a blanket find/replace) against each field's actual source: `unpaid-orders-card.tsx`, `new-orders-card.tsx`, `analytics-section.tsx`, `owner-dashboard-client.tsx` (full shadow — every field order-derived), `finance-client.tsx`/`finance-print-view.tsx` (split — order-derived fields shadowed, waste-entry cost snapshots kept on real conversion since that endpoint was untouched).
- [x] `pnpm type-check` / `pnpm lint` clean after all changes.



Operator reported the Finance Reports page was missing its Margin/Waste Loss/Net Profit KPI cards (screenshot), and asked for a full plan (proposed via plan mode, approved) covering: root-causing the missing cards, a flexible filter/sort/condition framework, new report formats, and export/import ideas. Scope approved: all 4 proposed new report types, the multi-outlet rollup upgrade, all 4 schema additions (discount/refund/frozen-COGS/staff-pay) now rather than backlogged, and aggregator settlement-CSV reconciliation as the import feature — user then chose to power through autonomously rather than checkpoint per phase.

- [x] **Root cause found and fixed**: the KPI grid and every report tab rendered `{data && (...)}`/`isLoading ? "Loading" : data` with **no error branch** — a failed or still-loading query didn't show an error, it silently rendered nothing. Every tab in `finance-client.tsx` now goes through shared `ReportStatus`/`ReportStatusRow` components (loading skeleton → retryable error → data), so a report can never again go from "visible" to silently blank.
- [x] **Schema** (migration `finance_discount_refund_cogs_payrate`): `Order.discountAmount`/`discountReason`/`refundAmount`/`refundedAt`/`refundReason`, `OrderItem.unitCostSnapshot`, `StaffMember.payType`/`payRate` (new `PayType` enum). All additive/defaulted, zero impact on existing rows.
- [x] **Discounts**: `computeOrderCharges()` (`order-charges.ts`) now takes a `discountAmount`, applied before tax/service-charge so both tax-inclusive and tax-exclusive math stay correct (unit-tested). POS cart footer gained an "Add discount" popover (amount + reason); wired through checkout + finalize routes, the cart Zustand store, and the printed receipt.
- [x] **Refunds**: new `computeRefund()` pure helper (supports repeat partial refunds, clamped to the remaining refundable total) + `POST /pos/orders/[orderId]/refund`, surfaced as an "Issue Refund" action on POS order history. Deliberately does not reverse stock — a refund in F&B doesn't mean the food comes back into inventory.
- [x] **Frozen COGS snapshot**: `deductStockForOrder()` now stamps `OrderItem.unitCostSnapshot` from `Product.costPrice` (the same figure already shown on the Products page) at the moment stock is deducted, per line item — independent of the existing per-material `StockMovement` aggregation.
- [x] **New Finance tabs**: P&L Statement (Gross Revenue → Discounts → Net Sales → Refunds → COGS → Gross Profit → Waste/Fees → Net Profit, with a "Compare to previous period" toggle showing deltas — `previousPeriodLocalISO()` in `date-range.ts`), Payment Method Breakdown, Menu Item/Recipe Margin (unknown-cost items show "—", never a silently-understated number), Cash Drawer Reconciliation (flags a closed shift whose `cashDifference` isn't zero, using the already-existing but previously unsurfaced `Shift.openingCash/closingCash/expectedCash` fields).
- [x] **Filters**: new `channelFilter()`/`paymentMethodFilter()` in `report-filters.ts`, threaded through summary/channels/top-items/by-category/by-item-margin/by-payment-method. The whole filter set (date range, staff, category, department, channel, payment method, compare-previous) now syncs to the URL via `useSearchParams`/`router.replace`, matching `management-client.tsx`'s existing pattern.
- [x] **Multi-outlet rollup** (`/api/owner/summary`, Enterprise): extended from revenue-only to COGS/gross-profit/margin/net-profit per store, via one batched cross-store `StockMovement`/`WasteEntry` query rather than N per-store calls. Fixed it re-deriving plan-tier ordering locally instead of using the shared `planHasFeature()` gate. Finance Reports page gained an "All Outlets" link (only shown when the business actually has >1 store).
- [x] **Excel export** extended with sheets for all 4 new reports; Summary sheet gained Gross Revenue/Discount/Refund rows.
- [x] **Deferred, documented as follow-up work** (not started): aggregator settlement-CSV reconciliation — investigated the existing Smart Import AI pipeline (`src/lib/ai/import/`) in depth; verdict is that its CSV-parsing stages (reconnaissance/structure) are reusable but its mapping/healing/validation stages and `bulkImportMultiEntity()` execute path are hardcoded to "upsert new/existing records," not "diff against existing Orders" — a reconciliation feature needs a mostly-separate pipeline + new UI step, not a quick new `EntityType`. Also deferred: true multi-select filters (Staff/Category/Department are still single-select), a numeric revenue-threshold filter on list tabs, and print-view support for the two new Channel/Payment-Method filters (print page's server-side queries weren't extended).
- [x] **Concurrent session note**: a separate live session was independently fixing a pre-existing multi-currency bug (COGS/waste stored in IDR base currency being combined with owner-currency revenue without conversion) across the same finance routes/files while this work was in progress — landed cleanly as additive changes on top of this session's code (`storefrontService.getOwnerCurrencyAndRate`/`convertBaseToOwnerSync` calls in `finance/summary`, `finance/by-item-margin`, `owner/summary`, `owner-dashboard-client.tsx`); this session fixed only the resulting `storeId` possibly-undefined type errors (the established `storeId!` convention used elsewhere in the API routes), left their currency-conversion logic untouched.
- [x] `pnpm type-check` / `pnpm lint` clean. `pnpm test`: 651 tests, 647 passing — the 4 failures are pre-existing and unrelated (in `storefront-auto-link.test.ts`/`product.service.test.ts`, from the concurrent currency-conversion session's own in-progress test updates, not this work).

---

## ✅ 2026-08-08 — Bulk "Add to Menu" on Products + Data Page Persisted Tab/Filters

Operator asked for two things on the Data → Products page: a bulk-selection action to push several selected products into the POS menu at once, plus a fix for products that "sometimes" don't auto-sync to the menu; and separately, for the Data page's active tab and each tab's filters to persist across navigation like the rest of the app already does (Stock/History), instead of always resetting to Materials/defaults.

- [x] **Root-caused the silent menu-sync gap**: `storefrontService.getStorefrontByStoreId()` auto-creates a store's first `Storefront` row via a find-then-create check — two near-simultaneous product creations (e.g. quick double-submit, or a race between two requests) could both pass the `findUnique` check and both attempt `create`; the loser hit a unique-constraint error on `storeId`, which `autoLinkProductToMenu`'s catch block swallowed silently (by design, non-fatal), so that product's `MenuItem` was simply never created with zero visible failure. Switched to `prisma.storefront.upsert()` keyed on `storeId` so the second caller becomes a no-op update instead of a failed create.
- [x] **Bulk "Add to Menu"**: new `useBulkAddProductsToMenu` (`use-products.ts`) resolves each distinct category name in the selection sequentially first (avoiding a parallel-create race that would otherwise duplicate categories), then creates the `MenuItem`s in parallel via `Promise.allSettled`, returning `{succeeded, failed, total}` for a single summary toast. Extracted `resolveMenuCategoryId`/`createMenuItemForProduct` helpers shared with the existing single-product `useAddProductToMenu`. New toolbar button in `products-section.tsx` (bulk-select mode, next to bulk delete) — filters the selection down to not-yet-linked products client-side against the existing `useProductMenuStatus` set, so it also doubles as the manual recovery tool for any product that falls out of sync for any reason.
- [x] **Data page tab + per-tab filters now persist** (`epidom-data-tab-${storeId}`, `epidom-data-{products,materials,suppliers,recipes}-filters-${storeId}` in `localStorage` via the existing `usePersistedState`), mirroring the Management page's `?tab=`-over-persisted-value pattern (URL wins for deep links, falls back to the saved tab). Each section's filter/sort selections (category, department, stock status, sort field/order, page size) persist; free-text search and pagination position are deliberately excluded from every sanitize function so a reload never restores stale search text or an out-of-range page.
- [x] New i18n strings (`data.products.bulkAddToMenu`, `.toasts.bulkAddedToMenu`/`bulkAddedToMenuPartial`/`bulkAddToMenuNone`) added to `id.ts` and `en.ts` only, per AGENTS.md (`fr` deprecated).
- [x] `pnpm type-check` / `pnpm lint` clean.

---

## ✅ 2026-08-08 — Schedule Hydration Bug + App-Wide Date Localization

Operator reported (with screenshots) that the Work Schedule page's staff/block filter dropdowns showed a React hydration error and appeared broken/empty, and separately that dates rendered inconsistently — raw ISO strings ("2026-08-10 – 2026-08-24"), and English-formatted timestamps ("Aug 7, 2026, 3:30 PM") even with the UI set to Bahasa Indonesia, where the expectation is a natural localized format ("Kamis, 7 Juli 2023"). Investigated with a full-codebase audit before fixing (61 files touched date formatting in some way) and chose the comprehensive fix over a screenshot-only patch, per operator's explicit choice.

- [x] **Hydration bug**: `schedule-grid-filters.tsx` (staff/block filter popovers) and `apply-shift-template-dialog.tsx` (staff checklist) both nested a `<Checkbox>` (renders as `<button role="checkbox">`) inside an outer `<button>` — invalid HTML per the exact console error shown. Both switched to a `role="button"` `<div>` with `onKeyDown` for Enter/Space, matching this codebase's existing custom-clickable-div conventions.
- [x] **Root cause of the date-format bug**: two colliding date-formatting modules (`lib/utils/formatting.ts`, locale-aware but silently English-default when callers omit the locale arg — nearly all of them did; `lib/utils/format-date.ts`, hardcoded `en-GB`, no locale concept), plus ~15 files with raw `.toLocaleDateString()`/`.toLocaleString()`/`.toLocaleTimeString()` calls hardcoding or omitting locale, plus zero of the ~29 `<Calendar>` (react-day-picker) popup usages ever passing a `locale` prop.
- [x] **Architecture fix**: `useI18n()` (`components/lang/i18n-provider.tsx`) now returns locale-bound `formatDate`/`formatDateTime`/`formatDateOnly`/`formatTimeOnly`/`formatRelativeTime`, plus `dateLocale` (date-fns Locale object) and `intlLocale` (Intl tag) for direct `date-fns`/`Intl` call sites — the correct pattern is now the *only* easy path, closing off the "forgot to pass locale" failure mode that caused this bug everywhere.
- [x] Migrated all ~40 component call sites (10 via `format-date.ts`, 21 via direct `formatting.ts` imports, plus the Calendar/date-range-picker/ad-hoc `.toLocaleDateString` sites) onto the bound helpers; deleted `lib/utils/format-date.ts`. Two bulk migrations (Calendar locale-prop sweep, formatting.ts import migration) were delegated to parallel background agents with the exact pattern spelled out from files fixed by hand first; both verified their own type-check/lint clean before reporting back, then re-verified end-to-end.
- [x] Fixed the two shared range-picker components (`date-range-field.tsx`, `date-range-picker.tsx`) — both their trigger-button label formatting and their popup `<Calendar>`.
- [x] Fixed `schedule-client.tsx`'s raw ISO range header (was plain string interpolation, never formatted at all) and `schedule-log.tsx`/`my-schedule-list.tsx`'s English-defaulting Log & History timestamps — the exact bugs in the operator's screenshots.
- [x] **Deliberately left unfixed** (documented, not overlooked): the internal admin panel (`features/admin/`, no i18n system at all — English-only by design, not merchant-facing); `email.service.ts` and the notifications-bell API route (both send/build entire English-only messages, not just an English-formatted date within an otherwise-localized string — patching only the date would look more inconsistent, not less; flagged as a real but separate follow-up); `entity-preview-card.tsx`'s `.toLocaleString("id-ID")` (a *number* format, not a date); `public-profile.tsx`'s `.toLocaleDateString("en-US", {weekday:"long"})` (an internal lookup key against English-keyed opening-hours data, not display text — confirmed by reading the surrounding code before touching it).
- [x] `pnpm type-check` / `pnpm lint` / `pnpm test` (603 passing) all clean after every stage of this work.

---

## ✅ 2026-08-08 — Management Refocused to Stock; Alerts Slimmed to Signal-Only; Optional Production Page

Operator asked to re-scope Management (5 tabs: Deliveries, Production, a mislabeled "History"/production-batch-history, Stock, Movements — the Movements ledger itself was only consolidated in from a separate `tracking` page three days prior, 2026-08-05) around Stock specifically: live stock monitoring, expiration, waste/condition, reorder/refill, and PDF-to-supplier, keeping the real stock-change history as a companion tab, while Alerts stays trigger-only and hands reordering off to Stock. Also asked for per-tab filters/sort and device-persisted "last tab + filters." Clarified via Q&A before building: Production becomes its own opt-in page (many merchants cook fresh with no fixed recipe) with a guide screen before enabling; expiration is a single field per Material, not per-lot; PDF sending covers both email and WhatsApp plus a local-download alternative via the existing print-page convention; filter/tab state is device-local (`localStorage`), not synced.

- [x] **Schema**: `Material.expirationDate DateTime?` (single field, nullable) and `Store.productionEnabled Boolean @default(false)`. Migration `production_toggle_and_material_expiration`.
- [x] **Management → 2 tabs**: `management-client.tsx` now controls **Stock** (default) and **History** (renamed from Movements) via `?tab=` synced to a persisted fallback (`usePersistedState`), mirroring the `?unpaid=1`-over-persisted-tab precedent already used in `pos-orders-tabs.tsx`.
  - **Stock tab** (`edit-stock.tsx`): consolidated the two pre-existing progress-bar idioms (a raw black div bar vs. Alerts' red/green Radix `Progress`) onto one — Radix `Progress`, red when `currentStock <= minStock`. Added status/category/expiration-soon filters + click-to-sort (name/stock%/expiration), all built on a new shared `FilterBar` (`src/features/dashboard/shared/components/filter-bar.tsx`). Added an editable expiration-date field (Calendar/Popover) wired through `UpdateIngredientInput`/`updateIngredientSchema` → `material.service.ts` (which builds its Prisma `updateData` field-by-field — `expirationDate` had to be added explicitly in both the transactional and non-transactional branches, or it would silently no-op). Wired up `BulkAdjustmentDialog`, which was imported with dead state (`bulkAdjustmentOpen`) but no trigger anywhere in the pre-existing file.
  - **New "Reorder & Deliveries" sub-tab**, absorbing three pieces wholesale from Alerts/Management-Delivery: `PlaceOrderDialog`/`BulkOrderDialog` (moved from `alerts/components/`), `OrdersView`→`OrdersToPlaceView` (moved + renamed), and `SupplierDeliveriesTable`/`SupplierDeliveryDetails`/`UpdateDeliveryStatusDialog`/`AddEditDeliveryDialog` (moved from `management/delivery/`, folder now empty/removed) — all now live under `edit-stock/reorder/`. Fixed `useCreateSupplierOrder`'s `onSuccess` to also invalidate `alertKeys`/`materialKeys` (it previously only invalidated the order list, so a fresh reorder didn't reflect in the live stock bar until later marked PLACED).
  - **History tab** (`movements-tab.tsx`): added a date-range filter (`dateFrom`/`dateTo`, already supported server-side but unused) and swapped the ad-hoc sort state for the shared `sortRows`/`SortDir`, plus persisted filters via `usePersistedState`.
- [x] **New optional Production page** (`/production`), gated on `Store.productionEnabled` (owner-only toggle, `pos/kds`'s settings-route pattern mirrored exactly: `/api/stores/[id]/production/settings`). Off by default → renders a guide/explainer card ("use this if you run standardized recipes...", "skip this if you cook fresh to order...") instead of the workflow. The old `recipe-production/` and `production-history/` folders moved wholesale from `features/dashboard/management/` to a new `features/dashboard/production/` feature.
- [x] **Alerts slimmed to signal-only**: removed the `?view=orders` toggle, `OrdersView` branch, and `PlaceOrderDialog` instance from `alerts-client.tsx`. `alerts-table.tsx`'s "Create Order"/"Bulk Order" buttons now `router.push` into `/management?tab=stock&highlight=<materialId>` or `&supplierId=<id>` instead of opening a dialog locally; Stock's Reorder sub-tab consumes those params once (mirrors `staff-client.tsx`'s `?editStaffId=` one-shot-effect pattern) to auto-open the matching `PlaceOrderDialog`/`BulkOrderDialog`, pre-filled from a live `useAlerts()` lookup.
- [x] **Send supplier order PDF**: new dedicated print page `management/print` (outside the `(dashboard)` route group, following the `pos/orders/print`/`attendance/print` precedent — `window.print()` → Save as PDF), replacing the old `print-delivery-dialog.tsx` jsPDF-download pattern (deleted). New `POST /api/stores/[id]/supplier-orders/[orderId]/send`: client generates the PDF via a new `generatePDFBlob()` (same jsPDF/autoTable pipeline as every other export, returning a `Blob` instead of triggering `doc.save()`), route uploads it via the existing `getStorageAdapter()` (Vercel Blob) and sends via `sendSupplierOrderEmail()` (new, Resend `attachments` — unused anywhere else in the codebase until now) and/or `sendFonnteWhatsApp()` (extended with an optional `fileUrl` → Fonnte's `url` param, previously unexposed).
- [x] **Device-local persistence**: relocated `usePersistedState` from `features/pos/hooks/` (POS-only despite being fully generic) to `src/lib/hooks/`, updated its 3 existing POS call sites, and reused it for the Management tab + Stock/History filters.
- [x] **Nav/permissions**: added `/production` (Operations section, off by default per store but always visible in nav — the page itself gates on the toggle, since no precedent existed for nav-level Boolean gating and inventing one wasn't worth it for one item) to `navigation.config.ts` and `ROLE_DEFAULT_PAGES.MANAGER`. Relabeled the `/management` nav item from "Management" to "Stock" (`nav.management` string) — left the href/route unchanged to avoid migrating every staff member's stored `allowedPages`.
- [x] `pnpm type-check` / `pnpm lint` — clean. Dev server smoke-tested (unauthenticated 307 redirects, no compile errors) on `/management`, `/production`, `/alerts`, `/management/print` — full authenticated click-through not done by the agent (no login credentials available; operator's own browser session was live against the same dev server at the time).

---

## ✅ 2026-08-08 — Work Schedule: Custom-Range Grid, Filters, Apply Template

Operator annotated a screenshot of the Work Schedule page: Block Name had no example placeholder, the roster grid had no way to filter by staff/shift block or pick an arbitrary date range, shift blocks (`ScheduleShift`) had to be assigned to staff one cell at a time even though a `POST /staff-schedules/bulk` endpoint already existed server-side with zero frontend callers, and the "standard work minutes per day" field rendered as a 12-hour AM/PM clock picker for what is actually a duration. First pass shipped a fixed Mon–Sun week with a single-date jump popover; operator followed up asking for the app's actual shared date-range component instead (with a 7-day floor) and a grid that renders exactly the chosen days, so the range picker and grid columns were reworked accordingly.

- [x] **Block Name placeholder** — `schedule-shift-blocks-dialog.tsx`'s Block Name input now shows "e.g. Morning Shift" / "cth. Sif Pagi".
- [x] **New `schedule-grid-filters.tsx`** — staff filter (narrows visible rows) and shift-block filter (dims/excludes non-matching entries per row, keeping every staff row visible so gaps in coverage stay visible; day-off entries always stay visible). Staff rows also now sort by role (Owner → Manager → Cashier → Kitchen) then name. Filters persist across range navigation.
- [x] **Custom date range replaces the fixed week.** `schedule-client.tsx` now tracks a `rangeFrom`/`rangeTo` pair picked via the shared `DateRangeField` (`src/components/ui/date-range-field.tsx`, same range picker used elsewhere in the app), which gained a new optional `minDays` prop — set to 7 here so the range can't shrink below a normal roster cycle (implemented via react-day-picker's native range `min`, off-by-one adjusted since it counts the gap between endpoints, not the inclusive span). The grid's day columns — and its table `min-width` — now track the exact chosen range instead of always rendering 7; prev/next pages by the current range's length; "Today" resets to the default Mon–Sun week. Draft/Publish-per-range logic (`from`/`to` were already generic params) needed no changes.
- [x] **New `apply-shift-template-dialog.tsx`** ("Apply Template" button) — bulk-assigns one shift block to a chosen set of staff × days of the visible range in one Save, via the previously-dead `/staff-schedules/bulk` route, chunked at 200 entries/request. Staff/day pairs already scheduled that day are skipped (not duplicated); the client-side empty-cell click gating on the grid was also fixed to check the *unfiltered* entry list, so a block-filtered "empty-looking" cell that actually has a hidden entry can no longer be clicked into creating a silent duplicate.
- [x] **Fixed the standard-hours field's wrong input type** — `schedule-log.tsx`'s "Standard work minutes per day" setting used a native `type="time"` input (rendering as a 12-hour AM/PM clock), misrepresenting a duration as a time of day. Replaced with separate hours/minutes number inputs, formatted like the existing "Xh Ym" Regular/Overtime columns in the same table. Removed the now-dead `minutesToHHmm`/`hhmmToMinutes` helpers.
- `pnpm type-check` / `pnpm lint` — clean.

---

## ✅ 2026-08-08 — Guaranteed Server-Side Image Compression for Every Upload

Audited every image-upload surface (storefront logo/cover, menu item photos, store image, avatar, Instagram-import logo, feedback screenshots, attendance selfies) — all funnel through the one shared `/api/upload` route + storage adapter, but compression was client-side only, inconsistently applied, and in one case (attendance selfies) entirely absent. Operator asked for a durable rule: every image upload, current and future, auto-compresses to a guaranteed size (2MB default).

- [x] **New server-side compression pass**, `src/lib/utils/server-image-compression.ts` (`sharp`), wired into `/api/upload`: resizes to ≤1600px longest edge, re-encodes at decreasing quality until ≤ target size. This is now the authoritative gate — a direct API call or any client that skips compression still gets a compressed result. GIFs are passed through unresized (only size-checked) rather than risk an unreliable animated re-encode path.
- [x] **Fixed a real bug** in `<ImageUpload>` (`src/components/shared/image-upload.tsx`): it rejected the raw selected file against the target size *before* compression ran, so e.g. a normal 3MB phone photo was rejected outright for a 2MB logo slot even though compression would have handled it. Raw files are now only checked against a 5MB processing-cost ceiling; the target size is what compression aims for.
- [x] **Closed the one path with zero compression/validation**: attendance selfie capture (`selfie-capture.tsx` + `clock-in-out-dialog.tsx`) now runs `compressImage()` before upload like every other surface.
- [x] Centralized constants in `src/lib/constants/image.ts` (max dimension, default/min/max target size, raw ceiling, allowed types) — both the client util and the new server util import from it so they can't drift apart. A feature needing a bigger guarantee (storefront cover banner, 5MB) passes its own `maxSize` through as a `maxSizeMB` form field; the server clamps it to a safe range.
- [x] Documented the rule in `AGENTS.md` under Coding rules ("Images") so future image-upload features are built on this pipeline rather than reinventing size limits.
- `pnpm type-check` / `pnpm lint` — clean.

---

## ✅ 2026-08-07 — Logout Consolidated into the Account Dropdown + Zero-Staff Gate Bypass

Follow-up to the Store Access Gate/Schedule-merge sessions above, in two rounds. Round 1: while acting as a staff persona, the account dropdown had no logout path at all — the topbar's real Logout button hides itself in that state, and "Back to Owner Account" is a PIN-gated switch, not a logout. Round 2 (same day): the operator asked to also move the Owner's logout into the dropdown, replace "Switch to Staff Account" with a logout-style action, and make `/stores` → store-click skip the picker when a store has nobody but the owner.

- [x] **Standalone topbar Logout button removed** (`topbar.tsx`, both mobile and desktop layouts) — logout now lives only in `NavUser`'s dropdown, one place instead of two.
- [x] **`nav-user.tsx` dropdown, three items instead of the old two:**
  - **"Log Out of Staff Session"** (staff only) — clears `posSession` + the server StaffSession cookie, no owner PIN, reloads back into `StoreAccessGate`'s picker.
  - **"Switch Account"** (Owner only) — replaces "Switch to Staff Account"; same clear-and-reload as above rather than the old in-dropdown PIN pad, since `StoreAccessGate` is now the one canonical place to pick a persona. `StaffSwitcherDialog` (the old dialog this opened) had no other callers — deleted as dead code.
  - **"Log Out of Owner Account"** (always shown, red/destructive) — the real `signOut()` moved in from the topbar button, redirects to `/login`.
- [x] **Zero-staff bypass.** `(dashboard)/layout.tsx`'s `StoreAccessGate` and `/pos/page.tsx`'s own gate both now also bypass when `prisma.staffMember.count({ isActive: true, role: { not: "OWNER" } })` is 0 for that store — mirrors the existing FREE/POS-plan bypass reasoning (nothing real to choose between), kept the two gates consistent with each other so a zero-staff OPERATIONS+ store doesn't skip the outer gate only to land on POS's own separate "no staff, continue as Owner" screen.
- `pnpm type-check` / `pnpm lint` — clean.

---

## ✅ 2026-08-07 — Web Push Notifications (Orders + Low Stock)

Requested: real OS-level push notifications for the bell/alerts surfaces — specifically new storefront orders and low/critical stock — that work "even when the tab is closed," across every device and browser. Existing `NotificationBell`/`alerts` page are both poll-only (30s/15s) and only useful with an open, focused tab; there was no Web Push infrastructure at all before this session (confirmed greenfield: no `PushSubscription`/VAPID/`Notification.requestPermission` anywhere in the repo).

- [x] **New `PushSubscription` Prisma model**, keyed by `storeId` (not `userId`) — a shared shop device can be operated by rotating staff PIN personas with no `User.id` of their own (`withApiHandler` always requires a persistent Better Auth owner session underneath; staff PIN is a UI-only overlay on top), so push fan-out targets every device subscribed for the store. Migration `add_push_subscriptions`.
- [x] **`src/lib/push/send.ts`** (`sendPushToStore()`) — mirrors `src/lib/realtime/publish.ts`'s exact graceful-degradation pattern (cached "configured" check, dev-only one-time warning, fire-and-forget, never throws). Cleans up dead subscriptions automatically on a 404/410 send response — iOS Safari rotates/expires these more aggressively than Chrome, so this is what keeps the table from accumulating stale endpoints. Tested (`send.test.ts`, 5 tests).
- [x] **Two triggers wired**: `POST /api/public/orders` (storefront order creation) and `fireLowStockAlert` inside `stock-deduction.service.ts` (reuses its existing unread-alert dedup — no second dedup layer added). While touching the storefront order route: also added the `publishStoreEvent(ORDER_CREATED)` call it was missing (the POS order route already had it) — a real, adjacent gap where storefront orders never live-updated an open dashboard tab at all, only reached it on the next 30s bell poll.
- [x] **`public/sw.js`**: `push`/`notificationclick` listeners added (defensive payload parsing, click focuses-or-opens the relevant page). `CACHE_NAME` bumped to `v3` per the file's own bump-on-change convention.
- [x] **`src/hooks/use-push-notifications.ts`** + a toggle in `NotificationBell`'s popover header (not the owner-only Profile settings page — the bell is reachable by both owner and staff personas, matching who should be able to opt a shared device in). Six states: `unsupported` (hidden entirely) / `ios-not-installed` / `default` / `subscribing` / `subscribed` / `denied`. Checks iOS-not-installed *before* the generic `PushManager` support check — outside Home Screen install, iOS Safari has no `PushManager` at all, so checking generic support first would show a dead-end "unsupported" instead of the actionable "Add to Home Screen" hint. A previously-denied permission is its own distinct state (browsers never re-prompt) rather than a retry button that would silently no-op.
- [x] i18n: extended the existing top-level `notifications` namespace in `en.ts`/`id.ts` with a `push: {...}` block; `fr.ts` untouched per AGENTS.md.
- [x] Local dev VAPID keypair generated and added to `.env` (not committed) so the feature is actually end-to-end testable this session, not just type-checked.
- [x] **Found and fixed a real, pre-existing bug while verifying this live**: `src/proxy.ts`'s auth-redirect matcher excluded `favicon.ico` and image extensions but not `sw.js`/`manifest.webmanifest`, so any request to those two without a session cookie got redirected to `/login` instead of the actual file — confirmed via `curl` against the running dev server (307 → `/login?callbackUrl=%2Fsw.js`), not just by reading the code. This silently broke service-worker registration (and therefore PWA installability + push) for anyone who'd never logged in — i.e. the public storefront's own customers, the primary audience for that surface per AGENTS.md. Logged-in dashboard users were never affected (they always carry the session cookie). Fixed by adding both to the matcher's exclusion list, same treatment `favicon.ico` already got. Re-verified via `curl` after restart: both now return 200.

### Cross-browser/device notes
iOS Safari requires Home Screen install (iOS 16.4+) — Apple gates the whole Push API behind standalone display mode; below that, or on desktop Safari <macOS 13, the toggle correctly falls back to its unsupported/hint states rather than a broken "Enable" button. Android Chrome and desktop Chrome/Firefox/Edge need no install step. Manual verification still needed on a real iOS device (see Operator To-Do) — the states were verified via code review + the automated test suite, not a physical device pass.

- `pnpm type-check` — clean
- `pnpm lint` — clean
- `pnpm test` — 596 passing, 1 pre-existing unrelated failure (`date-range.test.ts`, confirmed failing identically with this session's changes stashed out — a date-boundary bug, not touched this session)

---

## ✅ 2026-08-07 — Shifts + Attendance Merged into Schedule

Follow-up to the Store Access Gate/PIN Dedup session below, same day. The operator's framing: Shifts (till cash), Schedule (roster), and Attendance (clock-in/out log) were three fragmented pieces of one real workflow ("staff on shift") — asked for a concrete plan first (via plan mode + clarifying questions) before executing, given the scope.

- [x] **One page, two views, by role — not three pages.** `/shifts` and `/attendance` are now redirects into `/schedule`. Manager/Owner view (`canManage`, unchanged split from the original Schedule feature) gets a new **Log & History** section (`schedule-log.tsx`) below the roster grid: one filterable (staff/type/date-range) chronological table merging `AttendanceRecord` events and `Shift` open/close (rendered as synthetic Cash In/Out rows) — replaces the old separate Attendance Log/Hours tabs and the Shifts cash-reconciliation table. Staff (self-service) view (`my-schedule-list.tsx`) gets **Clock In/Out** (reuses `ClockInOutDialog`, already persona-aware from the session below so no repeated PIN) and, for POS-capable roles only (Cashier, Owner/Manager — matches the pre-existing "openingCash is realistically cashier-only" rationale in `docs/roadmap.md`), **Cash In/Out** (reuses the existing `Shift` open/close endpoints and dialogs, relocated) plus a self-service **My History**.
- [x] **New `src/lib/attendance/unified-log.ts`** — `mergeUnifiedLog()` (pure, unit-tested: `__tests__/unified-log.test.ts`, 8 tests) merges already-fetched `AttendanceRecord`/`Shift` rows, sorts, and filters by date-range/type; `fetchUnifiedLog()` wraps it with the actual Prisma queries. Reused by three call sites: the new manager-only `GET /schedule/log`, the new self-service `GET /schedule/my-log?staffId=`, and the existing attendance PDF export (`attendance/print/page.tsx`, `AttendancePrintView` — now shows Cash In/Out rows too, formatted with the store's currency).
  - Writing the test caught a real bug before it shipped: the first draft filtered `Shift` events by date range in-memory but silently relied on the *caller* having pre-filtered `AttendanceRecord` rows via Prisma — correct for the real Prisma-backed path, but meant the "pure" function wasn't actually self-contained/correct on its own. Fixed by applying the same in-range check to both sources inside `mergeUnifiedLog` itself.
- [x] **Roster: one Publish button, not two.** "Publish Week" / "Print" collapse into one dynamic slot — "Publish Week" while the visible week has a draft entry, "Published" (muted, still clickable) once every entry is published, clicking then opens the PDF instead of re-publishing. Week grid headers now also show the weekday name via `Intl.DateTimeFormat`, locale-aware off the existing `useI18n()` locale — no new i18n keys needed for that part.
- [x] **PIN dedup extended to till cash.** `POST /stores/[id]/shifts` (open) now uses the same `isStaffAuthenticated()` helper the attendance routes already adopted in the session below, instead of its own inline PIN check.
- [x] **"Clock In/Out" removed from the account dropdown, replaced with "Account Access."** Originally planned as a new card on the Profile page (per the approved plan) — caught during implementation that `/profile` is hard-gated owner-only (`requireOwnerOnly`), so a staff persona could never actually reach a card placed there, defeating the point for the very users who'd click it. Pivoted to a dialog (`account-access-dialog.tsx`) opened directly from the dropdown instead — reachable by both Owner and staff personas, shows the active persona's role and exactly which nav pages it resolves to (via `getAllDashboardNavItems()`).
- [x] `navigation.config.ts`/`staff-permissions.config.ts`: removed the `/shifts`/`/attendance` nav items and permission strings (`ALL_STAFF_PAGES` auto-shrinks, no separate Staff-editor checklist change needed). Deleted the now-fully-absorbed `shifts-client.tsx` (and the now-empty `shifts` feature folder) and `attendance-client.tsx`; kept `attendance-print-view.tsx` (still used by the print route).
- [x] `docs/FEATURES.md` and `docs/roadmap.md` updated to describe the merged page instead of three separate ones.

### Note on the plan-mode detour
This session deviated from its own approved plan in one place (the Profile-card → dialog pivot above) after discovering a correctness problem with the plan's premise mid-implementation, rather than building something known to be unreachable. Flagged explicitly rather than silently substituted.

- `pnpm type-check` — clean
- `pnpm lint` — clean
- `pnpm test` — 591 passing, 1 pre-existing unrelated failure (`date-range.test.ts`, not touched this or the prior session)

---

## ✅ 2026-08-07 — Store Access Gate, PIN Dedup, Attendance History/Retake

Live-usage feedback on the staff scheduling/attendance/selfie-clock-in work: (1) camera/location access needed to work reliably on desktop too, not just mobile; (2) a staff member already logged in was being asked for their PIN a second time just to clock in/out; (3) there was no checkpoint between picking a store and landing on the (potentially owner-only) dashboard the way `/pos` already had one.

- [x] **`StoreAccessGate`** (`src/features/dashboard/shared/store-access-gate.tsx`), generalized from `PosStaffGate`, wraps the whole `(dashboard)` route group (`(dashboard)/layout.tsx`) — every dashboard page now sits behind a "who's using this device?" checkpoint, not just POS. Staff pick their name + PIN (same as before); "Continue as Owner" now requires the separate Owner PIN (`VerifyOwnerPinDialog`/`SetOwnerPinDialog`, reused from the existing "switch back to Owner" flow) instead of trusting an already-open Better Auth session. Bypassed on FREE/POS plans (same condition `/pos` already used — no staff feature on those tiers). Shares `usePosSession` state with POS, so `/pos` doesn't ask again on top of this.
- [x] **Fixed a real gap surfaced while building the above:** "Continue as Owner" (both the new gate and POS's pre-existing one) only updated client state — a StaffSession cookie left over from an earlier persona would still make the server-side owner-only-page guard (`requireOwnerOnly`) bounce the request. Both now call the existing staff-logout endpoint first.
- [x] **PIN de-dup.** `ClockInOutDialog` now skips the "select your name" + "enter PIN" steps when the device is already operating as a specific staff persona, going straight to choosing clock-in/clock-out. Server-side, `clock-in`/`clock-out`/`absence` now accept an active StaffSession as proof via a new shared `isStaffAuthenticated()` (`src/lib/attendance/verify-staff-auth.ts`) instead of always requiring the PIN again — a PIN proves identity once, at login, not on every subsequent action from the same already-verified device.
- [x] **POS PIN re-verification, every 4 hours.** New `pinVerifiedAt`/`touchPinVerified` on `usePosSession`; `PosStaffGate` re-prompts the current staff member's PIN (not a full re-pick) after 4 hours of continuous POS use, checked via a 60s interval tick so it fires even if the tab never navigates. Doesn't apply to the Owner persona. Separate from, and stricter than, the once-a-day session everywhere else — POS handles cash.
- [x] **Attendance history + photo retake inside the dialog.** New `GET .../attendance/history` (self-service, scoped to one staffId, distinct from the existing manager-only audit trail at `.../attendance`) and `POST .../attendance/[attendanceId]/retake-photo`. The dialog's new History step is read-only except for the photo, and only within 30 minutes of the original capture (`RETAKE_WINDOW_MS`, checked both client- and server-side) — a retake updates the existing record's `selfieUrl` in place rather than creating a new record, so it reads as the same log entry. Everything else about a record (type, timestamp, notes) is still immutable, consistent with the existing manual-close correction flow's "never rewrite history" principle.
- [x] **Selfie capture hardened for desktop/non-mobile browsers.** `SelfieCapture` now distinguishes camera-permission-denied, no-camera-found, and insecure-context (non-HTTPS/non-localhost) failures with distinct messages, plus a "Try again" retry button so re-granting permission doesn't require closing the dialog. Confirmed the existing `facingMode: "user"` constraint and file-input fallback already work correctly on desktop (soft/ideal constraint, not exact — desktop webcams still match; file picker is the correct desktop-appropriate fallback).

### Concurrent editing note
Active in the same working tree at the same time as the Live Push Layer session below — both touched `CHANGELOG.md`/`STATUS.md`/`package.json`/`src/lib/version.ts`; this session's changes landed as their own `2.19.0` header above the other session's `2.18.0` rather than merging into it, since the two feature sets are unrelated. No file conflicts otherwise (disjoint route/component files).

- `pnpm type-check` — clean (pre-existing, unrelated failures only: `pusher`/`pusher-js` not yet installed for the concurrent realtime session's new dependency)
- `pnpm lint` — clean
- `pnpm test` — 468 passing, 1 pre-existing unrelated failure (`date-range.test.ts`, not touched this session), plus 7 test files that fail to even load due to the same missing `pusher`/`pusher-js` dependency

---

## ✅ 2026-08-07 — Live Push Layer (Pusher Channels) + Presence

Not a Phase 5 roadmap item — built at the operator's explicit request after a question about whether pages/data update live the way Notion/Figma content does. Answer at the time: no — the app was polling-only (5–60s tiers) plus one custom SSE-over-DB-poll endpoint for POS orders. This session adds a real push layer on top without ripping out any of that polling, since it's the safety net now.

Infra choice: **managed realtime SaaS (Pusher Channels)**, not raw WebSockets or Postgres LISTEN/NOTIFY directly — the app is fully serverless (Vercel + Neon Postgres, no Dockerfile/Fly/Railway config anywhere in the repo), and both of those alternatives need something to hold a long-lived connection, which nothing in this deployment currently does. Pusher fits the existing all-serverless model: publish is a plain HTTP call from an API route/service method, the client subscribes directly to Pusher's own infrastructure.

- [x] New `src/lib/realtime/` — `channels.ts` (channel/event naming, one `private-store-{id}` channel per store carrying all domain events, one `presence-store-{id}` channel for presence), `pusher-server.ts` / `pusher-client.ts` (singletons, both expose an `isConfigured` check), `publish.ts` (`publishStoreEvent()` — fire-and-forget, never throws, no-ops until Pusher env vars are set).
- [x] New `POST /api/pusher/auth` — channel authorization, accepts either an owner/manager session (`getSession()` + `verifyStoreOwnership`) or an active staff PIN session (`getActiveStaffSession()`), since POS terminals are as often staff-logged-in as owner-logged-in.
- [x] Wired `publishStoreEvent()` into the actual write paths: the 3 POS order route handlers (create, status PATCH, finalize), `stock-deduction.service.ts` (deduct + reverse), and `material.service.ts` / `product.service.ts` / `recipe.service.ts`'s create/update/delete/adjustStock methods.
- [x] Client side: new `src/hooks/use-realtime-channel.ts` (refcounted subscribe — several hooks share the same per-store channel, so unmounting one can't tear down the channel for the others) and `src/hooks/use-store-presence.ts`, plus `src/components/shared/presence-avatars.tsx`.
- [x] `use-pos-orders.ts` now prefers Pusher when configured and falls back to its original SSE implementation unchanged when it isn't — the only hook with a real fallback branch, since it's the only one that previously had its own live-update mechanism to fall back to. `use-pos-menu.ts`, `use-materials.ts`, `use-products.ts`, `use-recipes.ts`, `use-stock-movements.ts` got an additive push-triggered `invalidateQueries()` on top of their existing polling, unchanged.
- [ ] **Not done this pass** (see CHANGELOG "Known v1 limitations"): direct storefront/menu-editor `MenuItem` CRUD doesn't publish yet (only product-linked menu changes do); no field-level "someone's editing this" indicator or conflict resolution; tables/reservations/supplier-orders/alerts/schedule/finance/admin-dashboard remain poll-only.

### Tests
- [x] `src/lib/realtime/__tests__/publish.test.ts` — confirms `publishStoreEvent()` no-ops without throwing when Pusher isn't configured.
- [x] `src/app/api/pusher/auth/__tests__/route.test.ts` — unauthenticated request rejected, owner-session request for a store they don't own rejected, valid owner/staff sessions authorized.

### Concurrent session note
Another session was active on this same repo at the same time (`StoreAccessGate`, staff-session hardening — see the entry directly below), landing its own `CHANGELOG.md`/`package.json`/`src/lib/version.ts` bump to `2.19.0` mid-way through this session's work. Reconciled by renumbering this session's entry to `2.20.0` (above theirs) rather than reverting either side — no file conflicts, both diffs are disjoint.

- `pnpm type-check` — clean
- `pnpm lint` — clean
- `pnpm test` — 583/584 passing; the 1 failure (`date-range.test.ts`'s preset round-trip test) is pre-existing and unrelated — untouched by either concurrent session's diff, and explained by today's date (the 7th) making "this month so far" and "last 7 days" resolve to the same range, a boundary case in existing preset-detection logic.

---

## ✅ 2026-08-06 — Pricing Page Accuracy Audit

Cross-referenced every claim on `/pricing` (`pricing-cards.tsx` + `feature-comparison.tsx`) against actual plan gating (`src/lib/plans/entitlements.ts`, every `requirePlan()` call under `(dashboard)/*/layout.tsx`, `stripe.config.ts`'s `PLAN_LIMITS`, and the Prisma schema) rather than trusting the existing copy or `docs/FEATURES.md` (found to itself be stale — still describes multi-outlet as Phase-5/Enterprise-only, and AI import/production batches as feature-flagged, none of which is true anymore; left un-edited, out of scope for this pass, flagged for a follow-up).

- [x] Removed 5 fictional feature claims with no code behind them: "Daily P&L emailed to owner" (no scheduled email exists — `src/lib/inngest/functions/` has no such cron), "Allergen + nutrition labels" (no schema field), "Wholesale order portal" (no B2B ordering surface, only a cost-margin display hint), "SSO" (Better Auth only has Google OAuth, no SAML/OIDC), "API + Zapier + webhooks" (no public API/webhook surface — only inbound provider webhooks like Xendit's).
- [x] Fixed a genuine self-contradiction: the Operations card claimed a "multi-outlet dashboard" while the comparison table's `cmp_multi` marked the same-labeled row Enterprise-only. Root cause: two different real things share the ambiguous label "multi-outlet dashboard" — Operations gets **unlimited outlets** (`stripe.config.ts` `maxStores: Infinity`), but the **cross-store owner roll-up view** (`/owner`, `src/app/api/owner/summary/route.ts:33` hard-checks `plan === ENTERPRISE`) really is Enterprise-exclusive. Reworded both so they no longer collide: Operations → "Unlimited outlets", Enterprise → "Multi-outlet owner roll-up dashboard" / comparison row → "Owner roll-up dashboard".
- [x] Also caught (beyond the original audit) that Enterprise's "Centralised recipe library" claim doesn't exist — `Recipe.storeId` in `prisma/schema.prisma` shows recipes are strictly per-store with no cross-store sharing mechanism, consistent with AGENTS.md's no-cross-tenant-query rule. Removed.
- [x] Added the 3 real, shipped-but-previously-unadvertised Operations-tier features from the concurrent scheduling/attendance/waste session: shift scheduling & rosters (`/schedule`), selfie + geolocation attendance (`/attendance`), waste & loss tracking (Management → Edit Stock → Record Waste). Added a reservations mention to the POS tier (`tableReservations: POS` in entitlements.ts was previously unreflected in any pricing copy).
- [x] Deleted 4 dead i18n strings (`t1f7`, `t1f8`, `t2f7`, `t2f8`) — never rendered (`FEAT_COUNTS = [6,6,8,...]` caps those tiers below where they'd appear) and factually wrong for their tier had they rendered (claimed Recipes/Multi-outlet at Free/POS, both actually Operations+).
- [x] Trimmed Enterprise from 9 to 7 card bullets (`FEAT_COUNTS` `9`→`7`) rather than backfill the two removed fictional slots with more invented claims — added one honest support-tier bullet ("Priority support & onboarding", consistent with the existing unverifiable-but-standard "Dedicated account manager"/"Custom SLAs" promises already on that card).
- [x] Edited `en.ts` and `id.ts` only, per AGENTS.md's i18n rule — `fr.ts` (deprecated) left untouched; its now-orphaned old strings are harmless since `translations: Record<Lang, any>` has no cross-locale structural type check.
- `pnpm type-check` — clean
- `pnpm lint` — clean
- `pnpm test` — 575 passing
- `pnpm build` (`next build` directly, since the wrapper script's `sync-changelog.ts` needs `DATABASE_URL` in-process and this shell doesn't auto-load `.env` the way Prisma CLI/Next.js do) — 211 routes, 0 errors, 0 warnings

---

## ✅ 2026-08-06 — Unified Date-Range Picker (`DateRangeField`)

A previous concurrent session's log (below, "Schedule/Attendance Follow-ups") already referenced adopting a repo-wide `DateRangeField` component "another concurrent session was introducing at the same time" — that component never actually landed in this working tree (no such file existed, and Attendance still had the plain From/To inputs). This session builds it for real and applies it everywhere a date-range toggle existed.

- [x] New `src/components/ui/date-range-field.tsx` — a single trigger button + popover containing quick-pick presets (Today, Yesterday, Last 7/30 Days, This Month) and one calendar month with range highlighting, replacing the old two-`<Input type="date">` + separate preset-dropdown pattern. Built on the existing `Calendar`/`Popover` primitives (`react-day-picker`), with a plain `from`/`to` ISO-string API matching how every call site already stored its filter state.
- [x] Applied to all five date-range surfaces: Finance report, Dashboard Analytics, Attendance, Owner Dashboard, and POS Order History (which keeps its own outer "All time/Today/.../Last Month" preset selector and uses `DateRangeField` with `presets={[]}` for just its "Custom" step, avoiding duplicate preset UIs).
- [x] Removed the now-unused `DateRangeLabel` component (`src/features/dashboard/shared/components/date-range-label.tsx`) — its preset logic (`describeDateRange`/`resolveDateRangePreset`/`DATE_RANGE_PRESETS` in `src/lib/utils/date-range.ts`) is reused inside `DateRangeField` instead.
- [x] Added `common.datePicker.dateRange` label key to `id.ts`/`en.ts` (not `fr.ts`, per AGENTS.md).
- [x] New unit test suite `src/__tests__/components/date-range-field.test.tsx` (6 tests: placeholder state, preset-label recognition, custom-range formatting, preset-click commit, hiding presets, two-step calendar commit).
- `pnpm type-check` — clean
- `pnpm lint` — clean
- `pnpm test` — 575 passing

---

## ✅ 2026-08-06 — Schedule/Attendance Follow-ups (day off, print/PDF, date presets, i18n fix)

Live-usage feedback on the Staff Scheduling/Attendance work below, addressed in the same session.

- [x] **Schedule: "Today" button** jumps the week grid back to the current week (disabled when already viewing it).
- [x] **Schedule: day-off marking.** New `StaffSchedule.isDayOff` (migration `20260805230007_add_staff_schedule_day_off`), mutually exclusive with the block/custom-time choice (Zod refine covers all three states). Shown as a distinct "Day Off" chip in the week grid and in "My Schedule."
- [x] **Schedule: day detail view** — clicking a date-column header opens a read-only dialog listing every staff member's entry for that day (department/notes included, unlike the cramped grid cell).
- [x] **Schedule + Attendance: print/PDF export.** New shared `PrintReportShell` (`src/features/dashboard/shared/components/print-report-shell.tsx`), factored out of the existing `OrderHistoryPrintView` so every report gets the same Epidom-branded header, diagonal watermark, and repeating footer rather than a one-off look — this is also the answer to "check each env has it": one shared shell, not per-feature copies. New standalone print routes `/store/[storeId]/schedule/print` and `/store/[storeId]/attendance/print` (outside the `(dashboard)` route group, same convention as `pos/orders/print`), each auto-triggering the browser print dialog — "export to PDF" is Print → Save as PDF, matching the existing convention rather than a new jsPDF pipeline. Publishing a week now opens the print view automatically; Attendance's print button is tab-aware (exports whichever of Log/Hours is active).
- [x] **Attendance: date-range presets.** Replaced the plain From/To inputs with `DateRangeField` (a repo-wide component another concurrent session was introducing at the same time — adopted here for consistency rather than keeping the older `DateRangeLabel` pattern).
- [x] **Overtime threshold input changed from raw minutes to `HH:mm`** (`<input type="time">`), converted to minutes only at the API boundary — avoids the mental-math of typing "480" for 8 hours.
- [x] **Fixed i18n bug:** `pages.noData` rendered as literal text "pages.noData" on Attendance — the key only existed nested at `pages.analytics.noData`, not the top-level `pages.noData` the new page called. Added the correct top-level key to both `id.ts`/`en.ts`, then wrote a throwaway Vitest audit (import both locale modules, resolve every dotted key path actually used by the new components, assert each is a string) to catch any other silent misses — found exactly this one, confirmed all ~99 other keys used by the staff-scheduling/attendance feature resolve correctly in both languages.

### Note on concurrent editing
This session and the "Order-Linked Production" session below were both active on this repo at the same time, editing some of the same shared files (`schema.prisma`, `finance-client.tsx`, `CHANGELOG.md`, `STATUS.md`, `package.json`). No conflicts — Prisma migrations, locale files, and this log all merged cleanly; `pnpm type-check`/`lint`/`test` re-verified after each round of concurrent changes landed.

- `pnpm type-check` — clean
- `pnpm lint` — clean
- `pnpm test` — 569 passing

---

## ✅ 2026-08-06 — Order-Linked Production (KDS ↔ Production Batches)

Grew out of a question about whether Management's "Production"/"History" tabs duplicate Kitchen & Bar (KDS)'s order-prep tracking. Research found they didn't overlap — KDS tracks live `OrderItemStatus` per order, `ProductionBatch` tracks proactive Recipe→Material→Product manufacturing runs, completely disconnected at the code level (confirmed via `stock-deduction.service.ts`, which never touches `ProductionBatch`). The real ask, after clarification, was to connect them.

### Production / POS
- [x] **Auto-drafted production batches, triggered by real order demand.** New `ProductionBatch.triggerType` (`MANUAL` | `ORDER_SHORTFALL`) and `OrderItem.productionBatchId` (migration bundled into `20260805221704_add_staff_scheduling_and_attendance` — see note below). When an order needs more of a recipe-linked product than `Product.currentStock` covers, `ProductionBatchService.draftShortfallBatchesForOrder()` creates an `IN_PROGRESS`/`ORDER_SHORTFALL` batch sized to the shortfall and links it to the triggering `OrderItem`(s) — called at the moment an order is confirmed and enters the kitchen/bar queue (POS cash/pay-later creation, POS finalize, and the Xendit webhook — the last one specifically *before* `deductStockForOrder`, since it runs `deductStockForOrder` immediately on payment unlike the cash flow, and shortfall must be computed against pre-deduction stock or it double-counts).
- [x] **One action closes both.** `completeProduction()` now branches on `triggerType`: `MANUAL` batches behave exactly as before (PRODUCTION_IN movement, increments `Product.currentStock`); `ORDER_SHORTFALL` batches skip that (the order's own SALE deduction already covers the full quantity — this would otherwise double-count) and instead flip every linked `OrderItem` to `READY` and run the existing order-auto-advance check (extracted into a shared `advanceOrderToReadyIfAllItemsReady()` helper used by both the KDS item-status route and batch completion). The KDS item-status route (`PATCH .../items/[itemId]`) delegates to batch completion when an item is linked, so tapping the ticket to Ready on the KDS board *is* completing the batch — no separate step.
- [x] **KDS board shows a "making" indicator** on any ticket linked to an auto-drafted batch, so kitchen staff know why it's not a grab-from-the-case item.
- [x] **Production History table shows a Source badge** — "Manual" or "From Order #…" (linked order number) — per batch, so the connection is visible without merging the UI.
- [x] `cancelProduction()` now forces `restoreMaterials: false` for `ORDER_SHORTFALL` batches (they never deducted materials in the first place — see above).
- [ ] **Deferred**: merging the "Production" and "History" tabs into one "Batches" tab in Management, as originally discussed — scoped down given the size/regression-risk of rewriting the existing paginated/filterable/exported History table; the Source badge above delivers the visible connection without that rewrite. Worth doing as a follow-up.

### Known v1 limitations
- One batch per shortfall-triggering order — near-simultaneous orders for the same out-of-stock product each draft their own batch rather than being consolidated (batch sprawl during a rush is possible).
- Order cancellation doesn't auto-cancel a still-open linked shortfall batch (not addressed; `reverseStockForOrder` correctly leaves these batches alone regardless, since it only reads `SALE` movements and a shortfall batch never wrote one).
- Only the three primary order-confirmation paths trigger the auto-draft (see above) — aggregator-imported orders and any other less common entry points don't yet.

### Migration note
- The schema for this feature (`ProductionTriggerType` enum, `ProductionBatch.triggerType`, `OrderItem.productionBatchId`) ended up bundled into migration `20260805221704_add_staff_scheduling_and_attendance` rather than its own — a concurrent `prisma migrate dev` run (for the Staff Scheduling feature above) diffed against this session's in-progress `schema.prisma` edits on the same shared file and captured both at once. Verified via direct DB inspection that both migrations' columns/enums are present and `prisma migrate status` reports clean — no action needed, just noting the attribution for anyone tracing history later.

- `pnpm type-check` — clean
- `pnpm lint` — clean
- `pnpm test` — 568/569 passing; the 1 failure (`sidebar.test.tsx`, a timeout) is pre-existing full-suite flakiness unrelated to this change — passes 10/10 in isolation.

---

## ✅ 2026-08-05 — Staff Scheduling, Hours & Overtime, Shift-Block Reports, Selfie Attendance

Implements the full "Proposed addition" scope from `docs/roadmap.md` (now moved to shipped — `docs/roadmap.md` and `docs/FEATURES.md` updated accordingly), across all 3 planned phases in one pass.

### Schema (migration `20260805221704_add_staff_scheduling_and_attendance`)
- [x] New parallel domain, deliberately not touching the existing `Shift` model (a POS cash-drawer till session, cashier-only): `ScheduleShift` (reusable named time-block templates, e.g. "Shift 1" 08:00–16:00), `StaffSchedule` (roster: staff × date × block or custom time, `DRAFT`/`PUBLISHED`), `AttendanceRecord` (`CLOCK_IN`/`CLOCK_OUT`/`ABSENCE` events with selfie URL + lat/lng + reverse-geocoded label). New `Store.standardWorkMinutesPerDay` (default 480) drives the overtime threshold.
- [x] **Note:** this migration's SQL also includes a pre-existing, unrelated, already-uncommitted schema change found in the working tree at the start of this session — `ProductionBatch.triggerType` (`ProductionTriggerType` enum) and `OrderItem.productionBatchId` — not implemented by this work. Prisma migrations diff against live DB state, not git history, so it was swept in as part of the same `migrate dev` run. Flagging for whoever owns that feature to verify it end-to-end.

### Attendance (selfie + geolocation clock-in/out)
- [x] New "Clock In / Out" action in the account menu (`nav-user.tsx`), reachable by any staff persona regardless of `allowedPages` — same shelf as `StaffSwitcherDialog`. Flow: pick staff → PIN → capture selfie (`getUserMedia`, falls back to `<input capture="user">`) or report an absence with a reason → best-effort `navigator.geolocation` → submit.
- [x] 7 new API routes under `/api/stores/[id]/attendance/*`: `clock-in`, `clock-out`, `absence`, `status`, the manager audit list (`GET /attendance`), a manager-only correction endpoint (`[attendanceId]/close` — appends a new `CLOCK_OUT` rather than editing history, same principle as the Waste feature's compensating entries), and `settings` (the overtime threshold).
- [x] Reverse geocoding (`src/lib/attendance/geocode.ts`) calls OpenStreetMap Nominatim server-side, fails silently to `null` on any error/timeout — never blocks a clock-in. No map-rendering library anywhere (AGENTS.md §7) — the audit view shows raw coordinates/label plus an external Google Maps link only.
- [x] New `/attendance` page (Owner/Manager only, like `/shifts`) with a "Log" tab (filterable by staff + date range) and an "Hours & Overtime" tab.

### Scheduling
- [x] New `/schedule` page: managers get a week-grid roster builder (pick a named block or custom time per staff/day, department tag, publish-week action, "Manage Shift Blocks" CRUD dialog); Cashier/Kitchen roles get a read-only "My Schedule" list of their own published entries only (enforced server-side, not just hidden client-side).
- [x] 8 new API routes for `schedule-shifts` and `staff-schedules` (CRUD + bulk create + publish).

### Hours & Overtime
- [x] `src/lib/attendance/hours-aggregation.ts`: pure function pairing `CLOCK_IN`/`CLOCK_OUT` events into completed workdays, attributing a pair to the day its clock-in happened (so a 20:00→04:00 shift needs zero cross-midnight special-casing), flags missing clock-outs/orphan clock-outs instead of estimating, splits regular/overtime minutes against `standardWorkMinutesPerDay`. 10 unit tests covering same-day, cross-midnight, double clock-in, orphan, still-open, absence, split-shift, and the overtime boundary.

### Shift-Block Finance Report
- [x] New Finance tab "By Shift Block" (`/finance/by-schedule-shift`) — revenue/order-count per named block per day, joined with who was rostered on. Named blocks can overlap by design (handover coverage), so this is a coverage-window query, not a partition — verified overlapping-block double-counting is intentional via `schedule-shift-bucketing.test.ts`, and disclosed explicitly in the UI copy so it doesn't read as a bug.
- [x] **Known v1 limitation:** "who was rostered on" is informational only — true order-level revenue attribution to a specific person only exists for cashiers via the existing `Shift.staffMemberId` (`/finance/by-shift?staffId=`). Extending that to every role would need a new `Order.servedByStaffMemberId` populated at POS checkout — a separate, larger scope decision, not included here.

- `pnpm type-check` — clean
- `pnpm lint` — clean
- `pnpm test` — 561 passing (44 new: `attendance.schemas.test.ts`, `scheduling.schemas.test.ts`, `hours-aggregation.test.ts`, `geocode.test.ts`, `schedule-shift-bucketing.test.ts`)

---

## ✅ 2026-08-05 — Waste Management (record, track loss on Finance report, manual correction)

### Management / Finance
- [x] **Record wasted Materials or Products** from Management → Edit Stock ("Record Waste" — header button + per-item quick action) via a new `WasteEntry` model (migration `20260805143640_add_waste_entries`) with a `WasteReason` enum (`EXPIRED`, `DAMAGED`, `SPOILED`, `OVERPRODUCTION`, `QUALITY_CONTROL`, `OTHER` + required free-text `customReason` when `OTHER`). Deducts `currentStock` and writes a linked `StockMovement` (`type: WASTE`, previously defined in the schema but never used anywhere) via `wasteService.recordWaste()` (`src/lib/services/waste.service.ts`), `Serializable`-isolated like `stock-deduction.service.ts`.
- [x] **Waste loss is now trackable on the Finance report.** `/api/stores/[id]/finance/summary` gained a `wasteLoss` field (`Σ WasteEntry.totalValue` in range) that subtracts from `netProfit` only (not `cogs`/`grossProfit` — shrinkage, not cost of goods sold). New "Waste Loss" and "Net Profit" KPI cards in `finance-client.tsx` (the latter was already computed/exported to XLSX but had no card). New `by-waste-reason` sub-report + a "Waste" report tab (itemized + by-reason breakdown), included in the Excel export.
- [x] **Entries are correctable for any condition**, right from the Finance Waste tab (edit/delete row actions) or the record dialog in edit mode. Corrections never rewrite the original `WASTE` movement — they append a compensating `ADJUSTMENT` movement (linked via new `StockMovement.wasteEntryId`) that reconciles live `currentStock`; historical `balanceAfter` snapshots on other movements are left as recorded, same principle as a correcting ledger entry rather than an erasure. An "Advanced" section on edit allows overriding the frozen `unitCostSnapshot` itself for a full manual correction. Delete restores the consumed stock and removes the entry (linked movements persist, orphaned via `onDelete: SetNull`).
- [x] **Fixed pre-existing bug: Product stock adjustments silently failed.** `materialService.adjustStock` always threw `"Product stock adjustment not yet implemented"` for a Product, even though `StockAdjustmentDialog`'s own item-type selector has offered "Product" since it shipped. Extracted shared `resolveStockItem`/`applyStockDelta` (`src/lib/services/stock-item.helpers.ts`), reused by both the adjustment flow and the new waste service — Products now work in both.
- [x] Known v1 limitation: `WasteEntry` has no shift/order linkage, so the Finance report's staff-shift filter dropdown doesn't scope the Waste tab.

- `pnpm type-check` — clean
- `pnpm lint` — clean
- `pnpm test` — 509 passing, 10 pre-existing failures unrelated to this change (`reservation-list.test.tsx`, `sidebar.test.tsx` — broken by a concurrent unrelated edit to `reservation-list.tsx` mid-session, not touched by this work)

---

## ✅ 2026-08-05 — Account Deactivation, Reactivation & Data Retention

### Profile / Auth
- [x] **"Delete Account" replaced with "Deactivate Account"** (soft delete). `User.deactivatedAt`/`User.purgeAt` added (migration `20260805085354_add_user_deactivation_fields`). Deactivating signs the user out and sends a confirmation email (`sendAccountDeactivatedEmail`); no data is touched.
- [x] **30-day self-service reactivation.** Logging back in while deactivated redirects to `/profile` (gated in `(app)/(stores)/layout.tsx` and `store/[storeId]/(dashboard)/layout.tsx` via `getSession()`, now wrapped in React `cache()`), where a "Reactivate My Account" button instantly restores access (`POST /api/user/account-settings` action `reactivate-account`). `withApiHandler` gained an `allowDeactivated` option so only the account-settings route stays reachable while deactivated.
- [x] **31–365 days: support-quoted recovery, no self-service.** UI switches to a "contact support" message with a mailto link; `userService.reactivateAccount()` rejects self-service reactivation past the 30-day window. Admins can still reactivate any time within the year via a new "Reactivate Account" row action + `deactivatedAt` badge/stat tile in the Master Admin Panel (`reactivate-user` action, `enforceGracePeriod: false`).
- [x] **Storefronts go offline while deactivated.** `storefrontService.getStorefrontBySlug` now filters out storefronts owned by a deactivated user (`store.business.user.deactivatedAt: null`) — reverts automatically on reactivation, no other public-route changes needed.
- [x] **Automatic permanent purge after 12 months.** New daily Inngest cron `purge-expired-accounts` (`0 3 * * *`) hard-deletes any account past `purgeAt`, reusing the existing `userService.deleteAccount()` cascade. Admin's separate instant hard-delete (`delete-user`) is unchanged.
- [x] **Terms & Conditions (new §11) and Privacy Policy updated** with the full deactivation → reactivation → retention → deletion lifecycle, plus explicit France/GDPR/CNIL and Indonesia/UU PDP data-subject rights. Added to `en.ts`/`id.ts` only per AGENTS.md (`fr.ts` deprecated, no new French strings).
- [x] **Fixed pre-existing bug: `/privacy` required login.** `src/proxy.ts`'s public-route allowlist had `/terms` but not `/privacy` — found while smoke-testing this change. One-line fix.

- `pnpm type-check` — clean
- `pnpm lint` — clean
- `pnpm test` — 478 passing

---

## ✅ 2026-08-05 — Mark as Paid: Settle Payment Method + Note

### POS / Alerts
- [x] **Every "Mark as Paid" action now opens a confirmation dialog** (`src/features/pos/components/mark-paid-dialog.tsx`) instead of settling instantly — pick the payment method actually used (Cash, QRIS, GoPay, OVO, DANA, ShopeePay, Virtual Account, Credit Card) and add an optional free-text note (e.g. "client paid directly to the owner"). Wired into all four call sites that could mark an order paid: the Active Queue order card (`pos-order-primary-action.tsx`), the Order History detail dialog and its bulk "Mark as Paid" action (`order-history-tab.tsx`), and the dashboard's Unpaid Orders alert card (`unpaid-orders-card.tsx`) — all share the same `useUpdateOrderStatus` mutation, so only that one hook + the PATCH route needed to grow new fields.
- [x] New `Order.paymentNote` column (migration `20260805084015_add_order_payment_note`), separate from the existing `Order.notes` (customer/checkout notes) so mark-paid notes never overwrite them. `updateOrderStatusSchema` gained optional `paymentMethod`/`paymentNote`, with a refine requiring `paymentMethod` only alongside `paymentStatus: "PAID"`, and a `settlePaymentMethodEnum` (excludes `PAY_LATER`, which isn't a real settle-up method).

- `pnpm type-check` — clean
- `pnpm lint` — clean
- `pnpm test` — 478 passing (new: `pos.schemas.test.ts`)

---

## ✅ 2026-08-02 — Finance Reporting (Category/Department/Shift) + Dashboard Enhancements

### Finance Reports
- [x] **Staff and Category filters** added to the Finance page filter bar; threaded into `summary`, `channels`, `top-items` (`staffId`/`shiftId`), and `top-items` (`category`). Category/shift filters do **not** apply to the whole-order Summary/Channels P&L (tax/fees are frozen per-order, not itemized — would require proportional allocation).
- [x] **New report views**: `GET /finance/by-category` (menu-category breakdown), `GET /finance/by-shift` (per-cashier-session "open to close" totals — the "total sales today" report), `GET /finance/by-department` (Kitchen vs. Bar split). All bucket unattributable items (aggregator-email orders with no `menuItemId`, or no category/department/shift) under an explicit "Uncategorized"/"Unassigned" row rather than dropping them. Pure bucketing/filter logic lives in `src/lib/finance/report-aggregation.ts` + `report-filters.ts`, unit-tested.
- [x] Sortable column headers (shared `useSortable` hook, lifted from `shifts-client.tsx`) across all Finance report tables.

### Kitchen/Bar Department
- [x] New `Department` enum (`KITCHEN`/`BAR`), added to `Material`, `Recipe`, `Product`, `MenuItem` — deliberately separate from the existing free-text `category` field. Filter + form field + badge on the Data page (Products/Materials/Recipes), Menu editor, and a new department toggle on the POS item grid.
- [x] A Product's `department` syncs to its linked storefront `MenuItem` automatically on create/update, mirroring the existing name/price sync.

### Dashboard
- [x] **"New Orders" card** — highlights orders awaiting confirmation (calling out storefront-sourced ones), links to the Order Queue (`/pos/orders`). Reuses `usePosOrders`' existing SSE stream, so it updates live.
- [x] **Dynamic date-range label** ("Today," "Yesterday," "Last 7 Days," "This Month") next to the Dashboard Analytics and Finance date pickers (`src/lib/utils/date-range.ts`, shared `<DateRangeLabel>`). Dashboard Analytics now defaults to today instead of month-to-date; fixed a UTC-vs-local off-by-one in the date default that could show yesterday's data for timezones ahead of UTC.

- `pnpm type-check` — clean
- `pnpm lint` — clean
- `pnpm test` — 464 passing

---

## ✅ 2026-08-02 — Fees & Taxes (per store) + Finance Report Integration

### Profile / Store Settings
- [x] **"Fees & Taxes" card** on the store-scoped Profile page (`/store/[storeId]/profile`) — configurable tax rate (inclusive/exclusive toggle, custom label), service charge rate, and a payment-processing fee-rate table per `PaymentMethod`, pre-filled with editable estimated defaults (`src/config/payment-fees.config.ts`). New `StoreFinanceSettings` model (1:1 with `Store`), `GET`/`PATCH /api/stores/[id]/finance/settings`.
- [x] **Store-scoped profile page now actually fetches its `Store`** — previously ignored the `storeId` param entirely and rendered the same content as the account-level profile page.

### Order Calculation
- [x] **Fees/tax are computed once and frozen onto the order** (not recomputed live from current settings) — `src/lib/finance/order-charges.ts`, wired into POS checkout, POS hold/finalize, and storefront checkout. Editing a store's rates later never rewrites past orders/reports. New `Order` columns: `serviceCharge`, `processingFee`, `taxRate`, `serviceChargeRate`, `processingFeeRate` (all default 0 — existing orders unaffected).
- [x] Aggregator-imported orders (GoFood/GrabFood/etc.) explicitly keep these fields at 0 — the platform's own commission (`commissionRate()`) already models that cut; computing store fees there would double-count.

### Finance Reports
- [x] **Summary** (`/finance/summary`) now returns `taxCollected`, `serviceCharge`, `processingFee`, `netRevenue`, `netProfit`. **Channels** (`/finance/channels`) deducts tax + processing fee alongside aggregator commission in `netRevenue`. Both surfaced in the Finance page KPI cards, the channels table, and the Excel export.

- `pnpm type-check` — clean
- `pnpm lint` — clean
- `pnpm test` — 411 passing (new: `order-charges.test.ts`; updated: `channels.test.ts`, `summary.test.ts`)

**Known limitation:** the processing fee is an *estimate* from the merchant's configured rate, not a reconciliation with actual Xendit/Stripe settlement — the Xendit webhook payload doesn't carry a fee amount in this integration, and Stripe's real fee needs a separate balance-transaction call neither webhook makes.

---

## ✅ 2026-07-31 — Feedback NEEDS_REVIEW Fix, Storefront Auto-Save, QR Copy Link

### Feedback
- [x] **NEEDS_REVIEW crash fix** — Added missing status to `FeedbackStatus` type, `STATUS_BADGES` map, and translations (EN/ID). Accounts with tickets in this status no longer crash on "My tickets".

### Storefront Settings
- [x] **Real-time auto-save** — All fields save to DB 1.5s after user stops typing. Manual Save/Cancel buttons removed.

### QR Code Dialog (shared)
- [x] **Copy link** — URL shown in read-only input below QR; one-click copy with green checkmark feedback. Applies everywhere QR is shown (storefront, table QR, etc.).

- `pnpm type-check` — clean
- `pnpm lint` — clean

---

## ✅ 2026-07-29 — Feedback Dashboard: Detail Modal, Status Filters, Board/Feed Views

### Feedback Dashboard
- [x] **Ticket detail modal** — clicking the expand icon on any row/card (or any board card) opens a full-detail modal: user, page, full description, screenshot, dev note, and priority/status editing, without leaving the list.
- [x] **Clickable status filters** — the 5 stat cards (Open / In Progress / Review / Resolved / Archived) now filter the list on click; clicking the active one again clears the filter.
- [x] **Type filter + search** — added a Bug/Feature/General type filter and free-text search (user, description, page, ID).
- [x] **Table / Board / Feed views** — new view switcher: Table (existing grouped list), Board (Notion-style Kanban columns by status), Feed (flat newest-first stream). Preference persists via `localStorage`.

### Staff Management (undocumented from a prior session, verified and shipped alongside)
- [x] **Active/Inactive status control** — guarded so the last active staff member or the Owner can't be deactivated; Owner role is locked from being changed.
- [x] **Role Access Details panel** — reference of what each role (Owner/Manager/Cashier/Kitchen) can access, shown in the staff edit dialog.
- [x] **PIN validation** — new PIN must be exactly 4 digits before Save is enabled.

### Storefront / POS
- [x] **Menu item descriptions** — optional description field added to Add/Edit item dialogs in the Storefront Editor; renders under the item name in both the editor and the POS product grid.

- `pnpm type-check` — clean
- `pnpm lint` — clean

---

## ✅ 2026-07-28 — Feedback Copy-to-Clipboard UX Update

### Feedback Dashboard
- [x] **Description Click-to-Copy** — Integrated the `CopyableDescription` component in both desktop and mobile viewports. Clicking the description now copies the text directly to the clipboard.
- [x] **Copy Bubble / Tooltip** — Added a floating popover/tooltip bubble showing "Click to copy description" and "Copied!" for clear visual feedback.
- [x] **Show More/Less links** — Disconnected text-expansion from the copy action, wrapping long texts with distinct, accessible action links.

---

## ✅ 2026-05-29 — Integration, Auth & UX Sprint

### Auth & Production Fixes

- [x] **SW clone bug** — `sw.js` was calling `response.clone()` inside an async `.then()` causing "body already used" errors on login. Fixed to clone synchronously before `caches.open()`.
- [x] **Prisma 6 → 7 migration** — Removed `url`/`directUrl` from `schema.prisma`; created `prisma.config.ts` for CLI; swapped `PrismaClient datasources` option for `@prisma/adapter-pg` driver adapter; fixed `Decimal` import path (`runtime/library` → `runtime/client`).
- [x] **DB connection** — Added `DIRECT_URL` (Neon non-pooled endpoint) for `prisma migrate deploy`; `DATABASE_URL` remains pooled for runtime.
- [x] **OAuth error UX** — `onAPIError.errorURL: "/login"` routes all Better Auth OAuth failures to `/login?error=<code>` with a readable toast instead of the raw Better Auth HTML error page.
- [x] **Onboarding save bug** — `storefrontApi.createCategory()` returns the inner data directly (apiClient strips wrapper); was reading `.data?.id` → always undefined → menu items silently skipped. Fixed to `.id`.
- [x] **`hasOnboarded` flag** — New `User.hasOnboarded Boolean` column; migration applied; `POST /api/onboarding/complete` marks it on publish; `/onboarding` page redirects server-side for completed users (backward-compat also checks `storefront.isPublished`).
- [x] **Currency sync** — `CurrencyProvider` now uses `useQuery` with the same `["profile", userId]` key as `useProfile`; `select()` normalises all cache shapes (full object / API envelope / legacy string) so currency updates instantly when user changes it in profile settings.
- [x] **Subscription pricing per currency** — `getPlanDetails()` now accepts `currency` param; `SubscriptionInfoCard` reads live currency; prices shown as IDR / USD / EUR correctly. (2026-08-08: superseded — the IDR/USD/EUR/MGA lookup table silently fell back to Rupiah for every other currency, and the separate Billing page hardcoded `Rp .../month` outright ignoring currency and locale entirely. Both now derive price from the plan's IDR base via `useCurrency().formatPrice()`'s live exchange rate, covering all ~140 supported currencies. See CHANGELOG 2.24.1.)
- [x] **Pricing labels fixed** — id.ts had `Rp 429.000` and `Rp 1.169.000`; corrected to `Rp 99.000` (POS) and `Rp 249.000` (OPERATIONS).

### Data / Management / Tracking Integration

- [x] **"Add to POS menu" button** on product cards in Data page — finds or creates matching `MenuCategory`, creates `MenuItem` with `productId`, shows "In Menu" badge immediately via optimistic update (`onMutate` + `onSettled` invalidation).
- [x] **Sync-to-menu prompt** in edit-product-dialog — after saving, if name or price changed and a linked MenuItem exists, a toast offers one-click sync to update the MenuItem.
- [x] **"In Menu" badge** — `useProductMenuStatus` queries all linked MenuItems; `staleTime: 0` + `refetchOnWindowFocus: true` so badge is always fresh.
- [x] **Recipe demand badge** — "47× last 30d" badge on recipe cards via `GET /api/stores/[id]/recipes/demand` (SQL aggregation through Recipe→Product→MenuItem→OrderItem chain).
- [x] **Tracking: Recent Movements tab** — store-wide stock movement list with type filter, item search, source context (POS order # / Batch #), color-coded type badges.
- [x] **Dashboard: Recent Movements card** — last 8 stock movements with type and source on the main dashboard.
- [x] **Stock movements API** — added `take` param + store-wide scoping (filters through `material.storeId` / `product.storeId` relation).
- [x] **GET /storefront/items** — new endpoint with optional `?productId=` filter for linked-item lookup.
- [x] **GET /storefront/categories** — new GET handler alongside existing POST.
- [x] **Removed `data-manage.tsx`** — orphaned placeholder with hardcoded dummy data.

### Storefront

- [x] **Photo upload for logo and cover image** — replaced plain URL text inputs with `ImageUpload` component (drag-and-drop, Vercel Blob, compression, preview); logo: 1:1 · 400×400 min · 2 MB; cover: 16:9 · 1920×1080 ideal · 5 MB. Guide text below each field.

### PWA

- [x] **Install button** — `usePwaInstall` hook + `PwaInstallButton` in topbar; auto-hides when already in standalone mode.

### Tests

- [x] **311 tests passing** (25 files) — includes new auth suite (17 tests: getSession, /api/session, useLogin/useRegister) and 3 pre-existing vi.mock hoisting fixes.

---

## Developer / Operator To-Do (still pending)

- [ ] **Realtime**: Create a Pusher Channels app at https://dashboard.pusher.com/, add `PUSHER_APP_ID`/`PUSHER_KEY`/`PUSHER_SECRET`/`PUSHER_CLUSTER` and `NEXT_PUBLIC_PUSHER_KEY`/`NEXT_PUBLIC_PUSHER_CLUSTER` to `.env` and Vercel. Until set, live push/presence stay off and everything silently runs on its existing polling — no functional break either way.
- [ ] **Web Push**: Run `npx web-push generate-vapid-keys`, add `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`/`NEXT_PUBLIC_VAPID_PUBLIC_KEY` to `.env` and Vercel. Until set, the push toggle stays hidden in `NotificationBell` and everything keeps working via existing polling — no functional break either way. Also worth a manual pass on a real iOS device once live (Add to Home Screen → Enable push → background the app → place a test order) — this session verified the state machine via code + tests, not a physical device.
- [ ] Set `DIRECT_URL` in Vercel env vars (Neon non-pooled URL = `POSTGRES_URL_NON_POOLING`)
- [ ] Set `DATABASE_URL` in Vercel env vars (Neon pooled URL)
- [ ] Forward aggregator order emails to `orders@epidom.id` with subject prefix `[@slug] Original subject`
- [ ] Add `XENDIT_SECRET_KEY` + `XENDIT_WEBHOOK_TOKEN` (Xendit dashboard → webhook URL `/api/webhooks/xendit`)
- [ ] Add `FONNTE_API_TOKEN` (Fonnte device must be online)
- [ ] Enable `acceptsOrders: true` on storefronts that should show Order & Pay
- [ ] Enable `acceptsReservations: true` + toggle `reservationEnabled` per table
- [ ] After deploying, confirm the new `purge-expired-accounts` cron function (daily, 03:00) shows up and is enabled in the Inngest dashboard — Inngest syncs functions from `/api/inngest` on deploy, but cron functions are worth a manual check since nothing else exercises that endpoint until day 366 for any given account

---

## ✅ i18n Dashboard Refactor — Eliminate All Hardcoded Strings (2026-05-24)

### Completed

- [x] **100+ new translation keys** added to `en.ts`, `id.ts`, `fr.ts` — `pos.orderCard`, `pos.kds.*` (extended), `pos.tables.*` (extended), `storefront.*` (new namespace), `common.datePicker`, `pages.finance*`
- [x] **fr.ts missing `pos:` section** — entire POS dashboard section (kds, tables, orderCard) was absent; added with EN stubs
- [x] **Group A — `pos-order-card.tsx`** — added `useI18n`; date-fns locale mapped from `useI18n().locale`; all strings replaced
- [x] **Group B — `kds-shell.tsx`, `kds-column.tsx`, `kds-order-card.tsx`** — all KDS hardcoded Indonesian replaced with `t()`
- [x] **Group C — `table-status-badge.tsx`, `tables-manager.tsx`, `table-create-dialog.tsx`** — all table UI strings replaced
- [x] **Group D — `storefront-editor-client.tsx`, `storefront-settings.tsx`, `menu-editor.tsx`, `storefront-analytics.tsx`** — full storefront editor i18n; bonus: menu item price now uses `formatCurrency()` instead of hardcoded `Rp`
- [x] **Group E — `finance-client.tsx`, `owner-dashboard-client.tsx`, `profile-nav.tsx`** — Excel export headers/sheet names, date picker labels, nav labels all via `t()`
- [x] `pnpm type-check` — clean
- [x] `pnpm lint` — clean (no issues)

---

## ✅ UI System Sync — Dark/Light Mode + Brand Tokens (2026-05-24)

### Completed

- [x] **Dark/light mode toggle** — `next-themes` ThemeProvider in `(app)/layout.tsx`, default `dark`, `suppressHydrationWarning` on `<html>` + `<body>`
- [x] **epi-navy palette bridged into `.dark` CSS vars** — `--background`, `--card`, `--sidebar`, `--border`, `--muted` all mapped to `--epi-navy-*` tokens
- [x] **Cream light mode** — `:root` sets `--background: #FBF9E4`, body uses cream gradient; `--muted: #EEE9C4`
- [x] **ThemeToggle button** — inline Sun/Moon component in Topbar with mounted guard
- [x] **Dashboard Topbar** — replaced `bg-primary` with explicit `var(--epi-navy-850)` inline style; replaced PNG logo with `EpidomLogo` SVG
- [x] **Auth pages (login/register)** — dark-navy redesign: gold CTA buttons, cream text, gold focus rings
- [x] **Auth visual panel** — epi-gold + navy radial gradients replacing zinc/orange blobs
- [x] **Onboarding** — orange-500 accent → `--epi-gold-500` throughout (progress bar, buttons, badges)
- [x] **Cookie consent bar** — dark glass: `rgba(6,15,27,0.92)` bg, cream text, gold toggles
- [x] **Sheet z-index** — z-50 → z-[70] to sit above `epi-floating-nav` (z-60); fixes mobile nav overlap
- [x] **Global dark mode text overrides** — `text-gray/slate/zinc/neutral/black-*` mapped to cream in `.dark` via globals.css
- [x] **NavUser** — cream text on trigger; `bg-[var(--epi-navy-700)]` avatar fallback
- [x] **Production history chart** — `--chart-grid`, `--chart-axis`, `--chart-line` CSS vars; gold area, adaptive strokes
- [x] **Stores page** — full token conversion: `bg-background`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`
- [x] **Profile layout** — `bg-background` + `pt-20 sm:pt-24` spacer to prevent floating nav overlap
- [x] **Storefront editor tabs** — `bg-muted/30 border-border`; active trigger gold text
- [x] **Menu editor + storefront analytics** — all hardcoded slate/white colors → semantic tokens
- [x] **Storefront settings** — publication toggle `bg-card`
- [x] **Create store button** — epi-gold fill with navy text
- [x] **POS order card** — channel + status badges stacked in same right-side column
- [x] **React hydration warning** — `suppressHydrationWarning` on `<body>` (Grammarly extension)
- [x] **i18n locale corruption** — batch-fixed 140+ `Operations` substitutions in en/id/fr locale files (Pro→Operations regex artifact); also fixed `inProgress`, `property`, `process`, `Produk`, `Produksi`, `Profil`, `Promo`

---

## Current Phase: Phase 5 (Aggregator + Finance) — ✅ CODE COMPLETE, VERIFICATION COMPLETE

_(AI Agents: Update this checklist every time you finish a task)_

---

## ✅ Marketing Site — Dark Navy Redesign (2026-05-22)

### Completed

- [x] Full dark-navy redesign: new hero, 13 home sections, services & pricing pages
- [x] Floating pill navbar (lowercase links, custom lang switcher)
- [x] i18n for EN / ID / FR (FR deprecated — no new keys going forward)
- [x] Locale-driven pricing (USD / IDR / EUR)
- [x] Dashboard mockup (PosDashboard + PhoneMenu) in hero with dark glass notification chip
- [x] Terms & Refund Policy pages redesigned in dark theme with sticky TOC sidebar
- [x] 9 placeholder footer pages (blog, careers, changelog, cookie-policy, gdpr, partners, press, privacy, status)
- [x] About page (/about) — accessible via footer link and direct URL, not in navbar
- [x] Footer expanded to 5 columns (Brand / Product / Company / Legal / Contact)
- [x] SVG icons throughout marketing (lucide-react kept for dashboard nav only)

---

## ✅ Phase 3 — Lightweight POS (all milestones done)

Milestones completed: POS Cashier + Order Queue, KDS + Table Management, Offline PWA + Thermal Printing, Payment/Notification/Inngest/SSE integrations, Public order routes.

---

## ✅ Phase 4 — Operations Layer (verified 2026-05-23)

Milestones completed: Schema + Plan Gating, Stock Deduction Service, Staff + Shifts, Re-expose Operations Routes.

### Phase 4 Verification — ✅ COMPLETE

- [x] Verify: Stock auto-decrements when an order is marked DELIVERED.
      — `deductStockForOrder()` called in `/api/stores/[id]/pos/orders/[orderId]/route.ts` on `status === "DELIVERED"`.
- [x] Verify: Low-stock alert fires when material goes below threshold.
      — `stock-deduction.service.ts` emits `LOW_STOCK`/`CRITICAL_STOCK` alerts when `currentStock < minStock`.
- [x] Verify: Shift open/close reconciliation matches cash drawer expectations within 1%.
      — `cashDifference = closingCash − expectedCash` computed and stored in DB on every shift close; UI surfaces the delta.
- [x] Verify: A cashier with a PIN can clock in/out without a manager.
      — `requireStoreAuth: true` (not manager-only); PIN validated via `bcryptjs.compare()` in `/api/stores/[id]/shifts/route.ts`.
- [x] Verify: HPP (cost per dish) is calculated correctly to 2 decimal places in recipe view.
      — `recalculateCost()` in `recipe.repository.ts` computes `qty × unitCost` per ingredient (Prisma.Decimal); exported with `.toFixed(2)`.

---

## ✅ Phase 5 — Aggregator + Finance (verified 2026-05-23)

Milestones completed: Schema + Aggregator Foundation, Email Ingestion, Finance Reports, Multi-Outlet Dashboard, Navigation + i18n.

### Phase 5 Acceptance Criteria — ✅ COMPLETE

- [x] Verify: ENTERPRISE merchant sees orders from all sources in one queue.
      — `/api/stores/[id]/pos/orders` fetches all orders for the store regardless of `source` field (POS, ONLINE, AGGREGATOR). No source filter applied.
- [x] Verify: Finance reports balance to the penny against raw order data.
      — `/api/stores/[id]/finance/summary` sums `order.total` via `prisma.order.aggregate` (same raw table), rounds with `Math.round(x * 100) / 100`. COGS derived from `StockMovement` records of type `SALE`. 7 unit tests pass covering summary + channel breakdown.
- [x] Verify: Multi-outlet owner can drill down from rollup → outlet → shift → order.
      — `/api/owner/summary` returns per-store revenue + pending order counts (ENTERPRISE-gated). Individual store drill-down via `/api/stores/[id]/finance/*` and `/api/stores/[id]/shifts/*`. 10 rollup unit tests pass.
- [x] Verify: Email parsing accuracy >95% on common GoFood/GrabFood/ShopeeFood templates.
      — `detectPlatform()` in email webhook classifies by `from`/`subject` keywords (gofood, grabfood, shopeefood, tokopedia). OpenAI parsing triggered via Inngest for structured order extraction. 16 email webhook unit tests pass covering platform detection and slug routing.

### Phase 5 Definition of Done — ✅ COMPLETE

- [x] All acceptance criteria above pass.
- [x] Tests cover critical paths added in Phase 5 (aggregator ingestion, finance summary, owner rollup).
- [x] `/docs` updated to reflect Phase 5 changes (ARCHITECTURE, DATABASE).
- [x] `docs/CHANGELOG.md` has Phase 5 entry.
- [ ] At least 5 friendly users have used aggregator + finance without manual intervention.
      _(Requires live merchant testing — cannot be automated. Ship to beta users.)_

---

## ✅ Beta Polish + Reservations (2026-05-28)

### Completed

- [x] **Staff email invitations** — `email` + `inviteStatus` added to `StaffMember` (migration `20260527170327_add_staff_email_invite_status`). POST /staff optionally sends PIN via `sendStaffPinEmail()` (Resend). Invite status badges in staff table (Pending / Invited).
- [x] **Staff edit dialog** — role change, reset/set PIN (blank by default), "Send new PIN to email" checkbox (appears when PIN filled + email set). PATCH /staff/[staffId] handles email send.
- [x] **Owner pinned row** — current logged-in user shown at top of staff table with Crown icon + Owner badge; separate from staff CRUD.
- [x] **BETA badge** — violet chip on NavUser dropdown label and profile-header card.
- [x] **Account Settings card on profile** — data usage tiles (Stores / Products / Orders / Staff), account created date, linked accounts list, Change Password dialog, Delete Account dialog (requires exact email confirmation).
- [x] **Shifts page fix** — triple API path bug (`/api/stores/...` → `/stores/...`); broken i18n keys hardcoded; currency now uses `formatPrice()` from `useCurrency()`; sortable column headers (date / name / opening cash, default date desc).
- [x] **Finance report fix** — `finance/layout.tsx` was ENTERPRISE-gated (redirected beta users); replaced with simple session check.
- [x] **Finance client fix** — same API double-prefix bug fixed; hardcoded i18n keys resolved.
- [x] **Table reservations — full end-to-end** (migration `20260527172232_add_reservations`):
  - `reservationEnabled` toggle per table (Switch on table card, PATCH persisted)
  - Reservation count badge + Sheet side panel in Tables Manager (confirm / cancel / complete / delete)
  - `acceptsReservations` toggle in Storefront Settings
  - "Reserve a Table" button + bottom-sheet booking form on public storefront
  - Public API: `POST /api/public/reservations` (validates storefront + table), `GET` returns reservable tables + existing reservations for a date
  - Dashboard API: `GET/POST /api/stores/[id]/reservations`, `PATCH/DELETE /api/stores/[id]/reservations/[id]`
- [x] `pnpm type-check` — clean after all changes

---

## Developer / Operator To-Do

_(Completed items marked below — remaining items still require manual action)_

- [x] **Database**: Phase 5 migration `phase5_aggregator_finance` applied to local DB (2026-05-23). Apply to production when ready.
- [x] **Email Ingestion**: `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_WEBHOOK_SECRET` added to `.env` and Vercel. Configure Resend inbound webhook to `/api/webhooks/email`.
- [x] **AI Parsing**: `OPENAI_API_KEY` added to `.env` and Vercel (2026-05-23).
- [x] **Background Jobs (Inngest)**: `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` added to `.env` and Vercel (2026-05-23). Register serve URL (`/api/inngest`) in Inngest dashboard after next deploy.
- [ ] **Aggregator**: Instruct merchants to forward aggregator order emails to `orders@epidom.id` with subject prefix `[@their-slug] Original subject`.
- [ ] **Payments (Stripe)**: Set `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, and `NEXT_PUBLIC_STRIPE_PRICE_ID_*` with live keys in `.env` and Vercel.
- [ ] **Payments (Xendit)**: Add `XENDIT_SECRET_KEY` + `XENDIT_WEBHOOK_TOKEN` to `.env`. In Xendit dashboard, set webhook URL to `https://yourdomain.com/api/webhooks/xendit`.
- [ ] **Notifications**: Add `FONNTE_API_TOKEN` to `.env`. Ensure the Fonnte device is online and linked to the merchant's WhatsApp.
- [ ] **Storefront**: Enable `acceptsOrders: true` on any storefront that should show the Order & Pay flow.
- [ ] **Storefront reservations**: Enable `acceptsReservations: true` and toggle `reservationEnabled` per table for storefronts that want the booking form.
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
- **Realtime (Pusher)**: If `PUSHER_APP_ID`/`KEY`/`SECRET`/`CLUSTER` are missing, `publishStoreEvent()` silently no-ops server-side and every client hook's `isRealtimeConfiguredClient()` check keeps it on polling only — no live push, no presence avatars, no error surfaced to the user.

---

## Testing / Verification Results

### Automated Tests (2026-05-23)

- **Unit + integration tests**: 219/219 ✅ (`pnpm test`) — fixed year assertion in `stripe/route.test.ts` (PROMO_END_DATE updated to 2026)
- **TypeScript type-check**: 0 errors ✅ (`pnpm type-check`)

### Live API Tests (2026-05-21, localhost:3000)

| Test                    | Endpoint                                   | Result                                        |
| ----------------------- | ------------------------------------------ | --------------------------------------------- |
| Storefront page load    | `GET /@demo-verified`                      | ✅ HTTP 200                                   |
| Storefront API          | `GET /api/public/storefront/demo-verified` | ✅ Returns store + 2 categories + 4 items     |
| Menu page               | `GET /@demo-verified/menu`                 | ✅ HTTP 200                                   |
| Checkout page           | `GET /@demo-verified/order`                | ✅ HTTP 200                                   |
| Validation: empty items | `POST /api/public/orders`                  | ✅ 400 INVALID_INPUT                          |
| CASH order creation     | `POST /api/public/orders`                  | ✅ 201 `ORD-20260521-10YYJJ` — CONFIRMED/PAID |
| Order status polling    | `GET /api/public/orders/[id]/status`       | ✅ `{status: CONFIRMED, paymentStatus: PAID}` |

### Dashboard Flow — 5 Critical Journeys (2026-05-23, localhost:3000)

| Journey                                | Check                                                                  | Result                                                                                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Sign-up → publish storefront        | `GET /register`                                                        | ✅ HTTP 200, auth guard active (redirects unauthenticated to login)                                                                                     |
| 2. Place online order                  | `GET /api/public/storefront/demo-verified` + `POST /api/public/orders` | ✅ Storefront returns 3 categories + items; order validation returns 400 on empty items; prior session confirmed 201 CONFIRMED/PAID on valid CASH order |
| 3. Open shift → POS sale → close shift | `GET /api/stores/[id]/pos/orders`                                      | ✅ 200, returns live order queue with real orders (e.g. ORD-20260521-I9AP40)                                                                            |
| 4. Finance report export               | `GET /api/stores/[id]/finance/summary`                                 | ✅ 200, revenue=325,000 IDR, orderCount=7, cogs=0, grossMarginPct=100                                                                                   |
| 5. Multi-outlet owner drill-down       | `GET /api/owner/summary`                                               | ✅ 200, totalRevenue=325,000, storeCount=1, totalOrders=7, totalPending=0                                                                               |

### Environment / Provider Setup (2026-05-23)

- `RESEND_API_KEY` — ✅ real key, added to `.env` + Vercel
- `EMAIL_FROM` — ✅ set to `EPIDOM <noreply@epidom.id>`, added to Vercel
- `EMAIL_WEBHOOK_SECRET` — ✅ generated, added to `.env` + Vercel
- `OPENAI_API_KEY` — ✅ real key, added to `.env` + Vercel
- `INNGEST_EVENT_KEY` — ✅ real key, added to `.env` + Vercel
- `INNGEST_SIGNING_KEY` — ✅ real key, added to `.env` + Vercel
- `PROMO_END_DATE` — ✅ set to `2026-12-31T23:59:59Z`, added to Vercel
- `XENDIT_SECRET_KEY` — ⬜ pending (requires Xendit account setup)
- `FONNTE_API_TOKEN` — ⬜ pending (requires Fonnte device online)

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
