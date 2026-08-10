import type { Article } from "@/features/marketing/shared/content/article-types";

export const idGuides: Article[] = [
  {
    slug: "mulai",
    locale: "id",
    title: "Bikin Toko Online Gratis dalam 5 Menit",
    description: "Langkah-langkah publish halaman menu pertama kamu dan mulai terima pesanan, tanpa setup teknis.",
    date: "2026-05-10",
    readMinutes: 4,
    category: "Mulai",
    blocks: [
      {
        type: "p",
        text: "Toko online Epidom adalah halaman yang bakal dilihat pelanggan kamu — di bio Instagram, QR code di meja, atau di-share langsung. Ini caranya publish.",
      },
      { type: "h2", text: "1. Bikin akun" },
      { type: "p", text: "Daftar pakai email. Nggak perlu kartu kredit buat paket gratis." },
      { type: "h2", text: "2. Isi info toko" },
      {
        type: "list",
        items: [
          "Nama toko dan link kustom (epidom.fr/@nama-toko-kamu)",
          "Logo dan warna tema",
          "Deskripsi singkat dan jam buka",
        ],
      },
      { type: "h2", text: "3. Tambah menu pertama" },
      {
        type: "p",
        text: "Buat minimal satu kategori, terus tambah item dengan foto, harga, dan deskripsi. Nanti bisa nambah lagi kapan aja — nggak perlu semua menu lengkap dulu buat publish.",
      },
      { type: "h2", text: "4. Publish" },
      {
        type: "p",
        text: "Setelah publish, toko kamu langsung aktif di link-nya. Download QR code dari pengaturan buat dicetak di meja atau etalase.",
      },
    ],
  },
  {
    slug: "atur-menu",
    locale: "id",
    title: "Cara Atur Menu: Kategori, Item, dan Varian",
    description: "Cara menyusun menu biar jelas buat pelanggan dan gampang di-update sama kamu.",
    date: "2026-05-14",
    readMinutes: 4,
    category: "Setup",
    blocks: [
      { type: "p", text: "Menu yang tersusun rapi bisa dibaca dalam hitungan detik di HP. Ini cara aturnya." },
      { type: "h2", text: "Kategori" },
      {
        type: "p",
        text: "Kelompokkan item berdasarkan kategori yang logis (Makanan, Minuman, Snack...). Urutan kategori bisa diubah kapan aja — tampilan mengikuti urutan yang kamu atur.",
      },
      { type: "h2", text: "Item menu" },
      {
        type: "list",
        items: [
          "Foto — item dengan foto lebih laku dibanding tanpa foto",
          "Harga dan deskripsi singkat",
          "Tandai \"habis\" buat sembunyiin sementara tanpa harus hapus",
          "Kasih badge \"favorit\" buat item paling laku",
        ],
      },
      { type: "h2", text: "Varian dan tambahan" },
      {
        type: "p",
        text: "Buat item dengan pilihan (ukuran, level pedas, topping tambahan), tambahkan grup varian — pelanggan pilih langsung pas mesan.",
      },
    ],
  },
  {
    slug: "terima-pesanan",
    locale: "id",
    title: "Terima Pesanan dan Notifikasi WhatsApp",
    description: "Apa yang terjadi dari pelanggan pesan di toko online kamu sampai pesanan siap kamu proses.",
    date: "2026-05-19",
    readMinutes: 4,
    category: "Operasional",
    blocks: [
      {
        type: "p",
        text: "Setelah menu online, pelanggan bisa langsung pesan dari toko kamu — dine-in, take away, atau delivery sesuai yang kamu aktifkan.",
      },
      { type: "h2", text: "Alur pesanan" },
      {
        type: "list",
        items: [
          "Pelanggan tambah item ke keranjang dan checkout",
          "Kamu langsung dapat notifikasi WhatsApp lengkap sama detailnya",
          "Dashboard nampilin pesanan secara real-time",
          "Pelanggan dapat konfirmasi otomatis",
        ],
      },
      { type: "h2", text: "Pembayaran" },
      {
        type: "p",
        text: "Kamu bisa aktifkan QRIS, atau biarkan bayar tunai pas ambil pesanan. Metode pembayaran yang diterima diatur di pengaturan toko.",
      },
    ],
  },
  {
    slug: "bagikan-toko",
    locale: "id",
    title: "Cara Bagikan Toko: QR Code, Bio Instagram, Link",
    description: "Toko yang udah di-publish nggak ada gunanya kalau nggak ada yang nemuin. Ini prioritas tempat share-nya.",
    date: "2026-05-24",
    readMinutes: 3,
    category: "Growth",
    blocks: [
      {
        type: "p",
        text: "Link toko kamu (epidom.fr/@nama-toko-kamu) bisa dipakai di mana aja kamu bisa taruh link atau QR code.",
      },
      { type: "h2", text: "Prioritas tempat share" },
      {
        type: "list",
        items: [
          "Bio Instagram dan Facebook — ganti link Linktree",
          "QR code dicetak di meja atau etalase",
          "Status WhatsApp dan chat ke pelanggan langganan",
          "Google Maps, di bagian \"situs web\" profil bisnis kamu",
        ],
      },
      { type: "h2", text: "QR code" },
      {
        type: "p",
        text: "Download dari pengaturan toko, resolusi tinggi, siap cetak. Langsung ngarah ke menu kamu — nggak perlu generate ulang kalau update menu, link-nya tetap sama.",
      },
    ],
  },
  {
    slug: "upgrade-ke-kasir-pos",
    locale: "id",
    title: "Upgrade ke Kasir POS: Kapan dan Caranya",
    description: "Paket gratis udah cover toko online dan pesan online. Ini cara tahu kalau kamu udah siap upgrade ke kasir POS.",
    date: "2026-05-29",
    readMinutes: 3,
    category: "Upgrade",
    blocks: [
      {
        type: "p",
        text: "Paket POS nambah kasir, antrian pesanan gabungan (dine-in + online), struk, dan kitchen display basic.",
      },
      { type: "h2", text: "Tanda waktunya upgrade ke POS" },
      {
        type: "list",
        items: [
          "Kamu rekrut karyawan pertama buat pegang kasir",
          "Kamu handle pesanan dine-in selain pesanan online",
          "Kamu butuh cetak struk",
        ],
      },
      { type: "h2", text: "Proses upgrade" },
      {
        type: "p",
        text: "Nggak ada data yang hilang: menu, riwayat pesanan, dan pengaturan tetap sama. Upgrade ke paket berbayar dari dashboard cuma butuh kurang dari 1 menit.",
      },
    ],
  },
];
