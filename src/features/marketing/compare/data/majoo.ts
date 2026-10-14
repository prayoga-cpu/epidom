import type { Locale } from "@/components/lang/i18n-provider";
import type { CompetitorComparisonData } from "../types";

// Facts verified against majoo.id (2026-08): 14-day free trial ("Coba
// Gratis 14 Hari"), pricing not public (discount banner only, no numbers),
// and a free storefront/omnichannel product. Do not add claims beyond
// what's confirmed there.
// Epidom column corrected 2026-10-14: only the storefront page is free; online
// ordering is a POS-plan feature (14-day trial). No setup-time claims.
export const majooComparison: Partial<Record<Locale, CompetitorComparisonData>> = {
  id: {
    slug: "majoo",
    eyebrow: "Epidom vs. Majoo",
    titleParts: ["Majoo: coba 14 hari.", "Epidom: gratis, nggak ada batas waktu."],
    lede: "Majoo nawarin fitur lengkap buat berbagai jenis usaha, dengan uji coba gratis 14 hari. Bedanya sama Epidom: setelah 14 hari, kamu harus hubungi sales buat lanjut — harga Majoo nggak dipublikasikan di situs mereka. Epidom publish harga aslinya, dan tier gratis nggak pernah expired.",
    colCompetitor: "Majoo",
    rows: [
      { feature: "Akses gratis", epidom: "Selamanya, tanpa batas waktu", competitor: "Uji coba 14 hari" },
      { feature: "Transparansi harga", epidom: "Harga publik di halaman pricing", competitor: "Nggak dipublikasikan — harus hubungi sales" },
      { feature: "Toko online / storefront", epidom: "Halaman toko gratis selamanya; pesan online di paket POS", competitor: "Ada (Toko Online / Omnichannel), bagian dari paket" },
      { feature: "Setup awal", epidom: "Self-serve, tanpa perlu ngobrol sama sales", competitor: "Self-serve buat trial, lanjut butuh kontak sales" },
    ],
    note: "Data Majoo diambil dari majoo.id per Agustus 2026. Majoo nggak mempublikasikan angka harga di halaman utama mereka — kalau kamu butuh perbandingan harga persis, hubungi sales Majoo langsung.",
    faqEyebrow: "Pertanyaan",
    faqTitle: "Epidom vs Majoo",
    faqs: [
      {
        q: "Kenapa Epidom bisa gratis kalau Majoo cuma trial 14 hari?",
        a: "Model bisnisnya beda: tier gratis Epidom (halaman toko + menu) memang dirancang gratis selamanya buat jadi titik masuk, baru upgrade kalau butuh fitur operasional. Majoo lebih fokus jual paket lengkap dari awal.",
      },
      {
        q: "Apa Majoo juga punya toko online?",
        a: "Ya, lewat fitur Omnichannel/Toko Online mereka — tapi itu bagian dari paket berbayar, bagian dari paket berbayar. Di Epidom, halaman toko gratis, dan pesan online ada di paket POS (Rp 229.000/bulan, uji coba 14 hari).",
      },
    ],
    ctaTitle: "Nggak perlu nunggu 14 hari.",
    ctaButton: "Mulai gratis →",
  },
  en: {
    slug: "majoo",
    eyebrow: "Epidom vs. Majoo",
    titleParts: ["Majoo: a 14-day trial.", "Epidom: free, no time limit."],
    lede: "Majoo offers a full feature set for various business types, with a 14-day free trial. The difference from Epidom: after 14 days you need to contact sales to continue — Majoo doesn't publish pricing on their site. Epidom publishes real prices, and the free tier never expires.",
    colCompetitor: "Majoo",
    rows: [
      { feature: "Free access", epidom: "Forever, no time limit", competitor: "14-day trial" },
      { feature: "Pricing transparency", epidom: "Public pricing page", competitor: "Not published — contact sales required" },
      { feature: "Online storefront", epidom: "Storefront page free forever; online ordering on the POS plan", competitor: "Available (Toko Online / Omnichannel), part of a paid plan" },
      { feature: "Initial setup", epidom: "Self-serve, no sales call needed", competitor: "Self-serve trial, continuing requires contacting sales" },
    ],
    note: "Majoo facts sourced from majoo.id as of August 2026. Majoo doesn't publish pricing figures on their main pages — contact their sales team directly for an exact price comparison.",
    faqEyebrow: "Questions",
    faqTitle: "Epidom vs Majoo",
    faqs: [
      {
        q: "How can Epidom be free when Majoo only offers a 14-day trial?",
        a: "Different business models: Epidom's free tier (storefront page + menu) is deliberately free forever as an entry point, with upgrades for operational features later. Majoo's model leans toward selling the full package from the start.",
      },
      {
        q: "Does Majoo also have an online storefront?",
        a: "Yes, through their Omnichannel/Toko Online feature — but it's part of a paid plan, part of a paid plan. At Epidom the storefront page is free, and online ordering is on the POS plan (Rp 229,000/month, 14-day trial).",
      },
    ],
    ctaTitle: "No need to wait 14 days.",
    ctaButton: "Start free →",
  },
};
