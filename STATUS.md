# STATUS.md

## Current focus: SEO and website rework — Phases 0–3 shipped (3.12.1–3.17.2); open: Phase 4 (operator), field Web Vitals decision

_(AI agents: this file tracks the SEO/website phases below. Tick a box the moment an item is done and add the version it shipped in; don't re-describe finished work in prose. Anything that needs the operator goes in "Operator to-do". The previous STATUS.md (v3 dashboard revamp, releases 3.3.0–3.12.0, and their open operator to-dos) is archived unchanged at `docs/status-archive/2026-10-14-v3-revamp-and-releases.md`; its open items are listed at the bottom so they stay visible.)_

**Goal:** rank Epidom for POS / caisse / kasir searches in the markets it sells to — France first, Indonesia second, English long tail (`docs/STRATEGY.md` §3).

**Starting point (live audit, 2026-10-14):** the technical base is sound (hreflang, self-canonicals, crawlers exempt from the language redirect, honest JSON-LD). What holds rankings back: no page targets the words buyers type (no title said "logiciel de caisse" or "aplikasi kasir"), thin content (8 blog posts of ~300 words, none since 3 July), no authority (a search for "epidom" returns epidemiology), and France's `caisse` keywords depend on the NF525 decision.

**Expected timing:** long-tail terms 2–4 months after the pages exist, mid-tail 6–12 months, head terms ("logiciel de caisse", "aplikasi kasir", "pos system") 12–24+ months, and only with links.

### Phase overview

| Phase | Scope | Status |
| --- | --- | --- |
| 0 — Hygiene | Remove junk from the index, retarget titles, fix the H1 and structured data, crawler access | ✅ live in 3.12.1 (b7b36aec, 2026-10-14) |
| 1 — Speed | Static marketing pages, one language bundle per visitor, image/favicon weight, Core Web Vitals baseline | ✅ bundle + favicon 3.13.0, static pages 3.16.0, share images 3.17.0, lab baseline + font preloads 3.17.1; field data open |
| 2 — Pages that rank | Free tools, vertical pages, feature pages, more comparison pages, blog cadence | ✅ 3.14.0 (tools, 32 landing pages, 10 comparisons) + 3.15.0 (blog); ongoing cadence is the operator's |
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

- [x] **Marketing pages are static** (3.16.0). All marketing routes moved to `src/app/(marketing)/m/[locale]/` (`generateStaticParams` for fr/id/en, `dynamicParams = false`); the proxy rewrites every public marketing URL there (`/pricing` → `/m/fr/pricing`, `/id/pricing` → `/m/id/pricing`) and 308s direct `/m/*` visits to the public URL. Pages read the language from `params` (`src/features/marketing/seo/route-locale.ts`); the root layout no longer calls `headers()` (no `lang` on `<html>`: the marketing layout puts `lang` on its wrapper and sets `<html lang>` with an inline script; storefront/app set it from I18nProvider). Home and changelog revalidate hourly. Built output: every `/m/[locale]/…` route ● SSG; served with `x-nextjs-cache: HIT`, TTFB ~7–23 ms locally (was 350–1,500 ms on prod). Unknown blog/docs slugs now 404 (they were soft-404 200s). Checked in Chromium: `<html lang>` per page, soft navigation, header language switch.
- [x] **Only the visitor's language file** (3.13.0). `SeededI18nProvider` (`src/components/lang/seeded-i18n-provider.tsx`, a client module) lazy-loads one `seeded-i18n-{fr,id,en}.tsx`. Measured on a production build: every page loaded both the fr (318 KB) and id (299 KB) chunks; now only its own. Raw JS per page: `/en` 1948 → 1333 KB, `/` 1948 → 1651 KB, `/id` 1948 → 1632 KB. The same `next/dynamic` calls in a server component did NOT split (all chunks stayed in the script tags). Header language switch and hydration checked in headless Chromium (no console errors).
- [x] **Favicon 581 KB → 8 KB** (3.13.0): the old file's own 16/32/48 px images repacked as PNG entries, same artwork.
- [x] **Per-page share images** (3.17.0): `/og/<landing|blog|compare>/<locale>/<slug>` (`src/app/og/[kind]/[locale]/[slug]/route.tsx`, `next/og`, Geist from the `geist` package, prerendered, `dynamicParams = false`); landing, blog and comparison metadata point at their own image (not file-based `opengraph-image`: that would live under the internal `/m/` path the proxy redirects). Home/pricing keep the site-wide `og-image.png`.
- [x] **Core Web Vitals lab baseline** (2026-10-14, on 3.17.0 in production). The PageSpeed API was still over its daily quota, so measured with Playwright Chromium from Bali: 412×823 phone viewport, 150 ms RTT, 1.6 Mbps down, 4× CPU slowdown (Lighthouse's mobile throttling), fresh browser per run, median of 3. Script: `cwv.cjs` in the session scratchpad. No "before" lab numbers exist; before 3.16.0 only TTFB was measured (350–1,500 ms). CLS was 0 on every page.

  | Page | TTFB | FCP | LCP | LCP element |
  | --- | --- | --- | --- | --- |
  | `/` | 177 ms | 1.97 s | 3.04 s | hero image |
  | `/id` | 129 ms | 1.88 s | 2.50 s | hero image |
  | `/en` | 168 ms | 1.98 s | 2.62 s | hero image |
  | `/pricing` | 133 ms | 1.74 s | 2.30 s | h1 |
  | `/id/pricing` | 140 ms | 1.83 s | 2.53 s | h1 |
  | `/calcul-cout-de-revient` | 262 ms | 2.79 s | 3.99 s | first paragraph |
  | `/blog/reduire-commission-deliveroo-uber-eats` | 333 ms | 3.06 s | 5.62 s* | first paragraph |
  | `/compare/zelty` | 189 ms | 1.96 s | 3.00 s | first paragraph |

  \*Network variance: a single traced run of the same page gave FCP 1.9 s / LCP 2.7 s. The trace showed the bottleneck: the 42 KB render-blocking stylesheet finished at ~1.76 s because 7 preloaded font files (~238 KB) were downloading alongside it, two of them never used on a marketing page.
- [x] **Fewer font preloads** (3.17.1): GeistMono (57 KB, monospace, never painted first) is no longer preloaded on any page: `src/lib/fonts.ts` declares it with `preload: false` (same file and fallbacks as `geist/font/mono`) for the root, auth, Back Office and POS layouts, and a test fails if anything imports the package's version again; IM Fell's upright face is dropped (its only user, `.epi-script`, is always italic). Not done: Geist Sans (57 KB) is still preloaded on marketing pages, which never render it. It is the app's and storefronts' font, set on `<html>` so that portaled dialogs inherit it, and moving it out of the root layout is a bigger change.

  **After 3.17.1** (same method, 2026-10-14): the home page preloads 5 font files instead of 7, and the blog post's stylesheet finishes at 1.36 s instead of 1.76 s. Medians: `/` FCP 1.68 s / LCP 1.68 s (was 3.04 s), `/id` 1.69 / 1.69, `/en` 1.70 / 1.70, `/pricing` 1.49 / 1.49, `/id/pricing` 1.51 / 1.51, `/calcul-cout-de-revient` 1.57 / 1.57, blog post 1.56 / 1.56, `/compare/zelty` 1.52 / 1.52; CLS 0 everywhere. Part of the gain is network variance between runs (a single traced home run gave LCP 2.0 s, the hero image), but every page is now under Google's 2.5 s "good" LCP line in this lab setup.
- [ ] **Real-user Web Vitals go nowhere.** `src/lib/web-vitals.ts` beacons LCP/CLS/INP/FCP/TTFB from every production page view to `/api/analytics/web-vitals`, whose handler discards them, so each visit costs function calls and yields no field data. Decision needed (see Decisions).

## Phase 2 — Pages that rank — ✅ 3.14.0 + 3.15.0

Landing system (3.14.0): `src/features/marketing/landing/` — `registry.ts` (slug → language + hreflang group, link labels; imported by the proxy, sitemap and footer), `content/<group>.ts` (one `LandingPage` per language, server-only), `render-landing-page.tsx` + `components/landing-page-view.tsx`, a route folder per slug in `src/app/(marketing)/<slug>/page.tsx`. A page exists in ONE language at its own slug; the proxy 308s the slug under any other prefix to it and never redirects it by browser language. hreflang links the group's siblings at their own slugs. Tests: registry ↔ content ↔ route files, titles ≤ 60 / descriptions ≤ 160, ≥ 550 words, banned claims, own-currency prices, French typography (`landing-content.test.ts`), proxy (`proxy-landing-pages.test.ts`), sitemap. Content written from `FACTS.md` (product facts sheet in the session scratchpad: plans, prices, what each plan includes).

Free tools:

- [x] **Recipe cost / HPP calculator** (3.14.0): `/calcul-cout-de-revient`, `/id/kalkulator-hpp`, `/en/recipe-cost-calculator`. New `RecipeCostCalculator` + `lib/recipe-cost.ts` (ingredients by pack price/size/quantity, portions, packaging, target food cost, optional selling price; tested).
- [x] **Delivery-app commission calculator pages** (3.14.0): `/calcul-commission-uber-eats`, `/id/kalkulator-komisi-gofood`, `/en/delivery-app-commission-calculator`, embedding the home `MarginCalculatorSection`.
- [x] **Free QR menu pages** (3.14.0): `/menu-qr-code-gratuit`, `/id/menu-qr-code-gratis`, `/en/free-qr-code-menu` (viewing is free; ordering is POS).

Vertical and feature pages (3.14.0):

- [x] id: aplikasi-kasir-cafe, aplikasi-kasir-restoran, aplikasi-kasir-toko-roti, aplikasi-kasir-offline; en: cafe-pos-system, bakery-pos-system, offline-pos-system.
- [x] Online ordering: fr commande-en-ligne-restaurant, id pesan-online-tanpa-komisi, en commission-free-online-ordering.
- [x] Feature pages in 3 languages: kitchen display (ecran-cuisine-kds / layar-dapur-kds / kitchen-display-system), stock & recipes (gestion-stock-restaurant / aplikasi-stok-bahan-baku / restaurant-inventory-software), staff scheduling (planning-personnel-restaurant / jadwal-shift-karyawan / restaurant-staff-scheduling), offline (caisse-hors-ligne), receipt printers (imprimante-ticket-caisse / printer-struk-kasir / receipt-printer-pos).
- [ ] fr logiciel-caisse-cafe and logiciel-caisse-boulangerie — **after the NF525 decision**.
- [x] Footer "Guides & tools" column with the language's landing pages (3.14.0). `/services` itself is unchanged (it still links nothing to the feature pages).

Comparison pages (3.14.0):

- [x] fr: L'Addition, Lightspeed, Innovorder, Popina, Zettle (Tiller is the existing SumUp POS Pro page). id: Pawoon, Qasir, Olsera, ESB, Kasir Pintar. Drafted by research agents, then a legal pass: competitor facts only from the competitor's own site/help centre (re-fetched 2026-10-14), feature rows without official evidence deleted ("not mentioned" never stands for "doesn't have"). Lightspeed's draft claimed "no offline mode" — false per its help centre; its official pricing page was unreadable (403), so the page compares no price. Popina's pricing page was unreadable too.
- [x] **The 6 existing comparison pages were wrong** about Epidom: they promised free online ordering and "~5 minutes" setup. Corrected (3.14.0) and pinned by `compare-data-claims.test.ts`.
- [x] Individual comparison pages are linked from the `/compare` hub (all 17); the footer links the hub only (17 links would swamp it).

Content:

- [x] **The 8 existing posts rewritten** (3.15.0): 1,000–1,600 words each, free-ordering / "5 minutes" claims removed, `updated` (→ sitemap lastModified + BlogPosting dateModified) and `related` landing links (rendered under the article). Guarded by `blog-content-claims.test.ts`.
- [x] **5 new posts** (3.15.0): fr fiche-technique-recette-modele-cafe-boulangerie, ouvrir-un-cafe-materiel-outils-de-caisse; id cara-menentukan-harga-jual-menu-kafe, modal-buka-kafe-kecil-peralatan-dan-aplikasi; en how-to-price-a-cafe-menu.
- [ ] Blog cadence going forward: 2 posts/month in fr and id (operator/content owner; the brief used for these is in the session scratchpad `phase2/BLOG_BRIEF.md`).

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
- [ ] **Real-user Web Vitals.** Today they are sent from every page view and discarded (Phase 1). Either send them to Google Analytics as events, only for visitors who accepted analytics (field data for every page; recommended), or remove the reporter and its endpoint (saves the calls; rely on Search Console's Core Web Vitals report once the site has enough Chrome traffic).
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

**Suspected bugs / known risks:** last adversarial review not done (L19) · `PAYMENT_FEE_DEFAULTS` flat fee (L20) + card fees in euro stores (L33) — NOT fixed on 2026-10-14 because another session was actively editing `pos-order-settlement.ts` / finance code where the fix lands; fix = currency-aware defaults (IDR 2.9% + Rp 2.000, EUR 1.5% + 0,25 €, USD 2.9% + $0.30, transfers flat only in IDR) passed through `computeProcessingFee`/`resolvePaymentFeeRate`, plus a decision on already-recorded EUR fees · known risks (L97, L99). ~~Select heights ignored app-wide (L27)~~ fixed in 3.17.0 (`SelectTrigger` default height is a plain `h-9`/`h-8` class; not seen on the POS dialogs in a browser).

**Not verified live (browser/iPad/printer):** L38, L164, L174, L184, L197, L207, L219, L310–311, L367–368.
