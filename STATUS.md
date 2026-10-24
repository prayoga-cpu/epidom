# STATUS.md

## 3.37.1 — "Congratulations on choosing Epidom" after sign-up and payment (2026-10-24)

- [x] Sign-up: `WelcomeNotice` on the setup wizard for a brand-new account (no business yet) landing from `?verified=1` without `error`, or `?signup=google` (`useOnboardingLanding` → `welcome`). Dismissible; hidden once the owner leaves the first step shown and on the launch screen. The flags are stripped from the URL, so a reload doesn't show it again.
- [x] Payment: gold congratulations card on `/checkout/success` (paid and trial); the Billing page's `?success=true` alert (custom-price checkout) gets the same title.
- [ ] Not browser-tested yet (phone + desktop, light + dark).

## 3.37.0 — Hold / Resume hold with the Active Queue off, POS & Orders access (shipped 2026-10-24)

- [x] Active Queue off → Save Bill becomes Hold: `usePosCart.holdSale` parks the cart on the device (`heldSales[storeId]`, max `MAX_HELD_SALES` = 20), no server call, works offline. The server still refuses `/pos/orders/hold` in this mode (unchanged).
- [x] Cart header: "Resume hold" replaces the Order Queue link while the store has held sales on this device (any queue mode); one hold resumes on tap, several open a newest-first list (`PosResumeHoldButton`). Resuming over a non-empty cart holds that cart in its place (`resumeHeldSale` → `swapped`). Without holds the link reads "Order Log" when the queue is off.
- [x] Orders page, queue off: opens on the Log, POS / Online ordering tabs disabled (saved tab untouched). PosOrderQueue's own "Active Queue is off" placeholder was unreachable after this and was removed with its strings.
- [x] Staff Page Access: "POS & Orders" row grants `/pos` + `/pos/orders` together (`ACCESS_BUNDLES` in page-access-checklist.tsx). Enforcement is still per page; a row with only one of the two shows half-ticked.
- [ ] Not browser-tested on iPad yet (Hold → Resume hold, the held list, swap toast).
- [ ] Open decision: turning the queue off while saved bills (HELD) or unpaid orders are still open hides them from the queue — HELD bills can't be resumed from the Log. Proposed: warn (or block) on switch-off when the queue isn't empty.
- [ ] Known limit: held sales live in one browser only (another till can't see them; clearing site data loses them).

## 3.36.0 — Verification email: link + 6-digit code (shipped 2026-10-24)

- [x] Why: a signup (2026-10-21) could not tap the verify button. Resend showed the email delivered but never clicked; Gmail had filed it as spam, which turns links off. The account got verified by copy-pasting the address.
- [x] One email, two ways in: the link and a 6-digit code (Better Auth `emailOTP`; the code is made by `createVerificationOTP` inside the link email's hook, so the plugin's own mailer never runs). Hashed, 1 hour, 5 wrong tries, only the newest code works, unverified accounts only. Subject leads with the code.
- [x] Code form (`VerifyEmailCodeForm`) on /verify-email-sent and in the login page's "Email not verified" box. Success signs in and lands where the link would.
- [x] Every other emailOTP endpoint answers 404 (`DISABLED_EMAIL_OTP_PATHS` in `src/lib/auth/email-verification-code.ts`); a test reads the plugin's own path list so an upgrade can't open a new one quietly. End-to-end test drives the real `auth.ts` (`src/__tests__/auth/email-verification-code-flow.test.ts`).
- [x] Emails: the fallback address is a real link (verify + reset); signup names are HTML-escaped (`greetingFor`), so a name can't add its own link to an email we send; the staff PIN email is escaped too.
- [ ] Operator decision (deliverability): Resend click tracking is ON for prionation.io (every link goes through a shared tracker domain), and the From domain (prionation.io) doesn't match the brand or the link domain (epidom.fr, which has no SPF/DMARC at all). Options: turn click tracking off (prionation.io is shared with the PRIONATION finance and transport apps), or send from epidom.fr (needs a paid Resend plan or a second Resend account, plus DNS records on epidom.fr).

## 3.35.0 — Build Your Own menu (shipped 2026-10-24)

- [x] `buildYourOwn` switch (default off) on `Product` and `MenuItem` (migration `20261024090000_build_your_own`; items in the importer's "Build Your Own" category are backfilled on). An item is BYO when its own flag or its product's is on (`isBuildYourOwnItem`).
- [x] Data → Products (Add/Edit): switch above the options; on = options edited as numbered steps, each choice can link a raw material + quantity (stock deducted per sale, existing `ProductOption.materialId`). Turning it on moves a counted product to made to order (asks first if stock is counted). Linked materials must belong to the store (checked on save).
- [x] Storefront → Menu: same switch for hand-made items (price-only choices); linked items point to the product. BYO badge in the item list.
- [x] Cashier: BYO chip on tiles; options dialog shows numbered steps, pick limits, a running total; a full BYO step refuses extra picks; a skipped required step is highlighted.
- [x] Storefront (menu drawer + item page): one shared picker (`storefront-option-picker.tsx`) with steps, progress bar, total on the Add button, "From" prices; the `alert()` on a skipped option is gone.
- [x] Security: public orders rebuild options from the menu (`resolveSelectedOptions`, strict: unknown/over-limit/missing-required → 422); the till reprices matched options (lenient, keeps held/offline lines); stock deduction only looks up materials in the order's store; the public menu no longer exposes option material ids/quantities.
- [x] Fixed: a public order with the same item on two lines was refused as "unavailable" (id list wasn't deduped).
- [ ] Not browser-tested yet: try a BYO product end to end (Data → Products, till, storefront, order, then check the material moved in the Movements log).
- [ ] Dev branch: run `prisma migrate deploy` for `20261024090000_build_your_own` (the operator runs it).

## 3.29.0 — Sales page lead capture (shipped 2026-10-20)

✅ `SalesLead` DB model · ✅ `/api/public/sales-pages/leads` route · ✅ `lead-capture.js` (VSL 4-min timer + exit intent) · ✅ All 12 sales-page HTML files updated · ✅ Resend newsletter integration (graceful degradation)

### Operator to-do (3.29.0)

- [ ] **Resend newsletter audience (operator):** create an audience in Resend → copy its ID → set `RESEND_NEWSLETTER_AUDIENCE_ID` in Vercel env vars. Leads will then be auto-added as contacts. Until this is set, leads are saved to `sales_leads` only (no newsletter sync, no breakage).
- [ ] Dev branch: run `prisma migrate deploy` (the `20261019211747_add_sales_leads` migration).

## 3.28.0 — Infra consolidation (shipped 2026-10-19)

✅ Fonnte removed (wa.me flow kept) · ✅ `@ai-sdk/google` removed · ✅ SheetJS CDN tarball · ✅ Session location from Vercel geo headers (migration `20261019145420_add_session_location`) · ✅ CloudflareR2Adapter + storage factory wired · ✅ `isOwnUploadUrl` centralised across 7 callers · ✅ Blob→R2 migration script · ✅ `docs/OPERATIONS.md` secrets inventory · ✅ 6 ops GitHub Actions workflows · ✅ AGENTS.md Operations section

### Operator to-do (3.28.0)

- [ ] **Cloudflare Worker for media.epidom.fr** — create a Worker in the Cloudflare dashboard, bind it to the `epidom` R2 bucket as `EPIDOM_BUCKET`, paste the script from `docs/OPERATIONS.md`, and set the custom domain `media.epidom.fr`. This is the public URL for user-uploaded images.
- [ ] Add `R2_MEDIA_PUBLIC_URL=https://media.epidom.fr` to Vercel env vars (no separate bucket needed — `R2_MEDIA_BUCKET` can be omitted; uploads use the existing `epidom` bucket under the `media/` prefix).
- [ ] Set `STORAGE_PROVIDER=cloudflare-r2` in Vercel env to switch new uploads to R2.
- [ ] Run `npx tsx scripts/migrate-blob-to-r2.ts` (dry-run first, then `--apply`) to migrate existing Blob URLs.
- [ ] Add `CF_DEPLOY_HOOK` GitHub Actions secret (Vercel deploy hook URL for production).
- [ ] Add `DEV_DATABASE_URL` and `DEV_DIRECT_URL` GitHub Actions secrets for `ops-restore-to-dev.yml`.
- [ ] Rotate last-rotated dates in `docs/OPERATIONS.md` when secrets are first added.

---

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

## Outside the SEO phases

### Custom date ranges, clean sales-page URLs, video fill, viewer removed — 3.27.0 (2026-10-19)

- [x] Custom date range ("Custom", the app's calendar `DateRangeField`) after the range tabs on /admin/sales-pages, /admin/pixel and the partner page: `range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD`, whole UTC days, both included (`src/lib/report-range.ts`, `src/components/reports/custom-range-picker.tsx`). Those three are the only range toggles in admin.
- [x] Sales pages never show ".html": the report's "open" links are `/sales-page-N?lang=fr` / `/en|id/sales-page-N`; the proxy honours `?lang=` on an unprefixed sales page (nothing stored) and `lang-switch.js` drops it from the address bar; `/sales-pages/sales-page-N[.en|.id].html` redirect (307) to the public URL (next.config `redirects`).
- [x] Sales-page video fills its box (`object-fit: cover` in vsl.js; full screen shows the whole picture).
- [x] Removed the read-only partner-page viewer (Access dialog section, partner admin card, `/api/admin/partners/[id]/viewers*`, `?partner=` switcher). Admins follow partners on Referrals. Accounts that were viewers (Evan?) lose the partner page: tick "Referrals" in their Access dialog if they should keep following Aaron.
- [ ] **Later release:** drop the unused `partner_viewers` table (`PartnerViewer` model + `User.partnerViews` / `Partner.viewers` relations). Kept one release so the deployment serving during the rollout keeps its schema.

### Partner bank details — 3.26.0 (2026-10-19)

- [x] Partners enter where they're paid on their page (holder, bank, IBAN/account number, BIC/SWIFT), encrypted at rest (`src/lib/crypto/field-encryption.ts`, key from BETTER_AUTH_SECRET, migration `20261022090000_partner_bank_details`); full admins see them with copy buttons and in Record payout; scoped admins see only "provided"; viewers never.
- [x] Decision (operator, 2026-10-19): no Stripe refund events. Payments stay on Epidom's Stripe; a refunded customer's commission is voided by hand during the 30-day hold.
- [x] The partner page's "Back to stores" is hidden for partners without a business (meant for 3.25.0, the page change hadn't landed).
- [x] Dev branch: `migrate status` = up to date (2026-10-19, checked from here; endpoint confirmed as the development branch via the Neon API).
- [ ] Privacy (operator): the privacy policy doesn't mention partners' bank details or that partners see their customers' business names.

### Access in one place, partner invitations, video thumbnail — 3.25.0 (2026-10-19)

- [x] `public/vsl-thumbnail.png` (994 KB) → `public/sales-pages/vsl-thumbnail.webp` (64 KB) + `.jpg` (92 KB); the video box's cover on all 12 sales pages (vsl.js; `<link rel=preload>` in each head; tap anywhere plays; poster while loading).
- [x] Users list: one "Access…" (`src/features/admin/components/user-access-dialog.tsx`): full admin, admin pages, referral partner (opens the partner form next), partner-page views. Yellow "Admin" label for non-master admins; Partner label green.
- [x] New referral partner: user picker (`GET /api/admin/partners/candidates`, section partners) or invite by email (Resend; `Partner.inviteEmail`, migration `20261021090000_partner_invites`; `/partner-invite` public page → sign up/in with `?next=` → auto-accept → `/admin/my-referrals`; resend from the partner page). "Link opens" includes the sales pages; code auto-fills from the name.
- [x] Partner-only accounts: /stores sends them to their partner page (gatekeeper `partner-page`); partner page has Sign out, and no "back to stores" without a business.
- [x] Dev branch: up to date (2026-10-19).
- [ ] Not seen in a real browser while signed in (admin dialogs covered by render tests; the session-minting route is classifier-blocked).

### Sales-page video — 3.24.0 (2026-10-19)

- [x] `videos/VSL.mp4` (R2 bucket `epidom`, 96.85 MB, 5 min 27 s, fast-start) on all 4 sales pages × 3 languages: `public/sales-pages/vsl.js` (loads nothing until play is tapped; page 4 gets an injected gold play button), `GET /api/public/sales-pages/video` → 302 to a 6-hour signed GET link for that one key (`src/lib/storage/sales-video.ts`, `@aws-sdk/s3-request-presigner`). The bucket is NOT public: it also holds the DB backups. Captions "[X minutes…]" → 5 minutes (French + translation tables, EN/ID regenerated).
- [x] Checked locally: a signed link to the object answers 206 with `video/mp4` and range support.
- [ ] Prod uses the Vercel `R2_*` credentials: verify after deploy that they can read bucket `epidom` (else set `R2_MEDIA_BUCKET` / give the token read access). Video plays aren't counted in the sales-page report yet.

### Partners, referrals and commissions — Release B: partners, commission, admin access — 3.23.0 (2026-10-19)

- [x] Admin access per page: `src/config/admin-sections.config.ts` (one registry for nav, guards, grant dialog), `User.adminSections`, `getAdminAccess()` / `requireAdminSection()` / `getActingAdmin({ section })` / `withAdminApiHandler(h, { section })` (no section = full admin only). Users list + activity log stay full-admin. Shared `admin/layout.tsx` nav (hidden for partner-only accounts). "Admin pages…" in the users list (audited `admin.user.set_admin_sections`, reversible), `SECTION_GRANT` grant source. Fixed: a DB-flag admin could reset/temp-password/delete/wipe a hardcoded admin.
- [x] Referrals (`/admin/partners`, label "Referrals"): `Partner`, `PartnerSalesPage` (one owner per page, credit-from date + backfill), deal copied onto `SignupAttribution` at sign-up (referral link vs sales page = last opened), self-referral refused (normalized email) or flagged (same IP as a partner session). "Make referral partner…" in the users list Manage menu, with sales pages in the same step.
- [x] Discount: one-time coupon per % (`epidom-ref-once-10`), on the Checkout Session without a trial; with the POS trial, put on the subscription by `checkout.session.completed` (after the $0 invoice). Referral links only, capped at 50%.
- [x] Commission ledger from `invoice.payment_succeeded` (re-reads the invoice; window from the first paid invoice's period; yearly 3/12), refunds from `refund.created` / `refund.updated`, 30-day hold computed on read, payouts per currency (full admin), void. Math in `src/lib/partners/commission-math.ts`.
- [x] Partner page viewers (`PartnerViewer`): "Can view this partner's page" on the partner's admin page; the viewer opens Partner dashboard, read-only (landing switch disabled), commission stays the partner's. For Evan Cao (ecao.inquiries@gmail.com) on Aaron's page. **Removed in 3.27.0.**
- [x] Partner page `/admin/my-referrals` (fr/en/id): sales-page report of their own pages (same figures as the admin report, range tabs) + commission details + customers (no emails) + payouts; referral link with per-channel links for link partners. Banner "Bob's referral: 10% off" on /register and the home page.
- [x] ~~Stripe refund events~~: decided not needed (3.26.0 section): refunds are voided by hand.
- [x] Dev branch migrated (up to date on 2026-10-19).
- [ ] **Set up Aaron (operator, after the deploy):** Admin → users list → Aaron's Manage menu → Make referral partner…: no referral code, 30% for 3 months, tick his sales page, "count sign-ups from" 2026-10-20. He then sees only Partner dashboard. (Which page is his wasn't specified.)
- [x] ~~Then Evan: add him as a viewer of Aaron's page~~: viewers removed in 3.27.0; give Evan the Referrals page in his Access dialog instead, if wanted.
- [ ] Not built: a "10% off" note on the plan cards (Stripe Checkout shows the discount itself); a partner can't see visits to their referral link (only sign-ups).
- [x] Verified on the Stripe sandbox with test clocks (real API, in-memory DB): POS trial → the $0 trial invoice has no discount, the first paid invoice after 14 days is EUR 12.59 (10% off 13.99), window starts at the trial's end, commission 3.77, month 2 full price → 4.19, a replayed webhook adds nothing; no trial → first invoice 12.59, commission linked to its payment intent. Not run in a browser Checkout (same coupon mechanism).
- [ ] **Privacy (operator):** partners see their customers' business name and plan; the privacy policy doesn't say so yet.

### Partners, referrals and commissions — Release A: sign-up tracking — 3.22.0 (2026-10-19, pushed 0a1b902c, verified live on epidom.fr + www, CI green)

Plan: partners (Aaron = owner of a sales page, referral-link partners with a 10% first-invoice discount), 30% for the customer's first 3 months, manual payouts, per-page admin access. Release A ships the tracking before the sales-page ads start (2026-10-20); Release B (3.23.0) adds partners, admin access per page, the discount, commissions and the partner page.

- [x] Proxy cookies (`src/lib/attribution/cookies.ts`, called next to `applyConsentModeCookie`; page responses only, never redirects/API/bots; `.epidom.fr` on apex+www via `sharedCookieDomainForHost`): `epidom_source` = last referral link (`?ref=` only on `/`, `/register`, `/pricing`, any language) or sales page; `epidom_touch` = last utm_* tags + ad-click flag (fbclid/gclid/ttclid — the flag only, never the id) + landing path + outside referrer host; `epidom_sales_page` now also set server-side (Safari ITP caps the tracker.js copy at 7 days / 24 h after an ad click). `ref` added to the proxy's intent params.
- [x] `SignupAttribution` table (migration `20261019090000_signup_attributions`), one row per browser sign-up, written once by `recordSignupAttribution` from the Better Auth create hook (email POST and Google callback both carry the cookies); `fbc` from Meta's `_fbc` only (marketing consent).
- [x] `/admin/sales-pages`: "Tracked sign-ups" — by campaign (sign-ups, trials, paying) and each sign-up (came from, ad, utm, plan + status, store). No emails.
- [x] Cookie policy s4.item5 + privacy s2.item12 in en/fr/id, dates → 19 Oct 2026.
- [x] Tests: `attribution-cookies.test.ts`, `proxy-attribution-cookies.test.ts`, sales-page service (plan status, campaign summary, tracked rows).
- [ ] Dev branch: run `prisma migrate deploy` (operator; the build applies it to prod).
- [ ] Use `https://epidom.fr/sales-page-N?utm_source=…&utm_campaign=…&utm_content=…` in every ad so each ad shows up in the campaign summary (Meta adds fbclid itself; `{{campaign.name}}`/`{{ad.name}}` URL parameters work for utm_campaign/utm_content).
- [ ] **Legal check (operator):** are `epidom_source`/`epidom_touch` (tied to the account at sign-up) "functional" under the French rules? Listed as functional in the cookie policy, like `epidom_sales_page`.

### Changelog underscores + report language — 3.21.1 (2026-10-17, pushed f9c92750)

- [x] Found by the production verification of 3.21.0: the changelog's inline-Markdown parser (`src/components/shared/rich-text.tsx`, used only by the three changelog views) read `_…_` inside a word as emphasis, so epidom_consent_mode / epidom_sales_page rendered as "epidom*consent*mode". `_` emphasis now needs word edges on both sides (CommonMark), checked in code (no regex lookbehind: Safari < 16.4 can't parse it).
- [x] `currentTrackingLocale()` falls back to `?lang=` then `getLanguagePreference()` when `<html lang>` isn't set yet (app routes set it in an effect after the bridge's first PageView / AUTO beacon), so those rows carry a locale.

### Cookie banner by country — 3.21.0 (2026-10-17, pushed baf52255, verified live)

- [x] The proxy sets `epidom_consent_mode` (`opt-in` / `opt-out`) on every page response from Vercel's `x-vercel-ip-country` (`src/lib/consent-region.ts`, `applyConsentModeCookie`, only when it changes). Opt-in = EU 27 + EU outermost regions (GF GP MQ RE YT MF) + EEA (IS LI NO) + UK, Crown dependencies, Gibraltar + CH; no/unknown country = opt-in.
- [x] `CONSENT_BOOT_SCRIPT` (root layout `<head>`, before the pixel stub/bridges): opt-out + no record → automatic record (`auto: true`, analytics + marketing on, language = what `getLanguagePreference` would have returned, so the app's language doesn't change); opt-in + automatic record → removed (bar shows). Never on `/@…` storefronts or `/r/…` receipts (merchants' customers). A visitor's own choice is never touched; a language change keeps `auto`, any choice drops it.
- [x] `public/sales-pages/pixel.js`: same rules from the same cookie. "Manage cookies" still turns everything off in every country.
- [x] `/admin/pixel`: AUTO counted as "On by default (no consent needed)" (`CONSENT_CHOICES` gains `AUTO`, logged once by `MetaPixelConsentBridge` / pixel.js).
- [x] Cookie policy (s2, s3 + `epidom_consent_mode`, s5, s6), privacy s3.item6 and GDPR item3 rewritten in en/fr/id; privacy + GDPR dates → 17 Oct 2026.
- [ ] **Legal check (operator):** if the company running Epidom is established in France, GDPR applies to its processing of every visitor's data, wherever they are, and Indonesia's PDP Law (UU 27/2022) also covers Indonesian visitors. Confirm with whoever handles legal that "on by default outside Europe" is acceptable; adding a country back to the banner is one line in `CONSENT_REQUIRED_COUNTRIES`.

### Meta Pixel ready for ads — 3.20.0 (2026-10-17, pushed 619b7fb5)

- [x] Audit first (same day): pixel `1821676715464709` loaded only inside the Next.js app and only after marketing consent, but the cookie bar lived only in the marketing layout, and the 12 sales-page files (`public/sales-pages/`, the ad landing pages) had no pixel and no bar at all (checked on the live site: no stub on any `/sales-page-N`). So a visitor from an ad → sales page → `/register` could never consent and their CompleteRegistration never reached Meta.
- [x] `public/sales-pages/pixel.js` on every sales page (French originals + regenerated EN/ID copies): the cookie bar in the page's language (shadow DOM, the site's `cookie.*` strings), saving the site's own record (`cookie-consent-preferences` v1.0.0) so one answer covers both; with marketing consent PageView + ViewContent + custom `SignUpClick` per `[data-cta]`; with analytics consent GA4. Forwards `fbclid` + `utm_*` to `/register`. Disabled off `epidom.fr`/localhost (same rule as `TRACKING_ENABLED`).
- [x] `CookieConsentBar` mounted in the `(auth)` layout (login, register, forgot/reset password, verify email).
- [x] InitiateCheckout / StartTrial / Subscribe carry `value` + `currency` (`planChargeAmount`: one month, or the whole year for yearly; a trial = first charge after it). The default Checkout success URL adds `billing`, `currency` and `session_id={CHECKOUT_SESSION_ID}`; the session id is Meta's `eventID` and keys a once-per-tab guard, so a reload doesn't count twice. `Contact` on customer WhatsApp buttons (contact page, home final CTA + hero support, pricing + billing Enterprise); not on press/careers/partners.
- [x] `/admin/pixel` (button on `/admin`): first-party copy of every pixel event and every cookie-bar answer (`TrackingEvent` table, migration `20261017090000_tracking_events`, `POST /api/public/tracking-events`), anonymous (no user, IP or cookie stored). Totals with values, per page, per day (UTC), consent split site vs sales pages, and CompleteRegistration ÷ accounts created.
- [x] Review fixes before shipping: "Manage cookies" button added to each sales page's footer (reopens the bar on its settings; withdrawal = `fbq('consent','revoke')` + GA opt-out flag + `_fbp/_fbc/_ga*` deleted, as on the site); the checkout API flags its billing-portal answer (`portal: true`) so /pricing and the setup wizard don't record a checkout for a plan change; a trial's value is on GA `trial_started` only; tracking-events rate limit 240/min/IP (shared mobile IPs).
- [x] Tests: new suites for pixel.js (jsdom), the API, the service, `tracking-events`, the auth layout; updated checkout, cookie bar, contact, landing, pricing, onboarding, sales-pages suites. Real-browser pass (Chromium + WebKit, built app on :3100, Meta/Google requests aborted, logging intercepted): sales page → Accept → button → /register end to end, Reject sends nothing, no horizontal scroll at 360/390/1440px. Not seen in Meta's Events Manager.
- [ ] Known limits: a returning Stripe customer whose existing currency differs from the page's is charged in their old currency while the success URL keeps the page's (value labelled in the wrong currency, rare); `/checkout/success` can be opened by hand and send a valued conversion (as before, now with a value); `tracking_events` has no retention job yet; localhost sends to the production pixel, like the site always has.

**Operator to-do (3.20.0):**

- [ ] **Pixel ownership.** The Meta account connected for this audit (ad accounts PRIONATION.io and 552765451879779) can't see pixel `1821676715464709`: it only owns "PRIONATION Web Pixel" (prionation.io traffic) and an unused "Conversion Pixel". Make sure the ad account that will run the Epidom ads owns this pixel or has it shared (Business Settings → Data sources → Datasets), or it can't optimise on sign-ups.
- [ ] **Test Events before launch.** Events Manager → the pixel → Test Events, open `https://epidom.fr/sales-page-1` in a private window, accept the cookies, click the button, sign up: expect PageView, ViewContent, SignUpClick, then CompleteRegistration on `/register`. The same events should appear on `/admin/pixel`. Check that InitiateCheckout arrives too (it fires right before the redirect to Stripe).
- [ ] **Automatic advanced matching:** turn it on in Events Manager → the pixel → Settings (no code).
- [ ] **One host in ad links:** `www.epidom.fr` serves the site without redirecting to `epidom.fr`, and a cookie answer saved on one isn't seen on the other. Use `https://epidom.fr/…` in every ad, or add the www → apex redirect in Vercel's domain settings.
- [ ] Custom conversion: `SignUpClick` is a custom event; create a custom conversion / audience from it in Events Manager if you want to optimise or retarget on it.
- [ ] **Decision:** a conversion made while the cookie bar is still unanswered is dropped, never sent after a later Accept (deliberate rule in `src/lib/analytics.ts`). Sending it once the visitor accepts on the same page would count more sign-ups (Google's "wait for update" pattern); say if you want that.
- [ ] The migration applies to production on deploy; the dev branch needs `prisma migrate deploy` (or wait for the nightly reset after prod has it) before `/admin/pixel` works on dev.

### Sales page 4 — 3.19.0 (2026-10-17, pushed to main)

- [x] The operator's new French page (`epidom-landing-page.html`) is `/sales-page-4`: `public/sales-pages/sales-page-4.html`, wired like pages 1–3 (button → `/register` + `data-cta="hero"`, tracker + switcher `<script>`s, hreflang links). Two other changes to the design: the footer logo (`epidom-logo.png`, not supplied) is now `/sales-pages/epidom-logo.png`, the same cream wordmark page 3 embeds, by absolute path so it loads under `/en/` and `/id/`; and the phone top padding went 35px → 60px, because the language switcher covered the headline's first line at 320–430px (measured in Chromium).
- [x] EN/ID copies generated by `scripts/build-sales-pages.ts` from `translations/sales-page-4.{en,id}.ts`. The engine now also translates `data-suffix` (the unit the counter script writes after a number, " heures" → " hours" / " jam"); pages 1–3 have none, so their copies are byte-identical.
- [x] `SALES_PAGES` gains `sales-page-4`, so the events API accepts it, the signup cookie credits it, and `/admin/sales-pages` shows it (grid now 2 columns on tablets, 4 from `xl`; card rows measured to fit at 248px). Rewrites, proxy and `noindex` already matched any N. Cookie policy lists the page (fr/en/id, date 17 Oct 2026).
- [x] Checked in headless Chromium and WebKit at 320–1440px in all three languages: no overlap, no horizontal scroll, counters end at 500+ / 100 heures·hours·jam / 50%, logo loads, the button carries `?lang=`, the cookie is `sales-page-4.<lang>`, no script errors. Not seen on a real phone.
- [x] Release checks: full vitest (533 files, 8093 tests), `tsc --noEmit`, `next build`; then `next start` + curl and Playwright (Chromium, WebKit): the three URLs 200 with `X-Robots-Tag: noindex, follow`, `/sales-page-5` 404, en/id phones redirected from `/sales-page-4` with `utm_*` kept, Googlebot not redirected, switcher FR → ID, button → `/register?lang=id` in Indonesian, tracker events credited to `sales-page-4` (intercepted, nothing written). The admin report was rendered with page-4 data in a throwaway test (no admin login available).

**Operator to-do (3.19.0):**

- [ ] The figures (500+ users in 27 countries, 100 hours saved a month, +50% revenue) are the design's own. Before paying for traffic to this page, make sure each one can be backed up, or soften it; the translations repeat them as written.
- [ ] The video box is an empty placeholder (as designed). When the video exists, it goes inside `.video` in the French page; then re-run `tsx scripts/build-sales-pages.ts`.
- [ ] The design names the `Inter` font but doesn't load it, so visitors see Arial/Helvetica. Fine as is; add a Google Fonts link to the French page if Inter was intended.
- [ ] Have a native speaker read `/en/sales-page-4` and `/id/sales-page-4`; fix wording in the tables, then re-run the build script.

### Overtime approval — 3.18.0 (2026-10-16, not pushed)

- [x] Owner switch "Overtime needs approval before it's paid" (`Store.overtimeRequiresApproval`, default off = paid automatically as before). Per staff-day Approve / Reject / Undo and "Approve all" on Schedule → Hours (`POST`/`DELETE /api/stores/[id]/attendance/overtime`, `OvertimeApproval` table). Rule in one pure function, `resolveDayOvertime` (`src/lib/attendance/overtime-approval.ts`); payroll prices only paid minutes.
- [x] Managers can decide anyone's overtime but their own; only the owner flips the switch (a manager could otherwise switch it off to get their own overtime paid). Days still on the clock or missing a clock-out can't be decided. Each row stores minutes decided + minutes approved; minutes a later clock-out correction adds wait for their own decision, and deciding them leaves the earlier minutes alone (`nextOvertimeDecision`, so a day can be "partly approved"). To change a decision: Undo, then decide again (the API refuses a day with nothing waiting).
- [x] Finance → Labour now reads `fetchPayroll` (same number as the Salary tab: base + allowances + paid overtime), replacing the separate `estimateLabourCost`. This adds allowances and commission to the labour cost (commission keeps 3.7.0's over-attribution caveat). Waiting overtime is shown, not costed. P&L net profit is unchanged: wages still reach it only as Salaries expenses.
- Known limits: no partial approval (approve all of a day or none); switching approval on puts ALL recorded overtime, earlier periods included, back to waiting until approved ("Approve all" over a range restores it); no period close, so undoing a decision on a month already paid changes that month's numbers.

**Operator to-do (3.18.0):**

- [ ] Run `prisma migrate deploy` on the Neon **development** branch for `20261016090000_overtime_approvals` (the agent is blocked from it). Until then the Hours/Salary/Labour routes read a missing column there. Production applies it on deploy.
- [ ] Browser check on a phone and desktop: switch on, approve/reject/undo a day, Approve all, a manager persona's own row, then the Salary tab, POS My Pay and Finance → Labour showing the same overtime.

---

## Carried over from the previous STATUS.md (still open)

Full text, context and line numbers: `docs/status-archive/2026-10-14-v3-revamp-and-releases.md`. Close an item here when it's done.

**Operator to-dos:** retake 3 screenshots on realistic data (3.12.0, L12) · sales pages in three languages (3.10.0, L15) and sales pages (3.9.0, L17) · ship the offline apps (3.3.7, L24) · hero photo resolution (L31) · homepage launch blockers incl. NF525 (3.4.0, L32) · 3.8.0 checks (L37) · schedule payroll (3.7.0, L42) · turn PayPal on (3.3.4, L43) · phone/iPad checks (3.3.2, L46) · onboarding live checks (3.3.0, L50) · Enterprise price signal (L60) · before promising SLAs (L61) · All outlets on a real multi-store account (L62) · Customer portal plan switching (L63) · finish the Stripe move (L65) · POS Operational on the real till (L69) · customer display on the real till (L71) · platform commission rates are estimates (L77) · URGENT at deploy (L81) · legal and compliance (L82) · content that unlocks the redesign (L83) · config and infrastructure (L84) · zoom on a real phone and iPad (L87) · publish the Google consent screen (L94) · L95 · Preview test-mode Stripe keys (L96) · nightly dev-DB reset fix (L98).

**Decisions:** offline beyond one device (L25) · unpaid storefront orders (3.8.0, L39) · billing behaviour the audit confirmed (L66) · follow-ups that need a decision (L85) · L162, L172, L222.

**Suspected bugs / known risks:** last adversarial review not done (L19) · `PAYMENT_FEE_DEFAULTS` flat fee (L20) + card fees in euro stores (L33) — NOT fixed on 2026-10-14 because another session was actively editing `pos-order-settlement.ts` / finance code where the fix lands; fix = currency-aware defaults (IDR 2.9% + Rp 2.000, EUR 1.5% + 0,25 €, USD 2.9% + $0.30, transfers flat only in IDR) passed through `computeProcessingFee`/`resolvePaymentFeeRate`, plus a decision on already-recorded EUR fees · known risks (L97, L99). ~~Select heights ignored app-wide (L27)~~ fixed in 3.17.0 (`SelectTrigger` default height is a plain `h-9`/`h-8` class; not seen on the POS dialogs in a browser).

**Not verified live (browser/iPad/printer):** L38, L164, L174, L184, L197, L207, L219, L310–311, L367–368.
