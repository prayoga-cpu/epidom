import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Epidom POS",
    short_name: "Epidom",
    description: "Sistem kasir & manajemen toko all-in-one untuk UMKM Indonesia",
    start_url: "/",
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
        src: "/images/icon-192.png",
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
        src: "/images/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["business", "productivity"],
    shortcuts: [
      {
        name: "Kasir",
        short_name: "POS",
        url: "/pos",
        description: "Buka layar kasir",
      },
      {
        name: "Antrian Pesanan",
        short_name: "Antrian",
        url: "/pos/orders",
        description: "Lihat antrian pesanan aktif",
      },
    ],
  };
}
