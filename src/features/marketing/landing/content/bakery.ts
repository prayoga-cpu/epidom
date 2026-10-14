import type { LandingPage } from "../types";

export const bakeryPages: LandingPage[] = [
  {
    slug: "aplikasi-kasir-toko-roti",
    locale: "id",
    group: "bakery",
    kind: "vertical",
    metaTitle: "Aplikasi Kasir Toko Roti dengan HPP & Stok",
    metaDescription:
      "Aplikasi kasir toko roti dan kue: label item, pre-order, resep dan HPP per roti, batch produksi, stok menipis. POS Rp 229.000/bulan, coba 14 hari.",
    eyebrow: "POS toko roti",
    h1: "Aplikasi kasir toko roti: dari kasir sampai HPP per roti",
    lede: "Toko roti punya dua urusan: menjual cepat di etalase dan tahu untung per roti. Kasir bakery yang baik mengurus keduanya, dari struk sampai biaya per batch.",
    blocks: [
      { type: "h2", text: "Yang dibutuhkan kasir toko roti" },
      {
        type: "p",
        text: "Etalase toko roti penuh item kecil dan harga mirip: croissant, roti sobek, brownies, donat. Antrean pagi hari cepat, jadi kasir harus bisa memilih lewat kategori atau pencarian, atau memindai barcode. Di balik etalase, ada masalah yang lebih sunyi: berapa sebenarnya modal satu roti, dan berapa yang terbuang di akhir hari.",
      },
      { type: "h2", text: "Penjualan di etalase" },
      {
        type: "list",
        items: [
          "Jual per kategori atau pencarian, dengan pembayaran tunai, kartu, atau beberapa metode dalam satu pesanan.",
          "Barcode scanner didukung untuk produk kemasan.",
          "Printer Bluetooth 58 mm dan 80 mm untuk struk, plus label item untuk kemasan kue.",
          "Kasir tetap jalan saat internet putus, lalu tersinkron kembali.",
        ],
      },
      { type: "h2", text: "Pre-order lewat halaman toko" },
      {
        type: "p",
        text: "Pesanan kue ulang tahun atau roti untuk acara biasanya diambil lewat WhatsApp. Dengan paket POS, pelanggan bisa memesan dari halaman toko Anda (epidom.fr/@nama-toko) untuk diambil atau diantar sendiri. Saat ini pesanan itu bayar di kasir: kasir mendapat peringatan, lalu menandainya lunas saat pelanggan membayar. Halaman toko dengan menu tetap gratis selamanya; pemesanan online adalah bagian dari POS.",
      },
      { type: "h2", text: "Cara menghitung HPP roti" },
      {
        type: "steps",
        items: [
          {
            title: "Catat bahan dan harganya",
            text: "Tepung, ragi, mentega, gula, telur, dan kemasan, masing-masing dengan harga beli terbaru.",
          },
          {
            title: "Tulis resep dengan takaran",
            text: "Berapa gram tepung dan mentega untuk satu adonan, dan berapa roti yang dihasilkan.",
          },
          {
            title: "Bagi biaya adonan dengan jumlah roti",
            text: "Total biaya bahan dibagi hasil jadi adalah HPP per roti. Tambahkan kemasan.",
          },
          {
            title: "Bandingkan dengan harga jual",
            text: "Selisih harga jual dan HPP adalah margin kotor per roti.",
          },
        ],
      },
      {
        type: "callout",
        text: "Contoh: satu adonan menghabiskan bahan Rp 180.000 dan menghasilkan 30 roti. HPP per roti Rp 6.000. Dijual Rp 12.000, margin kotor Rp 6.000 atau 50% dari harga jual. Angka hanya ilustrasi.",
      },
      { type: "h2", text: "Resep, stok, dan batch produksi di Operations" },
      {
        type: "p",
        text: "Paket Operations menghitung HPP per item dari resep secara otomatis, lalu mengurangi stok bahan saat pesanan selesai. Untuk produksi, ada batch produksi: Anda mencatat hasil rencana dibanding hasil sebenarnya, dan melihat biaya per batch. Kalau adonan seharusnya jadi 30 roti tapi hanya 26, selisihnya langsung terlihat. Peringatan stok menipis memberi tahu sebelum tepung atau mentega habis, dan Anda bisa mencatat pesanan ke pemasok.",
      },
      { type: "h2", text: "Roti sisa dan waste di laporan keuangan" },
      {
        type: "p",
        text: "Roti yang tidak laku adalah biaya. Laporan keuangan Operations menampilkan waste bersama pendapatan, harga pokok, margin kotor, dan margin per item, dengan ekspor PDF dan Excel. Dengan begitu Anda bisa memutuskan membuat lebih sedikit varian yang sering tersisa.",
      },
      { type: "h2", text: "Harga" },
      {
        type: "p",
        text: "POS Rp 229.000 per bulan (Rp 189.000 per bulan jika tahunan), dengan percobaan gratis 14 hari. Operations, dengan resep, HPP, batch produksi, dan laporan, Rp 459.000 per bulan (Rp 379.000 jika tahunan). Harga belum termasuk pajak.",
      },
    ],
    faqs: [
      {
        q: "Apakah ada aplikasi kasir khusus toko roti dan kue?",
        a: "Epidom dibuat untuk usaha makanan dan minuman termasuk toko roti. Kasirnya mendukung etalase, label item, dan pre-order, sedangkan paket Operations menambahkan resep, HPP, dan batch produksi.",
      },
      {
        q: "Bagaimana menghitung HPP roti?",
        a: "Jumlahkan biaya semua bahan dalam satu adonan, tambahkan kemasan, lalu bagi dengan jumlah roti yang dihasilkan. Di Operations, Anda cukup memasukkan resep dan harga bahan; HPP per item dihitung otomatis.",
      },
      {
        q: "Apa itu batch produksi?",
        a: "Batch produksi mencatat satu kali pembuatan: hasil yang direncanakan, hasil sebenarnya, dan biaya per batch. Fitur ini ada di paket Operations.",
      },
      {
        q: "Apakah pelanggan bisa pre-order dari halaman toko?",
        a: "Bisa, dengan paket POS. Pesanan masuk ke antrean kasir dan berstatus bayar di kasir; kasir menandainya lunas. Pembayaran online di halaman toko belum tersedia.",
      },
      {
        q: "Berapa biaya aplikasi kasir toko roti ini?",
        a: "POS Rp 229.000 per bulan (Rp 189.000 jika tahunan) dengan percobaan 14 hari. Operations Rp 459.000 per bulan (Rp 379.000 jika tahunan) untuk resep, HPP, stok, dan batch produksi.",
      },
    ],
    cta: {
      title: "Coba kasir untuk toko roti Anda",
      text: "Mulai dengan POS selama 14 hari: masukkan menu etalase, cetak struk dan label, lalu terima pre-order dari halaman toko.",
      button: "Mulai percobaan 14 hari →",
      target: "trial",
    },
    updated: "2026-10-14",
  },
  {
    slug: "bakery-pos-system",
    locale: "en",
    group: "bakery",
    kind: "vertical",
    metaTitle: "Bakery POS System with Recipe Costing",
    metaDescription:
      "A bakery POS system for counter sales, item labels, pre-orders, recipe costing and production batches. POS is $14.99/month with a 14-day trial.",
    eyebrow: "Bakery POS",
    h1: "Bakery POS system: counter sales, recipes, and cost per loaf",
    lede: "A bakery needs a POS that is fast at the counter and honest about cost. The right system rings up the morning rush, then tells you what each loaf actually cost to make.",
    blocks: [
      { type: "h2", text: "What a bakery needs from a POS" },
      {
        type: "p",
        text: "A bakery counter is a stream of small, similar sales: a croissant, two rolls, a slice of cake. Speed matters at 8 a.m. But the harder questions come later. What does a loaf cost in flour, butter and packaging? How many came out of the oven versus what you planned? What was thrown away on Friday night?",
      },
      { type: "h2", text: "Counter sales" },
      {
        type: "list",
        items: [
          "Sell by category or search, with several payment methods on one order if needed.",
          "Barcode scanning for packaged goods.",
          "Bluetooth thermal printers (58 mm and 80 mm) for receipts, plus item labels for boxed cakes and packaged bread.",
          "Offline mode: keep selling if the internet drops; sales sync when it returns.",
        ],
      },
      { type: "h2", text: "Pre-orders from your storefront" },
      {
        type: "p",
        text: "Birthday cakes and party orders usually arrive by message. With the POS plan, customers can order from your storefront page (epidom.fr/@your-bakery) for pickup or your own delivery. Orders from the page are currently pay at the counter: the POS alerts you and you mark the order paid. The storefront page with your menu is free forever; online ordering is part of POS.",
      },
      { type: "h2", text: "How to cost a bakery recipe" },
      {
        type: "steps",
        items: [
          {
            title: "List ingredients and their prices",
            text: "Flour, yeast, butter, sugar, eggs and packaging, each at its current purchase price.",
          },
          {
            title: "Write the recipe with quantities",
            text: "Grams of flour and butter for one batch of dough, and how many pieces it yields.",
          },
          {
            title: "Divide batch cost by pieces",
            text: "Total ingredient cost divided by yield is the cost per piece. Add packaging.",
          },
          {
            title: "Compare with the selling price",
            text: "Price minus cost is your gross margin per item.",
          },
        ],
      },
      {
        type: "callout",
        text: "Example: a batch of dough uses $40 of ingredients and yields 30 rolls. Cost per roll is about $1.33. Sold at $3.00, the gross margin is $1.67 per roll, roughly 56% of the price. Figures are illustrative only.",
      },
      { type: "h2", text: "Bakery inventory and production batches" },
      {
        type: "p",
        text: "On the Operations plan, Epidom keeps an ingredient catalogue, calculates cost per item from your recipes, and deducts stock as orders complete. Production batches record what you planned to bake against what actually came out, with the cost per batch. If a batch meant for 30 rolls gives 26, you see the gap and its cost. Low-stock alerts warn you before the flour or butter runs out, and supplier orders keep reordering in one place.",
      },
      { type: "h2", text: "Waste in your finance reports" },
      {
        type: "p",
        text: "Unsold bread is a cost. Operations finance reports show waste alongside revenue, cost of goods, gross margin and item margin, with PDF and Excel export. If the same variety keeps ending up in the bin, you will see it and can bake less of it.",
      },
      { type: "h2", text: "Pricing" },
      {
        type: "p",
        text: "POS is $14.99 per month ($12.49 per month billed yearly) with a 14-day free trial. Operations, which adds recipes, costing, production batches and reports, is $29.99 per month ($24.99 yearly). Prices are before tax.",
      },
    ],
    faqs: [
      {
        q: "What is the best POS system for a bakery?",
        a: "Look for fast counter sales, item labels, pre-orders, and recipe costing in the same tool. Epidom covers the counter in the POS plan and adds recipes, stock and production batches in Operations.",
      },
      {
        q: "How do I calculate the cost of a loaf or pastry?",
        a: "Add up the ingredients in one batch, add packaging, and divide by the number of pieces. In Epidom's Operations plan you enter the recipe and ingredient prices, and cost per item is calculated for you.",
      },
      {
        q: "What are production batches?",
        a: "A production batch records one bake: planned yield, actual yield, and cost per batch. It is available on the Operations plan.",
      },
      {
        q: "Can customers pre-order from my bakery's page?",
        a: "Yes, on the POS plan. Orders are pay at the counter for now: you get an alert and mark the order paid. Online payment on the storefront is not available.",
      },
      {
        q: "How much does a bakery POS cost with Epidom?",
        a: "POS is $14.99 per month ($12.49 billed yearly) with a 14-day free trial. Operations is $29.99 per month ($24.99 yearly) and adds recipes, costing, stock, production batches and finance reports.",
      },
    ],
    cta: {
      title: "Try the POS in your bakery",
      text: "Start the 14-day trial: add your counter menu, print receipts and labels, and take pre-orders from your storefront.",
      button: "Start the 14-day trial →",
      target: "trial",
    },
    updated: "2026-10-14",
  },
];
