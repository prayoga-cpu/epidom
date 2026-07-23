# Changelog

All notable changes to Epidom are documented here, newest first.

This file is the **source of truth** for releases. On every deploy it is synced into
the `Release` table (`scripts/sync-changelog.ts`) which powers the public `/changelog`
page, the in-app changelog, and the dashboard "What's new" notification.

Format: `## [version] - YYYY-MM-DD · tag` where `tag` ∈ `feat | fix | infra | ux`.
Bump the version in `package.json` and `src/lib/version.ts` with every release.

## [2.14.4] - 2026-07-23 · fix

- Made the live "Change" preview in POS checkout recompute directly from the same field value driving the Amount Tendered input, in the same render pass, instead of a separate `useWatch` subscription — removes any chance of it lagging behind a keystroke.
- **Fixed wrong Change/Amount Tendered for stores on a non-IDR display currency** (e.g. EUR) — every price in this system is stored internally in IDR and converted only for display, but the cashier's typed Amount Tendered was never converted back to IDR before being compared against the (IDR) cart total, so the preview showed a nonsense number, and — more seriously — the same unconverted value was being sent to the server and saved on the order. Amount Tendered is now converted to the base currency once, up front, before it's used anywhere (live preview, the printed receipt, and the API request). No effect on stores using IDR as their display currency (the common case), since that conversion is already a no-op there.
- Redesigned the POS topbar for mobile: store name, connection status, staff name/role, and sign-out now collapse into a single profile icon menu on the left, and the cart button that used to float over the bottom of the screen now lives on the right side of the same topbar. Desktop is unchanged.
- Added validation to POS cash checkout: Confirm Order is now disabled and shows an "insufficient amount" message whenever Amount Tendered is less than the order total, instead of allowing an order to be confirmed with negative change. Also enforced server-side, so a cash order can't be placed underpaid even by a direct API call.
- Filled in the Meta Pixel side of the acquisition funnel (previously only Google Analytics was tracking most of these stages): signup now sends `CompleteRegistration` with real params instead of none; clicking a paid plan now also sends `InitiateCheckout`; activating the free plan now sends `Lead`; and checkout success now sends `StartTrial` for the 14-day POS trial or `Subscribe` for an immediate paid subscription, distinguished via a new `trial` flag threaded through the Stripe checkout success URL. Recurring-payment tracking from the Stripe webhook is server-side only and would need a separate Meta Conversions API integration — deferred for now.

## [2.14.3] - 2026-07-23 · fix

- Fixed the POS mobile cart cropping the item list with no way to scroll to the rest. Root causes: the shared `ScrollArea` component was missing `overflow-hidden` (affecting every usage of it in the app), and a bottom-sheet drawer's height (`auto` clamped by `max-height`) doesn't reliably size a scrollable list through a nested flex layout. Switched the cart from a bottom-sheet drawer to a centered dialog — the same scrolling pattern already proven across every other dialog fixed this release — with its own header, scrollable item list, and a clearly separated totals footer.
- Fixed the marketing site's mobile navigation drawer having no scroll region at all — a nav list taller than the screen had no way to reach the items below the fold.
- Simplified the POS product grid and table floor plan on mobile phones: removed the bordered "card" look from product tiles (the color-coded table status borders are kept, just thinner, since that color is a status signal, not decoration) and tightened the grid spacing so more fits on screen at once.
- Fixed the Tables page on mobile: the header (table count + "Download All Table QRs" + "Add Table") crammed into one row and wrapped into an unreadable multi-line column — it now stacks cleanly on narrow screens. Fixed the Reservations section's refresh button getting visually stranded on its own line once the status filter chips wrapped, by anchoring it to the section title instead. Tightened side padding throughout both sections on mobile.
- Fixed each table card's QR/edit/delete icons overlapping the table label — they were absolutely positioned over the card with no reserved space, which collided with the label below on narrower cards. They're now a normal row above the label instead, so they can't overlap it.
- Removed the left/right padding and card box around the Storefront Settings' Opening Hours rows on mobile — each day now runs edge-to-edge with a simple divider between days, instead of a boxed card floating with wide empty margins on both sides. The boxed look returns at `sm:` and up.
- Removed the shared `Card` component's default padding and inter-section gap entirely on mobile phones app-wide (was `p-6`/`gap-6` everywhere, phone or desktop) — every screen built on a `Card`/`CardHeader`/`CardContent`/`CardFooter` (Storefront settings, Dashboard data sections, account settings, and more) now uses the full screen width on a phone, with the normal spacing returning at `sm:` and up. Individual sections that already set their own padding are unaffected.
- Removed the POS product grid's remaining left/right container padding and the gap between product tiles on mobile — the scrollable area now only has top spacing (`pt-2`), so tiles run flush to the screen edge and to each other instead of floating with margins on every side.
- Fixed the Storefront editor's loading skeleton overflowing narrow phones — it used fixed pixel widths (`w-96`) sized for desktop instead of shrinking with the viewport, pushing part of the placeholder off-screen while the page was loading.
- Capped the dashboard's shared page padding (`PageShell`, used by every dashboard page — Data, Tables, Staff, Storefront settings, and more) at `p-2` on mobile phones, down from `p-4` — one more source of wasted margin on every dashboard screen, not just the ones touched individually above.
- Restored a border on the POS product grid's tiles on mobile — with zero gap between them and no image on some items, there was no visible boundary at all between adjacent products. The border now doubles as the tile spacing, reading as a clean grid instead of floating text.
- Fixed a console accessibility error on the POS mobile cart ("`DialogContent` requires a `DialogTitle`") from switching it to a dialog earlier this release — it has its own visible header already, so this is a screen-reader-only title/description rather than a duplicated one on-screen.
- **Fixed Confirm Order and Hold not submitting at all** on POS Checkout, POS Hold, Table create/edit, Add Staff, and Open/Close Shift — introduced earlier this release while adding scroll-safety to these dialogs. The submit button was wrapped in a `<form>` placed *around* the dialog, but dialog content renders through a React Portal to a different part of the page, so that `<form>` never actually contained its own submit button in the real DOM — clicking it did nothing. Fixed by using the same `form="id"` attribute binding (works regardless of DOM position) already used correctly everywhere else in the app.
- Silenced a Postgres driver deprecation warning on server startup ("SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'") by making the database connection string's SSL mode explicit (`sslmode=verify-full`) instead of relying on the implicit alias. No behavior change today — this is exactly what `require` already resolves to — but it keeps the connection secure once a future major version of the Postgres driver changes what the implicit modes mean.
- Added a ninth Enterprise plan feature to the pricing page: custom integrations and bespoke website builds for restaurants/cafés with specific needs beyond the standard plans.

## [2.14.2] - 2026-07-22 · fix

- Fixed the POS checkout "Change" amount not always updating live as Amount Tendered was typed — switched to React Hook Form's `useWatch`, the more reliable pattern for a value that needs to recompute on every keystroke.
- Fixed checkout and Hold showing a generic "Failed to create order"/"Failed to hold order" toast with no way to know what went wrong. The API already knew the real reason (most commonly: resuming a held order after one of its items was deleted or taken off the menu) — the dialog was discarding it before showing a toast. It now surfaces the server's actual reason, naming the exact item(s) that are no longer available so the cashier knows what to remove from the cart.
- Fixed several dialogs across POS and the dashboard (checkout, hold order, staff, shifts, account settings, menu editor, and more) that had no internal scroll region — on a phone, content taller than the screen (e.g. a Notes field at the bottom of checkout) simply ran off the bottom with no way to scroll to it. They now use the same bounded-height, scrollable-body pattern already used elsewhere in the app.
- Simplified the mobile phone layout across POS, the customer storefront menu, and dashboard list views (Materials, Products, Recipes, Suppliers, Staff, Shifts, Feedback): removed boxy card borders/shadows/heavy padding in favor of a flatter, whitespace-separated list, and shrank secondary/metadata text (timestamps, emails, descriptions) so primary content stands out more. Desktop and tablet views are unchanged — this only applies below the `sm` breakpoint.
- Fixed the POS mobile cart's "Clear All" button overlapping the sheet's own close (X) button — the sheet's close button floats in the top-right corner regardless of content, so the cart header now reserves room for it on mobile.
- Fixed the POS header's date/time and staff badge overlapping the store name on narrow phone screens — the header has a fixed height, so text that didn't fit was wrapping and getting clipped instead of showing cleanly. The clock is now hidden on mobile (redundant with the phone's own status bar) and the staff name truncates instead of overflowing.
- Tightened the Storefront Settings "Online Orders" / "Table Reservations" toggle cards on mobile — removed the box border/rounded corners/padding in favor of a plain divided list, matching the flattened style used elsewhere.

## [2.14.1] - 2026-07-22 · fix

- Added Credit Card as a POS payment method, alongside Cash/QRIS/e-wallets/Virtual Account.
- Fixed the POS cart failing to Pay or Hold again after resuming a held order, with visibly wrong totals (e.g. a subtotal in the billions). The API endpoints powering the order queue were sending raw database price values straight to the browser instead of converting them to plain numbers first — the browser received them as text, so every total calculation silently glued numbers together as strings instead of adding them.
- Fixed the storefront's checkout button becoming unreachable when several items were in the cart — the same underlying viewport-height issue from the last release, found in more places (POS's mobile cart sheet and about a dozen other dialogs across Data, Recipes, Suppliers, and Management) and fixed everywhere at once via the shared dialog component.
- Fixed table action buttons (QR code, edit, delete) and a notification's dismiss button being completely unreachable on iPad/touch devices — they were only ever shown on mouse hover, which touchscreens don't have. They're now always visible.
- Enlarged several more touch targets that were under Apple's recommended minimum tap size across POS (staff switch, table actions, reservation actions).
- Fixed the desktop POS cart's Pay button becoming unreachable with enough items in the cart, with no way to scroll down to it. A shared layout container was missing `min-height: 0`, a CSS default that (combined with a scrollable flex container) otherwise lets content grow past its allotted space instead of scrolling within it — silently clipping the bottom instead of showing a scrollbar. Fixed at the shared layout level, so this can't recur on any dashboard page, not just POS.
- Fixed the desktop POS cart's Pay button overflowing past the panel's right edge regardless of total size — it was sized to 100% of the row's width while sitting next to the Hold button, which a plain width percentage doesn't account for. It now correctly grows to fill only the space actually left over, and wraps onto a second line for a very large total instead of cropping.
- Fixed the desktop POS cart panel itself getting squeezed/cropped on the right — the menu grid next to it had the same missing "shrink below natural width" behavior horizontally that the scroll bug had vertically, so it could refuse to make room for the cart's fixed width. The cart panel now always keeps its full width regardless of the menu's content.
- Audited the rest of the app for the same iPad/touch issues found above and fixed what else turned up: the Create/Edit Store dialogs had the same viewport-height bug, and a toast notification's dismiss button plus the "remove photo" control on every image upload (menu items, profile photo, etc.) were hover-only and unreachable on touch, same as the table buttons.
- Documented all of these as explicit rules in the project's coding guidelines, so future changes get checked for them upfront instead of being caught one bug report at a time.

## [2.14.0] - 2026-07-20 · feat

- Data → Materials: added Purchase Quantity + Purchase Price to raw materials and their per-supplier prices. Buy flour as "a 1000g bag for €2" instead of having to work out and type a per-gram cost by hand — the exact per-unit cost is derived and stored automatically in the background, and everywhere that cost feeds into (recipe costing, stock value, supplier comparisons) keeps working exactly as before. Existing materials are unaffected — they're treated as a pack of 1, same as today.
- Fixed Unit Cost silently rounding down to "€0.00" wherever it was shown as a standalone per-unit rate (Materials list, Material details, Recipe cost-estimate breakdowns, Supplier details) — a real cost like €0.002/g was being truncated to 2 decimal places for display. It now shows enough precision to actually be meaningful.
- Fixed buttons feeling unresponsive or needing a second tap on iPad Safari across the POS Cashier and public storefront — the app never told iOS to skip its default double-tap-to-zoom detection delay, which can eat a fast, deliberate tap. Also enlarged several touch targets that were well under Apple's recommended minimum size for a fingertip: the POS cart's quantity +/- and Remove controls, the Pay/Hold/Clear buttons, and the storefront cart's quantity +/- and floating "Checkout" button (previously as small as ~16px, now 36–48px).
- Admin → Feedback: added a Priority field (Urgent / High / Medium / Low) alongside Status, editable inline from the same dropdown pattern. Tickets are now sorted by priority within each status group, so the most urgent open items always surface first.
- Fixed the Data page crashing with "Decimal objects are not supported" right after saving a Material — the new Purchase Quantity field wasn't included in the step that converts database values into plain data before sending them to the page, for both a Material's own record and its per-supplier prices.
- Dashboard: the fixed sidebar now only shows at true desktop/laptop widths. Every iPad size (Mini, Air, and Pro in portrait, up to 1024px) previously got the full 230px sidebar forced on top of already-tight content — they now get the same collapsible hamburger menu already used on phones, giving the actual page far more room.
- Fixed the storefront's checkout, cart, and item-detail sheets getting cropped on iPhone Safari with the "Pay" button pushed out of reach — they sized themselves against the full-screen viewport height instead of the actually-visible area above Safari's address bar and toolbar. Also padded each sheet's bottom edge for the home-indicator area on notched iPhones.

## [2.13.1] - 2026-07-20 · fix

- Fixed every Materials/Products/Recipes/Suppliers/Feedback save showing a generic "Invalid input data" error with no explanation. The server always computed the exact field and reason (e.g. "SKU is required", "Price must be non-negative"), but every form was discarding that detail before showing it. Errors now say exactly which field is wrong and why, and highlight that field in red on the form — instead of leaving you to guess.
- Fixed saving a Material or Product failing with "Price can only have 2 decimal places" even when the price you typed was a clean whole number. Any account on a display currency other than IDR converts prices through a floating-point exchange rate before saving, which almost never lands on an exact 2-decimal value — that unrounded value was then rejected by the server. Converted prices are now rounded to 2 decimals at the source, so this can no longer happen.
- Fixed linking a recipe to a Product sometimes leaving Cost Price stuck at a stray "0" instead of the recipe's real cost. A cheap recipe's per-unit cost can be a real, non-zero amount in the base currency (IDR) that still rounds to 0.00 once converted to a stronger display currency — that rounded-to-zero value was being written into the field anyway (now it's left alone instead), and a separate rendering bug was displaying that 0 as a stray floating character on the form even when the field itself was otherwise empty.
- Data → Products: Cost Price is now locked to the recipe's auto-calculated value whenever a recipe is linked, so it can't drift out of sync with the recipe by accident. A "Customize cost price manually" checkbox (off by default) unlocks the field for a manual override when you actually need one.

## [2.13.0] - 2026-07-20 · feat

- Data → Products: linking a recipe to a product now auto-calculates the Cost Price from that recipe's real ingredient cost (summed across every linked recipe if more than one), instead of requiring manual entry. The field stays editable — this is a smart default, not a locked value — and only kicks in when you actively change the recipe selection, so opening an existing product never overwrites a price you already set.
- Data → Materials and Products: adding a new item now suggests a SKU automatically from the name/category (still fully editable, with a regenerate button), and shows a live "available" / "already used" check as you type — no more finding out about a duplicate SKU only after a failed save. The Category field is now a searchable picker suggesting categories you've already used, instead of free text, to cut down on near-duplicate categories from typos — you can still type a brand-new one.

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
