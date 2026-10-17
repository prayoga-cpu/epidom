/*
 * The Meta Pixel, Google Analytics and the cookie bar on the static sales pages,
 * loaded by each public/sales-pages/sales-page-N[.en|.id].html as
 *   <script src="/sales-pages/pixel.js" data-page="sales-page-N" defer></script>
 *
 * The pages are plain HTML outside the Next.js app, so the site's pixel
 * (src/components/analytics/tracking-vendors.ts) and cookie bar
 * (src/features/marketing/shared/components/cookie-consent-bar.tsx) don't reach
 * them. This does the same, with the same rules:
 *
 * - Where consent is needed (EU, EEA, UK, Switzerland, or an unknown country:
 *   the epidom_consent_mode cookie the proxy sets, src/lib/consent-region.ts),
 *   nothing is sent to Meta or Google before consent: fbevents.js and gtag.js
 *   are only requested once the visitor allows marketing / analytics cookies.
 *   Elsewhere both are on by default (an automatic record, `auto: true`), no
 *   bar is shown, and "Manage cookies" turns them off.
 * - The answer is saved in the record the site reads (localStorage
 *   "cookie-consent-preferences", version 1.0.0), so a visitor who answers here
 *   isn't asked again on /register, and the reverse.
 * - With marketing consent: PageView and ViewContent on load, and the custom
 *   event SignUpClick on every sign-up button ([data-cta]).
 * - Each pixel event and each answer is also sent to /api/public/tracking-events,
 *   the first-party log behind /admin/pixel (src/lib/tracking-events.ts).
 * - Only on the production site and local development, like TRACKING_ENABLED in
 *   src/app/layout.tsx: a preview deployment must not feed the production pixel.
 *
 * Sign-up buttons also carry the ad's click id and UTM tags (fbclid, utm_*) on to
 * /register, so Meta can still attribute a sign-up when consent is given there.
 *
 * A "Manage cookies" button added to the page's footer reopens the bar on its
 * settings view, so consent can be withdrawn here as on the site: the pixel gets
 * fbq('consent', 'revoke'), Analytics its opt-out flag, and their cookies on this
 * site are deleted.
 *
 * The bar lives in a shadow root, so none of the pages' own CSS can restyle it.
 * Its strings are the site's (cookie.* and footer.manageCookies in src/locales/{fr,en,id}.ts).
 */
(function () {
  var script = document.currentScript;
  var page = script && script.getAttribute("data-page");
  if (!page) return;

  // Keep in step with the site: META_PIXEL_ID and GA_MEASUREMENT_ID in
  // src/components/analytics/tracking-vendors.ts, COOKIE_CONSENT_KEY and its
  // version in src/lib/cookie-consent.ts, TRACKING_EVENTS_ENDPOINT in
  // src/lib/tracking-events.ts. src/lib/__tests__/sales-page-pixel.test.ts checks them.
  var PIXEL_ID = "1821676715464709";
  var GA_ID = "G-S7DYSLM84X";
  var CONSENT_KEY = "cookie-consent-preferences";
  var CONSENT_VERSION = "1.0.0";
  // Set by the proxy from the visitor's country (CONSENT_MODE_COOKIE in
  // src/lib/consent-region.ts): "opt-out" = no consent needed there, so the
  // cookies are on by default and no bar is shown. Anything else: ask first.
  var MODE_COOKIE = "epidom_consent_mode";
  var ENDPOINT = "/api/public/tracking-events";

  var lang = (document.documentElement.getAttribute("lang") || "fr").slice(0, 2).toLowerCase();
  var locale = lang === "en" || lang === "id" ? lang : "fr";
  // The public URL, also when the file itself is opened (/sales-pages/…html).
  var path = locale === "fr" ? "/" + page : "/" + locale + "/" + page;
  var host = window.location.hostname;
  var TRACKING_ENABLED =
    /^(www\.)?epidom\.fr$/.test(host) || host === "localhost" || host === "127.0.0.1";

  var TEXT = {
    fr: {
      title: "Nous utilisons des cookies",
      description:
        "Accepter : Google Analytics et Vercel Analytics mesurent l'utilisation de notre site, et le Meta Pixel mesure les résultats de notre publicité. Refuser : seuls les cookies essentiels (connexion, sécurité) sont utilisés.",
      accept: "Accepter",
      reject: "Refuser",
      customize: "Personnaliser",
      back: "Retour",
      save: "Enregistrer les préférences",
      settingsTitle: "Préférences de cookies",
      settingsDescription:
        "Choisissez les cookies que vous souhaitez autoriser. Les cookies essentiels sont toujours activés car ils sont nécessaires au fonctionnement du site web.",
      essentialTitle: "Cookies essentiels",
      essentialDescription:
        "Nécessaires au bon fonctionnement du site web. Ces cookies ne peuvent pas être désactivés.",
      analyticsTitle: "Cookies analytiques",
      analyticsDescription:
        "Si accepté: Nous suivons les pages vues et le comportement des utilisateurs pour améliorer notre site. Si refusé: Aucune donnée de suivi n'est collectée.",
      marketingTitle: "Cookies marketing",
      marketingDescription:
        "Si accepté: Nous suivons les conversions et les événements à des fins marketing. Si refusé: Aucun suivi marketing n'est effectué.",
      always: "Toujours actifs",
      policy: "Politique des cookies",
      manage: "Gérer les cookies",
      close: "Fermer l'avis de cookie",
    },
    en: {
      title: "We use cookies",
      description:
        "Accept: Google Analytics and Vercel Analytics measure how our site is used, and the Meta Pixel measures the results of our advertising. Reject: only essential cookies (login, security) are used.",
      accept: "Accept",
      reject: "Reject",
      customize: "Customize",
      back: "Back",
      save: "Save Preferences",
      settingsTitle: "Cookie Preferences",
      settingsDescription:
        "Choose which cookies you want to allow. Essential cookies are always enabled as they are necessary for the website to function.",
      essentialTitle: "Essential Cookies",
      essentialDescription:
        "Required for the website to function properly. These cookies cannot be disabled.",
      analyticsTitle: "Analytics Cookies",
      analyticsDescription:
        "If accepted: We track page views and user behavior to improve our website. If rejected: No tracking data is collected.",
      marketingTitle: "Marketing Cookies",
      marketingDescription:
        "If accepted: We track conversions and events for marketing purposes. If rejected: No marketing tracking is performed.",
      always: "Always on",
      policy: "Cookie Policy",
      manage: "Manage cookies",
      close: "Close cookie notice",
    },
    id: {
      title: "Kami menggunakan cookie",
      description:
        "Terima: Google Analytics dan Vercel Analytics mengukur cara situs kami digunakan, dan Meta Pixel mengukur hasil iklan kami. Tolak: hanya cookie penting (login, keamanan) yang akan digunakan.",
      accept: "Terima",
      reject: "Tolak",
      customize: "Sesuaikan",
      back: "Kembali",
      save: "Simpan Preferensi",
      settingsTitle: "Preferensi Cookie",
      settingsDescription:
        "Pilih cookie yang ingin Anda izinkan. Cookie penting selalu diaktifkan karena diperlukan agar situs web berfungsi.",
      essentialTitle: "Cookie Penting",
      essentialDescription:
        "Diperlukan agar situs web berfungsi dengan baik. Cookie ini tidak dapat dinonaktifkan.",
      analyticsTitle: "Cookie Analitik",
      analyticsDescription:
        "Jika diterima: Kami melacak page views dan perilaku pengguna untuk meningkatkan website. Jika ditolak: Tidak ada data tracking yang dikumpulkan.",
      marketingTitle: "Cookie Pemasaran",
      marketingDescription:
        "Jika diterima: Kami melacak conversions dan events untuk keperluan marketing. Jika ditolak: Tidak ada tracking marketing yang dilakukan.",
      always: "Selalu aktif",
      policy: "Kebijakan Cookie",
      manage: "Kelola cookie",
      close: "Tutup pemberitahuan cookie",
    },
  }[locale];
  var POLICY_HREF = locale === "fr" ? "/cookie-policy" : "/" + locale + "/cookie-policy";

  // ── Ad click id and UTM tags on to /register ─────────────────────────────
  var FORWARDED = ["fbclid", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  try {
    var params = new URLSearchParams(window.location.search);
    var extra = [];
    FORWARDED.forEach(function (name) {
      var value = params.get(name);
      if (value) extra.push(name + "=" + encodeURIComponent(value.slice(0, 500)));
    });
    if (extra.length) {
      Array.prototype.forEach.call(document.querySelectorAll("a[data-cta]"), function (link) {
        var href = link.getAttribute("href");
        if (!href || href.charAt(0) !== "/" || /[?&](fbclid|utm_source)=/.test(href)) return;
        var hashAt = href.indexOf("#");
        var base = hashAt === -1 ? href : href.slice(0, hashAt);
        var hash = hashAt === -1 ? "" : href.slice(hashAt);
        link.setAttribute("href", base + (base.indexOf("?") === -1 ? "?" : "&") + extra.join("&") + hash);
      });
    }
  } catch (e) {}

  // ── First-party log ───────────────────────────────────────────────────────
  function log(event) {
    if (!TRACKING_ENABLED) return;
    event.path = path;
    event.source = "sales_page";
    event.locale = locale;
    var body = JSON.stringify(event);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }))) {
        return;
      }
    } catch (e) {}
    try {
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }

  // ── Vendors ───────────────────────────────────────────────────────────────
  function injectScript(src) {
    if (document.querySelector('script[src="' + src + '"]')) return;
    var tag = document.createElement("script");
    tag.async = true;
    tag.src = src;
    document.head.appendChild(tag);
  }

  // Meta's standard base code without its script insertion: calls are queued
  // until fbevents.js loads, which only happens in enableMarketing().
  if (!window.fbq) {
    var fbq = (window.fbq = function () {
      if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments);
      else fbq.queue.push(arguments);
    });
    if (!window._fbq) window._fbq = fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
  }

  // What runs now (marketingOn / analyticsOn) and what was already sent in
  // this page view (metaStarted / gaStarted), so a withdrawal and a later
  // re-grant never send the PageView twice. Same rules as the site's
  // src/components/analytics/tracking-vendors.ts.
  var marketingOn = false;
  var metaStarted = false;
  var metaRevoked = false;
  var analyticsOn = false;
  var gaStarted = false;

  /** Best-effort delete of this site's cookies by name, on every parent domain (as deleteCookiesMatching on the site). */
  function deleteCookies(matcher) {
    try {
      var names = document.cookie
        .split(";")
        .map(function (pair) {
          return pair.split("=")[0].trim();
        })
        .filter(function (name) {
          return name && matcher.test(name);
        });
      if (!names.length) return;
      var labels = host.split(".");
      var domains = [null, host];
      for (var i = 0; i < labels.length - 1; i++) domains.push("." + labels.slice(i).join("."));
      names.forEach(function (name) {
        domains.forEach(function (domain) {
          document.cookie =
            name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=/" + (domain ? "; domain=" + domain : "");
        });
      });
    } catch (e) {}
  }

  function enableMarketing() {
    if (marketingOn || !TRACKING_ENABLED) return;
    marketingOn = true;
    if (metaRevoked) {
      window.fbq("consent", "grant");
      metaRevoked = false;
    }
    if (!metaStarted) {
      metaStarted = true;
      var details = { content_name: page, content_category: "sales_page", language: locale };
      window.fbq("init", PIXEL_ID);
      window.fbq("track", "PageView");
      window.fbq("track", "ViewContent", details);
      log({ kind: "PIXEL", name: "PageView" });
      log({ kind: "PIXEL", name: "ViewContent", content: page });
    }
    injectScript("https://connect.facebook.net/en_US/fbevents.js");
  }

  function disableMarketing() {
    if (marketingOn && metaStarted) {
      window.fbq("consent", "revoke");
      metaRevoked = true;
    }
    marketingOn = false;
    deleteCookies(/^(_fbp|_fbc)$/);
  }

  function enableAnalytics() {
    if (analyticsOn || !TRACKING_ENABLED) return;
    analyticsOn = true;
    window["ga-disable-" + GA_ID] = false;
    if (gaStarted) return;
    gaStarted = true;
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== "function") {
      window.gtag = function () {
        window.dataLayer.push(arguments);
      };
    }
    window.gtag("js", new Date());
    window.gtag("config", GA_ID);
    injectScript("https://www.googletagmanager.com/gtag/js?id=" + GA_ID);
  }

  function disableAnalytics() {
    analyticsOn = false;
    // Google's documented opt-out switch, honoured from the next hit on.
    window["ga-disable-" + GA_ID] = true;
    deleteCookies(/^(_ga|_ga_.+|_gid|_gat|_gat_.+)$/);
  }

  function apply(choice) {
    if (choice.marketing) enableMarketing();
    else disableMarketing();
    if (choice.analytics) enableAnalytics();
    else disableAnalytics();
  }

  function onSignUpClick(e) {
    if (!marketingOn) return;
    var target = e.target && e.target.closest && e.target.closest("[data-cta]");
    if (!target) return;
    var cta = target.getAttribute("data-cta") || "";
    window.fbq("trackCustom", "SignUpClick", { content_name: page, cta: cta, language: locale });
    log({ kind: "PIXEL", name: "SignUpClick", content: (page + " · " + cta).slice(0, 100) });
  }
  document.addEventListener("click", onSignUpClick);
  document.addEventListener("auxclick", function (e) {
    if (e.button === 1) onSignUpClick(e);
  });

  // ── Consent record (the site's format) ────────────────────────────────────
  function readChoice() {
    try {
      var raw = window.localStorage.getItem(CONSENT_KEY);
      if (!raw) return null;
      var saved = JSON.parse(raw);
      if (!saved || typeof saved !== "object" || saved.version !== CONSENT_VERSION) return null;
      return { analytics: saved.analytics === true, marketing: saved.marketing === true, auto: saved.auto === true };
    } catch (e) {
      return null;
    }
  }

  /** `auto`: saved without asking, because the visitor's country needs no consent. */
  function saveChoice(analytics, marketing, auto) {
    try {
      var record = {
        essential: true,
        analytics: analytics,
        marketing: marketing,
        language: locale,
        timestamp: Date.now(),
        version: CONSENT_VERSION,
      };
      if (auto) record.auto = true;
      window.localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
      if (auto) return;
      // What the site's setCookiePreferences() writes alongside a choice.
      window.localStorage.setItem("locale", locale);
      window.localStorage.setItem("lang", locale);
    } catch (e) {}
  }

  function forgetChoice() {
    try {
      window.localStorage.removeItem(CONSENT_KEY);
    } catch (e) {}
  }

  function consentMode() {
    var match = document.cookie.match(new RegExp("(?:^|; )" + MODE_COOKIE + "=([^;]+)"));
    return match && match[1] === "opt-out" ? "opt-out" : "opt-in";
  }

  // ── The bar ───────────────────────────────────────────────────────────────
  var FONT = "Jost, Poppins, 'Helvetica Neue', system-ui, sans-serif";
  var CSS =
    ":host{all:initial}" +
    ".bar{position:fixed;left:0;right:0;bottom:0;box-sizing:border-box;max-height:90vh;max-height:90dvh;overflow-y:auto;" +
    "padding:20px max(16px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));" +
    "background:rgba(6,15,27,0.94);-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px);" +
    "border-top:1px solid rgba(255,255,255,0.08);box-shadow:0 -20px 48px rgba(0,0,0,0.45);font-family:" + FONT + ";" +
    "color:#fbf9e4;animation:up .25s ease-out}" +
    "@keyframes up{from{transform:translateY(100%)}to{transform:none}}" +
    ".inner{position:relative;max-width:1200px;margin:0 auto}" +
    ".close{position:absolute;top:-12px;right:-8px;display:flex;align-items:center;justify-content:center;width:44px;height:44px;" +
    "border:none;border-radius:999px;background:none;color:rgba(251,249,228,0.55);font:inherit;font-size:22px;line-height:1;cursor:pointer;" +
    "touch-action:manipulation;-webkit-tap-highlight-color:transparent}" +
    ".close:focus-visible{outline:2px solid #d9ae3b;outline-offset:2px}" +
    ".reopened .copy,.reopened .settings > .title{padding-right:40px}" +
    ".row{display:flex;flex-direction:column;gap:16px}" +
    "@media (min-width:640px){.row{flex-direction:row;align-items:center;justify-content:space-between}}" +
    ".copy{flex:1}" +
    ".title{margin:0 0 8px;font-size:14px;font-weight:600;line-height:1.4}" +
    ".desc{margin:0;font-size:12px;line-height:1.6;color:rgba(251,249,228,0.6)}" +
    ".links{display:flex;flex-wrap:wrap;align-items:center;margin:4px 0 0 -8px}" +
    ".link{display:inline-flex;align-items:center;min-height:44px;padding:0 8px;border:none;background:none;" +
    "font:inherit;font-size:12px;color:rgba(251,249,228,0.6);text-decoration:underline;cursor:pointer;" +
    "touch-action:manipulation;-webkit-tap-highlight-color:transparent}" +
    ".actions{display:flex;gap:12px;flex-shrink:0}" +
    ".btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 20px;border-radius:10px;" +
    "font:inherit;font-size:14px;font-weight:600;white-space:nowrap;cursor:pointer;touch-action:manipulation;" +
    "-webkit-tap-highlight-color:transparent}" +
    ".actions .btn{flex:1}" +
    "@media (min-width:640px){.actions .btn{flex:none}}" +
    ".ghost{background:transparent;border:1px solid rgba(255,255,255,0.18);color:#fbf9e4}" +
    ".gold{background:#d9ae3b;border:none;color:#060f1b}" +
    ".btn:focus-visible,.link:focus-visible,.switch:focus-visible{outline:2px solid #d9ae3b;outline-offset:2px}" +
    ".cats{display:flex;flex-direction:column;gap:12px;margin:16px 0}" +
    ".cat{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border-radius:10px;" +
    "border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03)}" +
    ".cat p{margin:0}" +
    ".cat .name{font-size:14px;font-weight:600}" +
    ".always{font-size:13px;color:rgba(251,249,228,0.4);white-space:nowrap}" +
    ".switch{position:relative;flex-shrink:0;width:56px;height:44px;border:none;background:none;cursor:pointer;" +
    "touch-action:manipulation;-webkit-tap-highlight-color:transparent}" +
    ".track{position:absolute;left:6px;top:10px;width:44px;height:24px;border-radius:999px;background:rgba(255,255,255,0.12);transition:background .15s}" +
    ".knob{position:absolute;left:8px;top:12px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .15s}" +
    ".switch[aria-checked='true'] .track{background:#d9ae3b}" +
    ".switch[aria-checked='true'] .knob{transform:translateX(20px)}" +
    "[hidden]{display:none!important}";

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function category(key, title, description, toggle) {
    return (
      '<div class="cat"><div><p class="name">' + escapeHtml(title) + '</p><p class="desc">' +
      escapeHtml(description) + "</p></div>" +
      (toggle
        ? '<button type="button" class="switch" role="switch" aria-checked="false" data-category="' + key +
          '" aria-label="' + escapeHtml(title) + '"><span class="track"></span><span class="knob"></span></button>'
        : '<span class="always">' + escapeHtml(TEXT.always) + "</span>") +
      "</div>"
    );
  }

  var barHost = null;
  var root = null;

  function removeBar() {
    if (barHost && barHost.parentNode) barHost.parentNode.removeChild(barHost);
    barHost = null;
    root = null;
  }

  function answer(name, analytics, marketing) {
    saveChoice(analytics, marketing);
    log({ kind: "CONSENT", name: name, analytics: analytics, marketing: marketing });
    removeBar();
    apply({ analytics: analytics, marketing: marketing });
  }

  function isOn(key) {
    var toggle = root && root.querySelector('[data-category="' + key + '"]');
    return !!toggle && toggle.getAttribute("aria-checked") === "true";
  }

  function showView(settings) {
    root.querySelector(".main").hidden = settings;
    root.querySelector(".settings").hidden = !settings;
    var first = root.querySelector(settings ? "[data-category]" : "[data-action=accept]");
    if (first && settings) first.focus();
  }

  /**
   * Draws the bar: on a first visit (main view, an answer needed), or from the
   * footer's "manage cookies" button (settings view, the switches showing the
   * saved choice, closable unchanged), so consent can be withdrawn here too.
   */
  function openBar(settings, current) {
    if (!document.body || !document.body.attachShadow) return;
    if (root) {
      showView(settings);
      return;
    }
    var policyLink = '<a class="link" href="' + POLICY_HREF + '">' + escapeHtml(TEXT.policy) + "</a>";
    barHost = document.createElement("div");
    barHost.setAttribute("data-epidom-cookie-bar", "");
    barHost.style.cssText = "position:relative;z-index:2147483000";
    root = barHost.attachShadow({ mode: "open" });
    root.innerHTML =
      "<style>" + CSS + "</style>" +
      '<div class="bar' + (current ? " reopened" : "") + '" role="dialog" aria-modal="false" aria-label="' +
      escapeHtml(TEXT.title) + '"><div class="inner">' +
      (current
        ? '<button type="button" class="close" data-action="close" aria-label="' + escapeHtml(TEXT.close) +
          '">&times;</button>'
        : "") +
      '<div class="main row">' +
      '<div class="copy"><p class="title">' + escapeHtml(TEXT.title) + '</p><p class="desc">' +
      escapeHtml(TEXT.description) + "</p>" +
      '<div class="links"><button type="button" class="link" data-action="customize">' +
      escapeHtml(TEXT.customize) + "</button>" + policyLink + "</div></div>" +
      '<div class="actions"><button type="button" class="btn ghost" data-action="reject">' + escapeHtml(TEXT.reject) +
      '</button><button type="button" class="btn gold" data-action="accept">' + escapeHtml(TEXT.accept) +
      "</button></div></div>" +
      '<div class="settings" hidden>' +
      '<p class="title">' + escapeHtml(TEXT.settingsTitle) + '</p><p class="desc">' +
      escapeHtml(TEXT.settingsDescription) + '</p><div class="links">' + policyLink + "</div>" +
      '<div class="cats">' +
      category("essential", TEXT.essentialTitle, TEXT.essentialDescription, false) +
      category("analytics", TEXT.analyticsTitle, TEXT.analyticsDescription, true) +
      category("marketing", TEXT.marketingTitle, TEXT.marketingDescription, true) +
      "</div>" +
      '<div class="actions"><button type="button" class="btn ghost" data-action="back">' + escapeHtml(TEXT.back) +
      '</button><button type="button" class="btn gold" data-action="save">' + escapeHtml(TEXT.save) +
      "</button></div></div>" +
      "</div></div>";

    if (current) {
      ["analytics", "marketing"].forEach(function (key) {
        root.querySelector('[data-category="' + key + '"]').setAttribute("aria-checked", current[key] ? "true" : "false");
      });
    }

    root.addEventListener("click", function (e) {
      var toggle = e.target.closest && e.target.closest("[data-category]");
      if (toggle) {
        toggle.setAttribute("aria-checked", toggle.getAttribute("aria-checked") === "true" ? "false" : "true");
        return;
      }
      var button = e.target.closest && e.target.closest("[data-action]");
      if (!button) return;
      var action = button.getAttribute("data-action");
      if (action === "accept") answer("ACCEPT_ALL", true, true);
      else if (action === "reject") answer("REJECT_ALL", false, false);
      // Saved from the settings view: CUSTOM whatever the switches say, as on the site.
      else if (action === "save") answer("CUSTOM", isOn("analytics"), isOn("marketing"));
      else if (action === "customize") showView(true);
      else if (action === "back") showView(false);
      else if (action === "close") removeBar();
    });

    document.body.appendChild(barHost);
    if (settings) showView(true);
  }

  /** "Manage cookies" in the page's footer: the way back to the choice, as on the site. */
  function addManageButton() {
    if (!document.body) return;
    var footers = document.getElementsByTagName("footer");
    var holder = footers.length ? footers[footers.length - 1] : document.body;
    var line = document.createElement("p");
    line.setAttribute("data-epidom-cookie-settings", "");
    line.style.cssText = "margin:8px 0 0;text-align:center";
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = TEXT.manage;
    button.style.cssText =
      "min-height:44px;padding:0 12px;border:0;background:none;font:inherit;font-size:12px;color:inherit;" +
      "opacity:0.6;text-decoration:underline;cursor:pointer;touch-action:manipulation";
    button.addEventListener("click", function () {
      openBar(true, readChoice() || { analytics: false, marketing: false });
    });
    line.appendChild(button);
    holder.appendChild(line);
  }

  addManageButton();
  var mode = consentMode();
  var saved = readChoice();
  // An automatic "accept" is only valid where no consent is needed: a visitor
  // now browsing from the EU is asked.
  if (saved && saved.auto && mode !== "opt-out") {
    forgetChoice();
    saved = null;
  }
  if (saved) apply(saved);
  else if (mode === "opt-out") {
    saveChoice(true, true, true);
    log({ kind: "CONSENT", name: "AUTO", analytics: true, marketing: true });
    apply({ analytics: true, marketing: true });
  } else openBar(false, null);
})();
