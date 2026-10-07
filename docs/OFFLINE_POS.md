# Offline POS

How Epidom keeps selling without internet, what it promises, what it doesn't,
and what's next. Current as of 3.3.6.

---

## 1. The apps

There is one app, the Next.js web app, delivered three ways. Offline behavior is
the same in all of them, because it's the web app's own.

| Device                     | How it's installed                                                                                            | Where                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Windows / macOS / Linux PC | Desktop installer (`.exe`, `.dmg`, `.AppImage`): a thin Electron shell that opens epidom.fr in its own window | `desktop/` (README there) |
| Android tablet / phone     | Play Store app or a sideloaded `.apk`: a Trusted Web Activity built from the live site                        | `android/README.md`       |
| iPad / iPhone              | Safari → Share → Add to Home Screen (PWA). Apple doesn't accept a site wrapper in the App Store               | —                         |

A desktop or Android install is "installed" for every purpose the web app cares
about: Offline Mode is always on, and Offline & Sync replaces the Install button.
The desktop shell exposes `window.epidomDesktop`; see `src/lib/pwa/desktop-shell.ts`.

Every web deploy reaches all three at once. The packages only need rebuilding to
change a name, icon, start page or signing key.

---

## 2. How offline works

| Piece          | What it does                                                                                                                                                                            | Code                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Service worker | Keeps the page shells and `_next/static` bundles on the device, so screens open with no connection                                                                                      | `public/sw.js`, `src/lib/pwa/offline-status.ts`                                         |
| Data mirror    | TanStack Query cache persisted to IndexedDB for menu, live orders/KDS, staff, schedules, materials, tables and settings; primed by Offline Mode, refreshed on reconnect and by Sync now | `src/lib/pwa/query-persister.ts`, `offline-prefetch-registry.ts`                        |
| Write queues   | Sales, table-status changes and production quick-logs made offline, in IndexedDB                                                                                                        | `src/lib/pwa/offline-queue.ts`, `offline-table-queue.ts`, `offline-production-queue.ts` |
| Replay         | One loop drains all three, oldest first                                                                                                                                                 | `src/lib/pwa/replay-queue.ts`, `src/features/pos/hooks/use-offline-*.ts`                |
| Connectivity   | A real round trip to our own origin about once a second while offline. `navigator.onLine` is only a hint, because it says "online" on wifi whose internet is down                       | `src/lib/pwa/reachability.ts`, `src/hooks/use-network-status.ts`                        |

Sync runs when the probe sees the connection come back, on app launch, and on
**Sync now** (Offline & Sync panel, POS Mode menu, POS offline banner).

---

## 3. A sale's path

**At the till** (`pos-checkout-dialog.tsx`):

1. If the probe or the browser says offline, the sale goes straight to the queue.
2. Otherwise it's posted with a fresh `clientRequestId` and a 25 s timeout. If
   no proper answer comes back (no connection, timeout, a captive portal's page,
   a gateway error page: `ApiNetworkError`), the sale is queued **under the same
   key**. If the request did reach the server, the replay finds that order instead
   of creating a second one.
3. A server refusal (4xx) is shown to the cashier and is not queued.
4. Finalizing a resumed Saved bill is never queued: the queue can only create new
   orders.

A queued sale is priced the way it was rung up. Anything the server must
validate (a customer record, coupon, preset or points) is folded into a flat
discount and free-text customer fields (`buildCheckoutPayload`, `offline: true`).
The payload also carries the shift and `clientCreatedAt`, the moment it was
queued. The receipt shows `OFFLINE-XXXXXXXX` until it syncs.

**On replay** (`POST /api/stores/[id]/pos/orders`):

- Deduped on `clientRequestId` (unique index on `Order.clientRequestId`).
- Recorded **at the time it was rung up**: `orderDate` and `createdAt` =
  `clientCreatedAt`, if that's within the last 30 days and not more than 5 minutes
  ahead of the server (`resolveOfflineOccurredAt`). Otherwise it's recorded at
  sync time, as before. Reports filter on `orderDate`, so a sale made at 23:50
  and synced the next morning stays on its own day.
- Linked to the shift the till named **only if that shift is still open and was
  already open at the sale** (5 minutes' clock tolerance), so the cash counts in
  the drawer it went into. Otherwise it's left unlinked ("cash sales not on a
  till" on the report), never filed under whatever shift is open at sync time
  (`resolveReplayShiftId`).

**When replay fails** (`classifySyncFailure`):

| Failure                               | What happens                                                               |
| ------------------------------------- | -------------------------------------------------------------------------- |
| No connection, timeout, 5xx, 408, 429 | The pass stops; nothing is counted against the entry                       |
| 401 (sign-in expired while offline)   | The pass stops; the banner asks to sign in again, then everything syncs    |
| Any other 4xx                         | Counts as one refusal. After 5, the entry is parked as **Needs attention** |

Parked entries (sales and production logs) **stay on the device** and are no
longer replayed automatically. The review list (POS banner → Review, the POS
Mode menu's sync strip, or Offline & Sync) lets a person **Try again**,
**Download a copy** (JSON) or **Discard** one, with a confirmation. Nothing is
deleted any other way. Table-status changes are the exception: stale table state
isn't worth keeping, so a refused one is dropped after 5 refusals, as before.

Before 3.3.6 a sale was deleted after 5 failed sends of any kind, a Wi-Fi-up /
internet-down sale failed instead of queuing, offline sales were dated and shifted
by their sync time, and offline sales never carried a shift.

---

## 4. Limits, stated plainly

- **One device at a time.** A queued sale lives on the device that took it. Other
  tablets (a second till, the kitchen screen) see it only after it syncs. During
  an outage the kitchen display receives nothing. Kitchen and bar tickets still
  print from the till's own Bluetooth printers.
- **Needs a connection:** opening or closing a shift, cash in/out, refunds, saving
  or resuming a bill, looking up customers, coupons, points and presets, and any
  payment confirmed online (QRIS, card through the gateway). Offline, take cash or
  a card/QRIS payment on a separate terminal and record it by method.
- **First launch needs internet**, to download the app and sign in. A sign-in lasts
  about a week (Better Auth default). After that, queued work waits for a fresh
  sign-in; it isn't lost.
- **Storage belongs to the app's profile.** The desktop app has its own. On Android
  it's Chrome's storage for epidom.fr, so clearing Chrome's site data clears it.
  iOS may clear a home-screen app's data if it isn't opened for about a week; the
  Offline & Sync panel warns about this.
- A replayed sale that goes to the kitchen queue arrives there at sync time, dated
  to when it was sold, so one sold before midnight sits under the previous day.

---

## 5. What's next (not built)

In order of value for a store that needs the till to work through long outages:

1. **Offline shift and cash drawer.** Queue shift open/close and cash movements
   with client-generated ids, like sales. The hard part is the one-shift-per-store
   rule when two devices act offline at once (`project_shift_page`).
2. **Local-first sync engine** (e.g. PowerSync, which replicates Postgres into
   SQLite on each device; writes still go through our API, so server-side rules
   stay). This gives a full local read model (today's history, reports) and
   devices that converge automatically when online. It needs logical replication
   enabled on the production Neon database, a PowerSync account or self-hosted
   service, per-store sync rules, and the POS's reads moved onto the local
   database. Weeks of work. Decide it on real outage data from the field.
3. **In-store hub** for several devices working together during an outage: the
   desktop app on the cashier PC serves the store's LAN, so tablets and the KDS
   talk to it and it syncs upstream. Months of work, plus hardware and support.
   Only worth it for multi-device restaurants that lose internet often.

Operator steps (signing, store listings, env vars) are in `STATUS.md` →
Developer / Operator To-Do.
