/*
 * Lead-capture overlay for sales pages, loaded as:
 *   <script src="/sales-pages/lead-capture.js" data-page="sales-page-N" defer></script>
 *
 * Two triggers:
 *   1. VSL timer  — form appears after 4 cumulative minutes of video play.
 *   2. Exit intent — form appears when the visitor moves the mouse above the
 *      viewport (desktop) or scrolls rapidly upward (mobile).
 *
 * The form collects First Name, Last Name, Phone, Email and posts to
 * /api/public/sales-pages/leads. A localStorage flag prevents re-showing
 * after the visitor has already submitted or dismissed it 3+ times.
 *
 * Visual style matches the dark-gold sales-page palette (--bg / --gd etc.).
 */
(function () {
  var script = document.currentScript;
  var page = script && script.getAttribute("data-page");
  if (!page) return;

  var lang = (document.documentElement.getAttribute("lang") || "fr").slice(0, 2).toLowerCase();
  var locale = lang === "en" || lang === "id" ? lang : "fr";

  var STORAGE_KEY = "epi_lc_" + page;
  var ENDPOINT = "/api/public/sales-pages/leads";
  var VSL_SECONDS = 4 * 60; // 4 minutes

  // --- i18n strings ---
  var T = {
    fr: {
      title: "Avant de partir…",
      subtitle: "Recevez nos conseils gratuits pour développer votre coffee shop.",
      firstName: "Prénom",
      lastName: "Nom",
      phone: "Téléphone",
      email: "E-mail",
      submit: "Recevoir les conseils →",
      sending: "Envoi…",
      thanks: "Merci ! Nous vous contacterons bientôt.",
      close: "Fermer",
      skip: "Non merci",
      vslTitle: "Vous semblez intéressé·e",
      vslSubtitle: "Laissez-nous vos coordonnées et recevez une démo personnalisée.",
    },
    en: {
      title: "Before you go…",
      subtitle: "Get our free tips to grow your coffee shop.",
      firstName: "First name",
      lastName: "Last name",
      phone: "Phone",
      email: "Email",
      submit: "Get the tips →",
      sending: "Sending…",
      thanks: "Thanks! We'll be in touch soon.",
      close: "Close",
      skip: "No thanks",
      vslTitle: "You seem interested",
      vslSubtitle: "Leave your details and get a personalized demo.",
    },
    id: {
      title: "Sebelum pergi…",
      subtitle: "Dapatkan tips gratis kami untuk mengembangkan coffee shop Anda.",
      firstName: "Nama depan",
      lastName: "Nama belakang",
      phone: "Telepon",
      email: "Email",
      submit: "Dapatkan tipsnya →",
      sending: "Mengirim…",
      thanks: "Terima kasih! Kami akan segera menghubungi Anda.",
      close: "Tutup",
      skip: "Tidak, terima kasih",
      vslTitle: "Anda tampaknya tertarik",
      vslSubtitle: "Tinggalkan detail Anda dan dapatkan demo yang dipersonalisasi.",
    },
  };
  var t = T[locale] || T.fr;

  // --- Storage helpers ---
  function getState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch (_) { return {}; }
  }
  function setState(patch) {
    try {
      var s = getState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.assign(s, patch)));
    } catch (_) {}
  }

  function shouldShow() {
    var s = getState();
    if (s.submitted) return false;    // already submitted
    if ((s.dismissals || 0) >= 3) return false; // dismissed 3× — back off
    return true;
  }

  // --- Modal ---
  var overlay = null;

  function injectStyles() {
    var style = document.createElement("style");
    style.textContent = [
      "#epi-lc-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;",
        "background:rgba(5,7,13,.82);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);",
        "padding:16px;box-sizing:border-box;animation:epi-lc-fadein .25s ease}",
      "@keyframes epi-lc-fadein{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}",
      "#epi-lc-box{background:#0b101c;border:1px solid rgba(226,183,63,.35);border-radius:20px;",
        "padding:36px 32px 32px;max-width:440px;width:100%;box-shadow:0 40px 80px rgba(0,0,0,.7),0 0 60px rgba(226,183,63,.1);",
        "position:relative;font-family:'Poppins',system-ui,sans-serif;color:#f5f2e8}",
      "#epi-lc-close{position:absolute;top:14px;right:16px;background:none;border:none;color:#a3abc2;",
        "font-size:22px;cursor:pointer;line-height:1;padding:4px 8px;touch-action:manipulation}",
      "#epi-lc-close:hover{color:#f5f2e8}",
      "#epi-lc-box h2{margin:0 0 8px;font-size:22px;font-weight:800;letter-spacing:-.02em;color:#f5f2e8}",
      "#epi-lc-box p{margin:0 0 22px;font-size:15px;color:#a3abc2;line-height:1.55}",
      ".epi-lc-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}",
      ".epi-lc-field{display:flex;flex-direction:column;gap:5px;margin-bottom:10px}",
      ".epi-lc-field label{font-size:12px;font-weight:600;color:#a3abc2;letter-spacing:.04em;text-transform:uppercase}",
      ".epi-lc-field input{background:#111829;border:1px solid rgba(255,255,255,.1);border-radius:10px;",
        "padding:11px 14px;font:500 15px 'Poppins',system-ui,sans-serif;color:#f5f2e8;outline:none;",
        "transition:border-color .15s;-webkit-appearance:none}",
      ".epi-lc-field input:focus{border-color:rgba(226,183,63,.6)}",
      ".epi-lc-field input::placeholder{color:#4a526a}",
      "#epi-lc-submit{display:block;width:100%;margin-top:6px;padding:15px 24px;",
        "background:linear-gradient(180deg,#f4dc90,#d7b54b 55%,#a97c1c);",
        "color:#151004;font:700 16px 'Poppins',system-ui,sans-serif;border:none;border-radius:12px;",
        "cursor:pointer;touch-action:manipulation;",
        "box-shadow:0 0 0 1px rgba(255,255,255,.2) inset,0 8px 28px rgba(226,183,63,.3);",
        "transition:transform .15s,box-shadow .15s}",
      "#epi-lc-submit:hover{transform:translateY(-2px);box-shadow:0 0 0 1px rgba(255,255,255,.3) inset,0 14px 36px rgba(226,183,63,.45)}",
      "#epi-lc-submit:disabled{opacity:.6;cursor:default;transform:none}",
      "#epi-lc-skip{display:block;text-align:center;margin-top:12px;font-size:13px;color:#4a526a;",
        "cursor:pointer;text-decoration:underline;background:none;border:none;width:100%;touch-action:manipulation}",
      "#epi-lc-skip:hover{color:#a3abc2}",
      "#epi-lc-thanks{text-align:center;padding:20px 0 8px;color:#5bb37c;font-weight:700;font-size:17px}",
      "@media(max-width:480px){",
        "#epi-lc-box{padding:28px 20px 24px}",
        ".epi-lc-row{grid-template-columns:1fr}",
      "}",
    ].join("");
    document.head.appendChild(style);
  }

  function buildForm(source) {
    var isExit = source === "exit_intent";
    var box = document.createElement("div");
    box.id = "epi-lc-box";
    box.innerHTML =
      "<button id=\"epi-lc-close\" aria-label=\"" + t.close + "\">×</button>" +
      "<h2>" + (isExit ? t.title : t.vslTitle) + "</h2>" +
      "<p>" + (isExit ? t.subtitle : t.vslSubtitle) + "</p>" +
      "<form id=\"epi-lc-form\" novalidate>" +
        "<div class=\"epi-lc-row\">" +
          "<div class=\"epi-lc-field\"><label>" + t.firstName + "</label><input type=\"text\" name=\"firstName\" placeholder=\"Marie\" required autocomplete=\"given-name\"></div>" +
          "<div class=\"epi-lc-field\"><label>" + t.lastName + "</label><input type=\"text\" name=\"lastName\" placeholder=\"Dupont\" required autocomplete=\"family-name\"></div>" +
        "</div>" +
        "<div class=\"epi-lc-field\"><label>" + t.phone + "</label><input type=\"tel\" name=\"phone\" placeholder=\"+33 6 12 34 56 78\" required autocomplete=\"tel\"></div>" +
        "<div class=\"epi-lc-field\"><label>" + t.email + "</label><input type=\"email\" name=\"email\" placeholder=\"marie@exemple.fr\" required autocomplete=\"email\"></div>" +
        "<button type=\"submit\" id=\"epi-lc-submit\">" + t.submit + "</button>" +
        "<button type=\"button\" id=\"epi-lc-skip\">" + t.skip + "</button>" +
      "</form>";

    var div = document.createElement("div");
    div.id = "epi-lc-overlay";
    div.setAttribute("role", "dialog");
    div.setAttribute("aria-modal", "true");
    div.setAttribute("aria-label", isExit ? t.title : t.vslTitle);
    div.appendChild(box);

    div.addEventListener("click", function (e) {
      if (e.target === div) dismiss();
    });
    box.querySelector("#epi-lc-close").addEventListener("click", dismiss);
    box.querySelector("#epi-lc-skip").addEventListener("click", dismiss);
    box.querySelector("#epi-lc-form").addEventListener("submit", function (e) {
      e.preventDefault();
      submitForm(source, box);
    });

    return div;
  }

  function showModal(source) {
    if (overlay || !shouldShow()) return;
    injectStyles();
    overlay = buildForm(source);
    document.body.appendChild(overlay);
    // Focus first field for keyboard/screen-reader users.
    var first = overlay.querySelector("input");
    if (first) setTimeout(function () { first.focus(); }, 50);
    // Escape key closes.
    document.addEventListener("keydown", onKeyDown);
    // Disable body scroll.
    document.body.style.overflow = "hidden";
  }

  function dismiss() {
    closeModal();
    setState({ dismissals: (getState().dismissals || 0) + 1 });
  }

  function closeModal() {
    if (!overlay) return;
    document.body.removeChild(overlay);
    overlay = null;
    document.removeEventListener("keydown", onKeyDown);
    document.body.style.overflow = "";
  }

  function onKeyDown(e) {
    if (e.key === "Escape") dismiss();
  }

  function submitForm(source, box) {
    var form = box.querySelector("#epi-lc-form");
    var btn = box.querySelector("#epi-lc-submit");

    var firstName = (form.querySelector("[name=firstName]").value || "").trim();
    var lastName = (form.querySelector("[name=lastName]").value || "").trim();
    var phone = (form.querySelector("[name=phone]").value || "").trim();
    var email = (form.querySelector("[name=email]").value || "").trim();

    if (!firstName || !lastName || !phone || !email) return;

    btn.disabled = true;
    btn.textContent = t.sending;

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: page, locale: locale, source: source, firstName: firstName, lastName: lastName, phone: phone, email: email }),
    })
      .then(function () {
        setState({ submitted: true });
        form.innerHTML = "<div id=\"epi-lc-thanks\">" + t.thanks + "</div>";
        setTimeout(closeModal, 3000);
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = t.submit;
      });
  }

  // --- Trigger 1: VSL 4-minute timer ---
  var vslPlayed = 0;
  var vslInterval = null;
  var vslTriggered = false;

  function startVslTracking() {
    var video = document.querySelector(".epi-vsl");
    if (!video) return;
    video.addEventListener("play", function () {
      if (vslInterval) return;
      vslInterval = setInterval(function () {
        if (video.paused || video.ended) return;
        vslPlayed++;
        if (!vslTriggered && vslPlayed >= VSL_SECONDS) {
          vslTriggered = true;
          clearInterval(vslInterval);
          showModal("vsl_timer");
        }
      }, 1000);
    });
    video.addEventListener("pause", function () {
      clearInterval(vslInterval);
      vslInterval = null;
    });
    video.addEventListener("ended", function () {
      clearInterval(vslInterval);
      vslInterval = null;
    });
  }

  // The video element is injected by vsl.js after the visitor taps play.
  // Watch for it with a MutationObserver on the .video box.
  function watchForVideo() {
    var box = document.querySelector(".video");
    if (!box) return;
    var observer = new MutationObserver(function () {
      var video = box.querySelector("video.epi-vsl");
      if (video) {
        observer.disconnect();
        startVslTracking();
      }
    });
    observer.observe(box, { childList: true });
  }

  // --- Trigger 2: Exit intent ---
  var exitTriggered = false;

  function onMouseLeave(e) {
    if (exitTriggered) return;
    if (e.clientY > 10) return; // only fire when cursor exits near the top
    exitTriggered = true;
    document.removeEventListener("mouseleave", onMouseLeave);
    showModal("exit_intent");
  }

  var lastScrollY = window.scrollY;
  var mobileExitScheduled = false;
  function onMobileScroll() {
    var current = window.scrollY;
    var delta = lastScrollY - current; // positive = scrolling up
    lastScrollY = current;
    if (!mobileExitScheduled && delta > 60 && current < 300) {
      // Rapid upward scroll near the top — likely heading to the address bar / back.
      mobileExitScheduled = true;
      window.removeEventListener("scroll", onMobileScroll);
      // Small delay so the page isn't mid-scroll when the modal appears.
      setTimeout(function () {
        if (!exitTriggered) {
          exitTriggered = true;
          showModal("exit_intent");
        }
      }, 400);
    }
  }

  // --- Init ---
  if (shouldShow()) {
    watchForVideo();
    document.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("scroll", onMobileScroll, { passive: true });
  }
})();
