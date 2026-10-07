/*
 * Sales-page tracker, loaded by each public/sales-pages/sales-page-N[.en|.id].html as
 *   <script src="/sales-pages/tracker.js" data-page="sales-page-N" defer></script>
 *
 * Sends VIEW, CTA_CLICK (any element with data-cta="…") and SCROLL_50 / SCROLL_90
 * to /api/public/sales-pages/events, with the page's language (its <html lang>),
 * and remembers both in the epidom_sales_page cookie ("sales-page-N.en") so a
 * signup made later from this browser is credited to them (src/lib/sales-pages.ts
 * explains the whole flow; keep the cookie name and format in step with
 * SALES_PAGE_COOKIE there). Results: /admin/sales-pages.
 */
(function () {
  var script = document.currentScript;
  var page = script && script.getAttribute("data-page");
  if (!page) return;
  var lang = (document.documentElement.getAttribute("lang") || "fr").slice(0, 2).toLowerCase();
  var locale = lang === "en" || lang === "id" ? lang : "fr";

  var ENDPOINT = "/api/public/sales-pages/events";
  var COOKIE = "epidom_sales_page";
  var COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

  function send(event) {
    event.page = page;
    event.locale = locale;
    var body = JSON.stringify(event);
    try {
      // sendBeacon survives the navigation a CTA click starts.
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

  // Same rule as the auth cookies (resolveCrossSubDomainCookies in
  // src/lib/auth/cookies.ts): shared by the apex and www, so a www <-> apex hop
  // on the way to signup keeps it; host-only on a preview subdomain.
  function cookieDomain() {
    var host = location.hostname;
    if (host === "localhost" || /\.vercel\.app$/.test(host) || /^[\d.:]+$/.test(host)) return "";
    var root = host.split(".").slice(-2).join(".");
    return host === root || host === "www." + root ? "; Domain=." + root : "";
  }

  // On load, again when Back/Forward restores the page from the browser's
  // cache (the script doesn't re-run then, and another language's copy may
  // have set the cookie meanwhile), and on every sign-up click: the signup is
  // credited to the copy the visitor actually signed up from.
  function rememberVisit() {
    try {
      document.cookie =
        COOKIE + "=" + page + "." + locale + "; Max-Age=" + COOKIE_MAX_AGE + "; Path=/; SameSite=Lax" +
        cookieDomain() + (location.protocol === "https:" ? "; Secure" : "");
    } catch (e) {}
  }
  rememberVisit();
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) rememberVisit();
  });

  var view = { type: "VIEW" };
  try {
    var params = new URLSearchParams(location.search);
    if (params.get("utm_source")) view.utmSource = params.get("utm_source").slice(0, 100);
    if (params.get("utm_medium")) view.utmMedium = params.get("utm_medium").slice(0, 100);
    if (params.get("utm_campaign")) view.utmCampaign = params.get("utm_campaign").slice(0, 200);
    if (document.referrer) {
      var ref = new URL(document.referrer).hostname;
      if (ref && ref !== location.hostname) view.referrer = ref.slice(0, 200);
    }
  } catch (e) {}
  send(view);

  function onCtaClick(e) {
    var target = e.target && e.target.closest && e.target.closest("[data-cta]");
    if (!target) return;
    rememberVisit();
    send({ type: "CTA_CLICK", cta: target.getAttribute("data-cta") });
  }
  document.addEventListener("click", onCtaClick);
  // A middle click (open in a new tab) fires auxclick, not click.
  document.addEventListener("auxclick", function (e) {
    if (e.button === 1) onCtaClick(e);
  });

  var milestones = [
    { at: 0.5, type: "SCROLL_50" },
    { at: 0.9, type: "SCROLL_90" },
  ];
  var ticking = false;
  function checkScroll() {
    ticking = false;
    var doc = document.documentElement;
    var seen = (window.scrollY + window.innerHeight) / Math.max(doc.scrollHeight, 1);
    while (milestones.length && seen >= milestones[0].at) {
      send({ type: milestones.shift().type });
    }
    if (!milestones.length) window.removeEventListener("scroll", onScroll);
  }
  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(checkScroll);
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
})();
