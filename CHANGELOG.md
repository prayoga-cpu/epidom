# Changelog

All notable changes to Epidom are documented here, newest first.

This file is the **source of truth** for releases. On every deploy it is synced into
the `Release` table (`scripts/sync-changelog.ts`) which powers the public `/changelog`
page, the in-app changelog, and the dashboard "What's new" notification.

Format: `## [version] - YYYY-MM-DD · tag` where `tag` ∈ `feat | fix | infra | ux`.
Bump the version in `package.json` and `src/lib/version.ts` with every release.

## [2.12.0] - 2026-07-19 · feat

- Admin Feedback console: entries now group by status (Open → In Progress → Resolved → Archived) with newest first within each group, each row/card and its status dropdown are color-coded by status, and every entry shows its ID (click to copy) for referencing a specific ticket.
- POS orders can now be cancelled — from the Active Queue (a Cancel button on each order card) or from Order History (a Cancel button in the order detail view). Cancelling an order that was already marked Delivered automatically restores the stock that had been deducted for it, so inventory numbers stay accurate.
- POS Cashier: a new "Hold" button next to Pay lets a cashier park the current cart aside (labeled by customer/table) to serve someone else, without completing payment. Held orders show up immediately in the Active Queue (with a Resume button) and Order History, but stay out of the Kitchen Display until they're resumed and actually paid — and out of every revenue/analytics report until then too. Resuming reloads the cart for editing; paying finalizes the same order rather than creating a duplicate.
- Fixed the Active Queue order cards' action buttons (Start Processing, Resume, Complete) wrapping into and overlapping the neighboring card, which also cut off the Cancel button.
- The Enterprise plan's pricing CTA now opens a WhatsApp chat instead of the old Calendly booking link. Every public-facing contact point across the site (Privacy, Press, Careers, GDPR, Partners, Contact, Refund Policy, Terms, footer, checkout-failed screen, and FAQ) now points to the same three real addresses — cro@, ceo@, and consult@prionation.io — and the same real WhatsApp number, replacing several stale placeholder emails and a wrong WhatsApp number.
- Storefront Settings now has a "Show QR" button next to your storefront link, generating a downloadable QR code for it. Tables Manager can now generate a QR code per table (scanning it opens the menu with that table's number already filled in for ordering) — download one at a time, or all at once as a single labeled sheet for printing table tents.
- Storefront Settings now has an Opening Hours editor — set open/close times or mark each day closed, shown on your public storefront page. This was previously only possible to display, not edit.
- Fixed the Tables Manager's per-table QR/Edit/Delete icons being invalid HTML (buttons nested inside another button), which was triggering a React hydration warning.
- Profile settings now offer a searchable picker for currency (~150 world currencies, up from 4) and timezone (the full worldwide IANA list, up from 5), instead of a short fixed dropdown. Currency conversion now works for any of them — previously only USD actually converted prices (EUR/MGA just relabeled the number); the POS Cashier screens (cart, checkout, order history) previously didn't convert at all and now do, matching what Dashboard finance/materials pages already did.
- The Admin panel's Region column now shows "Unknown" instead of a specific-looking but potentially fake city/currency for any account whose timezone has never actually been confirmed by a real device sync — previously every account showed "Jakarta · IDR" from the moment it was created, whether or not that was real. Also fixed the existing browser-timezone auto-sync silently never re-confirming itself for a device that had already synced once before this tracking existed.

## [2.11.0] - 2026-07-14 · feat

- Installed Google Analytics 4 and the Meta (Facebook) Pixel, both gated behind the cookie-consent bar (GA needs analytics consent, Meta needs marketing consent) and both wired to fire nothing until the visitor actually grants it.
- Instrumented the full funnel with GA4 events: marketing CTA clicks (hero, header, pricing plans, "book a demo", email capture, contact form), signup/login, every onboarding step plus final completion, dashboard activity (creating a product/material/recipe/supplier/production batch), POS checkout (as a standard e-commerce `purchase` event with line items), and billing (checkout started, subscription confirmed).
- Meta Pixel now also fires a `CompleteRegistration` event on signup, and got two reliability fixes: the pixel ID is hardcoded as a fallback so it still works if the hosting provider's env config is missing it, and the base code renders as a literal `<script>` tag physically inside `<head>` (a Next.js quirk meant it wasn't showing up as real markup, which is what Meta's own install check looks for).

## [2.10.0] - 2026-07-08 · feat

- POS plan now comes with a **14-day free trial** — connect a card, pay nothing for 14 days, then it renews automatically. The POS plan is highlighted as a special promo on the pricing page.
- Clearer plan boundaries — Online Orders and Table Reservations now require the POS plan; Data (Materials/Recipes/Products/Suppliers) stays an Operations feature. Hitting a feature your plan doesn't include shows an "Upgrade to POS" prompt (or sends you to pricing) instead of failing silently.
- Every plan now has a proper home for its menu: FREE manages a display-only **Store Menu** from Storefront settings; POS and up get a dedicated **Menu** page (same data, editable items with full edit/delete support); Operations' Data page keeps the deeper Product/recipe/stock layer, auto-synced to the menu so a Product's name/price never drifts from what customers and the POS Cashier see.
- Onboarding can now import your existing menu from a CSV / old data file (POS plan).
- Admin "Reset Account Data" now also signs the user out on all devices so they cleanly restart from onboarding.
- Log in and sign up are now one page with a toggle instead of two separate screens — same `/login` and `/register` links still work.
- Menu items can now have a photo — add or edit an item to upload one, with a size/resolution guide (square, 500×500 px ideal, max 2 MB).
- Fixed a redirect loop that could bounce a freshly-logged-in new user between `/login` and `/stores` instead of landing them on onboarding.
- Fixed rate limiting: every endpoint a user/IP hit shared one counter, so routine background checks (e.g. subscription status) could silently exhaust the much tighter budget for payment-sensitive endpoints like checkout, wrongly blocking the very first attempt. Each endpoint now has its own independent counter.
- Fixed stock/quantity fields (stock adjustment, materials, products, recipes, supplier orders, production batches) rejecting small decimals like 0,02 or 0,002 — inputs now accept both comma and period as the decimal separator, and precision was widened to 3 decimal places end-to-end (matching what the stock-adjustment ledger already supported) so gram/millilitre-level measurements track correctly. Also fixed the same comma-decimal typing bug on every price/cash field (cost price, selling price, supplier price, menu item price, POS cash tendered, shift opening/closing cash), and a follow-up bug where a mid-typing value could get rewritten (e.g. "0,0" collapsing back to "0").
- Material/product/recipe/supplier picker dropdowns (stock adjustment, recipe ingredients, supplier reordering, delivery receiving, production) are now sorted alphabetically instead of by creation date, so they're easier to scan.
- Fixed recipe cost calculations being off by up to 1000x whenever an ingredient's unit (e.g. grams) differed from its material's stock unit (e.g. kilograms) — cost per batch, ingredient cost breakdowns, production batch cost analysis, and stock deduction on sale now correctly convert between units before multiplying. The recipe editor's ingredient unit field is now locked to the material's unit to prevent the mismatch from being reintroduced.
- Fixed a crash opening any supplier with a phone number saved in a spaced-out format (e.g. "+33 3 88 45 12 67") instead of strict E.164 — the phone input now normalizes on read, and new/edited supplier phone numbers are validated up front.
- Products are now automatically added to the store's POS/storefront menu as soon as they're created (via the Data page or CSV import), grouped under a menu category matching the product's own category — no more manually clicking "Add to POS menu" for every item. You can still remove any item from the menu manually at any time. Existing products that weren't yet in the menu have been added.
- Increased the max zoom on the Instagram onboarding profile-picture cropper from 300% to 700%, so a small or low-res profile photo can still be framed to fill the crop area.

## [2.9.0] - 2026-07-07 · feat

- Instagram quick-start onboarding — upload a screenshot of your Instagram profile and AI pre-fills your storefront: business name, tagline from your bio, storefront URL from your username, Instagram link, a brand color, and smarter menu suggestions. Crop your profile picture straight from the screenshot to use as your logo — or skip and set up manually as before.

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
