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
  {
    slug: "sistem-kasir-dan-operasional",
    locale: "id",
    title: "Mode POS: Sistem Kasir dan Halaman Operasional",
    description:
      "Semua yang ada di tablet kasir: Kasir, Antrian Pesanan, Dapur & Bar, dan Meja, plus sif, jadwal, dan absen.",
    date: "2026-09-27",
    readMinutes: 5,
    category: "Operasional",
    blocks: [
      {
        type: "p",
        text: "Mode POS adalah bagian Epidom yang jalan di tablet kasir. Isinya dua ruang: Sistem Kasir buat jualan dan melayani, dan halaman Operasional buat sif dan tim. Mode POS termasuk di paket POS, yang bisa kamu coba gratis 14 hari.",
      },
      { type: "h2", text: "Sistem Kasir" },
      {
        type: "p",
        text: "Ada empat tab di bagian bawah layar. Tiap staf cuma lihat tab yang dibuka untuk perannya.",
      },
      {
        type: "list",
        items: [
          "Kasir: pilih Makanan atau Minuman, lalu kategori, lalu itemnya. Bill tersusun tiap kali kamu ketuk. Simpan buat nanti, pisah, gabung, atau bayar satu bill pakai beberapa metode.",
          "Antrian Pesanan: pesanan dari kasir dan dari toko online kamu, masing-masing di tab sendiri, langsung menampilkan pesanan hari ini. Tab Log menyimpan semua pesanan lama.",
          "Dapur & Bar: layar terpisah buat dapur dan bar. Item masuk begitu pesanan dibuat, lalu ditandai siap satu per satu.",
          "Meja: daftar meja dengan statusnya (kosong, terisi, dipesan, dibersihkan) dan reservasi yang akan datang.",
        ],
      },
      { type: "h2", text: "Halaman Operasional" },
      {
        type: "p",
        text: "Dibuka dari menu Epidom, tanpa tab bar kasir. Tab yang muncul tergantung siapa yang sedang masuk:",
      },
      {
        type: "list",
        items: [
          "Sif: buka kasir dengan modal awal, catat uang yang masuk atau keluar, lalu tutup sif.",
          "Jadwal Saya: jadwal sif milik staf itu sendiri, plus gambar jadwal kalau manajer sudah mengunggahnya.",
          "Jadwal Tim: jadwal seluruh tim yang sudah diterbitkan, untuk pemilik dan manajer (paket Operations).",
          "Clock In / Keluar: staf absen dengan memilih namanya, memasukkan PIN, lalu mengambil selfie (paket Operations).",
        ],
      },
      { type: "h2", text: "Satu sif untuk seluruh toko" },
      {
        type: "p",
        text: "Sif itu milik toko, bukan milik satu tablet atau satu kasir. Semua perangkat dan semua staf mencatat penjualan ke sif yang sama. Sif ditutup sekali, dengan hitung kas tanpa melihat angka seharusnya: laci dihitung dulu sebelum ada yang tahu isinya harus berapa.",
      },
      { type: "h2", text: "Menu Epidom" },
      {
        type: "p",
        text: "Tombol Epidom di kanan atas Mode POS membuka menu berisi semua yang nggak butuh tab sendiri:",
      },
      {
        type: "list",
        items: [
          "Pindah antara Sistem Kasir, halaman Operasional, dan (untuk pemilik dan manajer) Back Office",
          "Sinkronkan Penjualan: kirim penjualan yang tercatat saat offline dan segarkan salinan menu dan pesanan di perangkat ini",
          "Nyalakan layar pelanggan dan buka di layar kedua",
          "Pengaturan perangkat keras: printer dan pemindai barcode di perangkat ini",
          "Bahasa, tema, dan ukuran tampilan perangkat, ganti akun, dan keluar",
        ],
      },
    ],
  },
  {
    slug: "stok-dan-pesanan-pemasok",
    locale: "id",
    title: "Stok dan Pesanan ke Pemasok",
    description:
      "Jaga stok tetap akurat, catat barang terbuang, dan pesan ke pemasok dalam dua langkah: buat pesanan, lalu tandai Diterima.",
    date: "2026-09-27",
    readMinutes: 4,
    category: "Operasional",
    blocks: [
      {
        type: "p",
        text: "Halaman Stok termasuk di paket Operations. Isinya tiga tab: Item, Pesanan Pengiriman, dan Log.",
      },
      { type: "h2", text: "Item: stok yang kamu punya" },
      {
        type: "list",
        items: [
          "Semua bahan baku dan produk beserta jumlah stoknya sekarang, bisa ditampilkan sebagai grid, kolom, atau daftar",
          "Sesuaikan Stok untuk membetulkan satu item setelah hitung stok; Penyesuaian Massal untuk banyak item sekaligus",
          "Catat barang terbuang beserta alasannya, supaya kerugiannya kelihatan di laporan",
          "Item menu yang terhubung ke produk atau resep otomatis mengurangi stok setiap kali terjual",
        ],
      },
      { type: "h2", text: "Pesanan Pengiriman: pesan ke pemasok" },
      { type: "p", text: "Pesanan ke pemasok cuma dua langkah." },
      {
        type: "list",
        items: [
          "Buat pesanan: pilih pemasok, item dan jumlahnya, serta perkiraan tanggal tiba. Kirim lewat email atau WhatsApp, atau cetak.",
          "Begitu barang datang, ketuk Diterima lalu konfirmasi. Itemnya langsung masuk ke stok.",
        ],
      },
      {
        type: "p",
        text: "Sampai saat itu, pesanan menunggu di bagian Menunggu kiriman, dan otomatis tampil sebagai jatuh tempo hari ini atau terlambat setelah tanggalnya lewat. Kalau barangnya nggak akan datang, batalkan saja: stok nggak berubah.",
      },
      { type: "h2", text: "Log: semua pergerakan stok" },
      {
        type: "p",
        text: "Log mencatat setiap perubahan stok, dari yang terbaru: pengiriman, penjualan, produksi, penyesuaian, barang terbuang, dan retur, lengkap dengan sisa stok setelahnya.",
      },
      { type: "h2", text: "Tempat mengatur pemasok dan bahan" },
      {
        type: "p",
        text: "Pemasok, bahan baku, resep, dan produk diatur di halaman Data. Tambahkan pemasok di sana dulu, nanti kamu bisa memilihnya saat membuat pesanan.",
      },
    ],
  },
  {
    slug: "staf-jadwal-dan-sif",
    locale: "id",
    title: "Staf, Jadwal, dan Sif",
    description:
      "Tambahkan tim dengan PIN dan akses halamannya, terbitkan jadwal, dan pantau absen serta setiap sif kasir.",
    date: "2026-09-27",
    readMinutes: 5,
    category: "Operasional",
    blocks: [
      {
        type: "p",
        text: "Staf, Jadwal Kerja, dan Sif Kerja termasuk di paket Operations. Di menu Back Office, Staf dan Jadwal Kerja ada di bagian “Operations”, sedangkan Sif Kerja di bagian “Reports”.",
      },
      { type: "h2", text: "Staf" },
      {
        type: "list",
        items: [
          "Kasih peran ke tiap orang: Manajer, Kasir, atau Dapur. Tambahkan jabatan seperti Pelayan, Bartender, atau Penerima Tamu, atau tulis sendiri",
          "Tiap orang dapat PIN 4 digit untuk tablet bersama. Sesi PIN otomatis keluar jam 00:00 waktu toko",
          "Akses halaman mengikuti templat perannya; centang atau hapus centang halaman untuk mengubahnya",
          "Undang lewat email supaya staf bisa masuk dengan akun Epidom sendiri. Untuk sekarang, akun staf hanya bisa dipakai di Mode POS",
        ],
      },
      { type: "h2", text: "Jadwal Kerja" },
      {
        type: "list",
        items: [
          "Buat blok sif (misalnya Pagi, 07:00–15:00) lalu taruh di grid, atau terapkan satu blok ke beberapa orang dan beberapa hari sekaligus",
          "Terbitkan jadwal minggu itu, dan tiap orang bisa lihat sifnya di Jadwal Saya di Mode POS",
          "Atau unggah foto jadwal untuk tanggal yang tampil: semua staf melihatnya di Jadwal Saya",
          "Log & Riwayat mencatat absen masuk, absen keluar, dan ketidakhadiran, lengkap dengan foto saat absen",
        ],
      },
      { type: "h2", text: "Absen" },
      {
        type: "p",
        text: "Staf absen masuk dan keluar di halaman Operasional di Mode POS: pilih nama, masukkan PIN, lalu ambil selfie. Lokasi perangkat ikut tercatat kalau perangkatnya mengizinkan.",
      },
      { type: "h2", text: "Sif Kerja" },
      {
        type: "p",
        text: "Halaman Sif Kerja mencatat setiap sesi kasir: siapa yang pegang, modal awalnya, dan kondisi laci saat ditutup — yang seharusnya, yang dihitung, dan selisihnya. Tab Log kas menampilkan setiap pergerakan uang tunai: tip, tambahan modal, pengeluaran, dan setoran ke brankas.",
      },
      {
        type: "p",
        text: "Sif-nya sendiri dibuka dan ditutup di Mode POS, di halaman Operasional.",
      },
    ],
  },
  {
    slug: "perangkat-printer-dan-scanner",
    locale: "id",
    title: "Perangkat Keras: Printer dan Pemindai Barcode",
    description:
      "Sambungkan printer struk, dapur, bar, dan label ke perangkat, lalu cek apakah pemindai barcode kamu terbaca.",
    date: "2026-09-27",
    readMinutes: 3,
    category: "Setup",
    blocks: [
      {
        type: "p",
        text: "Pengaturan perangkat keras berlaku per perangkat: tiap tablet atau komputer menyimpan printer dan pemindainya sendiri. Di Mode POS, buka menu Epidom, lalu Pengaturan perangkat keras. Fitur cetak termasuk di paket POS.",
      },
      { type: "h2", text: "Printer" },
      {
        type: "p",
        text: "Sambungkan hingga empat printer, satu untuk tiap fungsi. Nyalakan yang kamu pakai; sisanya tetap mati.",
      },
      {
        type: "list",
        items: [
          "Printer struk: struk berisi harga dan total, bill, dan laporan sif",
          "Printer dapur: tiket pesanan untuk dapur, tanpa harga",
          "Printer bar: khusus item bar. Kalau dimatikan, item bar ikut dicetak di printer dapur",
          "Printer label: satu stiker per item yang dipesan, untuk gelas dan kemasan",
        ],
      },
      {
        type: "p",
        text: "Printer tersambung lewat Bluetooth, yang butuh Chrome di Android atau komputer. iPad tidak bisa mengirim struk, tiket dapur dan bar, maupun label ke printer. Di iPad, tombol Cetak saat sif selesai membuka laporan sif di dialog cetak, dan struk lama bisa dicetak dari Lihat Struk pada pesanan di tab Log, halaman Antrian Pesanan. Kertasnya bisa 58 mm atau 80 mm. Lakukan tes cetak di tiap printer setelah disambungkan — terutama printer label, yang belum diuji di semua model.",
      },
      { type: "h2", text: "Pemindai barcode" },
      {
        type: "list",
        items: [
          "Uji pemindai: pindai barcode apa saja, lalu Epidom memberi tahu apakah terbaca dan cocok dengan item menu yang mana. Tidak ada yang masuk ke penjualan",
          "Pilih apakah pindaian berlaku di mana saja di layar atau hanya di kolom pencarian",
          "Kalau ada pindaian yang terlewat, ganti kecepatannya ke Lambat / Bluetooth",
        ],
      },
      {
        type: "p",
        text: "Supaya kode bisa dicek ke menu kamu, buka Kasir sekali dulu di perangkat itu.",
      },
    ],
  },
];
