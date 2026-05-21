# Strategy

The business case behind every technical decision in this repo. Update this doc when positioning changes. Do not let it drift from reality.

---

## 1. One-line positioning

> Epidom is the public storefront, ordering layer, and operating system for small Indonesian F&B businesses, free at the front of the funnel and laddering into paid operations and finance tools.

---

## 2. Why we pivoted

The original Epidom positioning was "cookie bar inventory management for France." Strategic audit revealed:

| Finding | Implication |
|---|---|
| The French F&B POS market is saturated (Sunday, Tiller, Innovorder, Zelty) | Direct POS competition is a multi-year, capital-heavy fight |
| Most small restaurants and cafés still use **Linktree for landing, WhatsApp for reservations, Google Drive for menus** | The customer-facing layer is broken and underserved |
| Mie Gacoan-style QR self-order works, but only large chains can afford to build it | Massive whitespace for a productized version |
| Indonesia has 5.28M F&B businesses (BPS, 2024), 62% independent | Larger TAM than France, lower competitive density on the customer-facing layer |
| Owner.com hit $1B valuation in 2025 doing this playbook in the US | Thesis is validated at the venture scale |
| Sunday raised $100M+ for QR pay alone, then retreated from 4 markets | A standalone QR layer is not sticky enough. The ladder matters. |

The pivot trades a saturated niche (French bakeries) for a defensible wedge (Indonesian customer-facing layer) with a clearer monetization ladder.

---

## 3. Target market

### Geographic priority

1. **Indonesia first.** All product and pricing decisions optimize here.
2. France is paused. The codebase keeps Stripe and EUR pricing for a future return, but no new French copy.

### Customer segments

| Tier | Who | Trigger to upgrade |
|---|---|---|
| **FREE** | Solo warung, home baker, food truck, single-location café | They open shop, post on Instagram, customers want to order online |
| **POS** (~IDR 99k/mo) | Café or warung doing >50 orders/day with a cashier | They hire a cashier, can't manage orders by hand |
| **OPERATIONS** (~IDR 249k/mo) | Multi-staff café or restaurant | They hire a second shift, need ingredient cost control and shift handover |
| **ENTERPRISE** (~IDR 499k+/mo) | Multi-outlet brand, small manufacturer | They open a second outlet, need consolidated finance and aggregator dashboards |

---

## 4. Wedge mechanics

The wedge is the **public storefront** (`epidom.id/@warung-pak-budi`). Free forever. Replaces:

- Linktree (link in Instagram bio)
- Google Drive PDF menu
- WhatsApp ordering chaos

Why this is the right wedge:
- **Activation cost is near zero.** A merchant signs up, picks a theme, adds 3 menu items, publishes. Done in 5 minutes.
- **Visible value on day 1.** They share the link on Instagram, customers actually use it.
- **Built-in distribution.** Every storefront page is a marketing surface that shows "Powered by Epidom" (until they pay to remove it).
- **Data lock-in over time.** Once they have 200 orders in our system, they don't want to switch.

The POS, KDS, and inventory features upsell *after* we have the storefront relationship. We never lead with POS.

---

## 5. Competitive landscape

### Direct competitors (Indonesia)

| Competitor | Strength | Where we win |
|---|---|---|
| **Moka POS** (GoTo-owned) | Brand recognition, GoFood/Gojek integration | Free customer-facing storefront; Moka has none. Lower price. |
| **Majoo** | Comprehensive business management | Cleaner public ordering UX; less feature bloat. |
| **Klikit** | Best-in-class aggregator dashboard | Free tier; Klikit charges from day one. |
| **Pawoon, iSeller, Olsera** | Local F&B-specific POS | Storefront wedge, freemium funnel. |
| **Loyverse** | Free, multi-language including Bahasa | Customer-facing storefront, IDN-specific payments, WhatsApp notifications. |

### Indirect competitors

| Competitor | What they cover | Why we still win |
|---|---|---|
| **GoFood / GrabFood / ShopeeFood** | Hosted storefront + delivery | We're commission-free. Position as "the platform that helps you reduce your dependency on them." |
| **WhatsApp Business Catalog** | Free menu listing in WhatsApp | We offer real payment, order history per customer, analytics, and Instagram-shareable links. |
| **Linktree + Google Drive menu** | What most merchants use today | We replace the entire stitched-together mess with one tool. |

### Global benchmarks

| Company | Stage | What we learn |
|---|---|---|
| **Owner.com (US)** | $1B, $178M raised | The full ladder, including AI-driven content, is the right shape. |
| **Sunday (FR)** | Burned $100M+ then retreated | QR pay alone is not enough. Must own the operational layer above it. |
| **Choice QR (CZ)** | Bootstrap-ish, 7,500 restaurants on €1M | Lean execution can compete in the QR menu layer. |
| **Toast (US)** | Public, $7B revenue | Compound POS works at the high end, but we cannot fund that fight. |

---

## 6. Tier ladder

```
FREE         POS          OPERATIONS         ENTERPRISE
   |           |               |                  |
   v           v               v                  v
Storefront  + Cashier     + Shift mgmt       + Multi-outlet
Menu        + Order list  + Kitchen Display  + Finance reports
QR ordering + Receipts    + Inventory        + Aggregator dashboard
QRIS pay    + Basic KDS   + Recipe cost      + Stripe Connect 80/20 (optional)
WhatsApp                  + Stock deduction
notify                    + Low stock alerts
```

Each tier upgrade is triggered by a clear business event, not a feature gate. Upgrade prompts should explain the event ("You've onboarded your 2nd cashier. Time to add Shifts.") rather than the feature.

---

## 7. Pricing rationale

| Tier | Indonesia (IDR/mo) | France-ready price (EUR/mo) | Why |
|---|---|---|---|
| FREE | Rp 0 | €0 | Wedge. Forever free. |
| POS | Rp 99,000 (~$6) | €19 | Beats Klikit's Rp 390k by being focused on small operators |
| OPERATIONS | Rp 249,000 (~$15) | €49 | Where most revenue comes from |
| ENTERPRISE | Rp 499,000+ (~$30+) | €99+ | Custom upsell for chains and manufacturers |

The IDR pricing matters more than any other number in this strategy. Reference: Indonesian SME SaaS ARPU benchmarks suggest pain threshold ~Rp 300k/month for software, soft ceiling ~Rp 500k for non-payment SaaS.

---

## 8. Revenue model

Two streams, kept architecturally separate:

1. **SaaS subscriptions** (recurring): merchants pay Epidom monthly via Stripe.
2. **Payment processing** (future, Stripe Connect 80/20 model from original codebase): if a merchant accepts customer payments through us via QRIS/Xendit, we take a small margin on each transaction. **This is opt-in and lives in ENTERPRISE tier only.**

We are not a payment facilitator at scale. We are a SaaS company that integrates one. Important for regulatory positioning (BI / OJK).

---

## 9. Channel strategy

Order of acquisition channels by expected ROI:

1. **Direct PLG** (own the funnel): SEO, content, free-tier viral loop via "Powered by Epidom" link
2. **Supplier partnerships**: kopi bean roasters, frozen-food distributors, bakery suppliers. "Free 1 month POS tier with every Rp 1M order."
3. **F&B consultant affiliates**: 20-30% recurring commission
4. **Paid ads, retargeting only**: Google Ads against high-intent keywords ("aplikasi kasir warung," "menu QR resto"), only after PLG validates ICP

Avoid:
- Door-to-door sales (expensive, doesn't scale)
- Large enterprise sales motions (wrong product stage)
- Generic brand awareness ads

---

## 10. Key metrics to watch

| Metric | Healthy benchmark | Trigger to pivot |
|---|---|---|
| Activation: % of signups who publish a menu in week 1 | >40% | <20% after 90 days means the wedge is wrong |
| Time to first customer order via storefront | <7 days | >30 days means the storefront isn't getting shared |
| Free → POS conversion at 90 days | 4-6% | <2% means pricing or feature gap |
| Monthly churn (paid users) | <5% | >10% means the operations layer isn't sticky enough |
| CAC payback period | <12 months | >24 months means the funnel is broken |
| Net revenue retention (paid cohort) | >100% | <90% sustained means we're not laddering users up |

These metrics are reviewed monthly. Strategy changes get logged in the Changelog with the metric that triggered them.

---

## 11. What we explicitly are not

- We are not a delivery platform. We integrate with GoFood/GrabFood/ShopeeFood; we do not compete with them on logistics.
- We are not a full restaurant ERP. Recipe and inventory features are intentionally lightweight.
- We are not a website builder. We do one specific page type (restaurant storefront) very well.
- We are not a payment company. We integrate Xendit; we do not hold funds long-term.
- We are not for Mie Gacoan-tier chains. They build custom. We serve the long tail below them.

---

## 12. Open strategic questions

These are unresolved. Decide before Phase 2 closes.

1. Do we charge for QRIS transaction fees on the FREE tier? (Probably yes, ~0.7% on top of Xendit's 0.7% = 1.4% to the merchant. Aligns incentives, keeps free tier sustainable.)
2. Do we white-label for kopi chains (e.g., Janji Jiwa, Kopi Kenangan franchises)? (Maybe, in Phase 5.)
3. Do we go after small home-kitchen / catering operators with a sub-FREE "social tier" that's just a menu page? (Possibly, easy to add.)
4. When do we reactivate French market? (Not before Indonesia hits 5,000 paying merchants.)
