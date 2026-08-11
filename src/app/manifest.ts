import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Epidom POS",
    short_name: "Epidom",
    description: "Sistem kasir & manajemen toko all-in-one untuk UMKM Indonesia",
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
    background_color: "#ffffff",
    theme_color: "#18181b",
    orientation: "any",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
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
    shortcuts: [
      {
        name: "Kasir",
        short_name: "POS",
        url: "/go/pos",
        description: "Buka layar kasir",
      },
      {
        name: "Antrian Pesanan",
        short_name: "Antrian",
        url: "/go/pos/orders",
        description: "Lihat antrian pesanan aktif",
      },
    ],
  };
}
