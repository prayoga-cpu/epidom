import type { Locale } from "@/components/lang/i18n-provider";
import type { CompetitorComparisonData } from "../types";

// ESB facts re-checked 2026-10-14 on esb.id only (no third-party sources used):
// - https://www.esb.id/id/pricing : Basic "Mulai dari: Rp0* /Bulan" ("*Syarat dan
//   ketentuan berlaku"), Advanced "Mulai dari: Rp499.000 /Bulan", Enterprise "Harga
//   Sesuai Kebutuhan". The page mentions no free trial.
// - https://www.esb.id/id/solusi/produk/pos : FAQ "Data sinkronisasi otomatis apabila
//   sudah terhubung online dengan internet" (offline sync); "Mencatat otomatis seluruh
//   transaksi dari platform online tanpa menginput ulang" (online-platform orders).
// - https://www.esb.id/id/solusi/produk/order : ESB Order modes "Dine-In, Delivery,
//   Pick-up, Takeaway, Reservasi"; static + dynamic table QR; digital payments
//   (Gopay, OVO, Dana, QRIS, EDC machine & VA).
// - https://www.esb.id/id/solusi/produk/core : "Atur HPP (COGS) dan resep bertingkat
//   (multi-level BOM) ... secara otomatis".
// Removed: trial row and staff-scheduling row (not stated), unverified ERP details.
export const esbComparison: Partial<Record<Locale, CompetitorComparisonData>> = {
  id: {
    slug: "esb",
    eyebrow: "Epidom vs. ESB",
    titleParts: [
      "ESB mencakup kasir, ERP, dan pesanan online.",
      "Epidom untuk kafe dan warung yang ingin mulai ringan.",
    ],
    lede: "ESB adalah platform operasional F&B yang terdiri dari kasir (ESB POS), ERP (ESB Core), dan pemesanan online (ESB Order), dengan pencatatan otomatis pesanan dari platform online. Epidom cocok jika Anda ingin mulai dari halaman toko gratis, lalu kasir dan pesanan online dari satu paket berbayar dengan harga yang tertera jelas.",
    colCompetitor: "ESB",
    rows: [
      {
        feature: "Harga",
        epidom:
          "Tertera di halaman harga: Free Rp 0, POS Rp 229.000/bulan, Operations Rp 459.000/bulan (sebelum pajak)",
        competitor:
          "Basic mulai Rp0* per bulan (syarat dan ketentuan berlaku), Advanced mulai Rp499.000 per bulan, Enterprise sesuai kebutuhan",
      },
      {
        feature: "Pesanan online dari halaman sendiri",
        epidom:
          "Termasuk di paket POS (Rp 229.000/bulan): makan di tempat, bawa pulang, antar sendiri, reservasi meja. Pesanan dibayar di kasir",
        competitor:
          "Lewat ESB Order: Dine-In, Delivery, Pick-up, Takeaway, Reservasi, QR di meja, dan pembayaran digital",
      },
      {
        feature: "Integrasi GoFood / GrabFood / ShopeeFood",
        epidom:
          "Tidak ada integrasi langsung; pesanan aplikasi bisa dicatat di kasir sebagai kanal sendiri",
        competitor: "Pesanan dari platform online dicatat otomatis (ESB POS)",
      },
      {
        feature: "Mode offline",
        epidom:
          "Ada di paket POS; penjualan tersimpan di perangkat dan sinkron saat internet kembali",
        competitor: "Data disinkronkan otomatis saat kembali online (FAQ ESB POS)",
      },
      {
        feature: "Stok, resep, dan HPP",
        epidom:
          "Di paket Operations (Rp 459.000/bulan): resep, HPP otomatis per menu, stok berkurang saat pesanan selesai",
        competitor: "HPP (COGS) dan resep bertingkat (multi-level BOM) di ESB Core (ERP)",
      },
    ],
    note: "Fakta ESB diperiksa di situs resmi mereka (esb.id) pada 14 Oktober 2026. Hanya fakta yang dikonfirmasi publik yang dibandingkan; harga dan fitur bisa berubah, cek langsung ke ESB.",
    faqEyebrow: "Pertanyaan",
    faqTitle: "Epidom vs ESB",
    faqs: [
      {
        q: "Kapan ESB lebih cocok daripada Epidom?",
        a: "Jika Anda punya banyak cabang, butuh ERP (ESB Core) atau ingin pesanan GoFood, GrabFood, dan ShopeeFood masuk otomatis, ESB bisa lebih cocok. Epidom mendukung sampai 3 outlet di paket Operations dan 4 outlet ke atas lewat Enterprise.",
      },
      {
        q: "Apakah Epidom terhubung langsung ke GoFood, GrabFood, dan ShopeeFood?",
        a: "Tidak. Pesanan dari aplikasi tersebut dicatat manual di kasir sebagai kanal sendiri, sehingga laporan keuangan menunjukkan omzet dan komisi tiap platform. Idenya: pakai aplikasi untuk ditemukan pelanggan, lalu arahkan pelanggan tetap ke link pesan Anda sendiri.",
      },
      {
        q: "Apakah kasir Epidom bisa dipakai tanpa internet?",
        a: "Bisa, di paket POS. Penjualan tersimpan di perangkat dan tersinkron saat internet kembali. ESB juga menyebut data kasirnya tersinkron otomatis saat kembali online.",
      },
      {
        q: "Berapa biaya mulai dengan Epidom?",
        a: "Halaman toko gratis selamanya. Kasir dan pesanan online ada di paket POS, Rp 229.000 per bulan (Rp 189.000 per bulan jika tahunan), dengan uji coba 14 hari. Harga ESB tertera di halaman harga mereka; paket Basic dimulai dari Rp0 dengan syarat dan ketentuan.",
      },
    ],
    ctaTitle: "Mulai dengan halaman toko gratis.",
    ctaButton: "Coba kasir gratis 14 hari →",
  },
  en: {
    slug: "esb",
    eyebrow: "Epidom vs. ESB",
    titleParts: [
      "ESB covers POS, ERP and online ordering.",
      "Epidom is for cafés and warungs that want to start light.",
    ],
    lede: "ESB is an F&B operations platform made of a cashier (ESB POS), an ERP (ESB Core) and online ordering (ESB Order), with automatic recording of online-platform orders. Epidom fits when you want to start from a free storefront page, then the POS and online ordering in one paid plan with a published price.",
    colCompetitor: "ESB",
    rows: [
      {
        feature: "Pricing",
        epidom: "Published: Free $0, POS $14.99/month, Operations $29.99/month (before tax)",
        competitor:
          "Basic from Rp0* per month (terms and conditions apply), Advanced from Rp499,000 per month, Enterprise priced to your needs",
      },
      {
        feature: "Online ordering from your own page",
        epidom:
          "Included in POS ($14.99/month): dine-in, takeaway, shop delivery, table reservations. Orders are paid at the cashier",
        competitor:
          "Through ESB Order: dine-in, delivery, pick-up, takeaway, reservations, table QR and digital payments",
      },
      {
        feature: "GoFood / GrabFood / ShopeeFood integration",
        epidom: "No direct integration; app orders can be entered at the POS as their own channel",
        competitor: "Orders from online platforms are recorded automatically (ESB POS)",
      },
      {
        feature: "Offline mode",
        epidom: "In POS; sales are kept on the device and sync when the connection returns",
        competitor: "Data syncs automatically once back online (ESB POS FAQ)",
      },
      {
        feature: "Stock, recipes and cost per dish",
        epidom:
          "In Operations ($29.99/month): recipes, automatic cost per dish, stock deducted as orders complete",
        competitor: "COGS and multi-level recipes (BOM) in ESB Core (ERP)",
      },
    ],
    note: "ESB facts were checked on their official site (esb.id) on October 14, 2026. Only publicly confirmed facts are compared; prices and features can change, so check with ESB directly.",
    faqEyebrow: "Questions",
    faqTitle: "Epidom vs ESB",
    faqs: [
      {
        q: "When is ESB a better fit than Epidom?",
        a: "If you run many branches, need an ERP (ESB Core) or want GoFood, GrabFood and ShopeeFood orders to flow in automatically, ESB may suit you better. Epidom covers up to 3 outlets on Operations, and 4 or more through Enterprise.",
      },
      {
        q: "Does Epidom connect directly to GoFood, GrabFood and ShopeeFood?",
        a: "No. Orders from those apps are entered at the POS as their own channel, so Finance shows each platform's revenue and commission. The idea: keep the apps for discovery and move your regulars to your own ordering link.",
      },
      {
        q: "Does the Epidom POS work without internet?",
        a: "Yes, on the POS plan. Sales are kept on the device and sync when the connection returns. ESB also states that its POS data syncs automatically once back online.",
      },
      {
        q: "What does it cost to start with Epidom?",
        a: "The storefront page is free forever. The POS and online ordering are in the POS plan at $14.99 per month ($12.49 per month billed yearly), with a 14-day free trial. ESB's prices are on their pricing page; the Basic plan starts at Rp0 subject to terms and conditions.",
      },
    ],
    ctaTitle: "Start with the free storefront.",
    ctaButton: "Try the POS free for 14 days →",
  },
};
