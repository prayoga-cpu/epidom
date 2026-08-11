# Changelog

All notable changes to Epidom are documented here, newest first.

This file is the **source of truth** for releases. On every deploy it is synced into
the `Release` table (`scripts/sync-changelog.ts`) which powers the public `/changelog`
page, the in-app changelog, and the dashboard "What's new" notification.

Format: `## [version] - YYYY-MM-DD · tag` where `tag` ∈ `feat | fix | infra | ux`.
Bump the version in `package.json` and `src/lib/version.ts` with every release.

## [2.64.1] - 2026-08-11 · ux

- **The Mark as Paid window now scrolls instead of running off the screen.** With every payment method your store accepts listed at once, the top of the window and its Confirm button could both sit outside the screen on a laptop or tablet, with no way to reach them.
- **Only one window opens at a time now.** Choosing Mark as Paid, Refund or Cancel from an order's details used to open a second window stacked on top of the first — double-dimmed background, the order details still showing around the edges. Each one now replaces the details, and closing it takes you straight back to the order where you left off.
- **Order card buttons no longer overlap on narrow cards.** When an unpaid order showed both a stage action and Mark as Paid, the two labels printed over each other. Mark as Paid now shares the top row with the cancel ✕ and the main action (Complete, Start Process…) gets a full-width row below it, with longer labels shortened rather than spilling out. All three are also bigger to tap on a tablet.
- **Deleting a material, recipe or supplier from its details window asks once, not twice.** The details window raised its own confirmation, which then raised the page's confirmation for the same delete.
- **Editing or deleting a material from its details window no longer leaves the details stacked behind it**, matching how products, recipes and suppliers already behaved.
- **Deleting a category from Manage Categories** now replaces the category list rather than stacking on top of it.

## [2.64.0] - 2026-08-11 · fix

- **Fixed the intermittent 404s and "page needs reloading" errors when moving between dashboard pages.** The main cause was the offline cache holding on to page data from a previous release: after a new version shipped, it kept serving the old version's data, which pointed at files that no longer existed. The cache now leaves that data alone entirely and only stores genuinely static assets.
- **The installed app's shortcuts work again.** Long-pressing the app icon and choosing Cashier or Order Queue used to open a "page not found" screen, because those shortcuts pointed at an address that only exists inside a specific store. They now resolve to the right store automatically, and opening the installed app goes straight to your dashboard instead of the marketing homepage.
- **Opening the app no longer lands on a dead page after a store is removed or a page is renamed.** The "continue where you left off" shortcut now checks that the saved page still exists before jumping to it, and a store that is no longer yours sends you to your store list instead of a broken dashboard.
- **`/store/{id}` opens your preferred section** instead of a "page not found" screen — a trimmed or hand-shared store link now works.
- **Dashboard pages show a loading skeleton while they open, and a recoverable error screen with a Try again button if something fails**, instead of a blank screen you had to reload by hand.
- **Losing connection mid-shift now shows a proper offline screen** that reconnects on its own, rather than the browser's error page. The app also no longer tries to reload itself while offline, which previously left the screen stuck.
- **Fixed an upgrade dead-end that could trap the browser in an endless redirect.** If your plan lapsed while your last-opened page needed a higher tier, opening the app bounced you to the pricing page, which bounced you back to that page, forever — so the one page that could restore your plan was the one page you could never reach.
- **Fixed an endless loop for accounts with no store left.** Deleting your last store put the app in a permanent bounce between the store list and the setup screen; you now land on setup, where a new store can actually be created.
- **Losing wifi mid-shift keeps the screen you were on.** The offline fallback now restores the actual dashboard or cashier page rather than a generic offline card, since the app's code and its local order data are both still on the device. Signing out clears it, so a shared tablet never shows one account's screen to the next.
- **Connectivity is now detected by actually reaching the server** roughly once a second while offline, rather than trusting the device's network indicator — which reports "connected" behind café/hotel wifi sign-in pages and when a weak link silently recovers. Queued orders and cached data now sync the moment the connection genuinely returns, and the "last synced" time stays accurate.

## [2.63.0] - 2026-08-11 · fix

- **Custom Products now render as their own section in POS Cashier and on the storefront**, in a visually distinct block headed by the store's name for that product line, instead of appearing as just another menu category among the food and drink headings.
- **Fixed the "Track stock" toggle not saving**: the product update endpoint dropped the field, so switching stock tracking on or off in the Custom Products edit dialog silently did nothing.
- **Repaired menu categories that had drifted out of sync**: products edited before the category-sync fix kept their old category on the cashier and storefront. A one-off repair (`pnpm tsx scripts/repair-menu-item-categories.ts`, with `--dry-run` to preview) re-points every product-linked menu item at its product's current category.

## [2.62.0] - 2026-08-11 · feat

- **Products can now be marked as not stock-tracked** — a service (a haircut), or any always-available item. Turn "Track stock" off and nothing is ever deducted and it can never run out; turn it on and set a quantity, and it's deducted per order like any other product. Available on Custom Products items, where it defaults to off since services are the common case there; every existing product keeps tracking stock exactly as before.
- **Fixed custom items showing as "SOLD OUT" on the storefront**: they were being created as unavailable back when custom items were unconditionally hidden from the public menu. Storefront visibility is now controlled by its own setting, so that flag no longer applies — existing items are corrected automatically.
- **Fixed a product's category change not reaching the POS Cashier or storefront**: renaming or reassigning a product's category updated the product itself but left the linked menu item filed under its old heading, on both screens, indefinitely. The category now syncs across (creating the menu category if needed) and pushes live to the cashier like name/price changes already did. Applies to all products, not just custom ones.

## [2.61.0] - 2026-08-11 · feat

- **Order Queue can now mark an in-production order complete on its own**: an order that's had "Start Processing" clicked previously had no further manual action on the Order Queue at all — the only way to move it forward was switching to Kitchen & Bar and tapping every item. It now gets the same "Mark All Complete" action Kitchen & Bar has, right on the card, for stores that don't want a cashier bouncing between screens for a simple order.

## [2.60.0] - 2026-08-11 · fix

- **Fixed two Custom Products dataflow gaps found in operator testing**: turning off the feature's master toggle on the Data page now correctly pulls those items off the public storefront too — previously the storefront-visibility toggle in Storefront Settings was checked on its own, so a store that had opted into storefront publishing kept showing custom items there even after the master feature was switched off. Also, the "name this product line" field on the Data page's disabled/explainer view now pre-fills with whatever was last saved instead of appearing blank — turning the feature off never actually cleared the name, but the input didn't show it, making it look lost.

## [2.59.0] - 2026-08-11 · fix

- **Fixed notes (and modifiers) disappearing when a held order is resumed for the first time**: the very first time a cart was held (before it had ever been resumed once already), the order-item's note and selected modifiers were never actually written to the database — only quantity/price/name were. Resuming that order later showed the item with no note at all. A held order that had already been resumed and held again worked correctly, since that code path (a separate branch in the same route) already saved both fields — this just brings the first-hold branch in line with it.

## [2.58.0] - 2026-08-11 · fix

- **Order status now updates instantly on Kitchen & Bar and the Order Queue**: marking an item (or a whole station) "Ready" is pushed live everywhere else in the app, but the KDS item-status route was the one gap — it never fired that push, so both screens fell back to periodic polling (up to 10s, or 15s where live push isn't configured) to notice. Also fixed a same-device gap where the KDS card kept showing "Waiting other department" for a few seconds after that station had already finished, because the local optimistic update only flipped the item, not the order.
- **Order Queue status badges (status/source/payment/unpaid) now stretch to the full width of their column** instead of shrinking to fit their own text, so the badge stack reads as one clean aligned block instead of a jagged one. The status filter tiles above the queue (All/Confirmed/In Production/Ready/Held) had the same problem for a different reason — the grid was hardcoded to 6 columns for 5 tiles, leaving a dead gap the width of a whole tile; now a 5-column grid.
- **Checkout confirmation is significantly faster**: creating or finalizing an order now returns as soon as the order itself is committed. Stock deduction, shortfall-batch drafting, and the background order-placed notification (an outbound network call) used to all run before the response was sent — they're now deferred to run immediately after via Next's `after()`, off the critical path but still guaranteed to complete. The two independent lookups needed to build the order (menu item validation, finance settings) now also run concurrently instead of one after another.

## [2.57.0] - 2026-08-11 · feat

- **Custom Products, round two — separated the two on/off switches and made it a real POS department**: the master enable toggle (which drives POS Cashier inclusion) moved back to the Data page's Custom Products tab, where it's paired with the Operations-plan pricing wall; Storefront Settings now has its own, independent toggle purely for whether those items also publish to the public storefront link. Custom-line items now show up as a genuine third department filter — labeled with the store's own name for it — right beside Kitchen/Bar in POS Cashier, the Order Queue, and Finance Reports' revenue-by-department breakdown, instead of living in a separate section or an "Unassigned" bucket.
- **POS cart: every line item can now carry a note**, not just ones with modifier options — the pencil icon on a cart line no longer waits for a menu item to have option groups before it appears.

## [2.55.0] - 2026-08-11 · fix

- **Custom Products redesign, based on live operator testing of 2.54.0**: fixed a real currency bug where editing a custom item showed the raw IDR-stored value instead of converting to the store's display currency (e.g. a €10 cost showed as "208333,33"). Removed the per-item "Show on Menu"/"Show on Cashier" switches entirely — custom items are now never shown on the public storefront and always auto-added to POS Cashier for as long as the feature is on, no manual toggling needed. The on/off toggle and naming moved out of the Data page tab into Storefront Settings' "Storefront Features" card (alongside Online Orders/Table Reservations), now gated behind an Operations-plan upgrade wall. POS Cashier gained a dedicated section for these items, structurally separate (below) the regular Kitchen/Bar item grid rather than mixed into it. The Data page tab itself is now leaner — just the product list, or a link to Storefront Settings when the feature is off — fixing an unrelated layout gap reported alongside the above.

## [2.54.0] - 2026-08-11 · feat

- **Optional "Custom Products" second product line**: a store can now sell something entirely unrelated to its Kitchen/Bar menu — the example that prompted this, a café that also runs a small hair-salon counter — without Epidom building anything salon-specific. Off by default; the store owner names it (e.g. "Hair Salon", "Spa Services") when turning it on from a new tab on the Data page. Items in this line skip the Kitchen/Bar KDS workflow and material stock/recipe deduction entirely (there's no such thing as inventory for a haircut), and each item has two independent visibility switches — "Show on Menu" (the customer-facing Storefront) and "Show on Cashier" (the POS Cashier sell grid) — instead of the one shared toggle regular menu items use. Revenue still flows into the same integrated Finance Reports as everything else.

## [2.53.0] - 2026-08-11 · infra

- **Local dev and PR preview deployments no longer share the production database.** Vercel's `DATABASE_URL`/`DIRECT_URL` were scoped to both `production` and `preview` — every preview build's own migration step, and any local work, ran directly against live data. Added a Neon `development` branch (instant copy-on-write, reset from production nightly via a new GitHub Actions workflow) and re-scoped Vercel so only `production` deploys touch the production branch; `preview`/local now point at `development`. No user-facing behavior change — this is entirely about protecting production from development activity.

## [2.52.0] - 2026-08-10 · feat

- **Admin can now set a custom price for an individual account's subscription**: from the Master Admin Panel's "Manage" menu, a new "Set Custom Price" action lets the operator override what a user is billed. For a real Stripe-paying customer, it actually changes what Stripe charges them starting the next billing cycle (a live price override); for an admin-granted/comped account, it's stored as a reference figure — shown on the admin panel and that user's own Billing page — for the operator's own manual invoicing arrangement. Mainly for negotiated Enterprise deals, previously handled entirely outside the app.

## [2.51.0] - 2026-08-10 · feat

- **Marketing site now remembers your last chosen language**: picking a language from the switcher on epidom's marketing pages (`/`, `/pricing`, etc.) now sticks on every future visit to an unprefixed URL — a bookmark, the logo click, typing the bare domain — instead of only lasting for that page load. Previously the site only auto-guessed a language once from your browser settings on first visit; an explicit pick now always wins over that guess, on a real cookie so it's honored before the page even renders.

## [2.50.0] - 2026-08-10 · fix

- **Fixed a redirect loop in "Resume where I left off"**: clicking the EPIDOM logo (the way back to the marketing homepage from inside the app) now records `/` itself as the last-visited page before navigating, so the marketing site loads normally instead of instantly bouncing back into the app. Previously the logo linked straight to `/` without updating the tracked URL, so the stale in-app URL was still "last visited" and the resume redirect fired immediately — signed-in users had no way to actually see the marketing site.

## [2.49.0] - 2026-08-10 · feat

- **"Resume where I left off"**: signed-in visitors who land on the marketing homepage are now sent straight back to the last app page they had open on that device — including filters/tabs, since most of those already live in the URL — instead of seeing marketing content. New Profile setting (replaces "Default landing page") lets you turn this off. Device-local (localStorage), cleared on logout so the next person on a shared device isn't bounced into someone else's page.
- **"Back to Stores" added to the account dropdown**, alongside Switch Account/Account Access — there was no way back to the store picker from inside a store without using the browser back button.

## [2.48.0] - 2026-08-10 · feat

- **Offline Mode is now mandatory (no opt-out) once the app is installed as a PWA** — previously it auto-enabled once but respected an explicit prior "off," which meant an installed app could still end up without offline support. `disableOfflineMode` itself now refuses while standalone, not just the UI.
- **PWA install flow rebuilt on `@khmyznikov/pwa-install`**, replacing the hand-rolled iOS-detection code — its own richer, per-platform install guide (opened from a dedicated button), and its `isUnderStandaloneMode` is now the source of truth for "already installed" in this component. The install button (and the whole Offline & Sync dialog) is hidden entirely once installed — nothing left to configure once Offline Mode can't be toggled anyway. The app-preview screenshot (device-appropriate — phone vs. desktop) is still shown up front in our own dialog, same as before.

## [2.47.0] - 2026-08-10 · feat

- **NotificationBell: upload your own custom sound** instead of only the built-in Chime/Ping — pick "Custom" to select an MP3/WAV/OGG/M4A clip (validated: audio only, 3 seconds max, 1MB max), stored on-device only (no server upload). A trash icon next to "Custom" removes it and falls back to Chime.
- **Push toggle and sound options merged into one row** in the NotificationBell popover — a single switch for enabling/disabling push, plus a "customize" dropdown covering why push can't be toggled right now (blocked/iOS-install-needed) and the full sound picker, instead of two separately-bordered always-expanded sections.
- **Fixed a test regression from the MagicBell change (2.43.0)**: the low-stock alert test suite's Prisma mock didn't define `user.findUnique`, which `fireLowStockAlert` now calls to resolve the MagicBell recipient — crashed 3 tests. Production was never affected (the real Prisma client always has `.user`); this was a test-mock gap only, caught during this session's pre-push verification.

## [2.46.0] - 2026-08-10 · fix

- **Billing page now shows "Lifetime access" instead of a literal far-future date** (e.g. "May 4th, 2126") for accounts granted a lifetime period from the admin panel — mirrors the admin user table's existing lifetime detection, now shared via one `isLifetimePeriod()` helper instead of two separately-maintained thresholds.

## [2.45.0] - 2026-08-10 · fix

- **`/admin/capacity`'s Vercel card no longer shows a raw "404" as an error** — a Hobby-plan team with zero billable usage gets a real `costs_not_found` 404 from Vercel's billing API; that's honest zero-usage data, not a broken integration, so it now renders as "$0.00, no billable usage this period" instead of an error string.
- **Backup card now tells configured-but-never-run apart from not-configured** — previously always said "Set R2_ACCOUNT_ID..." even when R2 was fully configured and just hadn't backed up yet.
- **First real database backup run** — 50 tables, ~1,800 rows, ~166KB compressed, uploaded to Cloudflare R2.

## [2.44.0] - 2026-08-10 · fix

- **Fixed `/admin/capacity`'s "Failed to fetch capacity" error** — the orders-per-day query referenced the `Order` Prisma model name in raw SQL instead of its actual mapped table name (`orders`), which every other query on the page correctly used.
- **NotificationBell gets a custom in-app sound** — a synthesized chime/ping (no audio file to host) plays when a genuinely new order/reservation/onboarding item arrives while the tab is open, with a 3-way Chime/Ping/Off picker saved per device. Doesn't apply to OS-level push or MagicBell's own channels — neither the Web Notifications API nor MagicBell support a custom delivery sound, a platform limitation this app can't work around.

## [2.43.0] - 2026-08-10 · infra

- **Merchant alerts (new order, low/critical stock) now route through MagicBell** instead of separate direct WhatsApp (Fonnte) and browser-push (VAPID) calls — one unified API, with web push/mobile push/email/in-app configurable per category in the MagicBell dashboard (SMS can be turned on later by connecting Twilio there, no code change needed). Recipient is the store's owning account, identified by email. The old push/WhatsApp infrastructure is intentionally left in place (unused by this flow, not deleted) rather than bundling a second, larger cleanup into this change. Nothing else — the in-app notification bell, customer-facing WhatsApp receipts, and transactional email — changed.

## [2.42.0] - 2026-08-10 · feat

- **Offline Mode**: the "Install app" dialog (topbar/sidebar download icon) now doubles as an Offline & Sync settings surface, and stays visible after install instead of disappearing. A new Offline Mode toggle eagerly downloads menu, live orders/KDS, materials, staff roster, and staff schedules to the device (via IndexedDB) so POS keeps working with no connection; everything else (finance, admin, marketing) stays online-only by design. Auto-enables itself the first time the app is confirmed running installed to the home screen, without waiting for anyone to find the switch — turn it back off any time to opt out for good.
- **"Last synced: <date>" status**, shown in the Offline & Sync dialog and in the POS offline banner, plus a "Sync now" button that flushes any queued offline orders and refreshes the offline data mirror together. Reconnecting automatically triggers the same refresh.
- Offline data now survives a reload/relaunch (previously it lived only in memory and was gone the moment you left the POS screen or closed the tab).

## [2.41.0] - 2026-08-10 · infra

- **New `/admin/capacity` dashboard**: database size and per-table disk usage (auto-discovered, no hardcoded table list), row-growth for the highest-traffic tables, tenant scale (stores/users/orders-per-day), and Vercel Blob storage usage — an early-warning view for approaching a platform limit before it causes an outage.
- **Platform usage cards** for Vercel and Neon (billing/consumption vs. quota) — optional, degrade to "not configured" until their API credentials are added.
- **Independent, off-platform database backup**: a nightly job streams every table straight from Postgres into Cloudflare R2 (gzip-compressed), with a 90-day retention and a daily freshness check that alerts if a backup hasn't succeeded in 36+ hours. Restores are a deliberate CLI script (`pnpm restore:backup`), never a web action, and are documented end-to-end in the new `docs/BACKUP_RESTORE.md` runbook including a quarterly restore-drill checklist.

## [2.40.0] - 2026-08-10 · feat

- **Storefront → Analytics is now real, dynamic, and date-range driven** instead of a static "Coming Soon" mock. Tracks storefront page views, menu views, item views, and WhatsApp-button clicks via a new anonymous, daily-rotating visitor fingerprint (no cookies, no raw IP stored, bot/crawler and chat-app link-preview fetches excluded so sharing the link into WhatsApp doesn't inflate the numbers). The tab now shows real unique visitors with a trend vs. the prior period, menu-view and WhatsApp chat-conversion rates, storefront-attributed orders/revenue (from existing `Order.source = STOREFRONT` data), a visitor trend chart, and top viewed/ordered items.

## [2.39.0] - 2026-08-09 · ux

- **Kitchen & Bar / Order Queue ticket timers no longer show absurd raw minute counts on old tickets** (e.g. "51482m 50s"). Past an hour, the live mm:ss counter now switches to a human duration — "8hrs 9mins ago", "7 days ago", "1 month 4 days ago" — instead of continuing to tick in raw minutes.
- **Order History table's Date column now reads "<weekday>, <day> <month>"** (e.g. "Thursday, 9 July") with the time on a second line, instead of a year-inclusive timestamp that made the column harder to scan. The exact weekday, date, year, and timezone are still there in full — now on the order detail dialog, which shows a precise timestamp with both the timezone offset and full zone name (e.g. "Sunday, Jul 9, 2026, 4:00 PM GMT+7 (Western Indonesia Time)") for the order date, delivered date, and last receipt send time.

## [2.38.0] - 2026-08-09 · feat

- **Menu Editor: categories and items can now actually be dragged to reorder.** The grip handles were previously decorative; they now use `@dnd-kit` (new dependency) to reorder categories among themselves, and items within a category, persisting the new `displayOrder` via the existing update endpoints. Touch-safe (40px drag-handle hit targets, `touch-action: none`) for iPad/Android use.
- **Product-linked menu items: deleting is now framed as "remove from POS menu," not "delete."** The item's trash icon and confirm dialog say "Remove from POS menu" and clarify the product data is kept — only its POS listing goes away. Deleting a category that contains product-linked items shows the same clarified wording for its "delete items" option.
- **Product-linked menu items no longer show a Category or Modifiers editor in the Menu Editor.** Both are owned by the Product (`Product.category`, `Product.optionGroups`) and edited there via the existing "Edit in Products" link — duplicating them in the Menu Editor risked silent drift. Description and photo remain editable in place since those aren't synced from the product.

## [2.37.0] - 2026-08-09 · feat

- **Kitchen & Bar display and the Order Queue are now one module.** Both pages share a single "Active Queue" setting: turning Kitchen & Bar display off now also empties the Order Queue (new orders skip straight to History as Delivered), and a matching toggle was added to the Order Queue page itself — turning it off does the same and flips Kitchen & Bar display off too. Either page's toggle controls the same store-wide setting, in sync everywhere.
- Closed a gap where a Pay Later order could still sit on Pending in the queue even with the display off — it now also goes straight to Delivered (still unpaid, still followable from Order History's Mark Paid action).
- Hold order is now disabled while the Active Queue is off, since there's no queue left to park it in or resume it from.

## [2.36.0] - 2026-08-09 · feat

- **Menu Editor: move an item to a different category (or create one) without deleting and re-adding it.** The Edit Item dialog now has a Category field (searchable, creatable) that reassigns the item's `MenuCategory` in place.
- **POS menu items linked to a Product are now clearly marked and protected from drift.** A "From Product" badge + tooltip appears on any menu item backed by a Product; its Edit dialog locks Name/Price/Department (owned by the product and synced one-way) and offers an "Edit in Products" button that deep-links to that product's edit dialog on the Data page instead. Category, description, image, and modifiers stay editable in the Menu Editor.
- **Fixed the Data > Products "in POS menu" icon going stale.** Adding/removing/editing a menu item (from the Menu Editor, another tab, or another device) now publishes a `menu.changed` realtime event that the Products page subscribes to, instead of relying only on window-focus refetch; the Menu Editor also invalidates the Products page's linked-status cache directly for instant same-tab feedback.
- **Added a bulk "Remove from Menu" action** to the Products page's multi-select toolbar, mirroring the existing bulk "Add to Menu".
- **The "not yet in POS menu" icon on a product card no longer looks similar to the green "already in menu" one** — it's now a neutral/muted color so the two states are easier to tell apart at a glance.

## [2.35.0] - 2026-08-09 · ux

- **Email and WhatsApp Number now format live and show their own inline error, like Username already did.** Add/Edit Staff previously only caught a bad email or phone value on submit (or worse, silently on Add — those two fields had no inline error rendering at all). WhatsApp Number now strips non-digits while typing (keeping a leading `+`); Email strips whitespace and lowercases. Both re-validate as you type — Add via a `watch` + `trigger` effect (react-hook-form), Edit via a new shared `optionalEmailSchema` (`common.schemas.ts`, alongside the existing `phoneSchema`) checked directly against the plain `useState` fields — and show the specific reason inline instead of only a generic toast after Save.

## [2.34.1] - 2026-08-09 · fix

- **Staff save failures now say which field is wrong.** Saving the Add/Edit Staff dialog surfaced a bare "Validation failed" toast on any Zod validation error (e.g. a non-phone value sitting in WhatsApp Number), giving no way to tell what to fix — the actual per-field reason was already being computed server-side (`parsed.error.flatten()`) but discarded on the way to the toast, which only ever read the response's generic top-level message. Both dialogs now surface the real field + reason (e.g. "WhatsApp Number: Invalid phone number format").

## [2.34.0] - 2026-08-09 · fix

- **Staff filter dropdowns (Finance Reports, POS Order History, Order Queue) no longer drop staff the moment they're deactivated.** Finance Reports and Order History both queried/filtered `isActive: true`, so a staff member's own past orders became impossible to filter by as soon as they were deactivated — with no way to isolate their historical revenue or transactions. All three now keep deactivated staff selectable, labeled "(Inactive)", instead of quietly removing the option along with the person.
- **Hid "Switch Account" from the account dropdown when there's no one to switch to.** Previously always shown to the owner regardless of roster state, it reloaded into an empty picker whenever the store had zero staff or only inactive ones. Now hidden unless at least one active, non-Owner staff account exists (mirrors the existing zero-staff bypass check in the dashboard layout).

## [2.33.0] - 2026-08-09 · ux

- **Custom staff role moved into the Role dropdown, and it now actually shows up.** The Add/Edit Staff dialogs previously had an always-visible "Custom role label" text field sitting below the Role select — confusing since it looked mandatory, and its value was silently discarded by the display layer (the staff table's role Badge never read `customRoleLabel`, only the base role name). Replaced with a "Custom…" entry inside the Role dropdown itself: selecting it reveals a single inline text input right there, and the staff list now shows that custom title instead of the base role wherever it's set.
- **Staff username field now auto-formats while typing** instead of only rejecting invalid characters on submit — lowercases and strips anything outside `a-z0-9_.` live, matching the existing backend `usernameSchema` regex, in both the Add and Edit Staff forms.

## [2.32.0] - 2026-08-08 · feat

- **Fixed the printed/digital receipt going nearly invisible in dark mode.** `ReceiptDocument` (the shared component behind the public `/r/[orderId]` page and the receipt-settings live preview) deliberately renders as fixed black-on-white "paper" regardless of the app's theme — but a global dark-mode CSS rule that remaps `.text-black`/`.text-gray-*` to pale cream (for readability against the dark dashboard theme) was catching it too, since it wasn't opted out. Fixed by applying the same `print-report` marker class already used by the other "always white" views (`print-report-shell.tsx`, `order-history-print-view.tsx`) and extending that opt-out rule to cover the additional gray shades the receipt uses.
- **Added a printer-menu "Reprint Last Order" action** plus a direct link to Order History (`?tab=history`) for reprinting anything older — the last completed order's `ReceiptData` is now kept in a small persisted store (`useLastReceipt`) instead of living only inside the checkout dialog's local state and disappearing once it closed. Order History itself gained a genuine "Reprint" action (prints via the paired Bluetooth printer, not just the "View Receipt" web link), backed by a new `GET .../pos/orders/[orderId]/receipt` endpoint that returns the same `ReceiptData` shape used everywhere else.
- **Fixed the POS cart's Pay button requiring a scroll to reach.** Root cause: the shared dashboard `PageShell` wraps every page's content in a plain, unbounded-height div inside its own scrollable region — fine for ordinary pages that scroll at the page level, but it meant `PosShell`'s `flex-1` (which expects a bounded-height flex parent so its own internal item-grid/cart scroll regions can work) had nothing to size against, so the whole POS page just grew to fit content instead of keeping the cart footer pinned. Gave that wrapper `min-h-full` — additive for every other page, and the fix `PosShell` needed to properly fill the viewport and let only its item grid and cart list scroll internally.

## [2.31.0] - 2026-08-08 · feat

- **Redesigned the printed thermal receipt and fixed a real cropping bug.** `buildEscPos()`'s store name was hard-truncated with `.substring(0, 16)` regardless of paper width — a store named "TAHOMA CAFE & EATERY" printed as "TAHOMA CAFE & EA", cutting off mid-word. The same truncation hit item names and order notes. Replaced with a proper `wrapText()` word-wrapper everywhere free text is printed, so long content wraps onto extra lines instead of silently disappearing. Also widened the paper feed before the cut command and added an explicit tear-guide line — thin feed was letting consecutive orders visually run into each other on cutter-less printers.
  - Receipt layout now includes a tagline/address/contact block, a labeled bill-info block (`No. Bill` / `Tanggal` / `Kasir` / `Meja`), an `ITEM QTY TOTAL` header, and — previously missing entirely — tax and service-charge line items (`cart.tax`/`cart.serviceCharge` were computed but never passed into the receipt).
  - Added real 58mm/80mm paper-width support: a `paperWidth` toggle in the printer settings popover, persisted alongside auto-print, now actually threads through to `ReceiptData.width` (previously the type supported 48 cols but nothing in the app ever set it).
- **Added a Receipt & WhatsApp settings card** (Profile page) with an editable footer message, Facebook handle, social-links visibility, and a live receipt preview — reusing Instagram/TikTok/tagline from the store's Storefront where one exists, so there's no duplicate data entry for a cash-only store.
- **Automated customer-facing digital receipts.** New public, unauthenticated `/r/[orderId]` page (works for both storefront and walk-in POS orders) renders the same receipt data as a shareable, printable page. Once an order's payment is confirmed and a customer phone number is on file, a WhatsApp message with the receipt link now sends automatically (Fonnte) — gated by a per-store on/off toggle. Every send attempt is logged (`OrderReceiptSend`) and surfaced as a "View Receipt" / "Send via WhatsApp" action with sent/failed status in both POS order history and the storefront's own order-status page, with a manual resend option.

## [2.30.0] - 2026-08-08 · fix

- **Fixed a currency-conversion bug that mis-priced menu items and revenue figures for every non-IDR store** — surfaced as a EUR store's ~€1 product showing as "€20,833.33" in the POS menu. Root cause: `Product`/`Material` costs are stored in IDR (the platform's base currency) everywhere, but several code paths copied that raw IDR number directly into places that must hold a *literal* value in the store owner's own currency, without converting first.
  - **Menu sync**: `autoLinkProductToMenu` (auto-add on product create/import) and `updateProduct`'s menu-item sync now convert a linked product's price into the owner's currency before writing `MenuItem.price`, via new `storefrontService.convertBaseCurrencyToOwner`/`convertBaseToOwnerSync` helpers. The client-side "Add to Menu" hooks (single and bulk) do the same via `useCurrency().convertPrice()`.
  - **Root race condition**: `getStorefrontByStoreId`'s auto-create was find-then-create, so two near-simultaneous product creations could both pass the check and race to create a store's first `Storefront` row — the loser's error was silently swallowed, leaving that product's menu item never created. Switched to an atomic `upsert` on `storeId`.
  - **Data backfill**: corrected 31 already-corrupted `MenuItem.price` rows across 4 stores where the stored price was an exact, unconverted copy of the linked product's IDR value — the unambiguous signature of this bug. One item with a non-matching price was left untouched rather than guessed at, in case it was a genuine manual override.
  - **Smart Import / CSV import** never converted `Product.costPrice`/`sellingPrice`/`Material.unitCost` either, storing an imported row's price as a raw literal — now converted via a new `convertOwnerToBaseSync` helper (mirrors the Add/Edit Product form's existing `convertToBase` behavior), fetching the exchange rate once per import batch rather than per row.
  - **Finance reports mixed currencies in the same subtraction**: `grossProfit = revenue - cogs` (and `netProfit`) combined a literal-currency `revenue` (from `Order.total`) with a genuinely-IDR `cogs`/`wasteLoss` (from `Material.unitCost`/`WasteEntry`) without converting the latter first — wrong for any non-IDR store. Fixed in `/api/stores/[id]/finance/summary`, `/api/owner/summary`, `/api/stores/[id]/finance/by-item-margin`, and the finance print page (which independently re-runs the same queries). The print page also read the wrong currency (`Business.currency`, a legacy field nothing keeps in sync) instead of the live `User.currency`.
  - **Dashboard revenue displays wrongly re-converted already-correct figures**: `unpaid-orders-card.tsx`, `new-orders-card.tsx`, `analytics-section.tsx`, `owner-dashboard-client.tsx`, and `finance-client.tsx`/`finance-print-view.tsx` (partially) called the currency hook's default `formatPrice()` on `Order.total`-derived money, which assumes an IDR source and converts — for a non-IDR store this silently shrank revenue by the exchange-rate factor. All now shadow `formatPrice` to skip the conversion for order-derived figures, while genuinely-IDR figures (waste-entry cost snapshots) keep the real conversion — split per field, verified against each field's actual source.

## [2.29.0] - 2026-08-08 · feat

- **Finance Reports overhaul: fixed a silent-failure bug, and shipped discount/refund tracking, four new report types, and a multi-outlet P&L rollup.** Root cause of "the margin/loss cards are gone": the KPI grid and every report tab rendered `{data && (...)}` with no error branch — a failed or slow query didn't show an error, it just silently disappeared. Every tab now shows an explicit loading skeleton or a retryable error state instead.
  - **Discounts**: POS cashiers can apply a flat discount (amount + optional reason) from the cart footer; discount reduces the item total before tax/service-charge are computed (correct in both tax-inclusive and tax-exclusive modes), frozen onto `Order.discountAmount`/`discountReason`, shown on the receipt.
  - **Refunds**: a new staff-initiated "Issue Refund" action on POS order history — supports repeat partial refunds against one order, clamped to the remaining refundable total, does **not** reverse stock (a refund isn't food coming back into inventory).
  - **Frozen per-sale cost snapshot**: `OrderItem.unitCostSnapshot` is now stamped at the moment stock is deducted (from `Product.costPrice`, the same figure already shown on the Products page), enabling the new per-item margin report without re-deriving cost from raw ingredient prices.
  - **New report tabs**: P&L Statement (Gross Revenue → Discounts → Net Sales → Refunds → COGS → Gross Profit → Waste/Fees → Net Profit, with "compare to previous period" deltas), Payment Method Breakdown, Menu Item / Recipe Margin (items missing a cost snapshot show "—", never a silently-wrong number), and Cash Drawer Reconciliation (flags a closed shift whose drawer didn't balance).
  - **Filters**: new Channel and Payment Method filters threaded through every report route; the whole filter set (date range, staff, category, department, channel, payment method, compare-previous) now syncs to the URL, so a filtered view is shareable/bookmarkable.
  - **Multi-outlet rollup** (`/owner`, Enterprise): now shows COGS, gross profit, and margin per store and rolled up — previously revenue-only. Also fixed it re-deriving plan-tier ordering locally instead of using the shared `planHasFeature()` gate every other route uses.
  - Known scope for a follow-up: aggregator settlement-CSV reconciliation (matching GoFood/GrabFood/ShopeeFood payout CSVs against parsed orders) was investigated but not built — it needs a mostly-separate import pipeline, not a quick extension of the existing Smart Import flow. True multi-select filters and a numeric revenue-threshold filter were also deferred as lower-value polish.

## [2.28.0] - 2026-08-08 · feat

- **Bulk "Add to Menu" on the Products list**, and a fix for products that silently never made it into the POS menu. Selecting products in bulk-select mode now shows an "Add to Menu (N)" button alongside bulk delete — it skips products already linked, resolves each distinct category once up front (so a batch sharing a category doesn't race and create duplicates), then links the rest in parallel and reports a single summary toast. Root-caused the underlying sync gap: a new store's first-ever storefront record was created via a find-then-create check that two near-simultaneous product creations could both pass, so the loser's `create` threw a unique-constraint error that was silently swallowed — that product's menu item was just never made, with no visible failure anywhere. `getStorefrontByStoreId` now upserts on `storeId` instead, so the second caller becomes a no-op update rather than a failed create. The new bulk action doubles as the recovery tool for any product that still falls out of sync for other reasons — select it and re-add.
- **The Data page (Raw Materials / Recipes / Products / Suppliers) now remembers where you left off**, matching the pattern already used on Stock/History. The active tab persists to `localStorage` and syncs to a `?tab=` URL param (deep-linkable, wins over the saved value); each tab's own filter/sort selections (category, department, stock status, sort order, page size) persist the same way, scoped per store. Free-text search and pagination position are deliberately excluded so a reload never lands on stale search text or an out-of-range page.

## [2.27.0] - 2026-08-08 · fix

- **Fixed a hydration-breaking bug on the Work Schedule page**: the staff/shift-block filter popovers and the "Apply Template" staff checklist both nested a `<Checkbox>` (which renders as `<button role="checkbox">`) inside an outer `<button>` — invalid HTML that broke hydration and left the filter dropdowns non-functional. Both now use a `role="button"` div with keyboard support instead.
- **Dates now render in the user's selected language everywhere, not just translated UI text around them.** Found the root cause: two competing date-formatting utilities existed (`lib/utils/formatting.ts`, locale-aware but silently defaulting to English whenever a caller forgot to pass a locale — which was almost every caller; and `lib/utils/format-date.ts`, hardcoded to `en-GB` with no locale concept at all), plus ~15 files calling `.toLocaleDateString()`/`.toLocaleString()`/`.toLocaleTimeString()` directly with a hardcoded or omitted locale, plus every one of the ~29 calendar popups across the app never passing a `locale` to the shared `<Calendar>` primitive (so month/weekday names always showed in English regardless of app language).
  - `useI18n()` now returns locale-bound `formatDate`/`formatDateTime`/`formatDateOnly`/`formatTimeOnly`/`formatRelativeTime` helpers, plus `dateLocale` (a `date-fns` locale object) and `intlLocale` (an `Intl` tag) for call sites that need to invoke `date-fns`/`Intl` directly — one correct path, can't forget to thread the locale through again.
  - Migrated every component that imported date formatters from either utility module onto the new bound helpers; deleted `lib/utils/format-date.ts` entirely.
  - Added `locale={dateLocale}` to every real calendar-popup usage across the app (expiration dates, delivery/received dates, production scheduling, the Schedule range picker, etc.).
  - Fixed the Work Schedule page's raw `"2026-08-10 – 2026-08-24"` range header (was plain string interpolation of ISO date keys, never formatted at all) and its Log & History timestamps (were defaulting to English).
  - Left untouched, deliberately: the internal admin panel (no i18n system — English-only by design, not a merchant-facing surface); transactional emails and the notifications-bell API (both are hardcoded-English *entire messages*, not just a date fragment — fixing only the date would read even more inconsistently, so this is flagged as a separate follow-up rather than papered over); and one storefront line that uses `.toLocaleDateString("en-US", { weekday: "long" })` purely as an internal data-lookup key against English-keyed opening-hours data, not as display text.

## [2.26.1] - 2026-08-08 · infra

- **Two dashboard pages (Finance Reports, Dashboard Analytics) were eagerly bundling the `xlsx` library just for an "Export as Excel" button.** Every other export surface in the app already dynamically `import()`s `xlsx`/`jspdf` on click rather than on page load (see `src/lib/utils/export.ts`); these two hand-rolled exports had drifted from that pattern. Switched both to a dynamic import, matching the rest of the codebase — trims unnecessary JS off the initial bundle for two pages every merchant hits regularly, no behavior change.

## [2.26.0] - 2026-08-08 · feat

- **Management is now a Stock-focused page; Alerts is signal-only.** Management's five tabs (Deliveries, Production, a mislabeled "History" that was actually production-batch history, Stock, Movements) are down to two: **Stock** and **History**. Stock now covers the full lifecycle — a live per-item stock-reduction bar (Progress component, colored by severity, realtime via the existing `STOCK_CHANGED` channel), a new editable expiration date per material (single field, not per-batch/lot), waste/condition recording (existing `WasteEntry` reasons, now front-and-center), search/status/category/expiration filters with click-to-sort, and a "Reorder & Deliveries" sub-tab that absorbs the old Deliveries tab's PLACED→RECEIVED tracking plus Alerts' former "Create Order"/"Bulk Order" dialogs and "Orders to Place" view. History is the renamed Movements tab (the real stock-change ledger) with an added date-range filter and sort. Alerts drops the `?view=orders` toggle entirely — it's just the low-stock table and unpaid-orders card now, and its supplier action buttons deep-link into Management's Stock tab (`?tab=stock&highlight=<materialId>` or `&supplierId=<id>`), which auto-opens the matching reorder dialog on arrival.
- **Send a supplier order's PDF detail directly from the Stock tab** — by email (Resend, as an attachment) or WhatsApp (Fonnte, as a document link), pick one or both. A local-download alternative uses a new dedicated print page (`/management/print`, `window.print()` → Save as PDF) following the same pattern already established by `pos/orders/print`/`attendance/print`, replacing the older jsPDF-dialog download this superseded.
- **New optional Production page** (`/production`), off by default per store. Recipe-to-batch production (the old Production + Production History tabs, moved wholesale into a new `production` feature) is a distinct manufacturing workflow that not every merchant needs — many cook fresh to order with no fixed recipe. The page shows a guide explaining what it's for before the owner opts in via a toggle; enabling reveals the moved Produce/History sub-tabs.
- **Filters and the active tab are now remembered per device.** Stock, History, and the Management tab bar all persist their last state to `localStorage` (reusing/relocating the POS feature's existing `usePersistedState` hook to `src/lib/hooks/`, now shared instead of POS-only) — returning to the page lands back where you left it. Deep-link URL params always win over the saved state.
- New shared `FilterBar` component (search + filter controls + clear button) factored out for Stock/History to share instead of each hand-building its own layout.

## [2.25.0] - 2026-08-08 · feat

- **Work Schedule: a custom-range roster grid, filters, and a bulk "Apply Template" action.** The Block Name field in Manage Shift Blocks now shows a "e.g. Morning Shift" placeholder. The roster grid gained a staff filter and a shift-block filter (both above the table) — the staff filter narrows which rows show, the block filter dims/excludes non-matching entries within a row while keeping every staff row visible, since the point of "who's on Morning this week" is seeing who's *not* on it too; day-off entries stay visible under a block filter since they're informative, not noise. The fixed Mon–Sun week is now a picker built on the shared `DateRangeField` (the same range calendar used elsewhere in the app), constrained to a 7-day minimum so it can't shrink below a normal roster cycle — the grid's day columns, and its width, now track exactly the chosen range instead of always rendering 7. Prev/next now pages by the current range's length, and "Today" resets to the default Mon–Sun week. Both filters persist across range navigation on purpose (a manager filtering to one block or person is usually paging through several ranges with that same lens). Also added an "Apply Template" dialog next to Manage Shift Blocks: pick one shift block, check staff (default none, "Select all" shortcut) and days of the visible range (default weekdays), and Save creates every resulting roster entry in one go via the existing-but-previously-unused `POST /staff-schedules/bulk` endpoint, chunked at 200 entries per request to stay under its validation cap. Staff/day pairs that already have an entry that day are skipped rather than duplicated, and the result toast reports how many were applied vs. already scheduled. Previously every cell had to be assigned one at a time via the single-cell dialog. Bulk-applied entries land as Draft like any manually-created entry and still need Publish.
- **Fixed the "standard work minutes per day" field rendering as a 12-hour clock picker (e.g. "08.00 AM").** It's a duration (how many hours count as a normal day, for the overtime split), not a time of day — the AM/PM suffix implied a shift start time that didn't exist. Replaced with a plain hours + minutes counter (e.g. "8 h 0 m"), matching the "Xh Ym" format already used for the Regular/Overtime columns in the same table.

## [2.24.1] - 2026-08-08 · fix

- **Subscription plan price was hardcoded in Rupiah, ignoring the owner's chosen display currency — and stale against the public /pricing page besides.** The in-app Billing page and the Profile page's Subscription card both showed a static `Rp 99.000`/`Rp 249.000` string for the POS/Operations plan regardless of locale or the account's `currency` setting — a USD-currency owner on the French UI saw "Rp 249.000/mois". Both surfaces now derive the price from the plan's IDR base rate through the same live exchange-rate conversion (`useCurrency().formatPrice`) already used everywhere else in the dashboard, so it renders correctly in whichever of the ~140 supported currencies the owner has selected. The Profile card previously supported only IDR/USD/EUR/MGA and silently fell back to Rupiah for every other currency; it now works for all of them. The base itself was also wrong: `Rp 99.000`/`Rp 249.000` predates a price raise applied to the public `/pricing` page (now Rp 229k/Rp 459k, i.e. $14.99/$29.99) — the Billing/Profile surfaces were never updated when that raise shipped. Both now use the same Rp 229.000/Rp 459.000 base as `/pricing`. Removed the now-dead hardcoded `Rp .../month` translation strings and the finite `PLAN_PRICES` currency lookup table that caused this. Also found and fixed the same staleness on the actual `/payments` checkout summary: `id.ts`/`fr.ts`'s `pricing.plans.starter/pro.price` (read by `payment-summary.tsx`) still quoted the old Rp 99.000/249.000 and 9,99 €/24,99 € — a checkout screen showing a different price than the pricing page just clicked from. Corrected to match `/pricing`'s Rp 229.000/459.000 and 13,99 €/27,99 €.

## [2.24.0] - 2026-08-08 · fix

- **Every image upload now guarantees a compressed output instead of trusting the client.** Added a server-side compression pass (`compressImageServer`, using `sharp`) inside `/api/upload`: every accepted image is resized to at most 1600px on its longest edge and re-encoded until it's at or under a target size (2MB by default; a feature can request a larger target, e.g. the storefront cover banner's 5MB, via a `maxSizeMB` form field, clamped server-side to a safe range). This is now the authoritative guarantee — client-side compression (`compressImage()`) remains a bandwidth/UX optimization on top of it, not the only enforcement point.
- **Fixed a real bug**: the shared `<ImageUpload>` component (used for storefront logo, cover banner, and menu item photos) rejected the *raw* selected file against the feature's target size (e.g. "must be under 2MB" for a logo) *before* attempting compression — so a normal 3–4MB smartphone photo was rejected outright even though compression would have shrunk it comfortably under the limit. Raw files are now checked only against a generous processing-cost ceiling (5MB); the target size is what compression aims for, not a rejection threshold.
- **Attendance selfie capture had no compression or validation at all** (`selfie-capture.tsx` + `clock-in-out-dialog.tsx`) — camera captures and the file-picker fallback now run through `compressImage()` before upload, same as every other image surface.
- Centralized the size/dimension rule in `src/lib/constants/image.ts`, shared by both the client util and the new server util, so the two layers can't drift apart. Documented the rule in `AGENTS.md` ("Images" under Coding rules) so future image-upload features follow the same pipeline instead of reinventing size limits.

## [2.23.0] - 2026-08-07 · ux

- **Logout consolidated into one menu, for both personas — not scattered across a standalone topbar button and a PIN-based switcher.** While acting as a staff persona, the account dropdown previously had no logout option at all — the topbar's real "Logout" button hid itself in that state (it signs the underlying owner account out entirely, which a cashier shouldn't casually trigger), and "Back to Owner Account" is a PIN-gated switch, not a logout. The standalone topbar Logout button is gone; every logout-shaped action now lives in the one account dropdown, for Owner and staff alike:
  - **"Log Out of Staff Session"** (staff only) — no owner PIN needed, clears just this device's staff persona and drops back to the same "who's using this device?" picker `StoreAccessGate` already shows.
  - **"Switch Account"** (Owner only) — replaces the old in-dropdown "Switch to Staff Account" PIN-pad (and the `StaffSwitcherDialog` it opened, now removed as dead code); does the same picker-drop as staff's logout above, so picking a different persona always goes through the one canonical `StoreAccessGate` screen instead of a separate shortcut with its own PIN flow.
  - **"Log Out of Owner Account"** (always shown, styled distinctly) — the heavy action: signs out of the real Epidom account and returns to `/login`. Same `signOut()` the topbar's button used to call directly.
- **Zero-staff stores skip the picker entirely.** `StoreAccessGate` (and `/pos`'s own gate, kept consistent with it) now also bypasses when a store has no active non-owner staff members — with nobody else to choose from, the "who's using this device?" screen had nothing real to offer and was just an always-the-same-answer click every time a solo-operator store (on OPERATIONS+, past the FREE/POS bypass) was opened from `/stores`.

## [2.22.0] - 2026-08-07 · feat

- **OS-level Web Push notifications — new storefront orders and low/critical stock now alert even when the tab is closed or the screen is off.** New optional `VAPID_*` env vars enable real browser/OS push (standard Push API, not Firebase) delivered through the existing PWA service worker. A new toggle in the `NotificationBell` popover ("Enable"/"Disable") lets any device — owner or staff persona — subscribe; delivery fans out per-store to every subscribed device, since a shared shop device operated via staff PIN carries no independent `User.id` to key against. Dead subscriptions (expired/unsubscribed — common on iOS Safari, which rotates these more aggressively than Chrome) are cleaned up automatically on the next failed send (404/410).
- **Storefront orders now also live-update open dashboards.** Fixed an adjacent gap found while wiring this up: `POST /api/public/orders` never called the existing Pusher `publishStoreEvent(ORDER_CREATED)` that the POS order route already fires — a storefront order previously only reached an open dashboard tab on its next 30s notification-bell poll. Both routes now match.
- **Fixed: `/sw.js` and the PWA manifest were unreachable for anyone without a login session.** `src/proxy.ts`'s auth matcher excluded `favicon.ico` and image extensions from the login redirect, but not `sw.js`/`manifest.webmanifest` — so any first-time visitor to the public storefront (never logged in) got an HTML login-redirect page back instead of the actual service worker file, silently breaking PWA install/offline support and, now, push registration for that entire audience. Found by testing this feature live against a running server, not just via type-check. Logged-in dashboard users were unaffected (they always carry a session cookie).
- **Graceful degradation, same pattern as the rest of the realtime layer:** until an operator sets `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`/`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, the push toggle stays hidden entirely and nothing changes — same "no-op, fall back to polling" contract as `publishStoreEvent()`.
- **Cross-device/browser handling:** iOS Safari requires the site to be added to the Home Screen (iOS 16.4+) — the toggle shows an explicit "Add to Home Screen" hint there instead of a dead-end "unsupported" state, since Apple gates the whole Push API behind standalone install. A previously-denied browser permission is surfaced as its own "blocked" state (browsers never re-prompt after denial) rather than a retry button that would silently no-op.
- New `src/lib/push/` (VAPID-configured send helper, mirrors `src/lib/realtime/publish.ts`'s graceful-degradation pattern), `src/hooks/use-push-notifications.ts`, `PushSubscription` table, and `push`/`notificationclick` listeners in `public/sw.js`.

## [2.21.0] - 2026-08-07 · feat

- **Shifts, Schedule, and Attendance merged into one page.** `/shifts` (till cash sessions) and `/attendance` (clock-in/out audit log) were separate nav items with no owner-vs-staff view split — a staff member granted either page saw the same full manager table an owner would, and by default couldn't reach either at all. Both are now folded into `/schedule`, which already split by role: the manager view gains a **Log & History** section merging clock events and till cash open/close (shown as Cash In/Out) into one chronological, filterable-by-staff/type/date-range timeline; the staff view gains **Clock In/Out** on every staff member's page, plus **Cash In/Out** for POS-capable roles (Cashier, Owner/Manager) only, plus a self-service **My History**. `/shifts` and `/attendance` now redirect to `/schedule` rather than dead-ending old links. No schema change — `Shift` and `AttendanceRecord` stay two separate, independently-audited tables; only the UI merged, via a new `fetchUnifiedLog()`/`mergeUnifiedLog()` (the latter pure and unit-tested) reused by the new Log tab, the staff History section, and the existing attendance PDF export (which now includes Cash In/Out rows too).
- **Roster: one Publish button, not two.** "Publish Week" and "Print / Export PDF" collapse into a single dynamic action — "Publish Week" while the visible week has any draft entry, "Published" (muted, still clickable) once every entry is published, and clicking it in that state opens the PDF export instead of re-publishing. The week grid's day headers also show the weekday name (Mon, Tue, …), not just the date.
- **No more double PIN, extended to till cash too.** Following up on the clock-in/out PIN dedup shipped earlier this session, opening a till (`POST /stores/[id]/shifts`) now also accepts an already-active StaffSession as proof instead of always re-asking for the PIN.
- **"Clock In / Out" removed from the account dropdown** (now lives on the Schedule page) — replaced with **"Account Access"**, a small dialog showing which persona is signed in on this device and exactly which pages it can reach. Built as a dialog rather than a Profile page section: `/profile` is hard-gated owner-only, so a staff persona could never have reached a card placed there.

## [2.20.0] - 2026-08-07 · feat

- **Live push layer (Pusher Channels) — orders, menu, materials, products, recipes, and stock now update across tabs/devices without waiting for the next poll.** Every write that matters (POS order create/status-change/finalize, material/product/recipe create/update/delete, stock adjustments and sale deductions) now fires a lightweight `{action, entityId}` event on the store's private channel via a new non-blocking `publishStoreEvent()` helper; the affected list/query on any other connected tab or device invalidates and refetches immediately instead of waiting up to 5–10s for its existing poll tick. The old aggressive polling intervals are left in place as the fallback, unchanged — this is additive, not a replacement.
- **Presence.** New `<PresenceAvatars>` component + `useStorePresence()` hook show who else is currently connected to a store (owner or PIN-logged-in staff) via a Pusher presence channel — an initials avatar stack with name tooltips, renders nothing when nobody else is online.
- **Graceful degradation by design (AGENTS.md §6):** none of this requires setup to keep working. Until the operator sets `PUSHER_APP_ID`/`PUSHER_KEY`/`PUSHER_SECRET`/`PUSHER_CLUSTER` (see `.env.example`), `publishStoreEvent()` silently no-ops and every surface behaves exactly as before — polling only, no live push, no presence. The one exception is the POS order queue, which already had a custom SSE endpoint (`orders/stream`) for this; it now prefers Pusher when configured and falls back to that existing SSE mechanism unchanged when it isn't, rather than running both at once.
- New `src/lib/realtime/` (channel/event naming, server + client Pusher singletons, the publish helper) and `POST /api/pusher/auth` (channel authorization — accepts either an owner/manager session or an active staff PIN session, matching the existing dual-auth pattern already used by staff-gated POS routes).

### Known v1 limitations
- Menu-item-level push coverage is partial: a product's price/name/department change publishes `menu.changed` (since that syncs to its linked `MenuItem`), but direct storefront/menu-editor CRUD on `MenuItem` (add/remove/reorder categories and items outside of a linked product) doesn't publish yet — POS menu still catches those via its existing 5s poll, just not instantly. Full storefront-item-level coverage is a follow-up.
- No presence beyond "who's connected" — no live cursors, no per-field "someone else is editing this record right now" indicator, no conflict resolution for two people editing the same record at once (still last-write-wins). True field-level collaborative editing (the deeper Notion/Figma comparison) is out of scope for this pass.
- Only the six domains above publish events. Tables, reservations, supplier orders, alerts, schedule, finance, and admin dashboard remain poll-only for now — next in line by current poll aggressiveness (10–60s tier).

## [2.19.0] - 2026-08-07 · feat

- **Store access gate: pick Owner or Staff before the dashboard, not just before POS.** New `StoreAccessGate`, generalized from the existing POS staff picker, now wraps the entire `(dashboard)` route group — not just `/pos` — so a shared/unlocked device shows a "who's using this device?" checkpoint before any page renders, dashboard-wide. Picking a staff member reuses the same PIN as everywhere else; picking "Continue as Owner" now requires the separate Owner PIN (prompting to set one first if none exists yet) instead of trusting an already-open Better Auth session, since that session is exactly what a shared device leaves sitting unlocked. Skipped entirely on FREE/POS plans (no staff feature to gate). Once chosen, the same `usePosSession` state POS itself reads means `/pos` won't ask again on top of this.
- **Fixed: "Continue as Owner" didn't clear a leftover staff session.** Both the new gate and the existing POS gate's "Continue as Owner" only updated client-side state — a StaffSession cookie left over from an earlier persona (or another tab) would still be read by the server-side owner-only-page guard and bounce the request right back out. Both now clear it first (same call the existing "switch back to Owner" flow already made).
- **Clock-in/out: no more double PIN.** A PIN is meant to prove identity once, at login — if a device is already operating as a specific staff persona (via the gate above or "Switch to Staff Account"), the Clock In/Out dialog now skips straight to picking clock-in/out for them instead of asking to re-select their name and re-enter their PIN. The kiosk-style "pick anyone, enter their PIN" flow is unchanged for devices with no active persona. Enforced server-side too: clock-in/clock-out/absence now accept an active StaffSession as proof (new `isStaffAuthenticated()` helper), not just a submitted PIN.
- **POS: periodic PIN re-verification.** Because POS handles cash, a staff PIN there now expires after 4 hours of continuous use and re-prompts for the same PIN (not a full re-pick) — separate from, and on top of, the once-a-day session everywhere else. Doesn't apply to the Owner persona.
- **Clock-in/out: history log + photo retake.** The dialog now has a read-only history view of a staff member's own recent clock-in/out/absence records (timestamp, selfie thumbnail, location). Nothing in it is editable except the photo, and only within 30 minutes of the original capture — a retake replaces the selfie on that same record (via a new `POST .../[attendanceId]/retake-photo`, itself PIN/session-checked and window-checked) rather than creating a new entry, so a blurry first shot doesn't leave a duplicate in the log. Everything else about a record (type, timestamp, notes) stays immutable, same append-only-audit-trail principle as the existing manual-close correction flow.
- **Selfie capture: hardened for desktop and non-mobile browsers.** Distinguishes camera-permission-denied, no-camera-found, and insecure-context (non-HTTPS/non-localhost) failures with a specific message for each instead of one generic one, and adds a "Try again" retry button so granting the permission via the browser's own UI doesn't require closing and reopening the whole dialog. The `facingMode: "user"` constraint was already a soft/"ideal" hint (works on desktop webcams that don't report a front-facing camera), and the file-input fallback already degrades correctly to a normal file picker on desktop — this pass is about clearer failure states and recovery, not a new capture pipeline.

## [2.17.3] - 2026-08-06 · fix

- **Pricing page now matches what's actually shipped.** Audited every feature claim on `/pricing` (tier cards + the detailed comparison table) against real plan gates in the code. Removed five claims that don't exist in the product (a daily P&L email, allergen/nutrition labels, a wholesale order portal, SSO, and a public API/Zapier/webhooks integration) and fixed a self-contradiction where the Operations card advertised a "multi-outlet dashboard" while the comparison table marked the same thing Enterprise-only — both were partly right: Operations gets unlimited outlets, but the cross-store owner roll-up dashboard (`/owner`) is genuinely Enterprise-exclusive; copy now says so distinctly instead of using the same ambiguous label for both. Added the three real, previously-unadvertised Operations-tier features shipped this week — shift scheduling & rosters, selfie + geolocation attendance, and waste/loss tracking — plus a reservations mention on the POS tier. Removed four dead, never-rendered i18n feature strings left over from an earlier card layout.

## [2.17.2] - 2026-08-06 · ux

- **One integrated date-range picker, everywhere.** Every date-range filter across the dashboard — Finance, Dashboard Analytics, Attendance, Owner Dashboard, and POS Order History — now opens the same single calendar popover (`DateRangeField`) instead of a pair of separate From/To date inputs. Quick-pick shortcuts (Today, Yesterday, Last 7/30 Days, This Month) live in the same popover rather than a second dropdown next to the inputs, so picking a range is one click into one control instead of juggling three. POS Order History keeps its own outer preset selector (with its wider "All time"/"Last month" options) and uses the new picker just for its "Custom" calendar step. Removed the now-redundant `DateRangeLabel` component.

## [2.17.1] - 2026-08-06 · ux

- **Schedule: "Today" shortcut, day-off marking, and a print/PDF export.** The week grid now has a one-click jump back to the current week, a "Mark Day Off" toggle per staff/day (shown distinctly from a working shift in the grid and in staff's own "My Schedule" view), and clicking a date header opens a day-at-a-glance detail view. Publishing a week now also opens a printable roster (branded with the same Epidom header/watermark/footer as other reports) — "printing" is how the exported PDF is produced (browser Print → Save as PDF), matching the existing Order History report's pattern rather than a separate one-off PDF pipeline.
- **Attendance: date-range presets and a print/PDF export.** The From/To inputs are replaced with the same integrated calendar-and-presets picker (Today, Yesterday, Last 7/30/90 Days, This Month, This Year, or a custom range) used on the Finance report, plus a "Print / Export PDF" action that exports whichever tab (Log or Hours & Overtime) is currently open.
- **Fixed: "pages.noData" showing as literal text instead of translated copy** on the Attendance page — the key existed nested under `pages.analytics.noData`, not at the top level `pages.noData` the new page actually called; added the missing top-level key to both `id.ts` and `en.ts` and audited every other new i18n key introduced by the staff-scheduling/attendance feature against both locale files (all resolve correctly now).
- **Overtime threshold is now a time input, not raw minutes.** "Standard work minutes per day" was a plain number field requiring mental math (e.g. typing "480" for 8 hours) — now an `HH:mm` time picker, converted to minutes only at the API boundary.
- New `StaffSchedule.isDayOff` field (migration `20260805230007_add_staff_schedule_day_off`), mutually exclusive with the existing named-block/custom-time choice (enforced in Zod).

## [2.17.0] - 2026-08-06 · feat

- **Order-linked production.** When a Kitchen & Bar order needs more of a recipe-linked product than is currently sitting on hand, the system now auto-drafts a production task the moment the order enters the kitchen queue — visible on the KDS board with a "making" indicator on that ticket — instead of running as a disconnected, staff-triggered-only workflow. Tapping the item to Ready on KDS completes that task in the same action; no separate "go complete the batch" step.
- **Management's Production History now shows where each batch came from** — a "Manual" badge for the existing proactive/ahead-of-demand flow (unchanged), or "From Order #…" for one auto-drafted by a live order, with the linked order number for traceability.
- Known v1 limitations: one auto-drafted batch per shortfall-triggering order — near-simultaneous orders for the same out-of-stock product each get their own batch rather than being consolidated (batch sprawl during a rush is possible); order cancellation doesn't currently auto-cancel a still-open linked batch; only the primary order-confirmation paths (POS cash/pay-later, POS finalize, and Xendit online payment) trigger the auto-draft — aggregator-imported orders and other less common entry points don't yet.

## [2.16.0] - 2026-08-05 · feat

- **Staff Scheduling.** Managers can build and publish weekly work rosters from a new `/schedule` page — pick from reusable named shift blocks (e.g. "Shift 1" 08:00–16:00) or set a custom time per staff member per day, tag a Kitchen/Bar/Both department, and publish a week in one action. Staff (Cashier/Kitchen roles) see a read-only "My Schedule" list of their own upcoming published shifts.
- **Selfie + Geolocation Attendance.** A new "Clock In / Out" action in the account menu (available to every staff persona, regardless of page permissions) captures a front-camera selfie and best-effort GPS location before recording a clock-in, clock-out, or absence report — falls back to the device's native camera picker if `getUserMedia` is unavailable, and never blocks the action if location permission is denied. Managers get a filterable audit trail (by staff and date range) on a new `/attendance` page, with each entry's selfie thumbnail and a "view on Google Maps" link (no embedded map — see AGENTS.md's no-maps-library rule).
- **Automatic Working Hours & Overtime.** The Attendance page's "Hours & Overtime" tab pairs clock-in/out events into completed workdays (correctly attributing a shift that crosses midnight to the day it started) and splits worked minutes into regular vs. overtime against a configurable per-store daily threshold (default 8h). A stuck clock-in (forgotten clock-out) is flagged rather than guessed at, with a manager "close manually" recovery action that appends a correction record instead of editing history.
- **Shift-Block Revenue Report.** A new "By Shift Block" tab on the Finance report sums revenue/order-count per named shift block per day, plus who was rostered on. Named blocks can deliberately overlap (staggered handover coverage), so this is a coverage-window report, not a partition — the UI explicitly discloses that totals across blocks aren't expected to sum to the grand total.
- Known v1 limitations (see `docs/roadmap.md`): the overtime threshold is a single flat per-store value (no per-role/per-shift override); true order-level "who processed this sale" attribution only exists for cashiers via the existing POS till session (`/finance/by-shift?staffId=`) — for every other role, the new report shows "who was rostered on" as context, not a claim of who rang up a given order.

## [2.15.0] - 2026-08-05 · feat

- **Waste Management.** Record wasted Materials or Products from Management → Edit Stock ("Record Waste") with a predefined reason (Expired, Damaged, Spoiled, Overproduction, Quality Control) or a custom free-text reason — each entry snapshots the item's cost and stores a computed loss value, and deducts current stock the same way a stock adjustment does.
- **Waste loss is now trackable on the Finance report.** A new "Waste Loss" KPI card (and, alongside it, a "Net Profit" card that already existed in the export but had no card) shows the period's total loss, which now also reduces Net Profit. A new "Waste" tab lists every entry with a by-reason breakdown, and included in the Excel export.
- **Waste entries are correctable for any condition.** Editing an entry (from the Finance Waste tab) reconciles current stock by appending a compensating movement rather than rewriting history, and an "Advanced" override lets a manager correct the recorded unit cost itself; deleting an entry restores the stock it had consumed.
- **Fixed: stock adjustments for Products silently failed.** The "Adjust Stock" dialog has offered a "Product" option since it shipped, but the backend rejected it with "Product stock adjustment not yet implemented." Product stock adjustments (and the new waste feature) now work for both Materials and Products.

## [2.14.15] - 2026-08-05 · feat

- **Account deletion replaced with deactivation + a 30-day reactivation grace period.** Profile → Account Settings' "Delete Account" is now "Deactivate Account": your data is never touched, and logging back in any time within 30 days offers a one-click "Reactivate My Account" button that instantly restores everything. Your public storefront(s) go offline for as long as the account stays deactivated, and come back automatically on reactivation.
- **1-year data retention with support-assisted recovery.** After the 30-day window, self-service reactivation ends but your data stays on file for up to 12 months — recovering it means contacting support for a case-by-case quoted fee, after which an admin can manually reactivate the account. Past 12 months, a new daily background job permanently and irreversibly purges the account.
- **Admin panel: reactivate deactivated accounts.** The Master Admin Panel now shows a "Deactivated" stat tile and badge per user, plus a "Reactivate Account" row action that works at any point within the 1-year retention window. The existing instant hard-delete action is unchanged.
- **Updated Terms & Conditions and Privacy Policy** with the full deactivation → reactivation → retention → deletion lifecycle, and explicit data-subject rights for France/EU users (GDPR, right to complain to the CNIL) and Indonesian users (UU PDP / Law No. 27 of 2022).
- **Fixed: Privacy Policy required login to view.** `/privacy` was missing from the auth middleware's public-route allowlist, so visitors were redirected to `/login` instead of seeing the policy — defeating the point of a public privacy policy. Added alongside `/terms`.

## [2.14.14] - 2026-08-05 · feat

- **"Mark as Paid" now records how an order was settled.** Every mark-paid action — the Active Queue order card, the Order History detail dialog and its bulk action, and the dashboard's Unpaid Orders alert — now opens a confirmation dialog to pick the payment method actually used (Cash, QRIS, GoPay, OVO, DANA, ShopeePay, Virtual Account, Credit Card) and add an optional note (e.g. "client paid directly to the owner") before settling the order.

## [2.14.13] - 2026-08-05 · feat

- **Enterprise "Custom Development" page.** Under the dashboard's Enterprise section, request a custom feature or website build — describe your requirements, budget, and timeline. Submissions notify the founder/CRO team by email and appear in a new admin triage queue at `/admin/custom-development`. Users can edit or delete their own submitted requests.
- **Admin panel: Custom Development link + pending-request badges.** The Master Admin Panel header now links to the Custom Development queue, and both it and the Feedback button show a live count badge for open/new items awaiting a first look.
- **Consolidated Tracking into Management.** The Tracking page's unique stock-movement ledger is now a "Movements" tab inside Management; its redundant Stock Levels view (already covered by the Data page) was dropped, along with the separate Tracking nav item.
- **Fixed a tracking-page crash** (`Value 'BOTH' not found in enum 'Department'`) caused by an out-of-sync generated Prisma Client after the Material `department` field's `BOTH` option was added.
- Delivery print dialog's "Export PDF" now actually exports a PDF (previously a stub); removed the dead, unreachable "Add Delivery" form mode.
- Stock deduction now skips line items a KDS operator cancelled, so a cancelled item's ingredients/stock are no longer deducted when the rest of the order is delivered.
- Fixed the pricing page's plan cards: CTA buttons, dividers, and feature lists across the four tiers weren't level with each other because the header tagline and price block varied in height per tier — now consistently aligned.

## [2.14.12] - 2026-08-02 · feat

- **Finance reports: filter/breakdown by category, department, and staff shift.** The Finance page now has Staff and Category (menu category) filters, plus new "By Category," "By Shift," and "By Department" report tabs/cards — the last answering "how much did Kitchen sell vs. Bar today." All tables gained sortable column headers.
- **Kitchen/Bar department field**, separate from the existing free-text category, on Raw Materials, Recipes, and Products — filterable and shown as a badge on the Data page, the Menu editor, and a new Kitchen/Bar toggle on the POS item grid. A Product's department automatically syncs to its linked storefront menu item, same as name/price already did.
- **Dashboard: "New Orders" card.** Highlights orders awaiting confirmation (especially storefront orders) right on the dashboard, with a link straight to the Order Queue. Live-updates via the existing order SSE stream.
- **Dashboard & Finance date ranges now show a dynamic label** ("Today," "Last 7 Days," "This Month," etc.) next to the date pickers, and the Dashboard's Analytics section now defaults to today instead of month-to-date.

## [2.14.11] - 2026-08-02 · feat

- **Fees & Taxes settings, per store.** Added a "Fees & Taxes" card to each store's Profile page: a configurable tax rate (with an inclusive/exclusive toggle and custom label, e.g. "PPN 11%"), a separate service charge rate, and a payment-processing fee-rate table per method (QRIS, GoPay, OVO, DANA, ShopeePay, bank transfer, Stripe card), pre-filled with editable estimated default rates so a store gets accurate-ish reports even before touching the settings.
- **Financial calculations and reports now account for fees and taxes.** Tax, service charge, and the estimated payment-processing fee are computed once per order (at POS checkout, hold/finalize, and storefront checkout) and frozen onto the order — so editing a store's rates later never rewrites past reports. The Finance page now shows Tax, Processing Fee, and Net Revenue KPIs, and the per-channel breakdown deducts tax and processing fee alongside aggregator commission; both are included in the Excel export.
- The payment-processing fee is an estimate based on the merchant's configured rate, not a live reconciliation with Xendit/Stripe settlement data — Xendit's webhook payload doesn't carry the actual charged fee in this integration.

## [2.14.10] - 2026-07-31 · ux

- **Fix: "My tickets" crash for NEEDS_REVIEW status.** Accounts with tickets transitioned to `NEEDS_REVIEW` by an admin were experiencing a render crash on the "My tickets" tab. Added the missing status to the frontend `FeedbackStatus` union type, the `STATUS_BADGES` map in the feedback dialog, and added corresponding translations (EN: "Needs review" / ID: "Perlu ditinjau").
- **Storefront settings: real-time auto-save.** All fields in the storefront settings page now auto-save to the database 1.5 seconds after you stop typing. The manual "Save Settings" and "Cancel" buttons have been removed. A subtle "Saving..." / "Store settings saved." indicator appears at the top of the form.
- **QR code dialog: copy link.** The shared QR code dialog (storefront, table QR, etc.) now shows the URL in a read-only input below the QR image, with a one-click copy button that briefly shows a green checkmark on success.

## [2.14.9] - 2026-07-29 · ux

- **Feedback dashboard: ticket detail modal.** Every row/card now has an expand icon (and every board card is clickable) that opens a full-detail modal — user, page, full description, screenshot, dev note, and priority/status editing all in one place, without leaving the list.
- **Clickable status filters.** The 5 summary stat cards (Open / In Progress / Review / Resolved / Archived) now double as filters — click one to narrow the list to that status, click again to clear it.
- **Type filter + search.** Added a Bug/Feature/General type filter and a free-text search box (matches user, description, page, or ID) next to the view switcher.
- **Three layouts: Table / Board / Feed.** Added a view switcher — Table (existing grouped list), Board (Notion-style Kanban columns by status, unaffected by the status filter beyond dimming the other columns so the full picture stays visible), and Feed (flat, newest-first card stream). The chosen view persists across visits via `localStorage`.

## [2.14.8] - 2026-07-29 · feat

- **Staff status management.** The staff edit dialog now has an Active/Inactive control, guarded so the last active staff member or the store Owner can't be deactivated (would lock everyone out). The Owner role itself is locked from being changed and always appears pinned at the top of the list.
- **Role Access Details panel.** The staff edit dialog now shows a reference panel describing exactly what each role (Owner / Manager / Cashier / Kitchen) can access.
- **PIN validation.** The new-PIN field now requires exactly 4 digits before Save is enabled, with an inline error otherwise.
- **Menu item descriptions.** Storefront Editor's Add/Edit item dialogs now have an optional description field (e.g. "orange, jasmine, espresso"); it renders under the item name in both the editor list and the POS product grid.

## [2.14.7] - 2026-07-28 · feat

- **Add Product dialog** now shows a "Link to existing menu item" selector when the store has menu items not yet connected to any inventory product. Selecting one links the new product directly to that existing POS/storefront item instead of auto-creating a duplicate entry. Fully optional — leaving it on "Don't link" continues creating a new menu entry as before.
- Added `?unlinked=true` query param to `GET /api/stores/[id]/storefront/items` to return only menu items with no product association (used by the selector above).

## [2.14.6] - 2026-07-28 · feat

- Added **"Review" status** (`NEEDS_REVIEW`) to the admin feedback tracker, sitting between *In Progress* and *Resolved* (styled purple). Stats card updated to show a 5th column for this status.
- Added **developer notes** to each feedback entry: a private free-text field (saved as `devNote` in the DB) accessible only to admins. Inline pencil-to-edit textarea with save/cancel — visible below the description in both mobile and desktop views. Existing notes render with a violet 👁 badge and remain editable.
- DB migration: `20260728083727_add_feedback_needs_review_and_devnote` — added `devNote String?` to the `feedback` table and `NEEDS_REVIEW` to the `FeedbackStatus` enum.

## [2.14.5] - 2026-07-28 · ux

- Added click-to-copy/bubble-to-copy to feedback description text. Clicking the description text now copies the full feedback text to the clipboard with a visual "Copied!" popover bubble (tooltip) and toast notification. Toggling expansion of long description texts is now handled by clear "Show more" / "Show less" links.

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
