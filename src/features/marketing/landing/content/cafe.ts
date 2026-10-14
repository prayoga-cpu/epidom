import type { LandingPage } from "../types";

export const cafePages: LandingPage[] = [
  {
    slug: "aplikasi-kasir-cafe",
    locale: "id",
    group: "cafe",
    kind: "vertical",
    metaTitle: "Aplikasi Kasir Cafe: Kopi, Antrean, Menu QR",
    metaDescription:
      "Aplikasi kasir cafe untuk penjualan cepat dengan pilihan ukuran dan gula, antrean pesanan, menu QR, mode offline, dan harga paket dalam rupiah.",
    eyebrow: "Kasir untuk kafe",
    h1: "Aplikasi kasir cafe untuk kedai kopi dan kafe kecil",
    lede: "Aplikasi kasir cafe yang baik harus cepat di depan bar, paham pilihan minuman, dan tidak berhenti saat wifi mati. Berikut cara kerja kasir kafe sepanjang hari, dan paket Epidom mana yang Anda butuhkan.",
    blocks: [
      { type: "h2", text: "Apa yang harus bisa dilakukan kasir kafe" },
      {
        type: "p",
        text: "Kafe berbeda dari toko biasa. Satu gelas kopi punya ukuran, level gula, jenis susu, dan tambahan shot. Pelanggan antre di jam sibuk, dan pesanan harus sampai ke barista tanpa teriak-teriak. Karena itu, aplikasi kasir kafe sebaiknya memenuhi beberapa hal dasar.",
      },
      {
        type: "list",
        items: [
          "Memilih menu dengan satu atau dua ketukan, dari kategori atau kolom pencarian.",
          "Pilihan per minuman: ukuran, gula, susu, tambahan.",
          "Antrean pesanan dan tiket untuk bar atau dapur.",
          "Struk yang bisa dicetak atau dikirim ke email.",
          "Tetap berjalan saat internet putus.",
        ],
      },
      { type: "h2", text: "Penjualan cepat di meja kasir" },
      {
        type: "p",
        text: "Di kasir Epidom, Anda menjual lewat kategori atau pencarian, di tablet, ponsel, atau komputer. Menu bisa diberi opsi seperti ukuran dan tambahan, sehingga satu latte tidak perlu dibuat menjadi lima item terpisah. Satu pesanan bisa dibayar dengan beberapa metode sekaligus, misalnya sebagian tunai dan sisanya lewat metode lain. Biaya layanan dan pajak disimpan sebagai preset, dan refund tersedia kalau ada kesalahan.",
      },
      {
        type: "steps",
        items: [
          {
            title: "Susun menu",
            text: "Buat kategori seperti kopi, non-kopi, dan makanan ringan, lalu isi item beserta foto, harga, dan opsi ukuran atau tambahan.",
          },
          {
            title: "Atur pajak dan biaya layanan",
            text: "Pilih preset yang sesuai dengan kafe Anda supaya angka di struk selalu sama.",
          },
          {
            title: "Hubungkan printer",
            text: "Printer thermal Bluetooth 58 mm atau 80 mm bisa dipakai untuk struk, tiket dapur, dan tiket bar.",
          },
          {
            title: "Mulai jual",
            text: "Pilih item, pilih opsi, tentukan pembayaran, dan pesanan masuk ke antrean.",
          },
        ],
      },
      { type: "h2", text: "Antrean pesanan dan tiket bar atau dapur" },
      {
        type: "p",
        text: "Setiap pesanan, baik dari kasir maupun dari halaman toko, masuk ke antrean dengan status Baru, Disiapkan, Siap, lalu Disajikan. Barista tahu mana yang harus dibuat lebih dulu, dan kasir tahu mana yang sudah siap dipanggil. Tiket bisa muncul di layar dapur dengan suara pemberitahuan, atau tercetak di printer bar dan printer dapur.",
      },
      {
        type: "callout",
        text: "Satu layar dapur sudah termasuk di paket POS. Kalau Anda ingin beberapa layar yang dibagi per stasiun (dapur dan bar), itu ada di paket Operations.",
      },
      { type: "h2", text: "Halaman menu dan QR untuk meja" },
      {
        type: "p",
        text: "Setiap kafe mendapat halaman publik di epidom.fr/@nama-kafe berisi logo, jam buka, tautan Instagram dan WhatsApp, serta menu lengkap dengan foto dan harga. Halaman ini gratis selamanya. Anda bisa mencetak kode QR-nya dan menempelkannya di meja atau di pintu, sehingga tamu bisa melihat menu tanpa menunggu daftar menu cetak. Item yang habis bisa ditandai dengan satu tombol.",
      },
      { type: "h2", text: "Pesanan online dari pelanggan langganan" },
      {
        type: "p",
        text: "Di paket POS, halaman yang sama bisa menerima pesanan: makan di tempat dengan nomor meja, bawa pulang, atau diantar sendiri oleh kafe. Saat ini pesanan dari halaman toko dibayar di kasir. Kasir mendapat suara dan notifikasi, lalu menandai pesanan sebagai sudah dibayar. Cara ini cocok untuk pelanggan tetap yang ingin memesan sebelum tiba. Anda tetap bisa memakai GoFood atau GrabFood untuk dikenal orang baru, lalu mengajak langganan memesan lewat tautan sendiri.",
      },
      { type: "h2", text: "Saat wifi mati" },
      {
        type: "p",
        text: "Kafe tidak bisa berhenti jual hanya karena internet putus. Dengan mode offline, kasir tetap menerima penjualan. Transaksi disimpan di perangkat, lalu dikirim saat koneksi kembali, dengan waktu transaksi yang asli. Pengelolaan shift, kas, dan refund tetap butuh koneksi, jadi pastikan shift sudah dibuka sebelum jam sibuk.",
      },
      { type: "h2", text: "Paket mana yang Anda butuhkan" },
      {
        type: "list",
        items: [
          "Gratis: halaman toko, menu, dan kode QR. Tidak ada pemesanan online.",
          "POS, Rp 229.000 per bulan (Rp 189.000 per bulan jika bayar tahunan): kasir, antrean pesanan, satu layar dapur, printer, pesanan online, dan mode offline. Ada percobaan gratis 14 hari.",
          "Operations, Rp 459.000 per bulan (Rp 379.000 per bulan jika tahunan): stok dan resep dengan HPP otomatis per minuman, jadwal dan absensi staf, shift dengan hitungan kas, layar dapur per stasiun, laporan keuangan, diskon dan poin loyalitas, hingga 3 outlet.",
        ],
      },
      {
        type: "p",
        text: "Kafe satu outlet yang baru mulai biasanya cukup dengan POS. Pindah ke Operations ketika Anda ingin tahu HPP tiap minuman, stok biji kopi dan susu berkurang otomatis, atau jadwal barista dan gajinya dihitung dari absensi. Harga belum termasuk pajak.",
      },
    ],
    faqs: [
      {
        q: "Berapa harga aplikasi kasir cafe di Epidom?",
        a: "Paket POS Rp 229.000 per bulan, atau Rp 189.000 per bulan jika dibayar tahunan, dan dimulai dengan percobaan gratis 14 hari. Paket Operations Rp 459.000 per bulan (Rp 379.000 jika tahunan) untuk stok, resep, staf, dan laporan keuangan. Halaman toko dengan menu dan QR gratis. Harga belum termasuk pajak.",
      },
      {
        q: "Apakah bisa memilih ukuran, gula, dan susu untuk setiap minuman?",
        a: "Bisa. Item menu mendukung opsi seperti ukuran dan tambahan, sehingga pelanggan dan kasir memilihnya langsung di pesanan yang sama.",
      },
      {
        q: "Apakah kasir tetap jalan kalau wifi kafe mati?",
        a: "Ya. Di paket POS, kasir tetap menerima penjualan tanpa internet. Penjualan disimpan di perangkat dan dikirim saat koneksi kembali, dengan waktu aslinya.",
      },
      {
        q: "Apakah pelanggan bisa memesan dan membayar lewat QR di meja?",
        a: "Di paket POS, pelanggan bisa memesan dari halaman toko dengan nomor meja. Pembayaran saat ini dilakukan di kasir, yang menandai pesanan sebagai sudah dibayar. Pembayaran online di halaman toko belum tersedia.",
      },
      {
        q: "Bisa dipakai di tablet atau ponsel, dan printer apa yang didukung?",
        a: "Epidom berjalan di browser pada ponsel, tablet, atau komputer, dan bisa dipasang sebagai aplikasi. Struk dan tiket dicetak lewat printer thermal Bluetooth 58 mm atau 80 mm (ESC/POS). Anda juga bisa memakai struk PDF atau kirim ke email.",
      },
    ],
    cta: {
      title: "Coba kasir kafe selama 14 hari",
      text: "Susun menu, hubungkan printer, dan jual dari tablet Anda. Percobaan POS gratis selama 14 hari.",
      button: "Mulai percobaan gratis →",
      target: "trial",
    },
    updated: "2026-10-14",
  },
  {
    slug: "cafe-pos-system",
    locale: "en",
    group: "cafe",
    kind: "vertical",
    metaTitle: "Cafe POS System for Coffee Shops & Small Cafés",
    metaDescription:
      "A cafe POS system for fast counter sales, drink options, an order queue, QR menu and offline mode, with plans and prices in dollars.",
    eyebrow: "POS for cafés",
    h1: "Cafe POS system for coffee shops and small cafés",
    lede: "A good cafe POS system is fast at the counter, understands drink options, and keeps working when the wifi drops. Here is how a café day runs on Epidom, and which plan covers what.",
    blocks: [
      { type: "h2", text: "What a coffee shop POS has to handle" },
      {
        type: "p",
        text: "A café is not a corner store. One latte comes with a size, a milk, a syrup and an extra shot. The line builds up at 8 a.m., and the order has to reach the barista without anyone shouting it across the room. A POS for a small café should cover a few basics.",
      },
      {
        type: "list",
        items: [
          "Picking items in one or two taps, by category or search.",
          "Options per drink: size, milk, sweetness, add-ons.",
          "An order queue and tickets for the bar or kitchen.",
          "Receipts on paper or by email.",
          "Selling on when the internet goes down.",
        ],
      },
      { type: "h2", text: "Fast counter sales with options" },
      {
        type: "p",
        text: "On Epidom's POS you sell by category or search, on a tablet, phone or computer. Menu items carry options such as size and add-ons, so one latte stays one item instead of five near-duplicates. An order can be paid with several methods at once, for example part cash and part card. Service charge and tax are saved as presets, and refunds are there for the inevitable wrong order.",
      },
      {
        type: "steps",
        items: [
          {
            title: "Build the menu",
            text: "Create categories like espresso, tea and pastries, then add items with photos, prices and size or add-on options.",
          },
          {
            title: "Set tax and service charge",
            text: "Pick the presets that match your café so every receipt adds up the same way.",
          },
          {
            title: "Connect a printer",
            text: "Bluetooth thermal printers (58 mm or 80 mm) can print receipts, kitchen tickets and bar tickets.",
          },
          {
            title: "Start selling",
            text: "Tap the item, choose the options, take payment, and the order drops into the queue.",
          },
        ],
      },
      { type: "h2", text: "The order queue and bar or kitchen tickets" },
      {
        type: "p",
        text: "Every order, from the counter or from your storefront page, lands in a queue that moves from New to Preparing, Ready and Served. The barista sees what to make next, and the cashier sees what is ready to call out. Tickets can show up on a kitchen display with a sound alert, or print on a bar or kitchen printer.",
      },
      {
        type: "callout",
        text: "One kitchen display screen is included in the POS plan. If you want several screens routed by station (kitchen and bar), that comes with the Operations plan.",
      },
      { type: "h2", text: "A menu page and a QR code for your tables" },
      {
        type: "p",
        text: "Every café gets a public page at epidom.fr/@your-cafe with your logo, hours, Instagram and WhatsApp links, and the full menu with photos and prices. That page is free forever. Print its QR code and put it on tables or by the door, and guests can read the menu without a laminated card. A sold-out item is one switch away from disappearing from the list.",
      },
      { type: "h2", text: "Online orders from your regulars" },
      {
        type: "p",
        text: "On the POS plan the same page takes orders: dine-in with a table number, takeaway, or delivery by the café itself. For now these orders are pay-at-the-counter. The POS gets a sound and a device notification, and the cashier marks the order paid. It suits regulars who order ahead on the way in. Keep the delivery apps for being found by new people, and point your regulars to your own ordering link.",
      },
      { type: "h2", text: "When the wifi drops" },
      {
        type: "p",
        text: "A café cannot close the register because the router died. With offline mode, the POS keeps taking sales. They are stored on the device and synced when the connection returns, with their original time. Opening a shift, cash movements and refunds still need a connection, so open your shift before the rush.",
      },
      { type: "h2", text: "Which plan does what" },
      {
        type: "list",
        items: [
          "Free: your storefront page, menu and QR code. No online ordering.",
          "POS, $14.99 a month ($12.49 a month on the annual plan): the POS, order queue, one kitchen display, printers, online ordering and offline mode. It starts with a 14-day free trial.",
          "Operations, $29.99 a month ($24.99 a month yearly): stock and recipes with automatic cost per drink, staff schedules and attendance, shifts with cash counts, kitchen display by station, finance reports, discounts and loyalty points, up to 3 outlets.",
        ],
      },
      {
        type: "p",
        text: "A single café starting out is usually fine on POS. Move to Operations when you want to know what each drink costs you, have beans and milk deduct from stock as you sell, or calculate barista pay from attendance. Prices are before tax.",
      },
    ],
    faqs: [
      {
        q: "How much does a cafe POS system cost on Epidom?",
        a: "The POS plan is $14.99 a month, or $12.49 a month billed yearly, and begins with a 14-day free trial. Operations is $29.99 a month ($24.99 yearly) and adds stock, recipes, staff and finance reports. The storefront page with menu and QR code is free. Prices are before tax.",
      },
      {
        q: "Can I set size, milk and sweetness options on drinks?",
        a: "Yes. Menu items support options such as size and add-ons, so the cashier and the customer pick them on the same order.",
      },
      {
        q: "Does the POS keep working if the wifi goes down?",
        a: "Yes. On the POS plan the cashier keeps selling without internet. Sales are kept on the device and sync when the connection is back, with their original time.",
      },
      {
        q: "Can guests order and pay from a QR code on the table?",
        a: "On the POS plan guests can order from your page with a table number. For now they pay at the counter, where the cashier marks the order paid. Online payment on the storefront is not available.",
      },
      {
        q: "What devices and printers does it work with?",
        a: "It runs in the browser on a phone, tablet or computer and can be installed as an app. Receipts and tickets print on Bluetooth thermal printers (58 mm or 80 mm, ESC/POS), or you can send a PDF or email receipt.",
      },
    ],
    cta: {
      title: "Try the cafe POS for 14 days",
      text: "Build your menu, connect a printer and sell from a tablet. The POS plan starts with a 14-day free trial.",
      button: "Start the free trial →",
      target: "trial",
    },
    updated: "2026-10-14",
  },
];
