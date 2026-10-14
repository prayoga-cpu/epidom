import type { Locale } from "@/components/lang/i18n-provider";
import type { CompetitorComparisonData } from "../types";

// Olsera facts re-checked 2026-10-14 on Olsera's own site only (no third-party sources used):
// - https://www.olsera.com/id/pricing : Basic "Rp 1.288.000* / tahun", Premium
//   "Rp 1.988.000*", Pro "Rp 2.688.000*" (struck-through list prices Rp 1.888.000 /
//   2.888.000 / 3.888.000); "*Harga belum termasuk PPN"; "Coba Gratis 14 Hari" on each
//   plan; Online Order row (Take Away, Delivery, Dine In, Reservasi; some "Dikenakan
//   biaya tambahan"); "Manajemen Resep" under "Fitur F&B" (plan unclear); Basic
//   "Absensi PIN", Pro "PIN + Absensi Wajah"; Basic "Pemilik + 2 Staff", Premium/Pro
//   unlimited staff and devices.
// - https://www.olsera.com/id/hardware : lists printers, cash drawers, tablets, terminals.
// Rows on offline mode were removed (not stated); franchise/accounting/marketplace
// claims were removed from the FAQ (not re-verified). Do not add claims beyond this.
export const olseraComparison: Partial<Record<Locale, CompetitorComparisonData>> = {
  id: {
    slug: "olsera",
    eyebrow: "Epidom vs. Olsera POS",
    titleParts: ["Olsera lengkap untuk kasir dan retail.", "Epidom fokus ke kafe dan resto kecil."],
    lede: "Olsera adalah aplikasi kasir Indonesia dengan fitur kasir, pesanan online, manajemen resep, dan absensi karyawan, dengan harga paket yang tertera per tahun. Epidom cocok jika Anda ingin halaman toko gratis, lalu kasir dan back office khusus F&B (stok, resep, HPP) dengan harga bulanan yang tertera dan uji coba 14 hari.",
    colCompetitor: "Olsera POS",
    rows: [
      {
        feature: "Harga publik",
        epidom:
          "Ada di halaman harga: POS Rp 229.000/bulan (Rp 189.000/bulan jika tahunan), Operations Rp 459.000/bulan (Rp 379.000/bulan jika tahunan)",
        competitor:
          "Tertera per tahun: Basic Rp 1.288.000, Premium Rp 1.988.000, Pro Rp 2.688.000 (belum termasuk PPN)",
      },
      {
        feature: "Gratis / uji coba",
        epidom: "Halaman toko gratis selamanya; POS uji coba gratis 14 hari",
        competitor: "Uji coba gratis 14 hari di setiap paket",
      },
      {
        feature: "Pesanan online dari halaman sendiri",
        epidom: "Termasuk di POS (Rp 229.000/bulan, uji coba 14 hari); bayar di kasir",
        competitor:
          "Ada fitur Online Order (take away, delivery, dine in, reservasi); sebagian dikenakan biaya tambahan",
      },
      {
        feature: "Stok dan resep (HPP)",
        epidom: "Di Operations: resep, HPP otomatis per menu, stok berkurang saat pesanan selesai",
        competitor:
          "Manajemen Resep tercantum di bagian Fitur F&B; paket yang memuatnya tidak dijelaskan jelas di halaman harga",
      },
      {
        feature: "Jadwal dan absensi staf",
        epidom: "Di Operations: jadwal, absensi dengan selfie dan lokasi, jam kerja vs jadwal",
        competitor: "Absensi PIN; absensi wajah di paket Pro; staf Basic dibatasi pemilik + 2",
      },
      {
        feature: "Perangkat keras",
        epidom:
          "Berjalan di browser, ponsel, tablet, atau komputer; printer Bluetooth thermal didukung",
        competitor: "Menjual printer, laci kas, tablet, dan paket terminal",
      },
    ],
    note: "Fakta Olsera diperiksa di situs resmi mereka (olsera.com/id/pricing dan olsera.com/id/hardware) pada Oktober 2026. Hanya fakta yang dikonfirmasi publik yang dibandingkan; harga dan fitur bisa berubah, cek langsung ke olsera.com.",
    faqEyebrow: "Pertanyaan",
    faqTitle: "Epidom vs Olsera POS",
    faqs: [
      {
        q: "Kapan Epidom cocok dibanding Olsera?",
        a: "Epidom cocok jika Anda menjalankan kafe, toko roti, atau restoran kecil dan ingin halaman toko gratis, pesanan online dari halaman sendiri, serta resep dan HPP otomatis. Operations mendukung sampai 3 outlet, dan 4 outlet atau lebih lewat Enterprise. Jika Anda butuh fitur lain yang tercantum di situs Olsera, cek langsung ke mereka.",
      },
      {
        q: "Apakah harga keduanya bisa dibandingkan langsung?",
        a: "Belum tentu. Olsera menampilkan harga per tahun (belum termasuk PPN) dan Epidom per bulan. Isi paketnya juga berbeda, jadi bandingkan fitur yang Anda butuhkan, bukan hanya angkanya.",
      },
      {
        q: "Bisakah saya mencoba Epidom tanpa membayar dulu?",
        a: "Bisa. Halaman toko dengan menu dan QR code gratis selamanya, dan kasir POS dapat dicoba gratis 14 hari. Pesanan online memang bagian dari paket POS, bukan paket gratis.",
      },
    ],
    ctaTitle: "Mulai dengan halaman toko gratis.",
    ctaButton: "Coba POS gratis 14 hari →",
  },
  en: {
    slug: "olsera",
    eyebrow: "Epidom vs. Olsera POS",
    titleParts: [
      "Olsera is broad across retail and F&B.",
      "Epidom is built for small cafés and restaurants.",
    ],
    lede: "Olsera is an Indonesian POS with cashier, online order, recipe management and staff attendance features, with plan prices listed per year. Epidom fits when you want a free storefront page, then a food-and-beverage POS and back office (stock, recipes, cost per dish) with monthly prices listed and a 14-day trial.",
    colCompetitor: "Olsera POS",
    rows: [
      {
        feature: "Public pricing",
        epidom:
          "On the pricing page: POS $14.99/month ($12.49/month yearly), Operations $29.99/month ($24.99/month yearly)",
        competitor:
          "Listed per year: Basic Rp 1,288,000, Premium Rp 1,988,000, Pro Rp 2,688,000 (excluding VAT)",
      },
      {
        feature: "Free plan / trial",
        epidom: "Storefront page free forever; POS 14-day free trial",
        competitor: "14-day free trial shown on every plan",
      },
      {
        feature: "Online ordering from your own page",
        epidom: "Included in POS ($14.99/month, 14-day trial); pay at the cashier",
        competitor:
          "Online Order feature (take away, delivery, dine in, reservation); some items carry extra fees",
      },
      {
        feature: "Stock and recipe cost (HPP)",
        epidom:
          "In Operations: recipes, automatic cost per dish, stock deducted when orders complete",
        competitor:
          '"Manajemen Resep" (recipe management) is listed under F&B features; the pricing page does not clearly say which plan includes it',
      },
      {
        feature: "Staff scheduling and attendance",
        epidom: "In Operations: roster, selfie and location attendance, hours vs. roster",
        competitor: "PIN attendance; facial attendance on Pro; Basic limited to owner + 2 staff",
      },
      {
        feature: "Hardware",
        epidom:
          "Runs in the browser on a phone, tablet or computer; Bluetooth thermal printers supported",
        competitor: "Sells printers, cash drawers, tablets and terminal bundles",
      },
    ],
    note: "Olsera facts were checked on their official site (olsera.com/id/pricing and olsera.com/id/hardware) in October 2026. Only publicly confirmed facts are compared; prices and features can change, so check olsera.com directly.",
    faqEyebrow: "Questions",
    faqTitle: "Epidom vs Olsera POS",
    faqs: [
      {
        q: "When does Epidom fit better than Olsera?",
        a: "Epidom fits if you run a café, bakery or small restaurant and want a free storefront page, online ordering from your own page, and automatic recipe costing. Operations covers up to 3 outlets, and 4 or more go through Enterprise. If you need other features listed on Olsera's site, check with them directly.",
      },
      {
        q: "Can I compare the prices directly?",
        a: "Not one to one. Olsera publishes yearly prices (excluding VAT) and Epidom publishes monthly prices. The plans also contain different things, so compare the features you need, not only the numbers.",
      },
      {
        q: "Can I try Epidom without paying first?",
        a: "Yes. The storefront page with your menu and QR code is free forever, and the POS has a 14-day free trial. Online ordering is part of the POS plan, not the free one.",
      },
    ],
    ctaTitle: "Start with the free storefront.",
    ctaButton: "Try the POS free for 14 days →",
  },
};
