/*
 * Epidom's language switcher on the static sales pages, loaded by each
 * public/sales-pages/sales-page-N[.en|.id].html as
 *   <script src="/sales-pages/lang-switch.js" defer></script>
 *
 * The pages are plain HTML, so the React switcher can't mount here; this draws
 * the same one (src/components/lang/lang-switcher.tsx: same options and order,
 * same styles, the CSS variables written out) and does what it does in the
 * marketing header (urlDriven): remember the pick in the epidom_locale_pref
 * cookie and the stored language preference, then open the page in that
 * language (/sales-page-N, /en/sales-page-N, /id/sales-page-N). It lives in a
 * shadow root, so none of the three pages' own CSS can restyle it.
 *
 * Sign-up buttons ([data-cta] links) also get ?lang=<the page's language>,
 * which /register applies (AuthPage), so the form opens in the language the
 * visitor was reading, also when opened in a new tab. Nothing is stored for a
 * mere click: a signed-in team member checking an ad keeps their own language
 * (/register sends them straight to their stores).
 */
(function () {
  var OPTIONS = [
    { value: "fr", short: "FR", label: "Français", flag: "🇫🇷" },
    { value: "id", short: "ID", label: "Indonesia", flag: "🇮🇩" },
    { value: "en", short: "EN", label: "English", flag: "🇺🇸" },
  ];
  var PREF_COOKIE = "epidom_locale_pref"; // LOCALE_PREF_COOKIE in src/lib/i18n-routing.ts
  var CONSENT_KEY = "cookie-consent-preferences"; // COOKIE_CONSENT_KEY in src/lib/cookie-consent.ts

  var lang = (document.documentElement.getAttribute("lang") || "fr").slice(0, 2).toLowerCase();
  var current = OPTIONS.filter(function (o) { return o.value === lang; })[0] || OPTIONS[0];
  var match = /(sales-page-\d+)/.exec(window.location.pathname);
  var basePath = match ? "/" + match[1] : null;

  /** What setLocale() stores in the app: the preference record's language when there is one, plus the legacy keys. */
  function rememberLanguage(locale) {
    try {
      var raw = window.localStorage.getItem(CONSENT_KEY);
      var prefs = raw ? JSON.parse(raw) : null;
      if (prefs && typeof prefs === "object") {
        prefs.language = locale;
        prefs.timestamp = Date.now();
        window.localStorage.setItem(CONSENT_KEY, JSON.stringify(prefs));
      }
      window.localStorage.setItem("locale", locale);
      window.localStorage.setItem("lang", locale);
    } catch (e) {}
  }

  Array.prototype.forEach.call(document.querySelectorAll("a[data-cta]"), function (link) {
    var href = link.getAttribute("href");
    if (!href || href.charAt(0) !== "/" || /[?&]lang=/.test(href)) return;
    var hashAt = href.indexOf("#");
    var path = hashAt === -1 ? href : href.slice(0, hashAt);
    var hash = hashAt === -1 ? "" : href.slice(hashAt);
    link.setAttribute("href", path + (path.indexOf("?") === -1 ? "?" : "&") + "lang=" + current.value + hash);
  });

  if (!basePath || !document.body || !document.body.attachShadow) return;

  // Jost is the switcher's font on the site (--epi-font-body, loaded at 300-600
  // there); not every page loads it.
  try {
    var font = document.createElement("link");
    font.rel = "stylesheet";
    font.href = "https://fonts.googleapis.com/css2?family=Jost:wght@400;600&display=swap";
    document.head.appendChild(font);
  } catch (e) {}

  var FONT = "Jost, 'Futura PT', 'Helvetica Neue', sans-serif";
  var GLOBE =
    '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true" style="flex-shrink:0">' +
    '<circle cx="6.5" cy="6.5" r="5.7" stroke="currentColor" stroke-width="1.1"/>' +
    '<ellipse cx="6.5" cy="6.5" rx="2.4" ry="5.7" stroke="currentColor" stroke-width="1.1"/>' +
    '<path d="M0.8 6.5h11.4" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>' +
    '<path d="M1.5 4h10M1.5 9h10" stroke="currentColor" stroke-width="0.9" stroke-linecap="round"/></svg>';
  var CHEVRON =
    '<svg class="chevron" width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">' +
    '<path d="M1.5 3l3 3 3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var CHECK =
    '<svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true" style="flex-shrink:0;margin-left:2px">' +
    '<path d="M2 5.5l2.5 2.5 4.5-5" stroke="#e5c45c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var CSS =
    ":host{all:initial}" +
    ".ls{position:relative;display:inline-block}" +
    ".trigger{position:relative;display:inline-flex;align-items:center;gap:6px;margin:0;padding:6px 12px;border-radius:999px;" +
    "border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);color:rgba(251,249,228,0.65);" +
    "font-family:" + FONT + ";font-size:12px;line-height:normal;letter-spacing:0.08em;font-weight:600;cursor:pointer;" +
    "user-select:none;-webkit-user-select:none;outline:none;transition:all 0.15s ease;touch-action:manipulation;-webkit-tap-highlight-color:transparent}" +
    // A bigger hit area for a finger, the look unchanged.
    ".trigger::before{content:'';position:absolute;inset:-8px}" +
    ".open .trigger{border-color:rgba(217,174,59,0.40);background:rgba(217,174,59,0.08);color:#e5c45c}" +
    ".chevron{flex-shrink:0;transition:transform 0.15s ease}" +
    ".open .chevron{transform:rotate(180deg)}" +
    ".menu{position:absolute;top:calc(100% + 8px);right:0;min-width:160px;box-sizing:border-box;border-radius:14px;" +
    "border:1px solid rgba(255,255,255,0.10);background:rgba(6,15,27,0.96);background:color-mix(in srgb, #060f1b 96%, transparent);" +
    "-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px);" +
    "box-shadow:0 20px 48px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(255,255,255,0.06) inset;padding:6px;z-index:200}" +
    ".menu[hidden]{display:none}" +
    ".opt{display:flex;width:100%;align-items:center;gap:8px;margin:0;padding:9px 11px;border-radius:9px;border:none;" +
    "background:transparent;cursor:pointer;text-align:left;transition:background 0.12s;outline:none;font-family:" + FONT + ";" +
    "touch-action:manipulation;-webkit-tap-highlight-color:transparent}" +
    ".opt:hover{background:rgba(255,255,255,0.05)}" +
    ".opt.active,.opt.active:hover{background:rgba(217,174,59,0.10)}" +
    ".trigger:focus-visible,.opt:focus-visible{box-shadow:0 0 0 2px rgba(229,196,92,0.55)}" +
    ".flag{font-size:15px;line-height:1;flex-shrink:0}" +
    ".code{font-size:11px;font-weight:700;letter-spacing:0.1em;color:rgba(251,249,228,0.55);flex-shrink:0}" +
    ".active .code{color:#e5c45c}" +
    ".label{font-size:12px;color:rgba(251,249,228,0.32);margin-left:auto;white-space:nowrap}" +
    ".active .label{color:#f5f4dc}";

  var host = document.createElement("div");
  host.setAttribute("data-epidom-lang-switch", "");
  host.style.cssText =
    "position:absolute;top:max(14px, env(safe-area-inset-top));right:max(14px, env(safe-area-inset-right));z-index:1000";
  var root = host.attachShadow({ mode: "open" });

  var options = OPTIONS.map(function (o) {
    var active = o.value === current.value;
    return (
      '<button type="button" role="option" class="opt' + (active ? " active" : "") + '" data-value="' + o.value +
      '" aria-selected="' + active + '" lang="' + o.value + '">' +
      '<span class="flag">' + o.flag + '</span><span class="code">' + o.short + '</span>' +
      '<span class="label">' + o.label + "</span>" + (active ? CHECK : "") + "</button>"
    );
  }).join("");

  root.innerHTML =
    "<style>" + CSS + "</style>" +
    '<div class="ls"><button type="button" class="trigger" aria-haspopup="listbox" aria-expanded="false">' +
    GLOBE + "<span>" + current.short + "</span>" + CHEVRON + "</button>" +
    '<div class="menu" role="listbox" hidden>' + options + "</div></div>";

  var wrap = root.querySelector(".ls");
  var trigger = root.querySelector(".trigger");
  var menu = root.querySelector(".menu");

  function setOpen(open) {
    wrap.classList.toggle("open", open);
    menu.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
  }

  trigger.addEventListener("click", function () {
    setOpen(menu.hidden);
  });

  Array.prototype.forEach.call(root.querySelectorAll(".opt"), function (btn) {
    btn.addEventListener("click", function () {
      var value = btn.getAttribute("data-value");
      setOpen(false);
      rememberLanguage(value);
      try {
        document.cookie = PREF_COOKIE + "=" + value + "; path=/; max-age=" + 60 * 60 * 24 * 365;
      } catch (e) {}
      if (value === current.value) return;
      var path = value === "fr" ? basePath : "/" + value + basePath;
      // The ad's utm_* tags come along, so the new page's view keeps its source.
      window.location.assign(path + window.location.search);
    });
  });

  document.addEventListener("mousedown", function (e) {
    if (!menu.hidden && e.composedPath().indexOf(host) === -1) setOpen(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !menu.hidden) {
      setOpen(false);
      trigger.focus();
    }
  });

  document.body.appendChild(host);
})();
