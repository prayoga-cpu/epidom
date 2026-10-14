# STATUS.md

## Current focus: SEO and website rework — Phase 0 live (3.12.1), Phase 3 + part of Phase 1 in 3.13.0, Phase 2 in progress

_(AI agents: this file tracks the SEO/website phases below. Tick a box the moment an item is done and add the version it shipped in; don't re-describe finished work in prose. Anything that needs the operator goes in "Operator to-do". The previous STATUS.md (v3 dashboard revamp, releases 3.3.0–3.12.0, and their open operator to-dos) is archived unchanged at `docs/status-archive/2026-10-14-v3-revamp-and-releases.md`; its open items are listed at the bottom so they stay visible.)_

**Goal:** rank Epidom for POS / caisse / kasir searches in the markets it sells to — France first, Indonesia second, English long tail (`docs/STRATEGY.md` §3).

**Starting point (live audit, 2026-10-14):** the technical base is sound (hreflang, self-canonicals, crawlers exempt from the language redirect, honest JSON-LD). What holds rankings back: no page targets the words buyers type (no title said "logiciel de caisse" or "aplikasi kasir"), thin content (8 blog posts of ~300 words, none since 3 July), no authority (a search for "epidom" returns epidemiology), and France's `caisse` keywords depend on the NF525 decision.

**Expected timing:** long-tail terms 2–4 months after the pages exist, mid-tail 6–12 months, head terms ("logiciel de caisse", "aplikasi kasir", "pos system") 12–24+ months, and only with links.

### Phase overview

| Phase | Scope | Status |
| --- | --- | --- |
| 0 — Hygiene | Remove junk from the index, retarget titles, fix the H1 and structured data, crawler access | ✅ live in 3.12.1 (b7b36aec, 2026-10-14) |
| 1 — Speed | Static marketing pages, one language bundle per visitor, image/favicon weight, Core Web Vitals baseline | 🟡 bundle + favicon in 3.13.0; static pages, OG images, CWV open |
| 2 — Pages that rank | Free tools, vertical pages, feature pages, more comparison pages, blog cadence | ⬜ not started |
| 3 — Storefront loop | Server-rendered menus, store-language metadata, LocalBusiness detail, "Powered by" link | ✅ 3.13.0 |
| 4 — Authority | Search Console, Business Profile, Play Store listing, directories, listicles, data PR | ⬜ not started |

---

## Phase 0 — Hygiene — ✅ live in 3.12.1 (pushed b7b36aec, 2026-10-14)

- [x] **Sitemap stops submitting test and empty storefronts** (3.12.1). One rule, `isStorefrontIndexable` in `src/features/storefront/lib/indexing.ts` (not a test/demo name, at least `MIN_INDEXABLE_MENU_ITEMS` = 3 available menu items), drives both the sitemap and `noindex, follow` on `/@slug`, `/@slug/menu` and item pages. Against the dev DB: 24 → 14 storefronts listed; `@testing`, `@testings`, `@demo-cmsbjfr6`, `@sfa` noindexed; also `@lecomptoir-paris` (fewer than 3 available items — see Decisions).
- [x] **Sales pages are `noindex`** (3.12.1). `X-Robots-Tag: noindex, follow` in `next.config.ts` on `/sales-page-N`, `/{en,id}/sales-page-N` and `/sales-pages/*`; the home page has none.
- [x] **Placeholder pages out of the index** (3.12.1). `noindex: true` on careers/press/partners in `page-metadata.ts`; off the sitemap (a test ties the exclusion list to the flag). Sitemap 113 → 94 URLs.
- [x] **Titles and descriptions retargeted** (3.12.1). Home: "Aplikasi Kasir Cafe & Restoran + Menu QR" (id), "Commande en ligne, menu QR et caisse pour cafés" (fr, interim until NF525), "POS & Online Ordering for Cafés and Restaurants" (en); Pricing titles carry the price; Features, Compare (competitor names), delivery-commission (fr now names Uber Eats/Deliveroo, it named the Indonesian apps), blog. Tests: titles ≤ 60, descriptions ≤ 160, no "warung" in French snippets.
- [x] **Home H1 reads once** (3.12.1). The drawn copy is the h1's only text (`aria-label` for screen readers); built page shows `[Caisse en temps réel]`. Features h1 (still sr-only) is "Caisse, écran cuisine et back-office pour cafés et restaurants" / "POS, kitchen display and back office for cafés and restaurants" / "Aplikasi kasir, layar dapur, dan back office untuk kafe dan restoran".
- [x] **Structured data** (3.12.1). `WebSite`/`SoftwareApplication` no longer carry `logo`/`contactPoint`/`sameAs`; descriptions and `inLanguage` follow the page; Free/POS/Operations `Offer`s at the pricing table's monthly price in the page's currency (id: 0 / 229000 / 459000 IDR); `BreadcrumbList` on blog posts, docs guides, competitor and delivery-commission pages.
- [x] **Crawler access** (3.12.1). Google-InspectionTool, GoogleOther, Chrome-Lighthouse, BingPreview, Pinterest exempt from the language redirect; the redirect is `private, no-store` with `Vary: Cookie, Accept-Language, …`; footer links `/`, `/id`, `/en` with plain `<a hreflang>` (language list + cookie helper moved to `src/components/lang/language-options.ts`).
- [x] **One `<main>` per page** (3.12.1): the marketing layout's; 12 page wrappers are `<div>`s.
- [x] Tests + type check pass (3.12.1): full suite ran once (518 files, the one failure fixed and re-run), then the 32 affected files; `tsc --noEmit` 0 errors; `next build` passed; the built app was checked with curl as Googlebot on port 3100 (titles, h1, robots, JSON-LD, headers, redirect, footer links, sitemap). CHANGELOG 3.12.1 · fix.
- [x] **Deployed and checked on epidom.fr** (2026-10-14): `/id` title, `X-Robots-Tag` on `/sales-page-1`, `noindex` on `/@testing` and `/careers`, sitemap 94 URLs, h1 once. Footer language row checked in headless Chromium at 390 px and 1440 px (40 px tall links, no horizontal overflow, no console errors).
- [ ] Google's Rich Results Test on the live JSON-LD (operator: it needs a Google login).

## Phase 1 — Speed

- [ ] Derive the locale from the URL instead of `headers()` in `src/app/layout.tsx` and `src/app/(marketing)/layout.tsx`, so marketing pages can be static/ISR (today every request renders on the server; TTFB measured 0.35–1.5 s). Needs multiple root layouts and an internal locale segment (a `[locale]` folder would clash with the storefront's `(public)/[slug]`); scheduled last.
- [x] **Only the visitor's language file** (3.13.0). `SeededI18nProvider` (`src/components/lang/seeded-i18n-provider.tsx`, a client module) lazy-loads one `seeded-i18n-{fr,id,en}.tsx`. Measured on a production build: every page loaded both the fr (318 KB) and id (299 KB) chunks; now only its own. Raw JS per page: `/en` 1948 → 1333 KB, `/` 1948 → 1651 KB, `/id` 1948 → 1632 KB. The same `next/dynamic` calls in a server component did NOT split (all chunks stayed in the script tags). Header language switch and hydration checked in headless Chromium (no console errors).
- [x] **Favicon 581 KB → 8 KB** (3.13.0): the old file's own 16/32/48 px images repacked as PNG entries, same artwork.
- [ ] Per-page Open Graph images (`opengraph-image.tsx`) for home, pricing, blog posts, compare pages.
- [ ] Core Web Vitals baseline for `/`, `/id`, `/en`, `/pricing` (PageSpeed API quota was exhausted on 2026-10-14) and again after the changes above.

## Phase 2 — Pages that rank

Free tools (link magnets, no NF525 dependency):

- [ ] Recipe cost / margin calculator — fr "calcul coût de revient recette", id "kalkulator HPP menu" (reuse `src/features/marketing/home/lib/margin-calculator.ts`).
- [ ] Delivery-app commission calculator as its own page in 3 languages (fr Uber Eats/Deliveroo, id GoFood/GrabFood/ShopeeFood).
- [ ] Free QR menu page where the free storefront is the tool (fr "menu QR code gratuit", id "menu QR code gratis").

Vertical and feature pages (written per language with localized slugs, like blog and docs):

- [ ] id: aplikasi-kasir-cafe, aplikasi-kasir-restoran, aplikasi-kasir-toko-roti, aplikasi-kasir-offline.
- [ ] fr: commande-en-ligne-restaurant, menu-qr-code; logiciel-caisse-cafe and logiciel-caisse-boulangerie **after the NF525 decision**.
- [ ] en: bakery-pos, cafe-pos, commission-free-online-ordering.
- [ ] Split `/services` into feature pages: kitchen display, stock and recipe costs, staff scheduling, offline till, receipt printers.

Comparison pages (`src/features/marketing/compare/data/`):

- [ ] fr: L'Addition, Lightspeed, Tiller (SumUp), Innovorder, Popina.
- [ ] id: Pawoon, Qasir, Olsera, ESB, Kasir Pintar.
- [ ] Link the individual comparison pages from the footer.

Content:

- [ ] Blog cadence: 2 posts/month in fr and id (1,000–1,800 words), each linking to a vertical or tool page.
- [ ] Expand the 8 existing ~300-word posts; add `dateModified` (an `updated` field) to posts and the sitemap.

## Phase 3 — Storefront loop — ✅ 3.13.0

- [x] **Store pages in the store's language** (3.13.0). New `src/app/(public)/[slug]/layout.tsx` wraps every store page in `SeededI18nProvider followVisitorPreference`: the server renders the store's language (`resolveStorefrontLocale`: rupiah → id, euro → fr, else an explicit fr/en business language, else en — `Business.locale` defaults to "id", so a Paris café in euros was stored as Indonesian), then the visitor's saved choice / browser language takes over after hydration (`I18nProvider defaultLocale`). `<div lang>` marks the content (`StoreLanguage`). Checked in Chromium: server `lang=id`, an English browser switches to `en`, no hydration errors.
- [x] **The profile page shows dishes** (3.13.0): "On the menu", up to 6 available items with prices, featured first (`pickMenuHighlights`). The menu page was already server-rendered (items + prices in the HTML); `/@slug/menu` is now in the sitemap for indexable stores.
- [x] **Store-language titles and snippets** (3.13.0, `src/features/storefront/lib/storefront-metadata.ts`): "Ellens Bakery — Menu & Pesan Online, {city}" ("online ordering" only when the store accepts orders); the "Welcome to our store!" default is ignored; the menu page's description names real dishes; og:locale follows the store.
- [x] **JSON-LD** (3.13.0): CafeOrCoffeeShop / Bakery / Restaurant / BarOrPub / FastFoodRestaurant from `Business.businessType`, `priceRange` from the menu, `PostalAddress` only when there is a street or city (a country alone is often the onboarding default). No `geo`: the Store model has no coordinates.
- [x] **"Powered by Epidom"** links to `/`, `/id` or `/en` by the language being read (3.13.0).
- [x] **Merchant prompt** (3.13.0): Storefront → Google Reviews has a "Use this page as your menu on Google Maps" card with the `/@slug/menu` link, a copy button and the 3 Business Profile steps.
- [ ] Not done: a store-language default description in the product itself (new storefronts are still created with the English "Welcome to our store!").

## Phase 4 — Authority

- [ ] Search Console (domain property) + Bing Webmaster verified, sitemap submitted (operator).
- [ ] Google Business Profile for Epidom/Prionation (operator).
- [ ] Play Store listing (the Android TWA) titled with "aplikasi kasir cafe" / "caisse café" (operator).
- [ ] Indonesian listicle outreach (Dealls, IDXChannel-type "aplikasi kasir terbaik" pages).
- [ ] Capterra, GetApp, Appvizer listings — after the NF525 decision (they filter on it).
- [ ] Data PR from the commission calculator ("the real cost of delivery apps in 2026").

---

## Keyword tracker

Demand is an estimate (no Keyword Planner/Ahrefs data yet). Fill "Position" from Search Console once it is connected.

| Market | Keyword | Target page | Phase | Position (baseline → now) |
| --- | --- | --- | --- | --- |
| fr | calcul coût de revient recette | margin calculator | 2 | – |
| fr | commission Uber Eats restaurant | commission calculator | 2 | – |
| fr | menu QR code gratuit restaurant | QR menu page / blog | 2 | – |
| fr | commande en ligne sans commission | /commande-en-ligne-restaurant | 2 | – |
| fr | alternative Zelty / SumUp / Sunday | /compare/* | 0 ✔ live | – |
| fr | logiciel caisse café | /logiciel-caisse-cafe | 2 (after NF525) | – |
| fr | logiciel caisse boulangerie | /logiciel-caisse-boulangerie | 2 (after NF525) | – |
| fr | logiciel de caisse | home | 12+ months | – |
| id | kalkulator HPP menu | margin calculator | 2 | – |
| id | komisi GoFood GrabFood | commission calculator | 2 | – |
| id | aplikasi kasir offline | /id/aplikasi-kasir-offline | 2 | – |
| id | alternatif Moka / Majoo | /id/compare/* | 0 ✔ live | – |
| id | aplikasi kasir cafe | home title + /id/aplikasi-kasir-cafe | 0 + 2 | – |
| id | harga aplikasi kasir cafe | /id/pricing | 0 | – |
| id | aplikasi kasir | home | 12+ months | – |
| en | bakery POS system | /en/bakery-pos | 2 | – |
| en | POS with recipe costing | feature page | 2 | – |
| en | commission-free online ordering | /en/commission-free-online-ordering | 2 | – |

## Decisions needed

- [ ] **NF525.** The 2025 finance law removed the publisher's self-attestation; the **2026 finance law (n° 2026-103, art. 125) restored it**. Epidom can issue its own attestation only if the till really meets the four conditions (records can't be altered, secured, kept, archived). Confirm with an accountant. Until decided: French pages lead with online ordering, QR menu and cost tools, not "logiciel de caisse"; Capterra/Appvizer listings wait.
- [ ] **Features H1 visible or not.** 3.11.0 hid it at your request; Phase 0 keeps it hidden but makes its text name the product. A visible H1 is a slightly stronger signal.
- [ ] **Storefront index threshold.** Phase 0 noindexes stores with fewer than 3 available menu items (`MIN_INDEXABLE_MENU_ITEMS`). Lower it if real merchants with tiny menus should stay indexed.

## Operator to-do (SEO)

- [ ] Check `https://epidom.fr/` and `/id/pricing` in Search Console's URL Inspection and Google's Rich Results Test (expect SoftwareApplication with 3 offers, FAQPage, BreadcrumbList on blog/compare pages). 3.12.1 is deployed.
- [ ] Verify `epidom.fr` in Google Search Console (domain property) and Bing Webmaster; submit `https://epidom.fr/sitemap.xml`; after Phase 0 deploys, request removal of the test storefront URLs (`/@testing`, `/@testings`, `/@demo-cmsbjfr6`, `/@sfa`) if they show as indexed.
- [ ] Share a Search Console export (top queries, pages, indexed count) so the keyword tracker gets real numbers.
- [ ] Clean up or unpublish the test storefronts in production (`testing`, `testings`, `demo-cmsbjfr6`, `planb-261-1`): Phase 0 hides them from search, it doesn't delete them.

---

## Carried over from the previous STATUS.md (still open)

Full text, context and line numbers: `docs/status-archive/2026-10-14-v3-revamp-and-releases.md`. Close an item here when it's done.

**Operator to-dos:** retake 3 screenshots on realistic data (3.12.0, L12) · sales pages in three languages (3.10.0, L15) and sales pages (3.9.0, L17) · ship the offline apps (3.3.7, L24) · hero photo resolution (L31) · homepage launch blockers incl. NF525 (3.4.0, L32) · 3.8.0 checks (L37) · schedule payroll (3.7.0, L42) · turn PayPal on (3.3.4, L43) · phone/iPad checks (3.3.2, L46) · onboarding live checks (3.3.0, L50) · Enterprise price signal (L60) · before promising SLAs (L61) · All outlets on a real multi-store account (L62) · Customer portal plan switching (L63) · finish the Stripe move (L65) · POS Operational on the real till (L69) · customer display on the real till (L71) · platform commission rates are estimates (L77) · URGENT at deploy (L81) · legal and compliance (L82) · content that unlocks the redesign (L83) · config and infrastructure (L84) · zoom on a real phone and iPad (L87) · publish the Google consent screen (L94) · L95 · Preview test-mode Stripe keys (L96) · nightly dev-DB reset fix (L98).

**Decisions:** offline beyond one device (L25) · unpaid storefront orders (3.8.0, L39) · billing behaviour the audit confirmed (L66) · follow-ups that need a decision (L85) · L162, L172, L222.

**Suspected bugs / known risks:** last adversarial review not done (L19) · `PAYMENT_FEE_DEFAULTS` flat fee (L20) · card fees in euro stores (L33) · Select heights ignored app-wide (L27) · known risks (L97, L99).

**Not verified live (browser/iPad/printer):** L38, L164, L174, L184, L197, L207, L219, L310–311, L367–368.
