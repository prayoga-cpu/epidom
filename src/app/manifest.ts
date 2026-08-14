import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // English throughout, by operator decision. A manifest is static and
    // single-valued while the app ships id/en/fr, so one language has to win —
    // and this is also the copy the install dialog renders, since
    // src/components/pwa/pwa-install.tsx deliberately passes no name/description
    // overrides (the library's README asks you to rely on the manifest instead).
    name: "Epidom POS",
    short_name: "Epidom",
    description:
      "All-in-one point of sale and store management for cafés, restaurants, and small food businesses",
    // Pinned to the old default (`id` falls back to `start_url` when absent),
    // so moving start_url below doesn't read as a *different* app to browsers
    // that already have Epidom installed — a changed identity orphans the
    // existing install instead of updating it.
    id: "/",
    // Every entry point below goes through /go/*, the server-side launcher
    // that resolves which store this user is actually opening (see
    // src/app/(app)/go/[...path]/page.tsx). Store ids can't be baked into a
    // static manifest, and the root-level paths that used to be here (/pos,
    // /pos/orders) are not routes at all — long-pressing the installed icon
    // was a guaranteed 404.
    //
    // start_url is the dashboard rather than "/": launching a chromeless
    // standalone window onto the marketing homepage strands a cashier with no
    // address bar and no obvious way into the app.
    start_url: "/go/dashboard",
    // Deliberately wider than start_url. Scope is what the browser considers
    // "inside the app" — narrowing it to /go or /store would kick the public
    // storefront (/@slug) and every marketing/legal page out to the system
    // browser mid-session.
    scope: "/",
    display: "standalone",
    // Deliberately no `display_override`. The obvious candidate,
    // "window-controls-overlay", hands the titlebar strip to the page — which
    // only works if the layout reserves it via env(titlebar-area-*). Nothing
    // here does, so enabling it would slide the topbar under the window
    // controls on desktop. `standalone` alone is the honest declaration.
    background_color: "#ffffff",
    theme_color: "#18181b",
    orientation: "any",
    // Describes the language of the strings in this file, not the product —
    // the app itself is multilingual (id/en/fr).
    lang: "en",
    dir: "ltr",
    icons: [
      // favicon.ico is intentionally NOT listed here. It is a 580 KB multi-
      // resolution .ico, and declaring it with sizes "any" invites installers
      // to prefer it over the 6-37 KB PNGs below — half a megabyte to draw one
      // home-screen icon on a merchant's phone. It stays the browser-tab icon
      // via metadata.icons in src/app/layout.tsx.
      {
        src: "/images/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/icon-192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/images/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src: "/images/screenshot-narrow-1.png",
        sizes: "410x856",
        type: "image/png",
        form_factor: "narrow",
      },
      {
        src: "/images/screenshot-wide-1.png",
        sizes: "1602x1067",
        type: "image/png",
        form_factor: "wide",
      },
    ],
    categories: ["business", "productivity"],
    // Long-press / right-click menu on the installed icon. Each entry carries
    // its own icon: without one, Android renders a generic placeholder next to
    // the label instead of the app mark.
    shortcuts: [
      {
        name: "Cashier",
        short_name: "POS",
        url: "/go/pos",
        description: "Open the checkout screen",
        icons: [{ src: "/images/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Order Queue",
        short_name: "Orders",
        url: "/go/pos/orders",
        description: "View active orders",
        icons: [{ src: "/images/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
