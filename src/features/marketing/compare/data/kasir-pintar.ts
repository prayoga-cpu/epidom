import type { Locale } from "@/components/lang/i18n-provider";
import type { CompetitorComparisonData } from "../types";

// Kasir Pintar facts re-checked 2026-10-14 on kasirpintar.co.id only (no third-party sources):
// - https://kasirpintar.co.id/harga (now reachable): "Kasir Pintar Free" GRATIS (limits:
//   "Single User", "Manajemen Barang hingga 1.000 Data", "Struk dengan watermark");
//   bundle "Kasir Pintar Pro: Rp 666.000 per 1 Tahun"; plugins Business Account,
//   Desktop, Food Menu, Bahan Baku, POS Offline, StaffPlus listed as separate "Rp / Bulan"
//   items with NO amount shown (so no plugin prices are quoted).
// - https://kasirpintar.co.id (home): "Coba Gratis selama 30 Hari tanpa syarat";
//   "Transaksi Offline tanpa internet" (POS Offline); Food Menu "Pesan mandiri
//   (Self-order) dengan QR Code Online"; Olshopin "Toko online gratis" (COD, bank
//   transfer); Bahan Baku "Hitung setiap bahan baku yang digunakan dari setiap menu";
//   StaffPlus "Penjadwalan Jam Kerja Staff" + selfie attendance; Pro in Android, iOS
//   and Desktop versions; multi-branch control from one account in Pro.
// Do not add claims beyond this.
export const kasirPintarComparison: Partial<Record<Locale, CompetitorComparisonData>> = {
  id: {
    slug: "kasir-pintar",
    eyebrow: "Epidom vs. Kasir Pintar",
    titleParts: [
      "Kasir Pintar sudah akrab di banyak toko.",
      "Epidom berjalan di browser, dengan halaman toko sendiri.",
    ],
    lede: "Kasir Pintar adalah aplikasi kasir Indonesia dengan paket Free dan Pro, uji coba 30 hari, serta plugin untuk mode offline, pemesanan lewat QR, bahan baku per menu, dan absensi staf. Epidom cocok jika Anda ingin aplikasi yang berjalan di browser (juga bisa dipasang sebagai aplikasi), dan halaman toko publik dengan menu gratis selamanya, sementara pesanan online dan kasir ada di paket POS.",
    colCompetitor: "Kasir Pintar",
    rows: [
      {
        feature: "Paket dan harga",
        epidom:
          "Free Rp 0; POS Rp 229.000/bulan (tahunan Rp 189.000); Operations Rp 459.000/bulan (tahunan Rp 379.000); harga publik",
        competitor:
          "Kasir Pintar Free (gratis) dan paket Kasir Pintar Pro Rp 666.000 per 1 tahun; plugin (Food Menu, Bahan Baku, POS Offline, StaffPlus) tercantum terpisah di halaman harga tanpa nominal",
      },
      {
        feature: "Gratis / uji coba",
        epidom: "Halaman toko gratis selamanya; POS uji coba gratis 14 hari",
        competitor: "Paket Free (satu pengguna, hingga 1.000 data barang); uji coba gratis 30 hari",
      },
      {
        feature: "Pesanan online dari halaman sendiri",
        epidom: "Termasuk di POS (Rp 229.000/bulan, uji coba 14 hari); bayar di kasir",
        competitor:
          "Food Menu (pesan mandiri lewat QR) dan Olshopin (toko online, COD dan transfer)",
      },
      {
        feature: "Mode offline",
        epidom: "Termasuk di POS: penjualan tetap jalan tanpa internet dan tersinkron saat online",
        competitor: "Plugin POS Offline: transaksi tanpa internet",
      },
      {
        feature: "Stok dan resep (HPP)",
        epidom:
          "Di Operations: resep, HPP otomatis per menu, stok berkurang otomatis, peringatan stok menipis",
        competitor: "Plugin Bahan Baku: hitung bahan baku yang dipakai tiap menu",
      },
      {
        feature: "Jadwal dan absensi staf",
        epidom:
          "Di Operations: jadwal, absensi selfie dan lokasi, jam kerja vs jadwal, gaji dari absensi",
        competitor: "Plugin StaffPlus: absensi (termasuk selfie) dan penjadwalan jam kerja",
      },
      {
        feature: "Perangkat",
        epidom:
          "Browser di HP, tablet, atau komputer; juga aplikasi desktop dan Android; printer Bluetooth 58/80 mm",
        competitor:
          "Aplikasi Android, iOS, dan Desktop; perangkat keras dijual di halaman hardware mereka",
      },
    ],
    note: "Fakta Kasir Pintar diperiksa di situs resmi mereka (kasirpintar.co.id dan kasirpintar.co.id/harga) pada Oktober 2026; harga plugin tidak dicantumkan karena nominalnya tidak tertera di halaman. Hanya fakta yang dikonfirmasi publik yang dibandingkan; cek situs resmi mereka untuk info terbaru.",
    faqEyebrow: "Pertanyaan",
    faqTitle: "Epidom vs Kasir Pintar",
    faqs: [
      {
        q: "Apakah Epidom gratis seperti Kasir Pintar Free?",
        a: "Sebagian. Halaman toko publik dengan menu, foto, dan kode QR gratis selamanya di Epidom. Kasir dan pesanan online ada di paket POS (Rp 229.000/bulan) dengan uji coba gratis 14 hari. Kasir Pintar punya paket Free (satu pengguna, hingga 1.000 data barang) dan uji coba 30 hari.",
      },
      {
        q: "Mana yang lebih cocok untuk usaha dengan banyak cabang?",
        a: "Kasir Pintar Pro mencantumkan kontrol beberapa cabang dari satu akun. Epidom Operations mendukung sampai 3 outlet dengan tampilan keuangan gabungan; untuk 4 outlet atau lebih ada paket Enterprise dengan harga per proyek. Jika Anda sudah memakai Kasir Pintar dan puas, tidak ada alasan mendesak untuk pindah.",
      },
      {
        q: "Apakah Epidom terhubung langsung dengan GoFood atau GrabFood?",
        a: "Tidak. Pesanan dari aplikasi tersebut bisa dicatat di kasir sebagai kanal tersendiri, sehingga laporan keuangan (Operations) menampilkan pendapatan dan komisi tiap platform.",
      },
      {
        q: "Bisakah saya memindahkan data dari Kasir Pintar?",
        a: "Belum ada alat migrasi otomatis. Menu dan data perlu dimasukkan ulang.",
      },
    ],
    ctaTitle: "Mulai dengan halaman toko gratis.",
    ctaButton: "Coba POS gratis 14 hari →",
  },
  en: {
    slug: "kasir-pintar",
    eyebrow: "Epidom vs. Kasir Pintar",
    titleParts: [
      "Kasir Pintar is a familiar name for Indonesian shops.",
      "Epidom runs in the browser, with its own store page.",
    ],
    lede: "Kasir Pintar is an Indonesian cashier app with Free and Pro plans, a 30-day trial, and plugins for offline mode, QR self-ordering, per-menu raw materials and staff attendance. Epidom fits when you want an app that runs in the browser (and can be installed as an app), and the public store page with your menu is free forever, while the cashier and online ordering are in the POS plan.",
    colCompetitor: "Kasir Pintar",
    rows: [
      {
        feature: "Plans and pricing",
        epidom:
          "Free $0; POS $14.99/month (yearly $12.49); Operations $29.99/month (yearly $24.99); public pricing",
        competitor:
          "Kasir Pintar Free (free) and a Kasir Pintar Pro bundle at Rp 666,000 per 1 year; plugins (Food Menu, Bahan Baku, POS Offline, StaffPlus) are listed separately on the pricing page with no amount shown",
      },
      {
        feature: "Free plan / trial",
        epidom: "Storefront free forever; POS 14-day free trial",
        competitor: "Free plan (single user, up to 1,000 inventory records); 30-day free trial",
      },
      {
        feature: "Online ordering from your own page",
        epidom: "Included in POS ($14.99/month, 14-day trial); pay at the cashier",
        competitor: "Food Menu (QR self-order) and Olshopin (online shop, COD and bank transfer)",
      },
      {
        feature: "Offline mode",
        epidom: "Included in POS: keep selling without internet, syncs when back online",
        competitor: "POS Offline plugin: transactions without internet",
      },
      {
        feature: "Stock and recipe cost (HPP)",
        epidom:
          "In Operations: recipes, automatic cost per dish, stock deducted on orders, low-stock alerts",
        competitor: "Bahan Baku plugin: tracks the raw materials used in each menu item",
      },
      {
        feature: "Staff scheduling and attendance",
        epidom:
          "In Operations: roster, selfie and location attendance, hours vs. roster, salary from attendance",
        competitor: "StaffPlus plugin: attendance (including selfie) and work-hour scheduling",
      },
      {
        feature: "Devices",
        epidom:
          "Browser on phone, tablet or computer; also desktop and Android apps; Bluetooth 58/80 mm printers",
        competitor: "Android, iOS and Desktop apps; hardware sold on their hardware page",
      },
    ],
    note: "Kasir Pintar facts were checked on their official site (kasirpintar.co.id and kasirpintar.co.id/harga) in October 2026; plugin prices are left out because no amount is shown on the page. Only publicly confirmed facts are compared; check their official site for the latest.",
    faqEyebrow: "Questions",
    faqTitle: "Epidom vs Kasir Pintar",
    faqs: [
      {
        q: "Is Epidom free like Kasir Pintar Free?",
        a: "Partly. The public store page with your menu, photos and QR code is free forever on Epidom. The cashier and online ordering are in the POS plan ($14.99/month) with a 14-day free trial. Kasir Pintar has a Free plan (single user, up to 1,000 inventory records) and a 30-day trial.",
      },
      {
        q: "Which is better for several outlets?",
        a: "Kasir Pintar Pro lists control of multiple branches from one account. Epidom Operations covers up to 3 outlets with a combined finance view; 4 or more is Enterprise, priced per project. If you already use Kasir Pintar and it works for you, there is no urgent reason to switch.",
      },
      {
        q: "Does Epidom connect directly to GoFood or GrabFood?",
        a: "No. Orders from those apps can be entered at the POS as their own channel, so Finance (Operations) shows each platform's revenue and commission.",
      },
      {
        q: "Can I move my data from Kasir Pintar?",
        a: "There is no automated migration tool. You would re-enter your menu and data.",
      },
    ],
    ctaTitle: "Start with the free storefront.",
    ctaButton: "Try the POS free for 14 days →",
  },
};
