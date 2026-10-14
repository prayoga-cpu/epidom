import type { LandingPage } from "../types";

export const restaurantPages: LandingPage[] = [
  {
    slug: "aplikasi-kasir-restoran",
    locale: "id",
    group: "restaurant",
    kind: "vertical",
    metaTitle: "Aplikasi Kasir Restoran: Meja, Dapur, Stok",
    metaDescription:
      "Aplikasi kasir restoran dengan manajemen meja, layar dapur, split payment, service charge dan pajak, mode offline. POS mulai Rp 229.000/bulan.",
    eyebrow: "POS restoran",
    h1: "Aplikasi kasir restoran: meja, dapur, dan stok dalam satu sistem",
    lede: "Restoran dan rumah makan butuh kasir yang paham meja, tiket dapur, dan bayar patungan, bukan sekadar mesin hitung. Berikut yang harus ada, dan bagaimana Epidom menanganinya.",
    blocks: [
      { type: "h2", text: "Apa bedanya kasir restoran dengan kasir toko biasa?" },
      {
        type: "p",
        text: "Di toko, pelanggan memilih barang, membayar, lalu pergi. Di restoran, pesanan dibuat dulu, dimasak, diantar, dan baru dibayar di akhir. Satu meja bisa menambah pesanan tiga kali, lalu minta tagihan dipecah. Aplikasi kasir restoran harus menahan pesanan tetap terbuka, mengirimnya ke dapur, dan baru menutupnya saat pembayaran selesai.",
      },
      { type: "h2", text: "Fitur yang dicari pemilik restoran" },
      {
        type: "list",
        items: [
          "Manajemen meja dan zona (indoor, outdoor, lantai atas): pesanan per meja, pindah meja, gabung meja.",
          "Pesanan dine-in langsung tampil di layar dapur, lengkap dengan status tiap item.",
          "Tiket dapur dan tiket bar dari printer yang berbeda.",
          "Split payment: satu pesanan dibayar dengan beberapa metode, misalnya sebagian tunai dan sebagian kartu.",
          "Service charge dan pajak yang diatur sebagai preset, sehingga tidak dihitung manual.",
          "Pesanan online dari halaman toko, masuk ke antrean yang sama dengan pesanan di meja.",
          "Tetap bisa berjualan saat internet mati.",
        ],
      },
      { type: "h2", text: "Dari meja ke dapur: alurnya di Epidom" },
      {
        type: "steps",
        items: [
          {
            title: "Pilih meja",
            text: "Kasir atau pelayan membuka meja di zona yang benar, lalu memilih menu per kategori atau lewat pencarian.",
          },
          {
            title: "Kirim ke dapur dan bar",
            text: "Pesanan muncul di layar dapur secara real time dengan bunyi notifikasi. Minuman bisa dicetak sebagai tiket bar, makanan sebagai tiket dapur.",
          },
          {
            title: "Pantau status",
            text: "Antrean pesanan berjalan dari Baru, Diproses, Siap, sampai Disajikan, jadi pelayan tahu kapan harus mengantar.",
          },
          {
            title: "Bayar dan cetak struk",
            text: "Tagihan dihitung dengan service charge dan pajak sesuai preset, boleh dibayar dengan beberapa metode, lalu struk dicetak lewat printer Bluetooth 58 mm atau 80 mm, atau dikirim lewat email.",
          },
        ],
      },
      {
        type: "callout",
        text: "Contoh: tagihan meja 6 berisi makanan Rp 400.000. Dengan preset service charge 5% dan PPN 10%, total dihitung otomatis. Lalu empat orang bisa membayar sendiri-sendiri, dua tunai dan dua kartu, tanpa kalkulator. Persentase di sini hanya contoh; atur sesuai ketentuan restoran Anda.",
      },
      { type: "h2", text: "Layar dapur dan printer: pilih sesuai ukuran restoran" },
      {
        type: "p",
        text: "Paket POS menyediakan satu layar dapur. Kalau dapur dan bar dipisah dan Anda ingin tiket dialihkan per stasiun ke beberapa layar, itu ada di paket Operations. Printer struk, tiket dapur, tiket bar, dan label item bisa dipasang bersamaan pada satu kasir.",
      },
      { type: "h2", text: "Pesanan online dan mode offline" },
      {
        type: "p",
        text: "Pelanggan bisa memesan dari halaman toko Anda (dine-in dengan nomor meja, bawa pulang, atau antar sendiri) dan memesan meja. Saat ini pesanan dari halaman toko berstatus bayar di kasir: kasir mendapat peringatan suara dan notifikasi, lalu menandainya lunas. Kalau internet putus di jam ramai, kasir tetap menjual. Transaksi tersimpan di perangkat dan tersinkron saat koneksi kembali, dengan waktu transaksi aslinya.",
      },
      { type: "h2", text: "Karyawan dan stok di paket Operations" },
      {
        type: "p",
        text: "Setelah kasir berjalan, masalah berikutnya biasanya karyawan dan bahan baku. Operations menambahkan peran (manajer, kasir, dapur, pelayan), absen PIN, jadwal, shift dengan hitungan kas, resep dengan HPP otomatis per menu, stok yang berkurang saat pesanan selesai, dan peringatan stok menipis. Harga: POS Rp 229.000 per bulan (Rp 189.000 per bulan jika tahunan), Operations Rp 459.000 per bulan (Rp 379.000 jika tahunan).",
      },
    ],
    faqs: [
      {
        q: "Apakah aplikasi kasir restoran Epidom bisa mengatur meja?",
        a: "Bisa. Paket POS memiliki meja dan zona: Anda bisa menetapkan pesanan ke meja, memindahkannya, dan menggabungkan meja. Pesanan meja tampil di antrean dan di layar dapur.",
      },
      {
        q: "Bagaimana cara memecah tagihan di restoran?",
        a: "Satu pesanan bisa dibayar dengan beberapa metode pembayaran sekaligus (split payment). Kasir mencatat tiap pembayaran sampai tagihan lunas.",
      },
      {
        q: "Apakah bisa dipakai tanpa internet?",
        a: "Ya. Mode offline membuat kasir tetap bisa berjualan. Penjualan disimpan di perangkat dan disinkronkan otomatis begitu internet kembali.",
      },
      {
        q: "Berapa harga aplikasi kasir restoran Epidom?",
        a: "POS Rp 229.000 per bulan (Rp 189.000 per bulan jika membayar tahunan), dengan percobaan gratis 14 hari. Paket Operations Rp 459.000 per bulan (Rp 379.000 jika tahunan) menambah karyawan, stok, resep, dan laporan keuangan. Harga belum termasuk pajak.",
      },
      {
        q: "Apakah satu paket bisa untuk lebih dari satu cabang?",
        a: "POS untuk satu outlet. Operations mendukung hingga 3 outlet dengan tampilan keuangan semua outlet. Untuk 4 outlet atau lebih, tersedia Enterprise dengan penawaran khusus.",
      },
    ],
    cta: {
      title: "Coba kasir restoran Anda sendiri",
      text: "POS gratis dicoba 14 hari. Atur meja, menu, dan layar dapur, lalu jalankan satu hari layanan sebelum memutuskan.",
      button: "Mulai percobaan 14 hari →",
      target: "trial",
    },
    updated: "2026-10-14",
  },
];
