import type { Locale } from "@/components/lang/i18n-provider";
import type { CompetitorComparisonData } from "../types";

// Qasir facts re-checked 2026-10-14 on Qasir's own site only (no third-party sources used):
// - https://qasir.id/qasir-pro : Pro "Rp699.000" per 12 months (struck-through
//   Rp899.000; 12 or 24 month billing), Pro Plus "Rp1.199.000" (struck Rp1.399.000),
//   Enterprise by contact; "harga belum termasuk pajak"; "Trial Qasir pro selama
//   7 hari"; Pro: stock/product/raw-material management, employee access and
//   authorization, attendance, main outlet (branch outlets cost extra).
// - https://www.qasir.id/perangkat : Android tablet bundles incl. Qasir Pro (e.g.
//   Advan XTAB + Standing Holder + Qasir Pro Rp2.332.000), "mesin kasir online
//   portable berbasis Android".
// The homepage "Rp70.792 per bulan*" is not used (asterisk unexplained); the pricing
// page with its period is quoted instead. Rows on offline mode, online ordering and
// recipe/HPP were removed (not stated). Do not add claims beyond this.
export const qasirComparison: Partial<Record<Locale, CompetitorComparisonData>> = {
  id: {
    slug: "qasir",
    eyebrow: "Epidom vs. Qasir",
    titleParts: ["Qasir sudah dikenal banyak UMKM.", "Epidom menambah halaman toko Anda sendiri."],
    lede: "Qasir adalah aplikasi kasir Indonesia yang sudah dikenal UMKM, dengan stok, akses karyawan, absensi, dan paket perangkat Android dari mereka sendiri. Epidom cocok jika Anda ingin halaman toko gratis dengan menu Anda, pesanan online dari halaman itu (paket POS), dan berjalan di browser pada perangkat yang sudah Anda punya.",
    colCompetitor: "Qasir",
    rows: [
      {
        feature: "Harga paket",
        epidom: "POS: Rp 229.000/bulan (Rp 189.000/bulan jika tahunan), sebelum pajak",
        competitor: "Pro: Rp699.000 per 12 bulan (tertera bersama Rp899.000), belum termasuk pajak",
      },
      {
        feature: "Gratis / uji coba",
        epidom: "Halaman toko gratis selamanya; POS dengan uji coba 14 hari",
        competitor: "Uji coba Qasir Pro 7 hari untuk pendaftar baru; setelah itu berlangganan",
      },
      {
        feature: "Stok dan HPP resep",
        epidom: "Paket Operations (Rp 459.000/bulan): resep, biaya per hidangan, stok otomatis",
        competitor: "Pro mencakup pengelolaan stok, produk, dan bahan baku",
      },
      {
        feature: "Karyawan dan jadwal",
        epidom: "Operations: peran, absen PIN, jadwal, absensi selfie dan lokasi",
        competitor: "Akses karyawan dan absensi ada di Pro",
      },
      {
        feature: "Perangkat",
        epidom: "Browser di HP, tablet, atau komputer; printer Bluetooth 58 mm dan 80 mm",
        competitor: "Qasir menjual paket tablet Android (termasuk Qasir Pro) dan printer",
      },
    ],
    note: "Fakta Qasir diperiksa di situs resmi mereka (qasir.id/qasir-pro dan qasir.id/perangkat) pada Oktober 2026. Hanya fakta yang dikonfirmasi publik yang dibandingkan; harga dan fitur bisa berubah, cek langsung ke situs mereka.",
    faqEyebrow: "Pertanyaan",
    faqTitle: "Epidom vs Qasir",
    faqs: [
      {
        q: "Apakah Qasir punya paket gratis?",
        a: "Halaman paket Qasir Pro saat ini menyebut uji coba 7 hari untuk pendaftar baru, lalu berlangganan Pro atau Pro Plus. Halaman itu tidak menyebut paket gratis permanen. Di Epidom, halaman toko dengan menu gratis selamanya, sedangkan kasir (POS) berlangganan setelah uji coba 14 hari.",
      },
      {
        q: "Mana yang lebih murah?",
        a: "Harganya tidak bisa dibandingkan langsung: Qasir Pro tertera Rp699.000 per 12 bulan (belum termasuk pajak), sedangkan POS Epidom Rp 229.000 per bulan (Rp 189.000 per bulan jika tahunan, sebelum pajak). Isi paketnya juga berbeda, jadi bandingkan fitur yang Anda butuhkan.",
      },
      {
        q: "Apakah saya harus membeli tablet khusus?",
        a: "Epidom berjalan di browser pada HP, tablet, atau komputer yang sudah Anda punya, dan juga bisa dipasang sebagai aplikasi. Qasir menjual paket tablet Android dan printer. Kami tidak memverifikasi syarat perangkat mereka, jadi tanyakan langsung ke Qasir.",
      },
      {
        q: "Kapan Qasir lebih cocok?",
        a: "Jika Anda ingin kasir Android dengan paket perangkat dari satu penyedia, dan butuh stok serta absensi, Qasir layak dipertimbangkan. Epidom cocok jika Anda ingin halaman toko sendiri, pesanan online, dan HPP resep.",
      },
    ],
    ctaTitle: "Mulai dengan halaman toko gratis.",
    ctaButton: "Coba POS gratis 14 hari →",
  },
  en: {
    slug: "qasir",
    eyebrow: "Epidom vs. Qasir",
    titleParts: [
      "Qasir is well known to Indonesian shops.",
      "Epidom adds your own storefront page.",
    ],
    lede: "Qasir is an Indonesian cashier app known to small businesses, with stock management, staff access, attendance and Android hardware bundles sold by Qasir itself. Epidom fits when you want a free storefront page with your menu, online ordering from that page (POS plan), and a browser-based app on devices you already own.",
    colCompetitor: "Qasir",
    rows: [
      {
        feature: "Plan price",
        epidom: "POS: $14.99/month ($12.49/month yearly), before tax",
        competitor: "Pro: Rp699,000 per 12 months (shown next to Rp899,000), excluding tax",
      },
      {
        feature: "Free plan / trial",
        epidom: "Storefront free forever; POS with a 14-day free trial",
        competitor: "7-day Qasir Pro trial for new sign-ups, then subscription",
      },
      {
        feature: "Stock and recipe cost (HPP)",
        epidom: "Operations plan ($29.99/month): recipes, cost per dish, automatic stock",
        competitor: "Pro includes stock, product and raw-material management",
      },
      {
        feature: "Staff and scheduling",
        epidom: "Operations: roles, PIN clock-in, roster, selfie and location attendance",
        competitor: "Employee access and attendance in Pro",
      },
      {
        feature: "Hardware",
        epidom: "Browser on phone, tablet or computer; 58 mm and 80 mm Bluetooth printers",
        competitor: "Qasir sells Android tablet bundles (Qasir Pro included) and printers",
      },
    ],
    note: "Qasir facts were checked on their official site (qasir.id/qasir-pro and qasir.id/perangkat) in October 2026. Only publicly confirmed facts are compared; prices and features can change, so check their site for the latest.",
    faqEyebrow: "Questions",
    faqTitle: "Epidom vs Qasir",
    faqs: [
      {
        q: "Does Qasir have a free plan?",
        a: "The current Qasir Pro page mentions a 7-day trial for new sign-ups, then a Pro or Pro Plus subscription. It does not describe a permanent free tier. With Epidom, the storefront page with your menu is free forever, while the POS is a subscription after a 14-day trial.",
      },
      {
        q: "Which one is cheaper?",
        a: "The prices can't be compared directly: Qasir Pro is listed at Rp699,000 per 12 months (excluding tax), while Epidom POS is $14.99 per month ($12.49 per month billed yearly, before tax), in different currencies. The plans also contain different things, so compare the features you need.",
      },
      {
        q: "Do I have to buy a specific tablet?",
        a: "Epidom runs in a browser on a phone, tablet or computer you already own, and can also be installed as an app. Qasir sells Android tablet and printer bundles. We did not verify their device requirements, so ask Qasir directly.",
      },
      {
        q: "When is Qasir the better fit?",
        a: "If you want an Android cashier with hardware from a single provider, plus stock and attendance, Qasir is worth considering. Epidom fits when you want your own storefront page, online ordering and recipe costing.",
      },
    ],
    ctaTitle: "Start with the free storefront.",
    ctaButton: "Try the POS free for 14 days →",
  },
};
