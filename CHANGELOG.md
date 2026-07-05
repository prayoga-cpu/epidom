# Changelog

All notable changes to Epidom are documented here, newest first.

This file is the **source of truth** for releases. On every deploy it is synced into
the `Release` table (`scripts/sync-changelog.ts`) which powers the public `/changelog`
page, the in-app changelog, and the dashboard "What's new" notification.

Format: `## [version] - YYYY-MM-DD · tag` where `tag` ∈ `feat | fix | infra | ux`.
Bump the version in `package.json` and `src/lib/version.ts` with every release.

## [2.8.0] - 2026-07-05 · feat

- Customer feedback widget — report a bug or suggest a feature from the dashboard, with an optional screenshot; tickets are emailed to the team and users get a "My tickets" tab to track, edit, or delete their own submissions.
- Admin feedback console — review all tickets with status control (Open / In Progress / Resolved / Archived), an in-place screenshot preview, and a mobile-friendly layout.
- Order history — the POS Orders page now has "Active" and "History" tabs with search, status/source/date filters, an order-detail dialog, and Excel export.
- Customer "My orders" — storefront visitors can see the orders they placed on this device, with live status, from a new My Orders page.
- Dashboard analytics — a reporting section with Revenue, Orders, Average Order Value, and Customers KPIs, revenue-trend and orders-by-status charts, a date range, and Excel export.
- Mobile-first pass — the POS cashier cart now works on phones (floating bar + bottom sheet), dense tables collapse to cards on small screens, and pinch-zoom is disabled app-wide for a native feel.
- Install app — a cross-platform "Install app" button in the mobile menu that also guides iOS Safari users through installation.
- Changelog & versioning — this changelog is now database-backed, surfaced through a "What's new" notification in the dashboard bell and a clickable version badge in the footer and dashboard.

## [2.7.0] - 2026-06-30 · ux

- Public storefront is now fully light & dark theme-aware — fixed washed-out, unreadable text in dark mode across the menu, item detail, cart, checkout, and order-status pages by moving to semantic design tokens.
- Storefront language switcher (Indonesian / English / French) plus a light/dark toggle added to every storefront page; the visitor's browser language is auto-detected on first visit.
- Storefront fully internationalized across id / en / fr — menu, cart, checkout drawer, item detail, order status, and store profile.
- Storefront profile footer redesigned — compact, with the Epidom logo + wordmark, and trimmed empty space.
- Home page: smoother section transitions — removed the stray dark band that appeared between adjacent warm (cream) sections.
- Fixed a React hydration error on the storefront (the open/closed badge and theme toggle now resolve on the client).
- Fixed dialog action buttons touching with no gap (Add Menu Item and POS checkout).
- Fixed missing translations in the storefront menu editor's Add Item dialog.
- Admin: Revenue report now reads live Stripe data with multi-currency views (IDR / EUR / USD), a per-month cash-collected recap, a customer payment log, and one-click Export / Print to PDF.

## [2.6.0] - 2026-05-29 · ux

- Storefront logo & cover image are now photo-upload fields — drag-and-drop with preview, auto-compression, and resolution guide (logo 400×400 · cover 1920×1080).
- Data / Products — 'Add to POS menu' button now shows 'In Menu' badge instantly (optimistic update) instead of waiting for a page reload.
- Sync-to-menu prompt: editing a product's price or name now offers a one-click action to update the linked POS menu item.
- Recipe cards show a '47× last 30d' demand badge — pulls 30-day POS order counts so you know which recipes are driven by real sales.
- Tracking page gains a 'Recent Movements' tab showing all stock changes with source context (POS order # / Batch # / Manual).
- Dashboard now includes a 'Recent Stock Movements' card as a live activity feed.
- Subscription pricing on profile page updates instantly when you change your currency (IDR / USD / EUR) — no reload needed.
- Pricing labels corrected: POS = Rp 99.000/bln, OPERATIONS = Rp 249.000/bln.
- PWA install button in the topbar — disappears automatically when the app is already installed.
- Removed orphaned placeholder component (data-manage.tsx).

## [2.5.0] - 2026-05-28 · infra

- Prisma 6 → 7 — migrated to pg driver adapter (@prisma/adapter-pg); removed url/directUrl from schema.prisma; added prisma.config.ts for CLI.
- Added DIRECT_URL support (Neon non-pooled endpoint) so prisma migrate deploy runs over a direct connection and never hits pgBouncer prepared-statement limits.
- build script: prisma migrate deploy now runs before next build — missing columns (isAdmin, hasOnboarded) are created automatically on every Vercel deploy.
- Service worker fix: response.clone() was called inside an async .then(), causing 'body already used' errors that blocked login. Fixed to clone synchronously.
- OAuth errors now redirect to /login?error=<code> with a human-readable toast instead of Better Auth's raw HTML error page.

## [2.4.0] - 2026-05-28 · feat

- Guided onboarding (5 steps: business → logo → menu → theme → publish) with server-side redirect guard after completion (hasOnboarded flag).
- POST /api/onboarding/complete — marks onboarding done permanently; subsequent visits to /onboarding redirect to /stores instantly.
- Fixed onboarding menu-item save bug: createCategory() was returning the inner payload directly but code was reading .data?.id — items silently skipped. Fixed.
- Staff email invitation flow — PIN delivered via Resend after invite.
- Table reservations — per-table toggle, public booking form, dashboard management panel.
- Notification bell with badge count for unread alerts.

## [2.3.0] - 2026-05-24 · ux

- Full i18n sweep — 100+ new translation keys across POS, KDS, Tables, Storefront editor, Finance pages.
- epi-navy dark / epi-cream light design tokens fully bridged into shadcn CSS variables.
- Dark/light mode toggle in topbar; default dark.
- Currency provider — formatPrice() auto-converts from stored value to user's selected currency (IDR / USD / EUR).
- Shift management — currency-aware formatting, sortable columns.
- Account Settings — data usage stats, linked accounts, change password, delete account.

## [2.2.0] - 2026-05-23 · feat

- Finance reports — daily/weekly/monthly P&L: revenue, COGS, gross margin. Per-channel breakdown (DIRECT / GoFood / GrabFood / ShopeeFood / Tokopedia).
- Multi-outlet owner dashboard (ENTERPRISE) — rolls up all stores with drill-down.
- Aggregator email ingestion — GoFood/GrabFood order emails → Order records via Inngest + OpenAI.
- Automatic stock deduction on order → DELIVERED (serializable transaction through Recipe → Material chain).
- LOW_STOCK and CRITICAL_STOCK alerts with notification bell badge.
- Staff PIN login — clock-in with PIN, shift open/close.

## [2.1.0] - 2026-05-22 · feat

- POS cashier — menu grid, cart, checkout dialog (CASH / CARD / TRANSFER / QRIS).
- Kitchen Display System (KDS) — real-time order columns by status.
- Order queue with SSE real-time updates.
- Table management — seat assignment, status tracking (FREE / OCCUPIED / RESERVED).
- Production batch management — schedule batches from recipes, track status, view history.
- CSV Smart Import (AI-powered) for Products, Materials, Recipes, Suppliers.

## [2.0.0] - 2026-05-21 · feat

- Public storefront at /@slug — customizable menu page, theme color, tagline, social links.
- Online ordering — customer checkout form, QRIS/cash payment, order tracking page.
- Storefront editor — WYSIWYG menu builder with drag-and-drop category reordering.
- GoFood / GrabFood / ShopeeFood / Tokopedia aggregator link fields.
- Storefront analytics — view counts.
- Inventory management — Products, Materials, Recipes (with cost-per-batch), Suppliers.

## [1.0.0] - 2026-05-01 · feat

- Public launch — auth (email/password + Google OAuth), store creation, billing (FREE / POS / OPERATIONS / ENTERPRISE via Stripe).
- Dashboard with stock overview, production chart, alerts card, supplier card.
- Better Auth integration — HMAC-signed cookies, email verification, password reset.
- Multi-store support (Business → Stores hierarchy).
- Indonesian (id) primary language, English (en) secondary.
