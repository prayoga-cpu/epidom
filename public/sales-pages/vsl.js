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
 *
 * The box shows the video's thumbnail (vsl-thumbnail.webp, JPEG fallback,
 * preloaded by each page's <head>) as its cover, the caption as a pill at the
 * bottom; a tap anywhere on it plays, and the thumbnail stays as the poster
 * while the video loads.
 */
(function () {
  var SRC = "/api/public/sales-pages/video";
  var COVER_WEBP = "/sales-pages/vsl-thumbnail.webp";
  var COVER_JPG = "/sales-pages/vsl-thumbnail.jpg";
  var box = document.querySelector(".video");
  if (!box) return;
  var lang = (document.documentElement.getAttribute("lang") || "fr").slice(0, 2).toLowerCase();
  var LABEL = { fr: "Lire la vidéo", en: "Play video", id: "Putar video" }[lang] || "Lire la vidéo";

  var style = document.createElement("style");
  style.textContent =
    ".video{position:relative}" +
    ".video.epi-vsl-cover{background:#070b15 url(" + COVER_JPG + ") center/cover no-repeat!important;" +
    "background-image:image-set(url(" + COVER_WEBP + ') type("image/webp"),url(' + COVER_JPG + ') type("image/jpeg"))!important;' +
    "cursor:pointer}" +
    // Bottom-left: the empty corner of the thumbnail, clear of the cup and the button.
    ".video.epi-vsl-cover>p{position:absolute;left:12px;bottom:12px;transform:none;z-index:2;text-align:left;" +
    "max-width:calc(100% - 24px);margin:0;padding:6px 12px;border-radius:999px;background:rgba(7,11,21,.72);" +
    "color:#fff;font-size:12px;line-height:1.3}" +
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

  box.classList.add("epi-vsl-cover");

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
    video.poster = COVER_JPG;
    video.src = SRC;
    box.classList.add("epi-vsl-on");
    box.appendChild(video);
    try {
      var started = video.play();
      // Refused autoplay (rare after a tap): the controls let the visitor start it.
      if (started && started.catch) started.catch(function () {});
    } catch (e) {}
  }
  // The button, or anywhere on the cover (once playing, clicks are the video's own).
  box.addEventListener("click", start);
})();
