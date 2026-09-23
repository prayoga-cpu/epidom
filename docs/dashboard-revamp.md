# Epidom, Dashboard Shell Split, Wireframe Spec

POS Mode and Back Office as two distinct shells, not one responsive layout. Built from Section 4 (roles/access), Section 9.2 (current nav), Section 10 (hard UX constraints), and Section 12 (synthesis) of the source sitemap brief, cross-referenced against how Moka POS, Square, Toast, and sunday each structure this split in their live products.

---

## Why two shells, not one

Every competitor referenced treats "ring up an order" and "understand the business" as different jobs, on different devices, done by different people, at different moments:

| Reference | Operational side | Management side |
|---|---|---|
| Moka POS | A separate app, installed on the iPad/Android tablet from the app store | `backoffice.mokapos.com`, a different subdomain entirely |
| Square | Point of Sale | Dashboard (banking, staff, reporting) |
| Toast | Toast POS terminal software | Management / Marketing / Payroll / Finance suites, a separate portal |
| sunday | Staff app | Business analytics, accounting, reconciliation |

Epidom's own source brief reaches the same conclusion independently, Section 12: *"a stripped-down, high-touch-target 'operator mode' for Cashier/Kitchen, and a denser 'management mode' for Owner/Manager."* This spec is that conclusion, made concrete.

---

## Page inventory, split

Using the 21 dashboard pages from Section 6.5 of the source brief.

### POS Mode (Cashier, Kitchen)

| Page | Notes |
|---|---|
| `/pos` | Cashier grid, cart, checkout |
| `/pos/orders` | Order queue |
| `/pos/kds` | Kitchen display |
| `/pos/display` | Customer-facing second screen |
| `/tables` | Zones, table states, assign/move |
| Clock in/out | A reduced view of `/schedule`, not the full page, see Shared Surfaces below |

### Back Office (Owner, Manager)

| Page | Notes |
|---|---|
| `/dashboard` | Analytics overview |
| `/storefront` | Public storefront editor |
| `/menu` | Menu management |
| `/data` | Products, materials, recipes, suppliers |
| `/management` | Movements, waste, purchase orders |
| `/production` | Batch production (opt-in) |
| `/alerts` | Stock and system alerts |
| `/staff` | Owner-only, never staff-grantable |
| `/schedule` | Full roster builder, published shifts |
| `/finance` | P&L, channel margin (Enterprise) |
| `/owner` | Multi-outlet roll-up (Enterprise) |
| `/billing`, `/profile` | Account-level |
| `/custom-development` | Enterprise requests |

Print/display routes (Section 6.6) stay attached to whichever shell generates them, daily reports and order-history print from POS Mode, everything else from Back Office. No change needed there, they're already chrome-free by design.

---

## POS Mode shell, wireframe

**Device assumption:** iPad, per the source brief's explicit engineering rule, "iPad is the primary cashier device." Landscape orientation, mounted or handheld.

**Navigation pattern:** Bottom tab bar, not the left rail. A cashier's thumb reaches the bottom of a tablet screen; a left rail costs 230px of width Epidom's own current shell already sacrifices at exactly this size range.

```
┌─────────────────────────────────────────────────┐
│  ● Online          Warung Pak Budi        👤 PIN │  ← 44px status bar
├─────────────────────────────────────────────────┤
│                                                   │
│   Category tabs:  [Kopi] [Makanan] [Snack] [Bar] │
│   ┌────┐ ┌────┐ ┌────┐ ┌────┐                    │
│   │Item│ │Item│ │Item│ │Item│   Cart              │
│   └────┘ └────┘ └────┘ └────┘   ─────             │
│   ┌────┐ ┌────┐ ┌────┐ ┌────┐   2x Kopi Susu      │
│   │Item│ │Item│ │Item│ │Item│   1x Roti Bakar      │
│   └────┘ └────┘ └────┘ └────┘                     │
│                                   Total: Rp 45.000 │
│                                  [   Bayar   ]     │
│                                                   │
├─────────────────────────────────────────────────┤
│  🛒 Kasir   📋 Antrian   🍳 Dapur   🪑 Meja  ⋯  │  ← 56px tab bar
└─────────────────────────────────────────────────┘
```

**Touch targets:** every tappable element ≥44px per Section 10.1, item grid cells included. No control smaller than 40px, ever, matching the source brief's stated minimum.

**Tab bar items:** Kasir (`/pos`), Antrian (`/pos/orders`), Dapur (`/pos/kds`, hidden entirely if `kitchenDisplayEnabled` is off), Meja (`/tables`), and an overflow `⋯` for the customer display trigger and clock in/out, both low-frequency actions that don't deserve permanent tab-bar real estate.

**What's deliberately absent:** no hamburger menu, no global search, no store switcher, no language switcher, no theme toggle. A cashier mid-shift doesn't need any of them, and each one removed is one less thing competing for a 44px touch target on a screen that's already busy.

**Staff PIN gate:** stays exactly as documented, a shared device serving multiple personas without separate logins. This lives above the shell, not inside it, first thing rendered, before either Kasir or Dapur loads.

---

## Back Office shell, wireframe

**Device assumption:** mixed, Android phone for a solo owner checking in, desktop for a manager doing weekly planning. The source brief is explicit that desktop usability here is not an afterthought.

**Navigation pattern:** keep the existing left rail at desktop widths, keep the hamburger drawer below `xl`. This shell earns density, it doesn't need the operator-mode simplification.

```
Desktop (≥1280px)                          Mobile (<1280px)
┌──────┬────────────────────────┐          ┌────────────────────────┐
│ Epi  │  Dashboard              │          │ ☰   Warung Pak Budi  🔔│
│ dom  │  ────────────           │          ├────────────────────────┤
│      │  Revenue this week      │          │  Dashboard             │
│ Gen- │  ┌──────┐ ┌──────┐      │          │  ────────────          │
│ eral │  │ 4.2M │ │ 812  │      │          │  Revenue this week     │
│      │  └──────┘ └──────┘      │          │  ┌──────┐ ┌──────┐     │
│ POS  │                         │          │  │ 4.2M │ │ 812  │     │
│      │  Recent orders          │          │  └──────┘ └──────┘     │
│ Ops  │  ┌─────────────────┐    │          │                        │
│      │  │  ...            │    │          │  Recent orders         │
│ Ent- │  └─────────────────┘    │          │  ┌─────────────────┐   │
│ er-  │                         │          │  │  ...            │   │
│prise │  🔒 Finance             │          │  └─────────────────┘   │
│      │  Upgrade to Enterprise  │          │                        │
└──────┴────────────────────────┘          └────────────────────────┘
```

**Section grouping:** unchanged from today, General, Point of Sale, Operations, Enterprise, mirroring the plan ladder directly in the IA. This part of the current shell already works, Section 9.2 documents it as deliberate, keep it.

**What moves here that wasn't here before:** nothing. Back Office keeps every non-POS page it already has. The only change is that `/pos`, `/pos/orders`, `/pos/kds`, `/pos/display`, and `/tables` no longer appear in this rail at all, they've moved to their own shell entirely. A Manager who needs to glance at the live order queue gets a summary card on `/dashboard` linking out to POS Mode, not a duplicated live view inside Back Office.

**Locked nav items:** unchanged, inline with a lock icon and an amber "Upgrade to X" affordance. This is Epidom's working CRO mechanism per Section 12, don't lose it in the split, see the next section for where it needs a second home.

---

## Three things this split can't ignore

### 1. Schedule isn't one page anymore, it's two

Cashier and Kitchen both need clock in/out per Section 4's access matrix, but the roster-builder is Manager-only. Splitting cleanly means:

- **POS Mode gets a light "my shift" view**, current status, clock in/out, nothing else. Reachable from the tab-bar overflow.
- **Back Office keeps the full `/schedule`**, draft/publish roster states, absence tracking, overtime computation.

Don't ship one `/schedule` page and try to make it context-aware based on role, that reintroduces exactly the "one generic dashboard user" problem Section 12 warns against. Two views, sharing the same underlying clock-in/out data, cleanly separated.

### 2. The upgrade-prompt mechanism needs a deliberate new home

Today, a Free-tier user sees a locked "Upgrade to Operations" item inline in the left rail. Once Cashier/Free-tier users live in a rail-less POS Mode, that mechanism has nowhere to render. Two options, pick one on purpose:

- Surface it as a banner inside POS Mode itself, e.g. a dismissible strip above the cart when a Free-tier cashier hits a feature wall (can't apply a discount without Operations, for instance).
- Surface it only in Back Office, and accept that Free-tier Cashier-only accounts (which likely don't exist yet, since Cashier is an Operations-tier role per Section 6.5) never see it directly, the owner sees it instead when they check in.

Given Cashier is already gated to Operations tier and above, the second option is probably correct, but say so explicitly rather than let it happen by accident.

### 3. This extends a pattern Epidom already shipped, it doesn't invent one

Section 6.6 documents seven "chrome-free" routes, print and display views deliberately built outside the dashboard shell. POS Mode as its own shell is the same idea, applied to the live, interactive screens instead of just the printable ones. The team has already paid for and validated this pattern once.

---

## Rollout sequencing

Don't rebuild both shells in the same pass.

1. **Ship POS Mode first.** Per Section 12, the cashier screen is already the single largest, most complex client component in the app, checkout dialog, order queue, order history, hold dialog, refund dialog, printer menu, WhatsApp-receipt sender. It's the highest-leverage target and the one place the current responsive compromise costs the most on a real iPad.
2. **Leave Back Office on the current shell** for this phase. Owner/Manager screens tolerate the existing density fine, and touching both shells at once doubles the surface area for regressions in a redesign that's already reintroducing scar tissue risk (Section 10's five iPad failure modes, the `dvh`/app-zoom rules).
3. **Revisit Back Office's shell** once POS Mode has shipped and the schedule/upgrade-prompt decisions above have real usage data behind them, not just a spec.

---

## Constraints carried over, unchanged

These apply to both shells and are not up for renegotiation in this redesign, they're documented scar tissue from real shipped breakage (Section 10):

- `dvh`, never `vh`, for any dialog/sheet/drawer height.
- Every full-height layout as `calc(100dvh / var(--app-zoom, 1))`, never a bare viewport unit.
- No control gated behind `:hover` alone, anywhere.
- `flex-1` for the button that should fill space in a row, never `w-full`.
- `min-h-0` / `min-w-0` on every intermediate flex item in a nested scroll chain.
- Every money and quantity value stays a Prisma `Decimal`, never floated through JS in a way that could round-trip into a display artifact.
