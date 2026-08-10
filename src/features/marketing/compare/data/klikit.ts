import type { Locale } from "@/components/lang/i18n-provider";
import type { CompetitorComparisonData } from "../types";

// Facts verified against klikit.io (2026-08): pricing is "flexible" /
// custom-quoted, not public; they do advertise a zero-commission "Owned
// Channel" branded ordering website. Do not add claims beyond what's
// confirmed there.
export const klikitComparison: Partial<Record<Locale, CompetitorComparisonData>> = {
  id: {
    slug: "klikit",
    eyebrow: "Epidom vs. Klikit",
    titleParts: ["Klikit: kuat di aggregator,", "custom quote. Epidom: harga jelas dari awal."],
    lede: "Klikit punya dashboard aggregator yang kuat buat gabungin pesanan dari banyak platform, dan bahkan sudah nawarin \"Owned Channel\" tanpa komisi. Bedanya: harga Klikit disesuaikan per merchant lewat penawaran khusus, sementara harga Epidom publik dan sama buat semua orang.",
    colCompetitor: "Klikit",
    rows: [
      { feature: "Transparansi harga", epidom: "Harga publik, sama buat semua merchant", competitor: "Disesuaikan per merchant, hubungi sales buat penawaran" },
      { feature: "Toko online tanpa komisi", epidom: "Gratis selamanya, tier Free", competitor: "Ada (\"Owned Channel\"), bagian dari paket custom" },
      { feature: "Setup", epidom: "Self-serve, ~5 menit", competitor: "Proses onboarding lewat sales/demo" },
      { feature: "Cocok buat", epidom: "Warung/kafe satu outlet yang baru mulai online", competitor: "Bisnis dengan pesanan dari banyak platform aggregator sekaligus" },
    ],
    note: "Data Klikit diambil dari klikit.io per Agustus 2026. Klikit nggak mempublikasikan harga di situsnya — bandingan di atas soal transparansi dan cara akses, bukan perbandingan fitur lengkap.",
    faqEyebrow: "Pertanyaan",
    faqTitle: "Epidom vs Klikit",
    faqs: [
      {
        q: "Kapan Klikit lebih masuk akal dibanding Epidom?",
        a: "Kalau bisnis kamu udah gede dan pesanan datang dari banyak platform aggregator sekaligus (GrabFood, GoFood, Foodpanda, dll di satu dashboard), fitur konsolidasi Klikit memang dirancang buat itu.",
      },
      {
        q: "Apa Epidom juga bisa gabungin pesanan dari banyak platform?",
        a: "Epidom fokus di toko online milik sendiri plus kasir dan operasional — bukan dashboard konsolidasi aggregator multi-platform seperti Klikit.",
      },
    ],
    ctaTitle: "Harga jelas, nggak perlu nunggu penawaran.",
    ctaButton: "Mulai gratis →",
  },
  en: {
    slug: "klikit",
    eyebrow: "Epidom vs. Klikit",
    titleParts: ["Klikit: strong on aggregator ops,", "custom-quoted. Epidom: clear pricing upfront."],
    lede: "Klikit has a strong aggregator dashboard for consolidating orders across platforms, and already offers a zero-commission \"Owned Channel\" too. The difference: Klikit's pricing is tailored per merchant through a custom quote, while Epidom's pricing is public and the same for everyone.",
    colCompetitor: "Klikit",
    rows: [
      { feature: "Pricing transparency", epidom: "Public pricing, same for every merchant", competitor: "Tailored per merchant, contact sales for a quote" },
      { feature: "Zero-commission storefront", epidom: "Free forever, Free tier", competitor: "Available (\"Owned Channel\"), part of a custom plan" },
      { feature: "Setup", epidom: "Self-serve, ~5 minutes", competitor: "Sales/demo-driven onboarding" },
      { feature: "Best fit for", epidom: "Single-outlet cafés/warungs just getting started online", competitor: "Businesses juggling orders from many aggregator platforms at once" },
    ],
    note: "Klikit facts sourced from klikit.io as of August 2026. Klikit doesn't publish pricing on its site — the comparison above is about transparency and access, not a full feature match.",
    faqEyebrow: "Questions",
    faqTitle: "Epidom vs Klikit",
    faqs: [
      {
        q: "When does Klikit make more sense than Epidom?",
        a: "If your business is already sizeable and orders come in from many aggregator platforms at once (GrabFood, GoFood, Foodpanda, etc. in one dashboard), Klikit's consolidation features are built for exactly that.",
      },
      {
        q: "Can Epidom also consolidate orders across platforms?",
        a: "Epidom focuses on your own storefront plus cashier and operations — not a multi-platform aggregator consolidation dashboard like Klikit's.",
      },
    ],
    ctaTitle: "Clear pricing, no quote required.",
    ctaButton: "Start free →",
  },
};
