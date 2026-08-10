import type { Locale } from "@/components/lang/i18n-provider";
import type { CompetitorComparisonData } from "../types";

// Facts verified against mokapos.com (2026-08): Premium plan Rp 299,000/mo
// per outlet (~30% off if paid annually), free-trial signup ("Coba
// Gratis"), and a free storefront product (GoStore). Do not add claims
// beyond what's confirmed there.
export const mokaComparison: Partial<Record<Locale, CompetitorComparisonData>> = {
  id: {
    slug: "moka",
    eyebrow: "Epidom vs. Moka POS",
    titleParts: ["Moka bagus buat kasir.", "Epidom gratis dari hari pertama."],
    lede: "Moka POS punya nama besar dan fitur lengkap — termasuk GoStore, toko online mereka sendiri. Bedanya paling kelihatan di mana kamu mulai: Moka mulai dari uji coba gratis lalu bayar, Epidom gratis selamanya di tier awal, nggak ada batas waktu.",
    colCompetitor: "Moka POS",
    rows: [
      { feature: "Toko online / storefront", epidom: "Gratis selamanya, tanpa batas waktu", competitor: "Ada (GoStore), bagian dari paket berbayar" },
      { feature: "Harga awal", epidom: "Rp 0 — gratis selamanya", competitor: "Coba gratis, lalu Rp 299.000/bulan per outlet (Premium)" },
      { feature: "Transparansi harga", epidom: "Harga publik di halaman pricing", competitor: "Harga publik untuk paket Premium" },
      { feature: "Fokus utama", epidom: "Warung/kafe kecil-menengah, self-serve", competitor: "Bisnis dari kecil sampai enterprise, termasuk integrasi GoFood/GoTo" },
      { feature: "Setup", epidom: "Self-serve, ~5 menit, tanpa sales call", competitor: "Self-serve untuk uji coba, upgrade lewat aplikasi" },
    ],
    note: "Data Moka POS diambil dari mokapos.com per Agustus 2026 (paket Premium Rp 299.000/bulan per outlet, diskon ~30% kalau bayar tahunan). Fitur dan harga bisa berubah — cek langsung ke situs resmi mereka buat info terbaru.",
    faqEyebrow: "Pertanyaan",
    faqTitle: "Epidom vs Moka POS",
    faqs: [
      {
        q: "Apa Moka POS juga punya toko online gratis?",
        a: "Moka punya GoStore sebagai bagian dari produk mereka, tapi berdasarkan info di situs mereka, itu bagian dari paket yang butuh langganan berbayar. Epidom Free tier — storefront dan pesan online — gratis selamanya tanpa batas waktu.",
      },
      {
        q: "Kenapa harga Epidom POS beda sama Moka Premium?",
        a: "Paket dan fitur di antara keduanya nggak sama persis — Moka Premium include integrasi GoFood/GoTo yang lebih luas. Bandingkan fitur yang kamu butuhin, bukan cuma angka harganya.",
      },
      {
        q: "Bisa pindah dari Moka ke Epidom?",
        a: "Bisa, tapi kamu perlu masukin ulang menu dan data secara manual — belum ada tool migrasi otomatis dari Moka saat ini.",
      },
    ],
    ctaTitle: "Mulai gratis, tanpa batas waktu.",
    ctaButton: "Mulai gratis →",
  },
  en: {
    slug: "moka",
    eyebrow: "Epidom vs. Moka POS",
    titleParts: ["Moka is a solid cashier system.", "Epidom is free from day one."],
    lede: "Moka POS is a well-known Indonesian POS with a full feature set — including GoStore, their own online storefront product. The clearest difference is where you start: Moka begins with a free trial that leads to payment, Epidom's entry tier is free forever, no time limit.",
    colCompetitor: "Moka POS",
    rows: [
      { feature: "Online storefront", epidom: "Free forever, no time limit", competitor: "Available (GoStore), part of a paid plan" },
      { feature: "Starting price", epidom: "$0 — free forever", competitor: "Free trial, then Rp 299,000/month per outlet (Premium)" },
      { feature: "Pricing transparency", epidom: "Public pricing page", competitor: "Public pricing for the Premium plan" },
      { feature: "Primary focus", epidom: "Small-to-mid F&B, self-serve", competitor: "Small business through enterprise, incl. GoFood/GoTo integration" },
      { feature: "Setup", epidom: "Self-serve, ~5 minutes, no sales call", competitor: "Self-serve trial, upgrade in-app" },
    ],
    note: "Moka POS facts sourced from mokapos.com as of August 2026 (Premium plan Rp 299,000/month per outlet, ~30% off paid annually). Features and pricing can change — check their official site for the latest.",
    faqEyebrow: "Questions",
    faqTitle: "Epidom vs Moka POS",
    faqs: [
      {
        q: "Does Moka POS also have a free online storefront?",
        a: "Moka offers GoStore as part of their product line, but per their own site it's part of a paid subscription plan. Epidom's Free tier — storefront and online ordering — is free forever with no time limit.",
      },
      {
        q: "Why is Epidom POS priced differently from Moka Premium?",
        a: "The plans aren't feature-matched — Moka Premium includes broader GoFood/GoTo integration. Compare based on the features you actually need, not just the price tag.",
      },
      {
        q: "Can I switch from Moka to Epidom?",
        a: "Yes, though you'll need to re-enter your menu and data manually — there's no automated migration tool from Moka today.",
      },
    ],
    ctaTitle: "Start free, no time limit.",
    ctaButton: "Start free →",
  },
};
