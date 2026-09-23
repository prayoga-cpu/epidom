# Epidom, Website Redesign Brief, Page by Page

> **Status, 2026-09-21: implemented (v2.97.0 → v2.99.0, uncommitted on `epidom-revamp`).** About eight
> claims in this brief were wrong when checked against the code, and several important issues were
> missing. **Read the [Implementation log](#implementation-log-2026-09-21) at the bottom before acting on
> anything below.** The body of the brief is left as written, for the record.

Companion to the codebase-derived sitemap brief (13 Sep 2026). That document is the "before" picture. This one is the "do this" direction, page by page, built from four competitor references, real, current, fetched the day this brief was written: squareup.com, mokapos.com, sundayapp.com, pos.toasttab.com.

Every recommendation here ties back to a finding already in the source brief. Nothing invented, nothing generic.

---

## How to read this

Each page or page-group gets four lines:

- **Current** — one line, what's there today
- **Direction** — the concrete change to make
- **Reference** — which competitor pattern it borrows from
- **Priority** — P0 (fix in this pass, no exceptions), P1 (fix in this pass if time allows), P2 (fine to defer)

Pages are grouped into six tiers by how much CRO weight they carry. Don't spend equal design hours on `/status` and the homepage.

---

## Tier 1, Flagship pages

These four carry almost all the site's conversion weight. Full redesign attention here.

### Homepage, `/`

**Current:** 13 sections. Hero claims 500+/20+/10k+/4.9 with no visible source. Trust bar shows fictional shop names (Warung Sari, Café Bretonne) while 5 real customer photos sit unused in the assets folder. Closing-CTA email form doesn't persist if the visitor abandons registration.

**Direction:**
1. Swap the fictional trust-bar names for the 5 real photos already sitting in assets: `holycookie.jpg`, `lafabrique.jpg`, `laura-todd.jpg`, `momma-cookies.jpg`, `pepite-cookie.jpg`. This is a same-day fix, do it before anything else on this list.
2. Replace the 6-quote testimonial marquee with 2 to 3 named case studies. Real shop, real owner, one sentence, two hard numbers, a link to the fuller story if one exists. Don't publish a number you can't source.
3. Source or retire the hero stat block. If "500+ businesses" isn't real yet, say what is, a smaller honest number outperforms an invented big one the moment anyone checks.
4. Fix the closing CTA so the email actually persists (a write to a waitlist table or an ESP call), or replace it entirely with a WhatsApp CTA to match how the rest of the site already behaves.
5. Keep "See a real storefront, live" — it's already a good, working proof element. Don't touch it.
6. Illustrate the "old way vs new way" comparison with an actual screenshot of a real merchant's storefront mid-build, not an icon.

**Reference:** Sunday (named case studies with two hard numbers each), Square (real people over generic hero art), Moka (trust-bar honesty).
**Priority:** P0.

### Pricing, `/pricing`

**Current:** Functionally solid, real Stripe checkout, correct Meta Pixel event firing. But POS and Operations both claim "most popular." FAQ is a duplicate of the homepage FAQ, no trial/refund-specific answers.

**Direction:**
1. Pick one plan for the "most popular" badge. POS already gets the ribbon and the dedicated trial bar below the cards, keep the claim there and remove it from Operations' copy.
2. Write three FAQ entries this page is missing: what happens after the 14-day trial, can I switch plans, is there a refund. These are the exact three gaps in the current FAQ.
3. Reconcile the hand-authored per-locale prices so a USD-locale visitor physically in France or Indonesia doesn't see the wrong currency. Pull every number from `PLAN_PRICE_IDR`, never a hardcoded string.
4. Leave the feature comparison table and the checkout flow alone, both already work well.

**Reference:** Square ("run your entire business with one plan," clear single-tier framing), Sunday (a dedicated pricing page, not a repurposed homepage section).
**Priority:** P0.

### About, `/about`

**Current:** Founder story, reused stat card, a 6-tile placeholder "team" section explicitly commented as a placeholder in code.

**Direction:**
1. Replace the 6 placeholder avatars with real photos. If the team is genuinely 2 people right now, show 2 real people. A small real team reads more credible than a padded fake one.
2. Don't reuse the homepage stat card here. This page's job is credibility through people, not numbers already shown elsewhere.

**Reference:** Square's "humans of the business" approach, applied internally, not just to customer photography.
**Priority:** P1.

### Contact, `/contact`

**Current:** The form is a non-functional stub, `handleSubmit` fakes a 1.2s delay and shows "sent." No API call, no persistence. This is the site's flagship lead-capture form and it is currently losing every submission.

**Direction:**
1. Replace the form with a WhatsApp CTA as the primary action. This matches Moka's entire CTA strategy and matches how Epidom's own footer already behaves per-locale.
2. Keep the 3 channel cards (email, WhatsApp, docs) underneath as secondary paths.
3. If a form must stay for some inquiries, wire it to a real backend before shipping the redesign, don't ship a beautiful form on top of the same missing call.

**Reference:** Moka POS (every CTA on their site is a WhatsApp deep link, zero contact forms).
**Priority:** P0.

---

## Tier 2, Comparison pages

`/compare` hub + `/compare/klikit`, `/compare/majoo`, `/compare/moka`, `/compare/sumup-pos-pro`, `/compare/sunday`, `/compare/zelty`, `/compare/delivery-commission`

**Current:** Genuinely well-built. Sourced, dated footnotes per competitor claim, an explicit "don't invent numbers" authoring rule already in place. But 6 of 7 subpages only have copy in one locale, an English-locale visitor gets silently served Indonesian or French copy on 6 of 7 of these pages.

**Direction:** This is a content-completion problem, not a visual redesign problem. Fix the localization gap first, write the missing locale for all 6 pages, before spending design hours here. The template and sourcing discipline are already good, don't touch them.

**Reference:** Toast (rigorously footnoted comparative claims is the bar to match, and Epidom is already close on this specific page type).
**Priority:** P0 (the localization fix), P2 (any visual polish).

---

## Tier 3, Content and SEO pages

### Blog, `/blog`, `/blog/[slug]`

**Current:** Flat post list. Only 2 EN / 3 FR / 3 ID posts total, thin for the channel positioned as the primary SEO play. Post-page CTA is hardcoded and not locale-aware.

**Direction:**
1. Add a real byline with a small photo to each post. A small trust signal, and it's free once the About page photos exist.
2. Fix the hardcoded CTA to route through the same locale-aware pattern the rest of the page already uses.
3. Volume is a content-calendar problem, not a design problem, flag it, don't try to solve it in this pass.

**Reference:** N/A, this is a content-completeness fix more than a pattern borrow.
**Priority:** P2.

### Docs, `/docs`, `/docs/[slug]`

**Current:** 5 guides per locale, clean numbered navigation, but zero conversion path anywhere on the page.

**Direction:** Add one small, non-intrusive CTA card at the end of every doc article: "Ready to try this yourself? Start free." This is bottom-of-funnel, high-intent traffic reading setup docs, a missed nudge today.

**Reference:** Toast and Square both place contextual CTAs at the end of every piece of content, never leave a content page as a dead end.
**Priority:** P1.

### Services, `/services`

**Current:** 5 well-built feature modules, but reuses the same broken, non-persisting email CTA as the homepage.

**Direction:** Once the homepage CTA is fixed (WhatsApp or a real persisted email write), point this page at the identical fixed pattern. Don't maintain two CTA implementations.

**Reference:** Consistency fix, not a new pattern.
**Priority:** P0 (inherits the homepage fix).

### Changelog, `/changelog`

**Current:** Data-driven, tag-colored release list. The one content page on the entire site that skips the i18n layer, hardcoded English only.

**Direction:** Route this through `useI18n()` like every other page, or explicitly accept English-only here and say so, don't leave it as a silent gap.

**Reference:** Internal consistency fix.
**Priority:** P2.

---

## Tier 4, Soft-conversion utility pages

### Careers, `/careers`

**Current:** "No open roles" message, two bullet sections, zero CTA. Applying means manually copying a plain-text email address.

**Direction:** Add one CTA button, even a simple "no roles right now, tell us about yourself" mailto. Costs almost nothing, removes a genuinely broken interaction.

**Priority:** P2.

### Partners, `/partners`

**Current:** Maps to the supplier-partnership channel, which docs/STRATEGY.md ranks as the second-priority acquisition channel after direct PLG.

**Direction:** This page deserves more investment than its current state relative to its strategic importance. Add a clear application path (form or WhatsApp) aimed specifically at suppliers, kopi roasters, distributors, not at merchants. Don't let the page read as an afterthought when the channel behind it isn't one.

**Priority:** P1.

### Build With Us, `/build-with-us`

**Current:** A lead-gen page for the Prionation studio, not Epidom. Its "book a call" button sends visitors off-domain, and the calendar widget is explicitly commented in code as decorative-only, it never actually books anything.

**Direction:** Either bring this fully on-brand and functional, or fold its purpose into `/partners` and `/careers` rather than maintaining a third, weaker, off-brand funnel linked from the main footer.

**Priority:** P1.

### Press, `/press`

**Current:** Generic placeholder template, no CTA, no clickable email.

**Direction:** At minimum, add a "media inquiries" mailto link and, if any exist, a downloadable logo/brand-asset pack. A press page with zero contact method defeats its own purpose.

**Priority:** P2.

### Status, `/status`

**Current:** Generic placeholder.

**Direction:** No CRO work needed here. Status pages exist to be boring and accurate. Leave it.

**Priority:** P2, cosmetic only.

---

## Tier 5, Legal pages

`/privacy`, `/cookie-policy`, `/gdpr`, `/refund-policy`, `/terms`

**Current:** Inconsistent quality. `/refund-policy` and `/terms` use a good sidebar-TOC template, sticky anchor nav, numbered sections, a real mailto. The other four use a weaker generic placeholder template with no CTA, form, or clickable email at all. Separately, `/cookie-policy` claims "anonymised, self-hosted analytics, no third-party trackers," which is false given the live GA4 + Meta Pixel + Vercel Analytics stack.

**Direction:**
1. Normalize all five weaker pages to match the better sidebar-TOC template already built for `/refund-policy` and `/terms`.
2. Fix the false cookie-policy claim in the same pass. This is a legal-copy correction, not a design one, but it must not wait for a separate cycle. Route it to whoever owns legal review before publishing.

**Reference:** Internal consistency fix.
**Priority:** P0 (the false claim), P2 (the template normalization).

---

## Tier 6, Delete or rebuild

### Payments, `/payments`

**Current:** Confirmed unreachable, zero internal links point to it anywhere in the app, the real checkout flow never visits this page. Visually broken, a light-gray generic theme nested inside the shared dark layout, so the standard dark footer still renders underneath it. A second non-functional lead form. A second, drifting source of pricing truth in its own i18n namespace, different plan names, English-only, no yearly rate.

**Direction:** Delete it. If a payments-capability landing page is wanted later, rebuild it from scratch pulling from the same `PLAN_PRICE_IDR` source of truth as the real pricing page, and reuse the live checkout flow rather than faking a form.

**Priority:** P0. An indexable, broken, off-brand page actively hurts more than having no page at all.

---

## Cross-cutting fixes, not page-specific

Bundle these into the same pass regardless of which pages get visual attention:

1. **No `sitemap.xml` or `robots.xml` exists anywhere in the repo**, confirmed by a repo-wide search. For a 25+ page, 3-locale site with dynamic blog/docs/compare slugs, this is a quick, high-value fix search engines are currently missing entirely.
2. **The header CTA's `BUTTON_MODE` flag already has a fully-coded, currently-unused "waitlist" mode.** A ready-made experiment lever, worth knowing about before anyone considers building a new one from scratch.
3. **Cookie-consent-gated analytics undercounts EU visitors who decline cookies**, a meaningful share of traffic given France is now the primary market under CNIL rules. Worth a first-party, consent-independent fallback signal if the redesign wants reliable conversion measurement, flag for the engineering side, not a design decision.
4. **The shared 3-address mailto pattern** (`cro@prionation.io`, `ceo@prionation.io`, `consult@prionation.io`) appears on every contact touchpoint site-wide, footer, `/contact`, `/refund-policy`, `/gdpr`, `/press`, `/partners`, `/careers`. That's the agency's internal inbox, not a branded Epidom support address. Worth fixing independent of the visual redesign, a `support@epidom.fr` or `hello@epidom.fr` address reads more credible on a product's own site.

---

## What's already working, don't touch it

- The dark navy/gold visual language across ~24 of 25 pages, with a coherent animation vocabulary. Consistent and high-craft, keep it as the base.
- The pricing to Stripe checkout flow, fully functional, correctly instrumented.
- The comparison pages' sourcing discipline, dated, verified footnotes per claim.
- The technical SEO foundation, structured data, hreflang, canonical handling are all solid. It's specifically the sitemap/robots layer that's missing, not the on-page work.
- Cookie-consent-gated analytics is genuinely privacy-respectful and appropriate for a France-primary product, even accounting for the undercounting tradeoff noted above.

---

## Implementation log, 2026-09-21

Built on `epidom-revamp`, **uncommitted**, as CHANGELOG 2.97.0 (fix), 2.98.0 (feat) and 2.99.0 (ux). Before
building, every claim above was checked against the code. Verification: `tsc --incremental false` clean;
full vitest 352 files / 5,404 tests (baseline 294 / 3,905); eight independent read-only reviewers, then
nine fix groups, then a re-run; headless Chromium and curl against the dev server. Operator to-dos live in
`STATUS.md`.

### What this brief got wrong

| The brief says | The code says | What was done |
| --- | --- | --- |
| No `sitemap.xml` / `robots.xml` exists (P0) | `src/app/sitemap.ts` and `robots.ts` exist (Next metadata routes, since 2026-08-10, hreflang-aware) | Nothing to build. Made `lastModified` honest instead |
| 6 of 7 compare pages are single-locale, so English visitors get Indonesian or French | Each has its market locale **plus English**, and falls back to English. Deliberate | No translations written. Fixed canonical / hreflang for the fallback case |
| Blog CTA is not locale-aware | It was (inline fr / id / en copy map) | Only added a byline and NBSP typography |
| The changelog is the one page skipping i18n | Privacy, cookie, GDPR, press, status, partners, careers also had zero `t()` calls | All translated |
| `/payments` is indexable | It was `noindex`; its checkout call was real; only the sales form was fake | Deleted, 308 to `/pricing` |
| "5 real customer photos" | Brand **logos**; nobody has confirmed they are customers or consented (Laura Todd is a registered mark) | Built as data-driven, shipped **empty** |
| Header `waitlist` mode is a ready-made lever | It posts name / email / company to a third-party server with a personal Gmail receiver | Removed |
| `PLAN_PRICE_IDR` is the single source of truth | A private constant duplicated in two files, IDR-only | New `src/lib/constants/plan-pricing.ts` + drift test |
| Closing CTA email "doesn't persist on abandon" | Worse: the sign-up form ignored `?email=` entirely | Prefill added, handed over via `sessionStorage` (not the URL, which reached analytics) |
| Consent-gated analytics is privacy-respectful; technical SEO is solid | `gtag.js` / `fbevents.js` loaded before consent, a `<noscript>` pixel ignored it, no way to withdraw; canonical contradicted hreflang on every page; titles English on French pages; `<html lang="en">` everywhere | All fixed (real consent, locale-aware metadata, `<html lang>`) |

### What the brief missed (found during verification)

- **Security:** `POST /api/subscriptions/activate-free` let any signed-in user grant themselves a paid plan
  (fixed, see below); email login followed an unvalidated `?next=` (fixed).
- **Billing bug, NOT fixed (decision needed):** "Switch plan → Free" on `/pricing` flips the local row to
  FREE but never cancels the Stripe subscription. A legacy `new_year_2025` promo route (`/api/subscriptions/setup`
  + the webhook) still grants free POS that never lapses.
- French `/pricing` showed English for the whole trial promo (6 missing keys); the plan-change dialog was
  hardcoded English; the French trial banner said "no card"; the Operations button said "Start free trial".
- Fabricated named testimonials and outcome statistics in the homepage use-cases section (not only the
  trust bar); false feature claims (menu-photo OCR, "Official WhatsApp API", reports emailed at midnight,
  merchant WhatsApp pings that no code sends); unmeasured "5-minute setup" claims.
- Privacy and cookie pages: a second false claim ("no advertising cookies"), a missing processor
  (Cloudflare R2 nightly backups), and an understated Google Analytics disclosure (in-app URLs, till sale
  details).

### Done, tier by tier

- **Tier 1:** homepage (unsourced proof removed; four verifiable facts; honest trust bar; case-study, team and
  logo sections ready but hidden until real), pricing (own FAQ, one "Most popular", French, dialog i18n and
  focus handling, single price source), About (placeholders removed, honest team block), Contact (WhatsApp
  primary, form removed).
- **Tier 2:** compare pages: canonical / hreflang / og:locale follow the locale actually served.
- **Tier 3:** blog byline + CTA, docs end-of-article CTA, services (shares the fixed CTA), changelog chrome translated.
- **Tier 4:** partners (supplier application path), careers / press CTAs, build-with-us untouched, status translated.
- **Tier 5:** privacy, cookie policy and GDPR rewritten and translated on one shared template (Terms / Refund moved
  onto it); the false claims removed; French Terms section 11 backfilled.
- **Tier 6:** `/payments` deleted, permanent redirects in all locales.
- **Cross-cutting:** sitemap dates honest; the `BUTTON_MODE` waitlist removed; support contact centralised in
  `src/lib/constants/contact.ts` with a guard test; consent made real (Manage cookies, no vendor request before
  consent, withdrawal); locale-aware metadata on all 15 marketing pages.

### Deliberately not done

- The homepage CTA still goes email → `/register` (this is a free, self-serve product; a WhatsApp CTA there would
  remove the signup path). Nothing persists an abandoned email: that is a consent / GDPR decision.
- `/contact` has no form and no backend, only WhatsApp and email. A persisted form needs a model and a migration.
- Consent-independent analytics was not built (a legal call). Build With Us was left alone.
- Content that only the operator can supply: customer-logo consent, case studies, team photos, real numbers, the
  old-vs-new screenshot, press assets, real support hours.

### Production abuse check for the `activate-free` hole (read-only SQL; run against PRODUCTION)

The hole is closed in this change set but is open in production until it deploys. Treat it as exploited until
these come back clean. A legitimate paid customer always has a `stripeSubscriptionId` and a `cus_` id, so any
row from query A is not a Stripe-paying customer. Rule out accounts you upgraded by hand (Back Office set-plan)
or sold off-Stripe, row by row; whatever is left is suspect.

```sql
-- A: the direct fingerprint (paid plan on a free_ stub id; excludes the demo account)
SELECT s."userId", u.email, u.name, s.plan, s.status, s."stripeCustomerId", s."stripeSubscriptionId", s."createdAt", s."updatedAt",
  EXISTS (SELECT 1 FROM action_logs a WHERE a."actionType" = 'admin.user.set_plan' AND a."targetId" = s."userId") AS admin_set_plan_logged
FROM subscriptions s JOIN "user" u ON u.id = s."userId"
WHERE starts_with(s."stripeCustomerId", 'free_') AND s.plan <> 'FREE' AND lower(u.email) <> 'demo@epidom.fr'
ORDER BY s."updatedAt" DESC;

-- B: wider net (someone who already had a real Stripe customer id, e.g. an abandoned checkout)
SELECT s."userId", u.email, s.plan, s.status, s."stripeCustomerId", s."stripeSubscriptionId", s."updatedAt"
FROM subscriptions s JOIN "user" u ON u.id = s."userId"
WHERE s.plan <> 'FREE' AND s."stripeSubscriptionId" IS NULL AND NOT starts_with(s."stripeCustomerId", 'admin_') AND lower(u.email) <> 'demo@epidom.fr'
ORDER BY s."updatedAt" DESC;
```

`admin_set_plan_logged = false` means "unknown", not "clean" (the audit trail only covers the period since it
shipped). The route's own audit rows (`billing.plan.activate_free`) record who called it and when, but not
which plan was requested.
