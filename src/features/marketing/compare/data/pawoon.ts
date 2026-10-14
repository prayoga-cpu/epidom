import type { Locale } from "@/components/lang/i18n-provider";
import type { CompetitorComparisonData } from "../types";

// Competitor facts re-checked 2026-10-14 on Pawoon's own site only (no third-party sources used):
// - https://pawoon.com/harga : Free Plan ("Gratis"; "7 Transaksi/Hari", "Hanya untuk
//   Satu Outlet"; online orders, raw-material management and face-recognition
//   attendance are marked X for Free) and Pawoon Pro ("Rp299rb/outlet/bulan",
//   "Transaksi Tidak Terbatas", "Manajemen Waralaba" listed). Per-plan inclusion of
//   other features is not readable from the page, so nothing more is claimed.
// Rows about offline mode, recipes/HPP, trial length and online ordering in Pro were
// removed: the official pages do not state them clearly. Do not add claims beyond this.
export const pawoonComparison: Partial<Record<Locale, CompetitorComparisonData>> = {
  id: {
    slug: "pawoon",
    eyebrow: "Epidom vs. Pawoon",
    titleParts: [
      "Pawoon sudah dikenal sebagai aplikasi kasir.",
      "Epidom menggabungkan halaman toko, kasir, dan stok.",
    ],
    lede: "Pawoon adalah aplikasi kasir Indonesia yang punya paket Free dan paket Pro dengan harga yang dipublikasikan. Jika Anda butuh kasir dengan paket Pro per outlet, Pawoon menawarkannya. Epidom cocok jika Anda mengelola kafe, toko roti, atau restoran kecil dan ingin halaman toko gratis, kasir dengan pesanan online dari halaman Anda sendiri, serta resep dan HPP otomatis di paket Operations.",
    colCompetitor: "Pawoon",
    rows: [
      {
        feature: "Harga publik",
        epidom: "Ada di halaman pricing: Free, POS, Operations; Enterprise sesuai penawaran",
        competitor: "Ada di pawoon.com/harga: Free Plan dan Pawoon Pro",
      },
      {
        feature: "Harga awal berbayar",
        epidom: "POS: Rp 229.000/bulan (Rp 189.000/bulan jika tahunan)",
        competitor: "Pawoon Pro: Rp 299rb per outlet per bulan",
      },
      {
        feature: "Paket gratis",
        epidom: "Free: halaman toko dan menu, gratis selamanya (tanpa pesanan online)",
        competitor: "Free Plan: maksimal 7 transaksi per hari, satu outlet",
      },
      {
        feature: "Beberapa outlet / waralaba",
        epidom:
          "Operations: sampai 3 outlet dengan tampilan keuangan gabungan; 4 outlet ke atas lewat Enterprise",
        competitor: "Pawoon Pro mencantumkan Manajemen Waralaba; Free Plan hanya untuk satu outlet",
      },
    ],
    note: "Fakta Pawoon diperiksa di situs resmi mereka (pawoon.com/harga) pada Oktober 2026. Hanya fakta yang dikonfirmasi publik yang dibandingkan; harga dan fitur bisa berubah, jadi cek langsung ke situs mereka.",
    faqEyebrow: "Pertanyaan",
    faqTitle: "Epidom vs Pawoon",
    faqs: [
      {
        q: "Mana yang lebih murah, Epidom atau Pawoon?",
        a: "Berdasarkan harga yang dipublikasikan, paket POS Epidom mulai Rp 229.000 per bulan dan Pawoon Pro Rp 299rb per outlet per bulan. Namun isi paketnya tidak sama persis, jadi bandingkan fitur yang Anda butuhkan, bukan hanya angkanya.",
      },
      {
        q: "Apakah Pawoon punya paket gratis?",
        a: "Ya. Menurut halaman harga mereka, Free Plan tersedia dengan batas 7 transaksi per hari dan satu outlet. Paket Free Epidom adalah halaman toko dengan menu yang gratis selamanya; kasir dan pesanan online ada di paket POS dengan uji coba 14 hari.",
      },
      {
        q: "Kapan Pawoon lebih cocok untuk saya?",
        a: "Jika Anda membutuhkan fitur seperti manajemen waralaba, absensi pengenal wajah (face-recognition), atau integrasi pembayaran digital yang tercantum di situs Pawoon, atau menjalankan usaha di luar F&B, Pawoon bisa lebih sesuai. Epidom fokus pada kafe, toko roti, dan restoran kecil.",
      },
      {
        q: "Apakah Epidom terhubung langsung ke GoFood atau GrabFood?",
        a: "Tidak. Pesanan dari aplikasi tersebut dicatat manual di kasir sebagai kanal tersendiri (paket Operations), sehingga laporan keuangan menampilkan pendapatan dan komisi tiap platform. Ide kami: tetap pakai aplikasi untuk ditemukan pelanggan, lalu arahkan pelanggan tetap ke tautan pesan Anda sendiri.",
      },
    ],
    ctaTitle: "Mulai dengan halaman toko gratis, lalu coba kasir 14 hari.",
    ctaButton: "Coba POS gratis 14 hari →",
  },
  en: {
    slug: "pawoon",
    eyebrow: "Epidom vs. Pawoon",
    titleParts: [
      "Pawoon is an established Indonesian POS app.",
      "Epidom joins storefront, POS, and stock.",
    ],
    lede: "Pawoon is an Indonesian cashier app with a Free plan and a Pro plan at published prices. If you want a per-outlet Pro plan, Pawoon offers one. Epidom fits when you run a small café, bakery, or restaurant and want a free storefront page, a POS with online ordering from your own page, and automatic recipe costing (HPP) in the Operations plan.",
    colCompetitor: "Pawoon",
    rows: [
      {
        feature: "Public pricing",
        epidom: "On the pricing page: Free, POS, Operations; Enterprise by quote",
        competitor: "At pawoon.com/harga: Free Plan and Pawoon Pro",
      },
      {
        feature: "Paid starting price",
        epidom: "POS: $14.99/month ($12.49/month billed yearly)",
        competitor: "Pawoon Pro: Rp 299,000 per outlet per month",
      },
      {
        feature: "Free plan",
        epidom: "Free: storefront page and menu, free forever (no online ordering)",
        competitor: "Free Plan: up to 7 transactions per day, one outlet",
      },
      {
        feature: "Several outlets / franchise",
        epidom:
          "Operations: up to 3 outlets with a combined finance view; 4 or more through Enterprise",
        competitor: "Pawoon Pro lists franchise management; the Free Plan is for one outlet only",
      },
    ],
    note: "Pawoon facts were checked on their official site (pawoon.com/harga) in October 2026. Only publicly confirmed facts are compared; prices and features can change, so check their site for the latest.",
    faqEyebrow: "Questions",
    faqTitle: "Epidom vs Pawoon",
    faqs: [
      {
        q: "Which is cheaper, Epidom or Pawoon?",
        a: "On published prices, Epidom's POS plan is $14.99 per month and Pawoon Pro is Rp 299,000 per outlet per month, quoted in different currencies. The plans don't include exactly the same things, so compare the features you need, not only the number.",
      },
      {
        q: "Does Pawoon have a free plan?",
        a: "Yes. Per their pricing page, the Free Plan has a limit of 7 transactions per day and one outlet. Epidom's Free plan is a storefront page with your menu, free forever; the POS and online ordering are in the POS plan with a 14-day free trial.",
      },
      {
        q: "When is Pawoon the better fit?",
        a: "If you need franchise management, face-recognition attendance, or digital payment integration as listed on Pawoon's site, or you run a business outside food and beverage, Pawoon may suit you better. Epidom focuses on small cafés, bakeries, and restaurants.",
      },
      {
        q: "Does Epidom connect directly to GoFood or GrabFood?",
        a: "No. Orders from those apps are entered at the POS as their own channel (Operations plan), so Finance shows each platform's revenue and commission. The idea: keep the apps for discovery, and move your regulars to your own ordering link.",
      },
    ],
    ctaTitle: "Start with the free storefront, then try the POS for 14 days.",
    ctaButton: "Try the POS free for 14 days →",
  },
};
