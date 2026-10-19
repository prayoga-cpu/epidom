/*
 * Sales-page video (VSL), loaded by every public/sales-pages/sales-page-N[.en|.id].html:
 *   <script src="/sales-pages/vsl.js" defer></script>
 *
 * The page's video box (.video) keeps its designed look and its play button
 * (one is added where the design has none). Nothing is downloaded until the
 * visitor taps play: the video then plays inside the box, with the browser's
 * controls, from /api/public/sales-pages/video (a redirect to a short-lived
 * signed link to videos/VSL.mp4 in Cloudflare R2; src/lib/storage/sales-video.ts).
 * The same video on all four pages and all three languages.
 */
(function () {
  var SRC = "/api/public/sales-pages/video";
  var box = document.querySelector(".video");
  if (!box) return;
  var lang = (document.documentElement.getAttribute("lang") || "fr").slice(0, 2).toLowerCase();
  var LABEL = { fr: "Lire la vidéo", en: "Play video", id: "Putar video" }[lang] || "Lire la vidéo";

  var style = document.createElement("style");
  style.textContent =
    ".video{position:relative}" +
    ".video.epi-vsl-on{transform:none!important;cursor:auto}" +
    ".video.epi-vsl-on>*:not(.epi-vsl){visibility:hidden}" +
    ".epi-vsl{position:absolute;inset:0;width:100%;height:100%;border-radius:inherit;background:#000;object-fit:contain;z-index:5}" +
    ".epi-vsl-play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:76px;height:76px;" +
    "border:0;border-radius:50%;padding:0;cursor:pointer;touch-action:manipulation;" +
    "background:linear-gradient(135deg,var(--gold-light,#f3d27a),var(--gold,#d7b54b));" +
    "box-shadow:0 0 0 10px rgba(215,181,75,.14),0 12px 32px rgba(0,0,0,.45)}" +
    ".epi-vsl-play::after{content:'';position:absolute;left:50%;top:50%;transform:translate(-38%,-50%);" +
    "border-style:solid;border-width:13px 0 13px 21px;border-color:transparent transparent transparent #101a32}" +
    ".epi-vsl-play:focus-visible{outline:3px solid #fff;outline-offset:4px}";
  document.head.appendChild(style);

  var play = box.querySelector(".play");
  if (!play) {
    play = document.createElement("button");
    play.type = "button";
    play.className = "epi-vsl-play";
    play.setAttribute("aria-label", LABEL);
    box.appendChild(play);
  }

  function start() {
    if (box.querySelector("video")) return;
    var video = document.createElement("video");
    video.className = "epi-vsl";
    video.controls = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.preload = "auto";
    video.src = SRC;
    box.classList.add("epi-vsl-on");
    box.appendChild(video);
    try {
      var started = video.play();
      // Refused autoplay (rare after a tap): the controls let the visitor start it.
      if (started && started.catch) started.catch(function () {});
    } catch (e) {}
  }
  play.addEventListener("click", start);
})();
