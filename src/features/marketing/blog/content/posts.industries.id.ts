import type { BlogPost } from "./types";

/**
 * Satu panduan praktis untuk tiap jenis usaha makanan dan minuman. Kartu
 * "Epidom dipakai untuk apa?" di beranda menautkan ke sini (slug dipakai juga
 * di src/features/marketing/home/lib/industry-guides.ts). Saran dulu, produk
 * belakangan, tanpa angka karangan.
 */
export const idIndustryPosts: BlogPost[] = [
  {
    slug: "mengelola-kafe-pesanan-margin-stok",
    locale: "id",
    title: "Mengelola Kafe Sehari-hari: Pesanan, Margin, dan Stok di Satu Tempat",
    description:
      "Rutinitas praktis untuk pemilik kafe: memperpendek antrean pagi, tahu biaya sebenarnya per gelas, memesan stok sebelum habis, dan tetap berjualan saat Wi-Fi putus.",
    date: "2026-11-11",
    readMinutes: 6,
    category: "Kafe",
    blocks: [
      {
        type: "p",
        text: "Dari luar, kafe terlihat sederhana: kopi masuk, kopi keluar. Di balik meja, ada tiga pekerjaan sekaligus. Anda harus menerima pesanan dengan cepat, menjaga margin tipis di setiap gelas, dan menjaga rak tetap terisi tanpa membeli susu berlebih yang keburu rusak sebelum Jumat. Kebanyakan kafe kehilangan uang di sela-sela ketiga pekerjaan itu, bukan di salah satunya.",
      },
      {
        type: "p",
        text: "Panduan ini menjelaskan rutinitas harian yang menutup celah-celah tersebut. Ditulis untuk pemilik yang mengelola satu atau dua gerai, tanpa mengandaikan alat tertentu. Bila membantu, kami tunjukkan seperti apa langkah yang sama di Epidom, supaya Anda bisa menilai apakah cocok dengan cara kerja Anda.",
      },
      { type: "h2", text: "Perpendek antrean pagi sebelum membeli apa pun" },
      {
        type: "p",
        text: "Jam sibuk pagi menentukan hasil hari itu. Antrean yang tampak panjang membuat calon pembeli berlalu, dan pelanggan tetap yang terlalu sering menunggu akhirnya pindah. Obat termurahnya bukan barista yang lebih cepat, melainkan memindahkan sebagian pemesanan dari kasir.",
      },
      {
        type: "list",
        items: [
          "Beri pelanggan tetap tautan atau kode QR di meja kasir agar bisa memesan dan membayar dari ponsel, lalu mengambil saat namanya dipanggil. Kasir hanya melayani yang memang ingin ngobrol langsung.",
          "Tampilkan di layar kasir menu yang benar-benar laku di pagi hari. Layar yang pendek dan rapi lebih cepat daripada yang lengkap, dan menu penuh tetap satu ketukan jauhnya.",
          "Tentukan sebelumnya siapa mengerjakan apa saat ramai: satu orang di pesanan, satu di mesin, satu di serah terima. Alat apa pun tidak bisa memperbaiki tim yang semuanya berdiri di mesin.",
        ],
      },
      {
        type: "p",
        text: "Di Epidom, halaman pesan kafe Anda adalah tautan publik di alamat Anda sendiri. Pelanggan memesan dari ponsel, tiketnya masuk ke kasir dan, jika Anda memakainya, ke layar dapur atau bar. Anda bisa mencobanya di demo langsung tanpa membuat akun.",
      },
      { type: "h2", text: "Tahu biaya sebenarnya per gelas" },
      {
        type: "p",
        text: "Biaya per gelas adalah angka yang paling sering hanya ditebak pemilik. Susu, biji kopi, sirup, gelas, tutup, sleeve: masing-masing kecil, tetapi bersama-sama menentukan apakah minuman seharga empat puluh ribu benar-benar menguntungkan. Satu-satunya cara andal adalah menulis resep sekali dan membiarkan alat menghitung ulang tiap kali harga berubah.",
      },
      {
        type: "list",
        items: [
          "Catat bahan sepuluh menu terlaris beserta takarannya, termasuk gelas dan tutup. Timbang beberapa takaran sungguhan, jangan mengandalkan ingatan.",
          "Masukkan harga yang benar-benar Anda bayar per kilo atau per liter, dan perbarui saat pemasok mengubahnya. Margin yang dihitung dari harga susu tahun lalu hanyalah tebakan.",
          "Tinjau hasilnya sebulan sekali. Menu berharga tinggi dengan margin tipis layak naik sedikit; menu yang sangat laku dengan margin tipis layak diperiksa ulang resepnya.",
        ],
      },
      {
        type: "p",
        text: "Setelah resep terhubung ke produk, setiap penjualan bisa mengurangi bahan dari stok dan mencatat biayanya pada saat itu. Itulah yang membuat laporan menampilkan laba kotor, bukan hanya omzet.",
      },
      { type: "h2", text: "Pesan stok sebelum habis, bukan sesudahnya" },
      {
        type: "p",
        text: "Kehabisan susu oat pada jam sembilan pagi lebih mahal daripada harga susunya. Anda kehilangan penjualan setiap minuman yang memakainya, dan kepercayaan pelanggan yang sudah menanyakannya. Daftar stok menipis yang dicek di hari tetap lebih baik daripada mengandalkan ingatan.",
      },
      {
        type: "list",
        items: [
          "Tetapkan batas minimum untuk segelintir barang yang menghentikan layanan bila habis: susu, biji kopi, gelas, tutup.",
          "Cek daftar stok menipis satu atau dua kali seminggu dan buat satu pesanan per pemasok, bukan beberapa pesanan kecil.",
          "Catat barang terbuang saat kejadian. Teko yang tumpah mudah dicatat saat itu juga dan mustahil direkonstruksi di akhir bulan.",
        ],
      },
      { type: "h2", text: "Tetap berjualan saat koneksi putus" },
      {
        type: "p",
        text: "Wi-Fi di kafe jarang sempurna. Kasir yang macet saat koneksi putus mengubah masalah sepuluh detik menjadi jam ramai yang hilang. Periksa dulu perilaku alat Anda saat offline sebelum benar-benar butuh: apakah tetap menerima penjualan, apa yang terjadi pada penjualan itu sesudahnya, dan tindakan apa yang tetap butuh koneksi.",
      },
      {
        type: "p",
        text: "Aplikasi kasir Epidom untuk desktop dan Android tetap mencatat penjualan saat koneksi putus dan mengirimkannya begitu koneksi kembali. Membuka dan menutup shift, mutasi kas, dan pengembalian dana tetap butuh koneksi, memang disengaja agar angkanya bisa dipercaya. Coba sekali di sore yang sepi dengan mematikan router, supaya pertama kalinya bukan saat jam ramai.",
      },
      { type: "h2", text: "Rutinitas tutup toko yang singkat" },
      {
        type: "list",
        items: [
          "Tutup shift dan hitung uang tunai terhadap yang diharapkan kasir. Catat selisihnya, sekecil apa pun.",
          "Lihat penjualan hari itu per jam. Jika jam ramai mulai lebih awal dari jadwal, geser satu shift.",
          "Lihat sekilas daftar stok menipis dan catat apa yang perlu dipesan besok.",
          "Catat barang terbuang yang belum sempat dicatat.",
        ],
      },
      {
        type: "p",
        text: "Sebagai penutup yang praktis, mulailah dari satu langkah saja. Jika antrean pagi adalah masalah terbesar Anda, coba pemesanan lewat ponsel dulu selama seminggu. Jika margin yang membuat Anda tidak tenang, tulis lima resep pertama. Satu perbaikan yang benar-benar dipakai lebih berharga daripada lima yang hanya disiapkan, dan setiap perbaikan membuat langkah berikutnya lebih mudah dikerjakan.",
      },
      {
        type: "p",
        text: "Semua ini tidak butuh sistem besar. Butuh beberapa angka yang sama, dilihat di hari yang sama, oleh orang yang sama. Jika sebuah alat mempermudahnya, bagus; jika hanya menambah layar yang tak pernah dibuka, tinggalkan. Anda bisa mencoba Epidom gratis, pada kafe demo dengan sebulan pesanan contoh, sebelum memutuskan.",
      },
    ],
  },
  {
    slug: "restoran-pesan-dari-meja-alur-dapur",
    locale: "id",
    title: "Restoran: Pesan dari Meja dan Alur Dapur, Panduan Penerapan Praktis",
    description:
      "Cara membiarkan tamu memesan dari meja, mengirim tiket ke stasiun yang tepat, memakai satu kasir untuk makan di tempat, bawa pulang, dan antar, serta mengelola stok dan jadwal di satu tempat.",
    date: "2026-11-11",
    readMinutes: 7,
    category: "Restoran",
    blocks: [
      {
        type: "p",
        text: "Di restoran, pesanan itu seperti lari estafet. Tamu memilih, pelayan mencatat, dapur memasak, pengantar membawa, dan kasir menutup lingkaran. Setiap serah terima adalah peluang tiket hilang, salah meja, atau hidangan menunggu di bawah lampu. Perangkat lunak yang lebih baik tidak menghapus orang dari estafet itu, tetapi bisa menghapus teriakan dan kertas.",
      },
      {
        type: "p",
        text: "Panduan ini membahas penerapan yang paling berdampak untuk restoran kecil hingga menengah: pesan dari meja, layar dapur yang menampilkan tiket berurutan, satu kasir untuk semua kanal, dan dasar-dasar belakang layar, yaitu stok, resep, dan jadwal. Isinya praktis dan menunjukkan di mana Epidom masuk pada tiap langkah.",
      },
      { type: "h2", text: "Biarkan tamu memesan dari meja" },
      {
        type: "p",
        text: "Pesan dari meja bukan untuk menggantikan pelayan. Tujuannya menghapus bolak-balik yang berulang dan bernilai kecil: ronde minuman kedua, roti tambahan, tagihan. Staf menghabiskan waktu untuk tamu yang butuh saran, sementara yang lain memesan saat siap.",
      },
      {
        type: "list",
        items: [
          "Letakkan kode QR di tiap meja yang membuka menu Anda di ponsel tamu, dengan foto untuk hidangan yang paling sering ditanyakan.",
          "Tetap sediakan pelayan untuk pesanan pertama dan untuk tamu yang lebih suka bicara langsung. Pesan dari meja paling baik sebagai pilihan, bukan aturan.",
          "Tandai tidak tersedia begitu sesuatu habis, supaya tidak ada yang memesan porsi terakhir dua kali.",
        ],
      },
      {
        type: "p",
        text: "Di Epidom, pesanan dari meja masuk sebagai tiket di kasir dan di layar dapur, terkait dengan mejanya, tanpa ada yang mengetik ulang. Demo langsung memperlihatkan sisi tamu dan sisi kasir tanpa perlu mendaftar.",
      },
      { type: "h2", text: "Layar dapur, bukan kertas dan teriakan" },
      {
        type: "p",
        text: "Printer struk cukup sampai jam ramai, saat tiket menumpuk dan urutan datangnya tidak lagi sama dengan urutan memasaknya. Layar dapur menampilkan tiap tiket berurutan beserta lama menunggunya, dan memungkinkan koki menandai hidangan siap supaya bagian depan tahu.",
      },
      {
        type: "list",
        items: [
          "Kirim hidangan pembuka, utama, dan penutup ke stasiun yang tepat, agar bagian panggangan tidak membaca tiket pencuci mulut.",
          "Gunakan pengaturan waktu per hidangan: mulai masak hidangan utama saat pembuka sudah diangkat, bukan saat dipesan.",
          "Simpan satu printer sebagai cadangan. Layar yang mati saat jam layanan tidak boleh berarti dapur tak bisa membaca pesanan.",
        ],
      },
      {
        type: "p",
        text: "Epidom memungkinkan tiket dikirim ke beberapa printer, misalnya printer dapur dan printer bar, dan menyediakan tampilan dapur untuk dapur yang lebih suka layar. Pilih yang benar-benar akan dipakai koki Anda; fitur yang tak pernah dilihat lebih buruk daripada tidak ada.",
      },
      { type: "h2", text: "Satu kasir untuk makan di tempat, bawa pulang, dan antar" },
      {
        type: "p",
        text: "Banyak restoran menjalankan tiga atau empat daftar terpisah: kasir, tablet untuk aplikasi antar, buku catatan untuk pesanan telepon. Di akhir pekan tak ada yang bisa menyebut angka sebenarnya. Satu kasir untuk semua kanal menaruh semua penjualan di satu laporan, dan itulah satu-satunya cara membandingkan kanal dengan jujur.",
      },
      {
        type: "list",
        items: [
          "Catat tiap pesanan beserta kanalnya, agar terlihat berapa yang dibawa makan di tempat, bawa pulang, dan antar.",
          "Bandingkan penjualan aplikasi antar dengan komisi yang dipotong. Kanal yang ramai dengan margin tipis bukan kanal yang menguntungkan.",
          "Tawarkan tautan pesan Anda sendiri untuk bawa pulang, supaya pelanggan tetap memesan langsung dan Anda menyimpan seluruh nilainya.",
        ],
      },
      { type: "h2", text: "Stok, resep, dan jadwal di tempat yang sama" },
      {
        type: "p",
        text: "Di balik pass dapur, tiga angka menentukan hasil sebulan: biaya tiap hidangan, apa yang terbuang, dan jam kerja yang Anda bayar. Ketiganya sering tersimpan di tiga tempat berbeda, sebab itulah jarang diperiksa.",
      },
      {
        type: "list",
        items: [
          "Tulis tiap resep sekali dengan bahan dan takarannya, dan biarkan sistem menghitung biaya per porsi saat harga berubah.",
          "Catat barang terbuang saat terjadi: piring jatuh, adonan yang basi. Dalam sebulan, itu sering menjadi biaya terbesar yang tidak terlihat.",
          "Susun jadwal mingguan dari jam tersibuk minggu lalu, lalu bandingkan jam kerja sebenarnya dengan rencana jadwal.",
        ],
      },
      {
        type: "p",
        text: "Epidom menaruh resep, stok, pesanan pemasok, dan jadwal staf di samping kasir, sehingga satu penjualan memperbarui stok dan biaya hidangan tampil di sebelah harganya. Bagian ini biasanya paling lama disiapkan, jadi mulailah dengan dua puluh menu terlaris lalu tambahkan sisanya selama beberapa minggu.",
      },
      { type: "h2", text: "Mulai dari mana minggu ini" },
      { type: "h2", text: "Kesalahan yang sering muncul saat memulai" },
      {
        type: "p",
        text: "Perubahan alur kerja di restoran gagal bukan karena alatnya, tetapi karena cara memperkenalkannya. Beberapa kebiasaan berikut membantu penerapan berjalan mulus.",
      },
      {
        type: "list",
        items: [
          "Mengubah semuanya di akhir pekan tersibuk, padahal tim belum sempat berlatih dengan layar atau printer yang baru.",
          "Tidak melibatkan koki dalam memilih antara layar dan printer, lalu mendapati alat itu tak dipakai.",
          "Membiarkan menu di sistem berbeda dari menu di meja, sehingga tamu memesan hidangan yang sudah tidak ada.",
        ],
      },
      {
        type: "p",
        text: "Terakhir, libatkan tim sejak awal. Tunjukkan layarnya kepada pelayan dan koki, minta mereka mencoba sendiri pada hari sepi, dan dengarkan keluhan mereka. Orang yang ikut menyusun alurnya akan memakainya dengan sungguh-sungguh, sedangkan alat yang ditetapkan dari atas sering diam-diam ditinggalkan setelah dua minggu.",
      },
      {
        type: "p",
        text: "Anda tidak perlu mengganti semuanya sekaligus. Pilih serah terima yang paling menyakitkan. Jika tiket sering hilang, mulai dengan layar dapur atau printer kedua. Jika pembayaran lambat, mulai dengan pesan dari meja. Jika margin masih misteri, mulai dengan lima resep. Coba dulu di restoran demo, lalu di layanan Selasa yang sepi, dan baru setelah itu di Sabtu malam.",
      },
    ],
  },
  {
    slug: "toko-roti-hpp-stok-produksi",
    locale: "id",
    title: "Toko Roti: Menghitung HPP dan Stok untuk Roti yang Dipanggang Per Adonan",
    description:
      "Cara toko roti menghitung biaya resep per adonan, menjual per potong, per nampan, atau per kotak, memanggang jumlah yang tepat tiap pagi, dan menerima pesanan di muka tanpa buku catatan.",
    date: "2026-11-11",
    readMinutes: 7,
    category: "Toko roti",
    blocks: [
      {
        type: "p",
        text: "Toko roti menjual satu croissant sekali, tetapi membuat empat puluh sekali. Ketidakcocokan itulah seluruh masalah bisnisnya. Anda memutuskan satu adonan sebelum tahu siapa yang akan membelinya, sisa dagangan nilainya jauh turun di malam hari, dan biaya satu potong tersembunyi di dalam resep yang ditulis untuk satu loyang.",
      },
      {
        type: "p",
        text: "Panduan ini membahas tiga kebiasaan yang menyelesaikan sebagian besar masalahnya: menghitung biaya resep per potong, memanggang berdasarkan angka bukan perasaan, dan menerima pesanan di muka agar kue dan kotak pagi tak pernah jadi kejutan. Cocok untuk toko roti kecil dengan etalase dan beberapa pelanggan tetap, dan menunjukkan seperti apa tiap kebiasaan di Epidom.",
      },
      { type: "h2", text: "Hitung biaya adonan, lalu bagi" },
      {
        type: "p",
        text: "Tepung, mentega, telur, dan gula dibeli per kilo, dipakai per gram, dan dijual per potong. Hitungannya mudah keliru di kepala dan melelahkan bila diulang manual tiap harga mentega berubah. Tulis resep sekali, lengkap dengan hasil jadinya, dan biarkan biaya per potong mengikuti.",
      },
      {
        type: "list",
        items: [
          "Masukkan resep lengkap dengan jumlah potong yang benar-benar dihasilkan, bukan yang Anda harapkan. Timbang satu adonan sungguhan sekali untuk memeriksa hasil jadinya.",
          "Sertakan hal yang mudah terlupa: kertas, kotak, olesan glaze, gas atau listrik oven bila ingin biaya penuh.",
          "Simpan satu harga per bahan dan perbarui saat pemasok mengubahnya. Mentega saja bisa menggeser margin sebuah croissant.",
        ],
      },
      {
        type: "p",
        text: "Di Epidom, resep terhubung ke produk dan bahannya adalah bahan baku dengan harganya sendiri. Biaya per potong ikut berubah saat harga berubah, dan setiap penjualan mencatat biaya pada saat itu, sehingga laporan menampilkan laba kotor croissant yang sebenarnya, bukan yang berlaku musim lalu.",
      },
      { type: "h2", text: "Jual per potong, per nampan, atau per kotak" },
      {
        type: "p",
        text: "Produk yang sama sering dijual dalam beberapa format: satu kue, satu kotak isi enam, satu nampan untuk kantor. Tiap format punya harga dan biaya kemasan sendiri, dan mencampurnya diam-diam menggerus margin.",
      },
      {
        type: "list",
        items: [
          "Buat kotak dan nampan sebagai item tersendiri dengan harga dan kemasannya sendiri, jangan mendiskon satuan di dalam kepala.",
          "Tawarkan kotak campur yang bisa disusun pelanggan sendiri. Ini menaikkan nilai rata-rata transaksi dan cara yang baik untuk menghabiskan item yang lambat laku.",
          "Tinjau harga saat satu bahan melonjak. Kenaikan kecil pada item yang dibeli tanpa dilihat lebih mudah daripada kenaikan besar belakangan.",
        ],
      },
      { type: "h2", text: "Panggang jumlah yang tepat" },
      {
        type: "p",
        text: "Memanggang terlalu sedikit menghilangkan penjualan; terlalu banyak menghilangkan uang, sebab roti kemarin laku jauh lebih murah daripada roti hari ini. Jawabannya bukan firasat di pergelangan tangan. Jawabannya adalah penjualan beberapa pekan terakhir untuk hari yang sama dalam seminggu, dan catatan apa yang Anda buang.",
      },
      {
        type: "list",
        items: [
          "Lihat penjualan per item untuk hari yang sama dalam seminggu selama sebulan terakhir, lalu tetapkan jumlah awal dari situ.",
          "Catat sisa saat tutup, setiap hari. Setelah dua minggu Anda punya angka tiap item yang lebih andal daripada ingatan.",
          "Putuskan sebelumnya nasib barang tak terjual: diskon pada jam tertentu, disumbangkan, atau jadi puding roti besok. Rencana lebih baik daripada berimprovisasi saat tutup.",
        ],
      },
      {
        type: "p",
        text: "Epidom melacak stok dan barang terbuang per item, dan laporan penjualan menunjukkan apa yang laku per jam dan per hari. Itu cukup untuk mengubah daftar panggang dari tebakan menjadi tabel yang disesuaikan tiap pekan. Mulailah dari lima item terlaris, karena merekalah yang menanggung sebagian besar sisa.",
      },
      { type: "h2", text: "Terima pesanan di muka tanpa buku catatan" },
      {
        type: "p",
        text: "Kue ulang tahun, kotak acara, dan pesanan Minggu pagi adalah bagian paling menguntungkan sekaligus paling rapuh dari toko roti, karena hidup di buku catatan, ponsel, dan kepala seseorang. Satu baris yang hilang berarti pelanggan kecewa di hari ulang tahunnya.",
      },
      {
        type: "list",
        items: [
          "Beri pelanggan satu tautan untuk melihat tawaran Anda dan memesan dari ponsel, bukan pesan chat yang harus Anda ketik ulang.",
          "Minta jam pengambilan dan catatan saat memesan, supaya Anda tak perlu menelepon balik untuk detail.",
          "Cetak atau tampilkan pesanan hari itu di awal shift, agar pembuat roti melihat apa yang sudah terikat sebelum menentukan adonan.",
        ],
      },
      {
        type: "p",
        text: "Halaman Epidom Anda adalah tautan publik di alamat Anda sendiri, berisi menu, foto, dan formulir pesan. Pesanan masuk ke kasir bersama penjualan etalase, jadi satu daftar menunjukkan apa yang perlu dipanggang. Coba demonya untuk melihat sisi pelanggan.",
      },
      { type: "h2", text: "Tinjauan mingguan yang sederhana" },
      { type: "h2", text: "Kesalahan yang paling sering terjadi" },
      {
        type: "p",
        text: "Toko roti yang sudah lama berjalan pun sering mengulang beberapa kekeliruan yang sama. Memeriksanya sekali setahun saja sudah banyak membantu.",
      },
      {
        type: "list",
        items: [
          "Menghitung biaya dari harga bahan tahun lalu, sehingga margin yang tertulis jauh lebih bagus daripada yang sebenarnya.",
          "Lupa menghitung kemasan dan tenaga kerja, terutama untuk kotak hadiah dan pesanan acara yang dibuat dengan tangan.",
          "Memanggang jumlah yang sama setiap hari padahal penjualan Senin dan Sabtu jelas berbeda.",
        ],
      },
      {
        type: "p",
        text: "Seminggu sekali, sediakan sepuluh menit untuk tiga angka: laba kotor per item, barang terbuang per item, dan jam tersibuk. Jika sebuah item bermargin baik dan sedikit sisa, buat lebih mudah ditemukan. Jika sisanya banyak, panggang lebih sedikit. Jika jam ramai mulai sebelum oven siap, majukan adonan pertama. Putaran itu, diulang terus, berbuat lebih banyak bagi toko roti daripada alat apa pun yang berdiri sendiri.",
      },
    ],
  },
  {
    slug: "bar-biaya-bahan-ronde-tutup-kasir",
    locale: "id",
    title: "Operasional Bar: Ronde Pesanan, Biaya Bahan, dan Rutinitas Tutup",
    description:
      "Cara bar kecil menerima ronde pesanan dengan cepat, membiarkan tamu memesan dari meja tanpa antre, mengirim minuman dan makanan ke stasiun yang tepat, dan tahu margin per minuman dan per malam.",
    date: "2026-11-11",
    readMinutes: 7,
    category: "Bar",
    blocks: [
      {
        type: "p",
        text: "Bar punya masalah yang berlawanan dengan kafe. Tak ada yang buru-buru pergi, tetapi semua ingin ronde berikutnya pada saat yang sama. Pesanan datang berkelompok, tagihan terbuka berjam-jam, dan biaya satu minuman bergantung pada tuangan yang berbeda tiap kali. Risikonya bukan penjualan yang hilang, melainkan malam yang tampak ramai tetapi untungnya lebih kecil dari seharusnya.",
      },
      {
        type: "p",
        text: "Panduan ini membahas empat hal yang bisa diperbaiki bar kecil tanpa investasi besar: menerima ronde dengan cepat, membiarkan tamu memesan dari meja, mengirim minuman dan makanan ke tempat yang tepat, serta tahu margin per minuman dan per malam. Tiap hal ditunjukkan seperti apa di Epidom, supaya Anda bisa menilai kecocokannya.",
      },
      { type: "h2", text: "Terima ronde dengan cepat, dan jaga tagihan tetap jujur" },
      {
        type: "p",
        text: "Saat ramai, satu ronde enam minuman untuk satu meja harus selesai dengan beberapa ketukan, bukan satu percakapan. Hal yang sama berlaku untuk tagihan yang membesar sepanjang malam: bila menambahkannya lambat, bartender melewatkannya, dan minuman yang terlewat adalah minuman yang sudah Anda bayar.",
      },
      {
        type: "list",
        items: [
          "Taruh sepuluh minuman yang paling sering dipesan di layar pertama, dengan pilihan seperti es, ukuran, dan campuran hanya satu ketukan jauhnya.",
          "Biarkan satu tagihan tetap terbuka per meja atau per nama, tambahkan sepanjang malam dan selesaikan sekali, jangan menyimpannya di kepala atau di serbet.",
          "Selesaikan tagihan pada saat yang tetap, misalnya last call, agar tak ada yang tertinggal di antrean penutupan.",
        ],
      },
      { type: "h2", text: "Biarkan tamu memesan dari meja" },
      {
        type: "p",
        text: "Di malam yang padat, meja bar itu sendiri jadi penyumbatnya. Tamu menunggu untuk menarik perhatian bartender, dan yang menyerah pulang tanpa ronde tambahan. Pesan dari meja memindahkan penantian itu dari bar ke ponsel tamu, di mana tidak menghabiskan biaya apa pun bagi Anda.",
      },
      {
        type: "list",
        items: [
          "Taruh kode QR di tiap meja atau di kartu menu, dan biarkan tamu memesan ronde berikutnya saat siap.",
          "Tetapkan aturan pengambilan yang jelas: antar ke meja, atau ambil di bar saat nama muncul. Tamu menerima keduanya jika jelas.",
          "Periksa aturan usia dan perizinan yang berlaku di tempat Anda, dan biarkan penyerahan minuman beralkohol tetap di tangan seseorang, apa pun alatnya.",
        ],
      },
      {
        type: "p",
        text: "Di Epidom, pesanan dari meja masuk sebagai tiket di kasir dan, bila Anda memakai printer atau layar bar, di stasiun yang tepat. Tak ada yang diketik ulang, dan mejanya tercantum di tiket. Demo langsung memperlihatkan kedua sisinya.",
      },
      { type: "h2", text: "Minuman ke bar, makanan ke dapur" },
      {
        type: "p",
        text: "Bar yang menyajikan makanan menjalankan dua stasiun dari satu pesanan. Jika tiket berisi koktail dan burger keluar di satu tempat, bartender membaca makanan atau koki membaca minuman. Memisahkan tiket menurut jenis item mengatasinya dan menjaga kedua stasiun tetap bergerak.",
      },
      {
        type: "list",
        items: [
          "Tetapkan stasiun untuk tiap item: bar, dapur, atau keduanya. Pesanan campuran lalu keluar di dua tempat dan tak ada yang membaca yang bukan bagiannya.",
          "Tambahkan printer label bila Anda menjual minuman botol, gelas bawa pulang, atau ingin tiket di tiap gelas.",
          "Uji seluruh jalurnya dengan pesanan sungguhan sebelum malam tiba, dari ponsel tamu sampai tiap printer.",
        ],
      },
      {
        type: "p",
        text: "Epidom mendukung beberapa printer dengan peran berbeda, seperti struk, dapur, bar, dan label, sehingga satu pesanan tercetak di tempat yang dibutuhkan. Periksa dulu perangkat yang sudah Anda miliki; banyak printer struk umum yang bisa dipakai.",
      },
      { type: "h2", text: "Tahu margin per minuman dan per malam" },
      {
        type: "p",
        text: "Biaya bahan adalah bagian dari harga minuman yang habis untuk isi gelas. Ini angka pertama yang harus diketahui pemilik bar, dan angka terakhir yang kebanyakan hanya diperkirakan. Susun dari resepnya: alkohol dalam mililiter, pencampur, hiasan, es, dan gelas, dengan harga yang benar-benar Anda bayar.",
      },
      {
        type: "list",
        items: [
          "Tulis tiap koktail sebagai resep dengan takaran pasti, dan standarkan tuangan dengan jigger agar resepnya benar.",
          "Hitung botol saat tutup untuk minuman beralkohol utama Anda, lalu bandingkan dengan sisa yang seharusnya menurut penjualan. Selisih adalah tanda untuk memeriksa lebih dekat.",
          "Lihat margin per minuman dan per malam, bukan hanya omzet. Malam penuh dengan minuman bermargin rendah bisa menghasilkan lebih sedikit daripada malam yang lebih sepi.",
        ],
      },
      {
        type: "p",
        text: "Dengan resep yang terhubung ke produk, Epidom mencatat biaya tiap minuman pada saat penjualan dan menampilkan laba kotor di laporan keuangan. Ketepatannya tetap bergantung pada takaran Anda dan pada harga botol yang selalu diperbarui.",
      },
      { type: "h2", text: "Rutinitas tutup yang tidak memakan waktu lama" },
      {
        type: "list",
        items: [
          "Selesaikan tagihan dan shift, hitung uang tunai, dan catat selisihnya bila ada.",
          "Hitung botol yang penting dan catat pecah atau tumpah sebagai barang terbuang.",
          "Lihat penjualan malam itu per jam dan catat kapan keramaian benar-benar dimulai.",
          "Susun pesanan untuk besok bila daftar stok menipis menunjukkan ada yang kurang.",
        ],
      },
      { type: "h2", text: "Kebocoran kecil yang sering terlewat" },
      {
        type: "p",
        text: "Di bar, uang jarang hilang dalam satu kejadian besar. Biasanya ia menetes sedikit-sedikit sepanjang malam, dan baru terlihat bila Anda memang mencarinya.",
      },
      {
        type: "list",
        items: [
          "Minuman yang dituang berlebih atau dibuat ulang karena salah pesan, tanpa pernah dicatat sebagai barang terbuang.",
          "Minuman yang diberikan tanpa dimasukkan ke tagihan, entah karena sibuk atau karena sungkan.",
          "Harga botol di sistem yang sudah lama tidak diperbarui, sehingga margin di laporan tampak lebih baik daripada kenyataannya.",
        ],
      },
      {
        type: "p",
        text: "Lakukan beberapa langkah yang sama setiap malam dan angka-angkanya mulai bermakna. Anda bisa mencoba bar demo, dengan sebulan penjualan dan resep contoh, gratis dan tanpa akun, untuk melihat tampilan layarnya sebelum menyiapkan milik Anda sendiri.",
      },
    ],
  },
  {
    slug: "food-truck-menu-singkat-antrean-cepat",
    locale: "id",
    title: "Panduan Food Truck: Menu Singkat, Antrean Cepat, dan Sinyal yang Labil",
    description:
      "Panduan lapangan untuk food truck: menyusun menu singkat yang cepat laku, membiarkan pelanggan memesan lewat kode QR di antrean, tetap berjualan offline, dan tahu margin tiap acara.",
    date: "2026-11-11",
    readMinutes: 6,
    category: "Food truck",
    blocks: [
      {
        type: "p",
        text: "Food truck adalah restoran dengan jendela layanan, tanpa ruang makan, dan dengan koneksi yang hanya sebagus tempat parkirnya. Kendalanya ketat: ruang sempit, layanan singkat, antrean orang yang tak mau menunggu lama, dan sinyal yang datang dan pergi. Truk yang berhasil mengubah kendala itu menjadi aturan.",
      },
      {
        type: "p",
        text: "Panduan ini memuat empat aturan: jaga menu tetap singkat, pindahkan pemesanan dari jendela, tetap berjualan saat sinyal hilang, dan ukur tiap acara secara terpisah. Ditulis untuk pemilik satu truk, dan menunjukkan di mana Epidom membantu pada tiap langkah, supaya Anda bisa menilai kecocokannya.",
      },
      { type: "h2", text: "Aturan satu: menu singkat yang cepat laku" },
      {
        type: "p",
        text: "Tiap item tambahan memperlambat antrean, menambah stok yang harus dibawa, dan membuat jendela lebih sulit dibaca. Menu singkat lebih cepat dimasak, lebih mudah dihitung biayanya, dan lebih mudah diingat. Kebanyakan truk menjual beberapa menu andalan jauh lebih banyak daripada sisanya.",
      },
      {
        type: "list",
        items: [
          "Pangkas menu menjadi yang bisa Anda sajikan dalam beberapa menit per pesanan di saat paling ramai. Simpan sisanya untuk hari khusus.",
          "Jadikan menu terlaris yang paling mudah dipesan dan dibuat, dan pasang harganya di tempat yang terbaca dari antrean.",
          "Tawarkan pilihan sebagai opsi sederhana, seperti ukuran atau saus, bukan item baru. Layar kasir tetap ringkas.",
        ],
      },
      { type: "h2", text: "Aturan dua: ambil pesanan sebelum jendela" },
      {
        type: "p",
        text: "Jendela adalah penyumbatnya: satu orang menerima, memasak, dan menyerahkan. Apa pun yang memajukan pemesanan memperpendek waktu tunggu semua orang. Kode QR di papan pada antrean memungkinkan orang memilih dan membayar sambil mengantre, sehingga jendela hanya untuk menyerahkan.",
      },
      {
        type: "list",
        items: [
          "Pasang kode QR besar di tempat antrean terbentuk, dengan satu kalimat pendek yang menjelaskan fungsinya.",
          "Tampilkan nama atau nomor pengambilan dengan jelas, agar orang tahu kapan maju.",
          "Sediakan kasir di jendela bagi yang lebih suka memesan di sana. Kedua kanal harus berakhir di daftar yang sama.",
        ],
      },
      {
        type: "p",
        text: "Di Epidom, truk Anda punya halaman pesan publik di alamat Anda sendiri. Pesanan dari ponsel masuk ke kasir bersama penjualan jendela, dalam satu daftar. Coba demo langsung untuk melihat apa yang dilihat pelanggan, lalu cetak kode QR milik Anda sendiri.",
      },
      { type: "h2", text: "Aturan tiga: tetap berjualan saat sinyal hilang" },
      {
        type: "p",
        text: "Pasar, tempat parkir, dan festival persis tempat koneksi sering gagal. Kasir yang butuh internet untuk setiap penjualan membuat Anda kehilangan jam terbaik hari itu. Sebelum mengandalkan alat apa pun, uji perilakunya saat offline: apakah tetap mencatat penjualan, dan apa yang terjadi pada penjualan itu sesudahnya?",
      },
      {
        type: "list",
        items: [
          "Uji kasir dengan ponsel dalam mode pesawat sebelum acara pertama, bukan saat acara berlangsung.",
          "Ketahui tindakan mana yang masih butuh koneksi. Di Epidom, itu membuka dan menutup shift, mutasi kas, dan pengembalian dana, jadi lakukan di tempat yang ada sinyal.",
          "Siapkan mesin kartu dengan data seluler sendiri, terpisah dari kasir, agar koneksi lemah di satu perangkat tidak menghentikan yang lain.",
        ],
      },
      {
        type: "p",
        text: "Aplikasi kasir Epidom untuk desktop dan Android tetap mencatat penjualan tanpa koneksi dan mengirimkannya saat sinyal kembali. Anggap acara pertama sebagai latihan dan periksa bahwa setiap penjualan offline muncul sesudahnya.",
      },
      { type: "h2", text: "Aturan empat: ukur tiap acara" },
      {
        type: "p",
        text: "Pekan sebuah truk terdiri dari hari yang sangat berbeda: tempat parkir saat makan siang, pasar hari Sabtu, festival malam hari. Satu total bulanan menyembunyikan mana yang sepadan dengan biaya lokasi dan bahan bakar. Ukur masing-masing sendiri-sendiri.",
      },
      {
        type: "list",
        items: [
          "Catat biaya lokasi atau acara dan bandingkan dengan laba kotor hari itu, bukan hanya omzet.",
          "Catat stok yang dibawa dan stok yang dibawa pulang. Itu memberi tahu apa yang perlu disiapkan lain kali.",
          "Lihat penjualan per jam. Jika puncaknya lebih pendek dari acaranya, Anda bisa pulang lebih awal atau membawa lebih sedikit.",
        ],
      },
      {
        type: "p",
        text: "Laporan Epidom menampilkan penjualan per jam dan per item, serta laba kotor setelah resep Anda dihitung biayanya. Tambahkan biaya acara sebagai pengeluaran dan Anda punya hasil sebenarnya hari itu. Melihat beberapa angka yang sama tiap pekan akan memberi tahu di mana sebaiknya parkir bulan depan.",
      },
      { type: "h2", text: "Daftar periksa pagi hari acara" },
      {
        type: "list",
        items: [
          "Isi daya ponsel, printer, dan mesin kartu, dan bawa kabel cadangan.",
          "Buka kasir dan shift selagi masih ada sinyal.",
          "Cetak atau tampilkan kode QR dan pastikan membuka halaman pesan.",
          "Cocokkan daftar stok menipis dengan yang ada di truk.",
        ],
      },
      { type: "h2", text: "Tiga kesalahan yang sering terjadi" },
      {
        type: "p",
        text: "Truk yang baru mulai biasanya tersandung di tempat yang sama. Mengenalinya lebih awal menghemat banyak malam yang melelahkan.",
      },
      {
        type: "list",
        items: [
          "Membawa terlalu banyak variasi menu ke acara pertama, lalu pulang dengan bahan yang tidak laku dan harus dibuang.",
          "Menyalakan kasir untuk pertama kali di lokasi, sehingga masalah pengaturan baru ketahuan saat antrean sudah panjang.",
          "Menetapkan harga tanpa menghitung biaya kemasan, biaya lokasi, dan bahan bakar, sehingga hari yang ramai terasa untung padahal tidak.",
        ],
      },
      {
        type: "p",
        text: "Satu hal lagi yang sering dilupakan: catat pelajaran setiap acara sebelum tidur, selagi masih segar. Dua kalimat tentang apa yang habis lebih cepat, apa yang tersisa, dan jam berapa antrean paling panjang akan lebih berguna daripada laporan panjang yang Anda tulis seminggu kemudian. Setelah beberapa acara, pola itu terlihat jelas dan keputusan menyiapkan stok menjadi jauh lebih mudah.",
      },
      {
        type: "p",
        text: "Jalankan daftar yang sama setiap kali dan harinya menjadi rutinitas. Anda bisa mencoba Epidom gratis pada food truck demo dengan penjualan contoh sebelum menyiapkan menu Anda sendiri.",
      },
    ],
  },
];
