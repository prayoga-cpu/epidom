import type { BlogPost } from "./types";

export const idPosts: BlogPost[] = [
  {
    slug: "cara-mengurangi-komisi-gofood-grabfood",
    locale: "id",
    title: "Cara Mengurangi Ketergantungan pada Komisi GoFood dan GrabFood",
    description:
      "Aplikasi delivery tetap berguna buat ditemukan pelanggan baru, tapi tiap pesanan kena komisi. Ini cara bikin kanal pesan langsung tanpa berhenti pakai GoFood atau GrabFood.",
    date: "2026-06-05",
    updated: "2026-10-14",
    readMinutes: 5,
    category: "Jualan Langsung",
    related: ["kalkulator-komisi-gofood", "pesan-online-tanpa-komisi"],
    blocks: [
      {
        type: "p",
        text: "Kebanyakan pemilik warung dan kafe nggak benar-benar berhenti pakai GoFood, GrabFood, atau ShopeeFood, dan memang nggak perlu. Aplikasi delivery itu etalase yang ramai: orang yang belum pernah dengar nama tokomu bisa nemuin kamu karena lagi lapar dan buka aplikasi. Masalahnya bukan di aplikasinya. Masalahnya muncul kalau SEMUA pesanan, termasuk dari pelanggan yang udah kenal dan sering balik, harus lewat sana dan kena potongan komisi.",
      },
      {
        type: "p",
        text: "Artikel ini membahas cara menghitung berapa sebenarnya komisi itu buat tokomu, pelanggan mana yang layak dipindah ke kanal sendiri, dan langkah-langkah praktis supaya dua kanal bisa jalan bareng tanpa saling ganggu.",
      },
      { type: "h2", text: "Hitung dulu: berapa yang sebenarnya hilang tiap pesanan" },
      {
        type: "p",
        text: "Tiap pesanan lewat aplikasi delivery kena komisi yang dipotong sebelum uangnya sampai ke kamu. Besarnya beda-beda tergantung platform, jenis kemitraan, dan promo yang kamu ikuti, jadi cek angka di dashboard mitra atau kontrak kamu sendiri. Buat gambaran, anggap saja komisinya 20% (ini cuma contoh, bukan angka resmi platform mana pun).",
      },
      {
        type: "list",
        items: [
          "Satu es kopi susu dijual Rp 25.000 di aplikasi. Dengan komisi contoh 20%, kamu menerima Rp 20.000.",
          "Kalau biaya bahan, gelas, dan es-nya Rp 9.000, sisa kotor per gelas tinggal Rp 11.000, bukan Rp 16.000.",
          "Kalau kamu jual 40 gelas per hari lewat aplikasi, potongan komisinya Rp 200.000 per hari, sekitar Rp 6 juta per bulan.",
          "Belum termasuk promo yang kamu danai sendiri supaya muncul di halaman depan aplikasi.",
        ],
      },
      {
        type: "p",
        text: "Angka-angka di atas contoh hitungan. Masukkan angka tokomu sendiri, atau pakai kalkulator komisi GoFood di Epidom buat lihat berapa yang tersisa per menu setelah komisi. Sering kali menu yang kelihatan laris ternyata marginnya tipis banget setelah dipotong.",
      },
      { type: "h2", text: "Soal data pelanggan: yang sering kelupaan" },
      {
        type: "p",
        text: "Selain komisi, ada hal kedua yang jarang dihitung: data pelanggan. Siapa yang pesan, kapan, pesan apa, itu tetap dipegang platform. Kamu nggak bisa langsung bilang ke pelanggan yang minggu lalu suka banget sama menu barumu bahwa besok ada menu baru lagi. Pelanggan itu, di mata aplikasi, adalah pelanggan aplikasi, bukan pelangganmu.",
      },
      { type: "h2", text: "Siapa yang layak dipindah ke kanal sendiri" },
      {
        type: "p",
        text: "Jangan coba memindahkan semua orang. Fokus ke pelanggan yang sudah punya alasan kuat buat balik:",
      },
      {
        type: "list",
        items: [
          "Pelanggan langganan yang pesan minimal dua atau tiga kali sebulan",
          "Kantor atau komunitas sekitar yang sering pesan buat banyak orang",
          "Orang yang sudah follow Instagram atau WhatsApp tokomu",
          "Pelanggan yang makan di tempat dan kadang minta diantar kalau lagi malas keluar",
        ],
      },
      {
        type: "p",
        text: "Pelanggan baru yang cuma ketemu kamu lewat aplikasi biarkan di aplikasi. Itu memang fungsi aplikasi: jadi iklan yang bayarnya per pesanan.",
      },
      { type: "h2", text: "Kanal langsung: bukan pengganti, tapi tambahan" },
      {
        type: "list",
        items: [
          "Halaman toko sendiri dengan menu lengkap, jam buka, dan tombol WhatsApp, yang bisa ditaruh di bio Instagram, QR code di meja, atau status WhatsApp",
          "Link GoFood, GrabFood, dan ShopeeFood tetap bisa dipasang di halaman yang sama, jadi pelanggan yang lebih suka aplikasi tetap punya jalan",
          "Pesanan online lewat link sendiri (paket POS di Epidom, ada uji coba gratis 14 hari) nggak kena komisi platform. Pembayarannya dilakukan di kasir, dan kasir dapat pemberitahuan tiap ada pesanan baru",
          "Kontak langsung lewat WhatsApp buat pesanan berulang atau pesanan besar",
        ],
      },
      {
        type: "quote",
        text: "Tujuannya bukan \"ngalahin\" GoFood atau GrabFood. Tujuannya biar nggak 100% bergantung ke mereka buat pelanggan yang udah kenal kamu.",
      },
      { type: "h2", text: "Langkah praktis, urut dari yang paling gampang" },
      {
        type: "list",
        items: [
          "Bikin halaman toko dengan menu, foto, dan harga. Halaman toko dan menu QR di Epidom gratis selamanya, dan ini belum menerima pesanan online.",
          "Taruh link dan QR code di tempat pelanggan sudah ketemu kamu: bio Instagram, meja, kemasan, nota, dan stiker di kantong bungkus.",
          "Tambahkan tulisan kecil di kemasan pesanan aplikasi: pesan langsung lewat WhatsApp atau link kami buat lain kali. Jangan menjanjikan diskon besar, cukup kasih tahu kanalnya ada.",
          "Kalau volume pesanan langsung sudah cukup banyak, aktifkan pesanan online (paket POS) supaya pesanan dari link masuk ke antrean kasir, bareng pesanan dari pelanggan yang datang langsung.",
          "Catat pesanan dari aplikasi delivery di kasir sebagai kanal tersendiri. Di paket Operations, laporan keuangan menampilkan omzet dan komisi tiap platform, jadi kamu bisa lihat angka sebenarnya.",
        ],
      },
      {
        type: "p",
        text: "Perlu dicatat: Epidom tidak tersambung langsung ke GoFood, GrabFood, atau ShopeeFood. Pesanan dari aplikasi tersebut kamu masukkan sendiri di kasir sebagai kanal terpisah. Gunanya buat pembukuan, supaya omzet dan komisi per platform kelihatan jelas.",
      },
      { type: "h2", text: "Kesalahan yang sering terjadi" },
      {
        type: "list",
        items: [
          "Menaikkan harga di aplikasi terlalu tinggi sampai pelanggan kabur. Naikkan sedikit saja, dan hitung dulu lewat kalkulator.",
          "Berhenti total dari aplikasi sebelum kanal sendiri jalan. Aplikasi tetap sumber pelanggan baru, jangan dimatikan dulu.",
          "Menyebar link tapi menunya nggak rapi, fotonya buram, atau stok habis tapi tampil tersedia. Pakai tombol habis supaya menu yang kosong nggak bisa dipesan.",
          "Nggak ada yang jaga pesanan langsung. Kalau pesanan masuk tapi baru dibalas satu jam kemudian, pelanggan balik ke aplikasi.",
          "Menjanjikan pembayaran online di link toko. Saat ini pesanan dari halaman toko dibayar di kasir, jadi sampaikan dengan jelas supaya pelanggan nggak bingung.",
        ],
      },
      { type: "h2", text: "Contoh sehari di kafe kecil" },
      {
        type: "p",
        text: "Bayangkan kafe dengan 60 pesanan per hari: 20 lewat aplikasi delivery, 40 dari pelanggan yang datang. Tiap sore, barista menaruh kartu kecil di kantong pesanan aplikasi berisi nama kafe dan link halaman toko. Dua minggu kemudian, beberapa langganan kantor mulai menghubungi lewat WhatsApp dari tombol di halaman toko. Mereka tetap pesan lewat aplikasi di hari-hari tertentu, tapi pesanan rutin mingguan pindah ke kanal sendiri. Perubahannya kecil, tapi berulang tiap minggu, dan itu yang membuat hasilnya terasa.",
      },
      {
        type: "p",
        text: "Satu hal lagi: jaga kualitas yang sama di semua kanal. Pelanggan yang pindah dari aplikasi ke kanal sendiri membawa harapan yang sama soal rasa, kemasan, dan kecepatan. Kalau kanal sendiri terasa lebih ribet dari aplikasi, mereka akan balik ke aplikasi, dan itu wajar.",
      },
      { type: "h2", text: "Cara mengukur apakah berhasil" },
      {
        type: "p",
        text: "Cukup pantau tiga angka tiap bulan: berapa pesanan yang masuk lewat link sendiri, berapa persen dari total pesanan delivery, dan berapa komisi yang berhasil nggak terpotong. Kalau dalam tiga bulan porsi kanal sendiri naik walau pelan, itu sudah benar. Nggak perlu sampai 50%. Bahkan kalau seperlima pesanan delivery pindah ke kanal sendiri, selisihnya terasa di akhir bulan.",
      },
      {
        type: "p",
        text: "Mulai dari mana pun yang paling gampang buatmu: hitung komisi, rapikan menu, dan bagikan satu link. Dua kanal bisa jalan bareng, dan kamu yang pegang kendali atas pelangganmu sendiri.",
      },
    ],
  },
  {
    slug: "panduan-menu-qr-code-gratis-warung-kafe",
    locale: "id",
    title: "Panduan Lengkap Menu QR Code Gratis untuk Warung dan Kafe",
    description:
      "Sebelum bikin menu QR code, tahu dulu apa yang beneran berubah buat pelanggan, kesalahan yang sering terjadi, dan cara bikinnya tanpa biaya.",
    date: "2026-06-19",
    updated: "2026-10-14",
    readMinutes: 5,
    category: "Setup",
    related: ["menu-qr-code-gratis", "aplikasi-kasir-cafe"],
    blocks: [
      {
        type: "p",
        text: "Menu QR code udah jadi hal biasa sejak 2020, tapi banyak warung dan kafe masih stuck di versi paling basic: PDF hasil scan, susah dibaca di HP, dan nggak pernah di-update. Menu QR code yang beneran bagus itu beda. Artikel ini membahas apa saja yang membuatnya bagus, apa yang gratis dan apa yang tidak, serta cara memasangnya di warung atau kafe kecil.",
      },
      { type: "h2", text: "PDF bukan menu QR code" },
      {
        type: "p",
        text: "Scan menu kertas terus dijadiin PDF di balik QR code emang nyelesain satu masalah (nggak perlu pegang menu fisik), tapi bikin masalah baru. Teksnya kecil dan harus dicubit-cubit di layar HP. Setiap harga naik, kamu harus scan ulang, ekspor ulang, dan cetak ulang QR code kalau alamat file-nya berubah. Dan PDF nggak bisa kasih tahu pelanggan bahwa menu favoritnya lagi habis.",
      },
      {
        type: "p",
        text: "Bayangkan jam makan siang: tiga meja scan QR, lalu satu per satu memutar HP, memperbesar, dan menyerah lalu manggil pelayan. Menu digital yang buruk justru menambah kerjaan, bukan mengurangi.",
      },
      { type: "h2", text: "Yang harus ada di menu QR code yang beneran bagus" },
      {
        type: "list",
        items: [
          "Gampang dibaca dan cepat dibuka di HP, nggak perlu zoom-zoom",
          "Bisa diubah dalam hitungan detik: stok habis, harga naik, menu musiman masuk",
          "Ada foto per item dan kategori yang jelas (kopi, non-kopi, makanan berat, camilan)",
          "Pilihan seperti ukuran dan tambahan topping tertulis jelas, bukan cuma di deskripsi",
          "Ada jam buka, alamat, dan tombol WhatsApp supaya pelanggan bisa langsung bertanya",
          "Link-nya tetap sama walau menu berubah, jadi QR code yang sudah dicetak nggak perlu diganti",
        ],
      },
      { type: "h2", text: "Apa yang gratis, apa yang tidak" },
      {
        type: "p",
        text: "Supaya jelas dari awal: halaman toko Epidom, lengkap dengan menu, foto, pilihan ukuran dan tambahan, tombol habis, dan QR code yang bisa dicetak, gratis selamanya. Halaman ini untuk menampilkan menu dan memudahkan pelanggan menghubungi kamu lewat WhatsApp. Ada statistik dasar juga: berapa kali halaman dibuka, berapa kali menu dilihat, dan berapa kali tombol WhatsApp diklik.",
      },
      {
        type: "p",
        text: "Yang tidak termasuk di paket gratis adalah pesanan online. Kalau kamu ingin pelanggan memesan dari meja lewat HP (makan di tempat dengan nomor meja, bawa pulang, atau diantar sendiri oleh tokomu), itu ada di paket POS, yang punya uji coba gratis 14 hari. Pesanan dari halaman toko dibayar di kasir, dan kasir dapat pemberitahuan saat pesanan masuk.",
      },
      { type: "h2", text: "Cara bikinnya, langkah demi langkah" },
      {
        type: "list",
        items: [
          "Siapkan daftar menu dalam satu catatan: nama, harga, dan kategori. Mulai dari 15 sampai 30 item terlaris dulu, nggak perlu semuanya.",
          "Foto item andalan dengan cahaya jendela. Satu foto yang terang lebih berguna daripada sepuluh foto gelap.",
          "Buat halaman toko: isi nama, deskripsi singkat, jam buka, dan tautan Instagram atau WhatsApp.",
          "Masukkan menu per kategori. Tulis nama seperti yang biasa diucapkan pelanggan, misalnya es kopi susu, bukan nama internal dapur.",
          "Unduh QR code, cetak, lalu coba scan dari HP sendiri sebelum dipasang.",
          "Pasang di meja, kasir, dan jendela. Tambahkan tulisan kecil: scan buat lihat menu.",
        ],
      },
      {
        type: "p",
        text: "Bagian yang paling lama biasanya memasukkan menu dan harga satu per satu, bukan membuat QR code-nya. Sisihkan waktu sore hari yang sepi supaya nggak terburu-buru.",
      },
      {
        type: "p",
        text: "Sebelum mencetak banyak, uji satu QR code di meja sungguhan dengan beberapa HP berbeda, baik Android maupun iPhone, dan di jam yang cahayanya berbeda. Dari situ kamu tahu ukuran dan posisi yang paling nyaman buat pelangganmu.",
      },
      { type: "h2", text: "Di mana QR code sebaiknya dipasang" },
      {
        type: "list",
        items: [
          "Di meja, pada tatakan kecil atau stiker yang menempel, supaya tidak hilang atau tertukar",
          "Di dekat kasir, untuk pelanggan yang antre dan ingin melihat menu sambil menunggu",
          "Di jendela atau pintu, supaya orang yang lewat bisa melihat menu sebelum masuk",
          "Di kemasan bungkus, nota, dan kantong, supaya pelanggan bisa memesan lagi dari rumah",
          "Di bio Instagram dan status WhatsApp, dalam bentuk link yang sama",
        ],
      },
      {
        type: "p",
        text: "Satu link untuk semua tempat itu memudahkan: kamu cukup memperbarui menu di satu tempat, dan semua QR code yang sudah tersebar otomatis menampilkan versi terbaru.",
      },
      { type: "h2", text: "Kesalahan yang sering terjadi" },
      {
        type: "list",
        items: [
          "Mencetak QR code terlalu kecil. Ukuran sekitar 4 sampai 5 cm per sisi dengan margin putih di sekelilingnya umumnya aman dibaca kamera HP biasa. Coba dari jarak meja sebenarnya.",
          "Menaruh QR code di tempat yang kena pantulan lampu atau di permukaan yang basah. Laminasi doff lebih aman daripada yang mengkilap.",
          "Lupa menandai menu habis, sehingga pelanggan memilih lalu kecewa. Biasakan menekan tombol habis di pagi hari atau saat stok menipis.",
          "Menu terlalu panjang. Kalau pelanggan harus menggulir tiga menit, mereka akan menyerah. Kelompokkan dan unggulkan beberapa item andalan.",
          "Tidak menyediakan menu kertas sama sekali. Beberapa pelanggan, terutama yang lebih tua, masih lebih nyaman dengan kertas. Simpan satu dua lembar buat yang minta.",
          "Mengira QR code sama dengan pesan online. QR code hanya pintu masuk. Kalau pesanan online belum diaktifkan, pelanggan tetap memesan ke kasir seperti biasa.",
        ],
      },
      { type: "h2", text: "Contoh: menata menu untuk kafe kecil" },
      {
        type: "p",
        text: "Misalnya kafe dengan 24 item. Kelompokkan jadi empat kategori: Kopi, Non-Kopi, Makanan, dan Camilan. Taruh tiga item andalan di bagian unggulan supaya langsung terlihat saat halaman dibuka. Beri nama yang dipakai pelanggan sehari-hari. Untuk minuman yang punya pilihan ukuran regular dan large, atau tambahan seperti extra shot dan oat milk, tulis sebagai pilihan di item yang sama, bukan sebagai item terpisah, supaya daftarnya tetap pendek.",
      },
      {
        type: "p",
        text: "Tulis deskripsi satu kalimat untuk menu yang butuh penjelasan, misalnya kopi susu gula aren dengan es, atau roti isi dengan keju. Jangan menuliskan klaim yang tidak bisa kamu buktikan. Cukup jelaskan apa isinya, dan kalau ada bahan yang sering ditanyakan (kacang, susu, pedas), sebutkan agar pelanggan tidak perlu bertanya.",
      },
      {
        type: "p",
        text: "Terakhir, tentukan siapa yang memperbarui menu. Satu orang yang bertanggung jawab lebih baik daripada semua orang boleh ubah tapi tidak ada yang rutin mengecek.",
      },
      { type: "h2", text: "Setelah dipasang: rawat seminggu sekali" },
      {
        type: "p",
        text: "Menu QR code yang jarang diurus cepat jadi menu lama lagi. Luangkan beberapa menit seminggu untuk mengecek tiga hal: harga sudah sesuai, item yang sudah tidak dijual sudah dihapus atau ditandai habis, dan foto menu baru sudah masuk. Lihat juga statistik halaman. Kalau menu sering dibuka tapi klik WhatsApp nol, mungkin nomor atau tombolnya perlu dipindah ke tempat yang lebih terlihat.",
      },
      {
        type: "p",
        text: "Mulai sederhana: satu halaman toko, satu QR code di tiap meja, dan menu yang selalu terbaru. Kalau nanti pelanggan mulai meminta pesan dari meja, baru pikirkan pesanan online.",
      },
    ],
  },
  {
    slug: "tanda-warung-butuh-sistem-kasir-digital",
    locale: "id",
    title: "5 Tanda Warung Kamu Butuh Sistem Kasir Digital",
    description:
      "Nggak semua warung butuh sistem kasir dari hari pertama. Ini lima tanda kalau sudah waktunya pindah dari catatan manual ke sistem yang lebih rapi.",
    date: "2026-07-03",
    updated: "2026-10-14",
    readMinutes: 5,
    category: "Operasional",
    related: ["aplikasi-kasir-cafe", "aplikasi-kasir-offline", "jadwal-shift-karyawan"],
    blocks: [
      {
        type: "p",
        text: "Warung yang baru buka dengan satu pemilik yang megang semuanya beda kebutuhannya sama warung yang udah punya beberapa karyawan gantian shift. Buku tulis dan kalkulator masih bisa jalan bertahun-tahun kalau pemiliknya sendiri yang berdiri di kasir. Sistem kasir digital baru terasa gunanya saat kerjaan mulai nggak bisa kamu awasi sendiri. Berikut lima tanda yang paling sering muncul, plus apa yang bisa kamu lakukan untuk masing-masing.",
      },
      { type: "h2", text: "Tanda 1: kamu punya karyawan pertama yang pegang kasir" },
      {
        type: "p",
        text: "Selama kamu sendiri yang menerima uang, kamu tahu persis berapa masuk. Begitu ada karyawan yang pegang kasir waktu kamu belanja ke pasar atau tidur siang, kamu bergantung pada kejujuran dan ketelitian orang lain. Itu bukan soal curiga. Dengan catatan manual, kalau uang kurang Rp 50.000 di akhir hari, nggak ada jejak untuk menelusuri apakah itu salah kembalian, pesanan yang lupa dicatat, atau hal lain.",
      },
      {
        type: "p",
        text: "Sistem kasir mencatat tiap pesanan lengkap dengan waktu, item, dan metode pembayaran. Di paket Operations, ada juga buka dan tutup shift dengan hitungan uang tunai, sehingga selisih kas langsung kelihatan di akhir shift, bukan seminggu kemudian.",
      },
      { type: "h2", text: "Tanda 2: tutup kas di akhir hari makan waktu lebih dari 15 menit" },
      {
        type: "p",
        text: "Contoh hari biasa di warung: pukul 21.00 pintu ditutup, lalu kamu dan karyawan duduk menghitung uang, mencocokkan dengan nota, dan menambah-nambah di kalkulator. Kalau ini makan 30 menit tiap malam, itu 15 jam sebulan yang hilang dan melelahkan. Sistem kasir sudah menjumlahkan total per metode pembayaran (tunai, QRIS, transfer), jadi yang tersisa hanya menghitung fisik uang tunai di laci dan mencocokkannya.",
      },
      { type: "h2", text: "Tanda 3: sering hitung ulang nota karena nggak yakin totalnya benar" },
      {
        type: "p",
        text: "Nota tulis tangan rawan salah jumlah, terutama saat ramai. Pelanggan membayar, lalu baru sadar total kurang atau lebih. Atau pesanan dengan banyak tambahan (extra telur, pedas level 3, es dipisah) dicatat sebagian saja. Dengan kasir digital, harga dan opsi sudah terisi dari menu, struk keluar otomatis, dan kamu tinggal memilih item. Salah hitung berkurang drastis.",
      },
      { type: "h2", text: "Tanda 4: kamu ingin tahu item apa yang paling laku" },
      {
        type: "p",
        text: "Omzet harian cuma satu angka. Yang berguna untuk keputusan adalah rinciannya: nasi goreng terjual 38 porsi atau 12? Es teh habis jam berapa? Menu mana yang jarang terjual tapi bahannya sering terbuang? Dari rincian itu kamu bisa memutuskan menu yang dipromosikan, menu yang dihapus, dan bahan yang dibeli lebih sedikit. Kalau semua itu masih ada di kepala atau buku tulis, hasilnya sering meleset.",
      },
      {
        type: "p",
        text: "Contoh sederhana: dalam seminggu kamu menemukan bahwa dari 20 menu, lima menu menyumbang sebagian besar penjualan, dan tiga menu hampir tidak pernah dipesan. Menu yang tidak laku itu menghabiskan bahan, tempat di etalase, dan perhatian dapur.",
      },
      { type: "h2", text: "Tanda 5: pesanan mulai datang dari banyak arah" },
      {
        type: "p",
        text: "Pesanan di meja, bungkus, pesanan lewat WhatsApp, dan pesanan dari aplikasi delivery. Kalau semuanya ditulis di tempat berbeda, dapur sering kebingungan mana yang duluan, dan sebagian pesanan terlewat. Sistem kasir dengan antrean pesanan menyatukan semua kanal dalam satu daftar: baru, diproses, siap, disajikan. Di paket POS ada juga layar dapur supaya tiket pesanan muncul langsung di dapur tanpa teriak-teriakan.",
      },
      { type: "h2", text: "Apa yang berubah kalau pakai sistem kasir digital" },
      {
        type: "p",
        text: "Sistem kasir yang dirancang buat F&B menyambungkan pesanan, pembayaran, dan cetak struk jadi satu alur, di tablet, HP, atau komputer. Kamu bisa menerima beberapa metode pembayaran dalam satu pesanan (misalnya sebagian tunai, sebagian QRIS), mengatur biaya layanan dan pajak, dan memproses refund dengan catatan jelas. Struk bisa dicetak lewat printer thermal Bluetooth, dikirim sebagai PDF, atau lewat email.",
      },
      {
        type: "p",
        text: "Warung sering khawatir soal internet yang tidak stabil. Epidom punya mode offline: kasir tetap bisa berjualan tanpa internet, dan penjualan tersimpan di perangkat lalu tersinkron saat koneksi kembali, dengan waktu transaksi yang asli.",
      },
      { type: "h2", text: "Contoh: satu hari di warung makan" },
      {
        type: "p",
        text: "Pukul 12.15, warung penuh. Tiga meja memesan sekaligus, dua orang menunggu bungkusan, dan satu pelanggan menelepon soal pesanan buat kantor. Dengan nota tulis tangan, pesanan bisa tertukar dan karyawan harus bolak-balik bertanya. Dengan kasir digital, tiap pesanan punya nomor, status, dan daftar item yang jelas. Yang bungkus ditandai bungkus, yang meja ditandai nomor meja, dan dapur tahu mana yang harus keluar dulu. Pukul 21.00, laporan hari itu sudah tersedia tanpa kamu menjumlahkan nota satu per satu.",
      },
      {
        type: "p",
        text: "Perhatikan bahwa semua manfaat ini muncul dari hal sederhana: setiap pesanan dicatat satu kali, di satu tempat, dan tidak ditulis ulang. Pengurangan salah catat dan waktu hitung itulah yang membuat orang yang sudah pindah jarang mau balik lagi.",
      },
      {
        type: "p",
        text: "Jangan lupa karyawan: tanyakan pendapat mereka sebelum memilih sistem. Orang yang tiap hari memakainya akan langsung tahu apakah tombolnya mudah dijangkau dan alurnya masuk akal untuk jam sibuk.",
      },
      { type: "h2", text: "Kapan sebaiknya belum pindah" },
      {
        type: "p",
        text: "Nggak semua warung perlu pindah sekarang. Kalau kamu sendiri yang jaga kasir, transaksi per hari masih sedikit, dan buku tulismu rapi serta rutin dicocokkan, kamu mungkin belum butuh. Pindah karena temanmu pindah, atau karena merasa harus punya, biasanya berujung sistem yang dibiarkan nganggur. Pindah ketika rasa sakitnya nyata: uang selisih, antre di kasir, atau stok yang terus meleset.",
      },
      {
        type: "p",
        text: "Satu hal yang sering terlewat adalah pelatihan. Sistem apa pun hanya berguna kalau karyawan nyaman memakainya saat antrean panjang. Sisihkan setengah jam sebelum buka untuk latihan: satu orang jadi pelanggan, satu orang jadi kasir, lalu tukar. Coba juga kasus yang jarang tapi pasti terjadi, seperti pesanan dibatalkan, pembayaran campuran, atau pelanggan minta refund. Karyawan yang sudah pernah mencobanya tidak akan panik saat kejadian sungguhan.",
      },
      { type: "h2", text: "Urutan yang masuk akal buat pemula" },
      {
        type: "list",
        items: [
          "Mulai dari halaman toko dengan menu dan QR code (gratis selamanya) supaya menu kamu rapi dan bisa dibagikan.",
          "Saat kamu siap, coba kasir selama uji coba gratis 14 hari di paket POS, dengan satu tablet atau HP di kasir.",
          "Masukkan 20 sampai 30 menu terlaris dulu. Jangan menunggu semua menu lengkap.",
          "Jalankan paralel dengan catatan lama selama satu atau dua minggu supaya karyawan terbiasa dan kamu bisa membandingkan angkanya.",
          "Kalau sudah ada beberapa karyawan, stok, dan shift, baru pertimbangkan paket Operations untuk shift, absensi, resep dan stok, serta laporan keuangan.",
        ],
      },
      {
        type: "p",
        text: "Intinya, sistem kasir adalah alat untuk mengurangi kerja manual yang sudah mulai menyakitkan, bukan tujuan itu sendiri. Kalau dua dari lima tanda di atas terasa akrab, itu pertanda baik untuk mulai mencoba.",
      },
    ],
  },
  {
    slug: "cara-menentukan-harga-jual-menu-kafe",
    locale: "id",
    title: "Cara menentukan harga jual menu kafe supaya tetap untung",
    description:
      "Hitung HPP, tetapkan target food cost, masukkan overhead, bulatkan harga, dan sesuaikan harga di aplikasi delivery. Lengkap dengan contoh hitungan rupiah.",
    date: "2026-10-14",
    readMinutes: 6,
    category: "Operasional",
    related: ["kalkulator-hpp", "kalkulator-komisi-gofood"],
    blocks: [
      {
        type: "p",
        text: "Banyak kafe menentukan harga dengan cara paling gampang: lihat harga kafe sebelah, lalu kurangi sedikit biar lebih menarik. Cara itu bisa berhasil kebetulan, tapi sering bikin kafe ramai namun uangnya tidak bertambah. Harga jual yang benar dimulai dari angka di dapurmu sendiri, bukan dari tetangga. Artikel ini membahas langkah-langkahnya, dari menghitung HPP sampai menyesuaikan harga di aplikasi delivery, dengan contoh hitungan dalam rupiah.",
      },
      { type: "h2", text: "Langkah 1: hitung HPP per porsi" },
      {
        type: "p",
        text: "HPP (harga pokok penjualan) adalah biaya bahan untuk membuat satu porsi menu. Mulai dari yang paling jelas: bahan utama. Untuk es kopi susu, itu kopi, susu, gula aren, es batu, dan gelas beserta sedotannya. Bagi harga belanja dengan jumlah porsi yang dihasilkan.",
      },
      {
        type: "p",
        text: "Contoh hitungan es kopi susu, dengan angka ilustrasi:",
      },
      {
        type: "list",
        items: [
          "Biji kopi: 18 gram per porsi. Kalau 1 kg biji Rp 150.000, maka 18 gram = Rp 2.700",
          "Susu: 120 ml per porsi. Kalau 1 liter Rp 20.000, maka 120 ml = Rp 2.400",
          "Gula aren cair: 20 ml per porsi, sekitar Rp 500",
          "Es batu: sekitar Rp 300",
          "Gelas, tutup, dan sedotan: sekitar Rp 1.800",
          "Total HPP: Rp 7.700 per gelas",
        ],
      },
      {
        type: "p",
        text: "Jangan lupa bahan yang kelihatan sepele: sirup, topping, tisu, kantong bungkus, dan bahan yang terbuang saat menyiapkan. Banyak pemilik kafe menambahkan beberapa persen sebagai cadangan buat bahan terbuang atau tumpah. Aturan kasarnya, kalau kamu tidak pernah mencatat bahan terbuang, kemungkinan HPP sebenarnya lebih tinggi dari hitunganmu.",
      },
      {
        type: "p",
        text: "Kalau menu punya banyak bahan atau harga bahan sering berubah, hitung manual cepat melelahkan. Kalkulator HPP di Epidom membantu menghitung biaya per porsi dari bahan dan takarannya. Di paket Operations, resep dengan takaran bahan otomatis menghitung biaya per menu dan memperbarui hitungan saat harga bahan berubah.",
      },
      { type: "h2", text: "Langkah 2: tetapkan target food cost" },
      {
        type: "p",
        text: "Food cost adalah persentase biaya bahan terhadap harga jual. Rumusnya: HPP dibagi harga jual, dikali 100. Banyak pelaku F&B memakai angka sekitar 25% sampai 35% sebagai patokan awal untuk kafe dan restoran, tapi ini aturan kasar, bukan hukum. Kafe kopi dengan minuman sering punya food cost lebih rendah daripada restoran dengan lauk daging, sedangkan bakery dengan bahan mentega impor bisa lebih tinggi.",
      },
      {
        type: "p",
        text: "Pakai target sebagai titik awal, lalu sesuaikan dengan kenyataan tokomu. Untuk es kopi susu tadi dengan HPP Rp 7.700 dan target food cost 30%:",
      },
      {
        type: "list",
        items: [
          "Harga jual = HPP dibagi food cost = Rp 7.700 dibagi 0,30 = sekitar Rp 25.667",
          "Dibulatkan menjadi Rp 25.000 atau Rp 26.000, tergantung strategi harga",
          "Kalau dijual Rp 25.000, food cost sebenarnya = 7.700 dibagi 25.000 = sekitar 31%",
        ],
      },
      { type: "h2", text: "Langkah 3: ingat bahwa HPP bukan satu-satunya biaya" },
      {
        type: "p",
        text: "Selisih antara harga jual dan HPP, yaitu margin kotor, bukan laba. Dari margin kotor itu kamu masih harus membayar sewa, gaji, listrik, air, gas, internet, perawatan alat, biaya pembayaran, pajak, dan ongkos pemasaran. Itulah overhead, atau biaya operasional.",
      },
      {
        type: "p",
        text: "Cara praktis memasukkan overhead: hitung total biaya tetap bulanan dan perkirakan jumlah porsi yang terjual per bulan. Misalnya:",
      },
      {
        type: "list",
        items: [
          "Sewa Rp 6.000.000, gaji dua karyawan Rp 7.000.000, listrik, air, dan internet Rp 1.800.000, lain-lain Rp 1.200.000. Total Rp 16.000.000 per bulan",
          "Perkiraan penjualan 2.000 porsi minuman dan makanan per bulan (contoh)",
          "Overhead per porsi = 16.000.000 dibagi 2.000 = Rp 8.000",
        ],
      },
      {
        type: "p",
        text: "Artinya, es kopi susu yang dijual Rp 25.000 dengan HPP Rp 7.700 menyisakan margin kotor Rp 17.300. Dikurangi overhead rata-rata Rp 8.000 per porsi, sisa Rp 9.300 per gelas sebagai laba sebelum pajak penghasilan. Kalau penjualan turun jadi 1.200 porsi per bulan, overhead per porsi naik jadi sekitar Rp 13.300, dan labanya menyusut ke sekitar Rp 4.000 per gelas. Inilah sebabnya harga yang pas bergantung pada seberapa ramai kafemu, bukan cuma bahan.",
      },
      {
        type: "p",
        text: "Jangan lupa upahmu sendiri. Banyak pemilik tidak menghitung gaji sendiri sebagai biaya, lalu bingung kenapa merasa kerja keras tapi uangnya tidak ada. Masukkan sebagai bagian dari biaya tetap.",
      },
      { type: "h2", text: "Langkah 4: bulatkan harga dengan sengaja" },
      {
        type: "p",
        text: "Hasil hitungan jarang berupa angka cantik. Pembulatan boleh dipakai, asal sengaja dan sebaiknya ke atas kalau margin sudah tipis.",
      },
      {
        type: "list",
        items: [
          "Bulatkan ke kelipatan Rp 500 atau Rp 1.000 supaya kembalian mudah dan tidak merepotkan kasir",
          "Harga berakhiran 5.000, misalnya Rp 25.000 atau Rp 28.000, terasa rapi di menu; harga seperti Rp 24.500 juga umum dipakai karena terasa lebih murah, tapi cuma kalau kamu konsisten",
          "Jangan membulatkan ke bawah kalau food cost sudah di atas target; naikkan sedikit atau kurangi takaran",
          "Atur jarak antar-harga. Kalau kopi susu Rp 25.000 dan latte Rp 30.000, jarak Rp 5.000 terasa jelas buat pelanggan",
        ],
      },
      {
        type: "p",
        text: "Perhatikan juga pajak dan biaya layanan. Kalau tokomu mengenakan pajak atau service charge, tentukan apakah harga di menu sudah termasuk atau belum, lalu tulis dengan jelas di menu. Pelanggan benci kejutan di struk.",
      },
      { type: "h2", text: "Langkah 5: harga di aplikasi delivery vs harga di toko" },
      {
        type: "p",
        text: "Pesanan lewat GoFood, GrabFood, atau ShopeeFood kena komisi. Besarnya berbeda-beda, jadi cek di dashboard mitra atau kontrakmu. Sebagai contoh, anggap komisi 20% (hanya ilustrasi).",
      },
      {
        type: "p",
        text: "Dengan harga Rp 25.000 di aplikasi, kamu menerima Rp 20.000. Setelah HPP Rp 7.700, margin kotor tinggal Rp 12.300 dan setelah overhead Rp 8.000 hanya sisa Rp 4.300, jauh di bawah Rp 9.300 kalau pelanggan membeli langsung di toko. Ada tiga pilihan:",
      },
      {
        type: "list",
        items: [
          "Samakan harga di aplikasi dan di toko, lalu terima margin yang lebih tipis di aplikasi sebagai biaya iklan",
          "Naikkan harga di aplikasi sedikit (misalnya Rp 3.000 sampai Rp 5.000 per item) untuk menutup sebagian komisi, tanpa bikin pelanggan kabur. Cek aturan platform mengenai selisih harga",
          "Hanya tampilkan menu yang marginnya sehat di aplikasi, dan tahan menu bermargin tipis dari aplikasi",
        ],
      },
      {
        type: "p",
        text: "Untuk menghitung tepatnya berapa yang tersisa per menu setelah komisi, kamu bisa memakai kalkulator komisi GoFood. Masukkan harga jual, komisi, dan HPP, lalu lihat sisanya. Pilihan terbaik tergantung berapa besar porsi penjualan dari aplikasi di tokomu.",
      },
      { type: "h2", text: "Langkah 6: uji harga dengan data, bukan perasaan" },
      {
        type: "p",
        text: "Harga bukan keputusan sekali seumur hidup. Setelah menetapkannya, pantau dua hal selama beberapa minggu: jumlah terjual dan margin per item. Kalau jumlah terjual hampir tidak turun setelah harga naik Rp 2.000, kemungkinan harga lama terlalu murah. Kalau penjualan anjlok, kembalikan atau tawarkan ukuran lebih kecil.",
      },
      {
        type: "p",
        text: "Perhatikan juga menu bintang dan menu beban. Menu bintang laku dan marginnya baik, jadi taruh di posisi menonjol. Menu beban kurang laku dan marginnya tipis, jadi pertimbangkan menaikkan harga, mengubah resep, atau menghapusnya. Di paket Operations, laporan margin per item dan laporan keuangan per hari, minggu, atau bulan memudahkan melihat menu mana yang benar-benar menghasilkan.",
      },
      { type: "h2", text: "Kesalahan yang sering terjadi" },
      {
        type: "list",
        items: [
          "Memakai harga bahan lama. Harga susu, kopi, dan telur berubah, jadi hitung ulang HPP tiap beberapa bulan",
          "Tidak menghitung bahan terbuang, kemasan, dan bahan pelengkap",
          "Menyamakan margin kotor dengan laba",
          "Meniru harga kompetitor tanpa tahu biaya mereka. Sewa dan volume mereka berbeda",
          "Menurunkan harga untuk menarik pelanggan sebelum menghitung berapa porsi tambahan yang dibutuhkan agar impas",
          "Lupa komisi saat menjual lewat aplikasi delivery",
          "Naik harga drastis sekaligus. Naikkan bertahap atau barengi dengan menu baru supaya terasa wajar",
        ],
      },
      {
        type: "p",
        text: "Satu catatan terakhir tentang ukuran porsi. Kadang cara paling aman menjaga margin bukan menaikkan harga, tapi menyesuaikan takaran: mengurangi 10 ml susu atau mengganti gelas dengan yang sedikit lebih kecil bisa menurunkan HPP tanpa pelanggan merasa. Lakukan dengan hati-hati dan jangan sampai rasa berubah.",
      },
      { type: "h2", text: "Ringkasan alur" },
      {
        type: "list",
        items: [
          "Hitung HPP tiap menu dari bahan dan takaran",
          "Pilih target food cost sebagai titik awal, bukan harga mati",
          "Hitung overhead per porsi dari biaya tetap bulanan",
          "Bulatkan harga dengan sengaja",
          "Hitung ulang margin untuk penjualan lewat aplikasi delivery",
          "Pantau penjualan dan margin, lalu sesuaikan",
        ],
      },
      {
        type: "p",
        text: "Semua angka dalam artikel ini hanya contoh. Harga bahan, sewa, dan volume penjualan tiap kafe berbeda, jadi ganti dengan angkamu sendiri. Intinya, harga yang sehat lahir dari hitungan yang jujur, bukan tebakan.",
      },
    ],
  },
  {
    slug: "modal-buka-kafe-kecil-peralatan-dan-aplikasi",
    locale: "id",
    title: "Modal buka kafe kecil: peralatan dan aplikasi yang dibutuhkan",
    description:
      "Daftar praktis peralatan dan aplikasi untuk membuka kafe kecil: perangkat kasir, printer struk, layar dapur, QRIS, menu QR, internet cadangan, plus urutan setup.",
    date: "2026-10-14",
    readMinutes: 6,
    category: "Setup",
    related: ["aplikasi-kasir-cafe", "printer-struk-kasir", "menu-qr-code-gratis"],
    blocks: [
      {
        type: "p",
        text: "Membuka kafe kecil sering dimulai dengan semangat dan daftar belanja yang panjang. Mesin espresso, grinder, etalase, meja, kursi, lalu baru ingat: kasirnya bagaimana? Struknya dicetak di mana? Pembayaran QRIS lewat apa? Artikel ini fokus pada sisi yang sering telat dipikirkan: perangkat dan aplikasi untuk menjalankan kafe sehari-hari. Kisaran biaya yang disebut hanya perkiraan umum untuk gambaran, bukan harga pasti. Harga berubah menurut merek, kota, dan musim promo, jadi cek langsung ke penjual.",
      },
      { type: "h2", text: "Pisahkan dulu: yang wajib, yang bagus kalau ada, dan yang bisa nanti" },
      {
        type: "p",
        text: "Kesalahan modal paling umum adalah membeli semua sekaligus. Kafe kecil dengan satu atau dua orang di balik meja tidak butuh semua perangkat di hari pertama. Bagi daftarnya jadi tiga kelompok:",
      },
      {
        type: "list",
        items: [
          "Wajib sebelum buka: perangkat kasir, cara menerima pembayaran (tunai dan QRIS), menu yang bisa dilihat pelanggan, listrik dan internet yang bisa diandalkan",
          "Bagus kalau ada: printer struk, laci uang, menu QR di meja, layar dapur untuk dapur yang sibuk",
          "Bisa menyusul: scanner barcode, beberapa printer untuk dapur dan bar, perangkat tambahan untuk pelayan, sistem stok dan resep yang lengkap",
        ],
      },
      { type: "h2", text: "1. Tablet atau HP untuk kasir" },
      {
        type: "p",
        text: "Kasir modern tidak harus mesin besar. Epidom berjalan di browser pada HP, tablet, atau komputer, dan bisa dipasang sebagai aplikasi desktop (Windows, macOS, Linux), aplikasi Android, atau aplikasi layar utama di iPad dan iPhone. Artinya, kamu bisa mulai dari perangkat yang sudah ada.",
      },
      {
        type: "list",
        items: [
          "HP atau tablet bekas yang masih mulus: kisaran perkiraan Rp 1,5 juta sampai Rp 3 juta",
          "Tablet baru kelas menengah: kisaran perkiraan Rp 3 juta sampai Rp 6 juta",
          "Dudukan atau stand tablet supaya layar stabil di meja kasir: kisaran perkiraan Rp 100 ribu sampai Rp 500 ribu",
          "Charger cadangan dan power bank supaya baterai tidak habis di tengah jam sibuk",
        ],
      },
      {
        type: "p",
        text: "Pilih layar yang cukup besar, minimal sekitar 8 inci, supaya menu dan tombol mudah ditekan saat ramai. Pastikan sistem operasinya masih menerima pembaruan browser. Kalau perangkat terlalu tua, aplikasi kadang lambat.",
      },
      { type: "h2", text: "2. Printer struk" },
      {
        type: "p",
        text: "Struk bukan sekadar bukti bayar. Pelanggan sering memintanya, dan kamu butuh bukti kalau ada komplain. Epidom mendukung printer thermal Bluetooth ukuran 58 mm dan 80 mm. Ukuran 58 mm lebih kecil dan murah, cocok untuk kafe kecil. Ukuran 80 mm lebih lega untuk nota yang panjang.",
      },
      {
        type: "list",
        items: [
          "Printer thermal 58 mm: kisaran perkiraan Rp 400 ribu sampai Rp 900 ribu",
          "Printer thermal 80 mm: kisaran perkiraan Rp 800 ribu sampai Rp 2 juta",
          "Kertas thermal: beli per dus dan simpan di tempat sejuk, jangan di dekat panas karena kertasnya menghitam",
          "Printer kedua untuk dapur atau bar kalau nanti dibutuhkan",
        ],
      },
      {
        type: "p",
        text: "Di paket POS, satu kasir bisa memakai beberapa printer dengan peran berbeda: struk, tiket dapur, tiket bar, dan label item. Struk juga bisa dikirim sebagai PDF atau lewat email, jadi printer tidak mutlak di hari pertama. Panduan memilih printer struk ada di halaman printer struk kasir.",
      },
      { type: "h2", text: "3. Layar dapur (opsional di awal)" },
      {
        type: "p",
        text: "Kalau pesanan di kafemu masih sedikit dan dapur dekat dengan kasir, kamu belum butuh layar dapur. Pesanan bisa dibacakan langsung atau dicetak lewat printer dapur. Layar dapur mulai berguna ketika pesanan datang dari beberapa arah (meja, bungkus, pesanan online) dan dapur sering salah urutan.",
      },
      {
        type: "list",
        items: [
          "Satu tablet atau monitor kecil di dapur: kisaran perkiraan Rp 1,5 juta sampai Rp 4 juta",
          "Dudukan di dinding atau meja yang aman dari cipratan air dan minyak",
          "Di paket POS, layar dapur satu layar menampilkan tiket real time dengan status item dan suara pemberitahuan. Beberapa layar yang diarahkan per stasiun (dapur dan bar) ada di paket Operations",
        ],
      },
      { type: "h2", text: "4. QRIS dan cara menerima pembayaran" },
      {
        type: "p",
        text: "Mayoritas pelanggan sekarang membayar dengan QRIS, jadi kafe tanpa QRIS akan kehilangan penjualan. QRIS didaftarkan lewat bank atau penyedia pembayaran pilihanmu, bukan lewat aplikasi kasir. Prosesnya biasanya berupa pengajuan dengan dokumen usaha, lalu verifikasi. Syarat dan lama prosesnya berbeda tiap penyedia, jadi tanyakan langsung dan ajukan jauh sebelum hari buka.",
      },
      {
        type: "list",
        items: [
          "Bandingkan biaya per transaksi dan jadwal pencairan dana dari tiap penyedia, karena ini memengaruhi arus kas",
          "Cetak stiker QRIS dan taruh di kasir. Siapkan juga alternatif kalau jaringan penyedia sedang gangguan",
          "Tetap sediakan uang kembalian tunai untuk hari pertama, perkiraan Rp 500 ribu sampai Rp 1 juta dalam pecahan kecil",
        ],
      },
      {
        type: "p",
        text: "Di kasir Epidom kamu bisa mencatat beberapa metode pembayaran dalam satu pesanan, misalnya sebagian tunai dan sebagian QRIS, sehingga laporan akhir hari tetap rapi. Catatan: pembayaran QRIS diterima lewat penyedia pembayaranmu sendiri, lalu dicatat di kasir sebagai metode pembayaran.",
      },
      { type: "h2", text: "5. Menu QR code" },
      {
        type: "p",
        text: "Menu QR di meja menghemat biaya cetak menu dan mudah diperbarui. Halaman toko Epidom, dengan menu, foto, pilihan ukuran, tombol habis, dan QR code yang bisa dicetak, gratis selamanya. Biayanya hanya cetak stiker atau tatakan meja, kisaran perkiraan Rp 2.000 sampai Rp 10.000 per buah, tergantung bahan.",
      },
      {
        type: "p",
        text: "Perlu diingat, menu QR di paket gratis menampilkan menu dan mengarahkan pelanggan ke WhatsApp. Pesanan online dari meja ada di paket POS (uji coba gratis 14 hari), dan pembayarannya tetap di kasir. Detail pembuatannya ada di panduan menu QR code gratis.",
      },
      { type: "h2", text: "6. Internet dan cadangan" },
      {
        type: "p",
        text: "Internet adalah urat nadi kafe modern, tapi jaringan bisa putus kapan saja. Siapkan lapisan pengaman:",
      },
      {
        type: "list",
        items: [
          "Internet WiFi utama dari penyedia dengan paket yang stabil: kisaran perkiraan Rp 300 ribu sampai Rp 600 ribu per bulan",
          "Kuota data di HP sebagai cadangan, bisa dibagikan sebagai hotspot kalau WiFi mati",
          "Mode offline di kasir. Di paket POS, kasir tetap bisa berjualan tanpa internet. Penjualan disimpan di perangkat dan tersinkron saat koneksi kembali, dengan waktu transaksi yang asli",
          "Router yang diletakkan dekat kasir, bukan di ruang belakang",
        ],
      },
      { type: "h2", text: "Ringkasan kisaran biaya awal" },
      {
        type: "p",
        text: "Sebagai gambaran kasar, dengan angka tengah dari kisaran di atas, sisi perangkat dan aplikasi untuk satu kafe kecil kira-kira:",
      },
      {
        type: "list",
        items: [
          "Perangkat kasir dan dudukan: sekitar Rp 2 juta sampai Rp 4 juta",
          "Printer struk dan kertas: sekitar Rp 0,5 juta sampai Rp 1 juta",
          "Layar dapur (kalau perlu): sekitar Rp 1,5 juta sampai Rp 3 juta",
          "Cetak QR code dan stiker QRIS: sekitar Rp 100 ribu sampai Rp 300 ribu",
          "Aplikasi: halaman toko dan menu QR gratis; kasir POS mulai Rp 229.000 per bulan (Rp 189.000 per bulan kalau bayar tahunan), setelah uji coba gratis 14 hari",
        ],
      },
      {
        type: "p",
        text: "Jumlahnya sekali lagi perkiraan. Kafe yang memakai perangkat yang sudah dimiliki bisa menekan biayanya jauh lebih rendah. Harga paket Epidom belum termasuk pajak.",
      },
      { type: "h2", text: "Urutan setup yang masuk akal" },
      {
        type: "list",
        items: [
          "Tentukan konsep dan menu dulu. Aplikasi dan alat mengikuti menu, bukan sebaliknya.",
          "Ajukan QRIS ke bank atau penyedia pembayaran sedini mungkin karena verifikasinya butuh waktu.",
          "Buat halaman toko dengan menu, foto, jam buka, dan QR code, lalu cetak untuk meja.",
          "Siapkan perangkat kasir dan masukkan menu ke kasir. Mulai dari menu terlaris, lalu tambahkan sisanya.",
          "Sambungkan printer struk dan coba cetak. Tes semua jenis pesanan: makan di tempat, bungkus, dan pembayaran campuran.",
          "Lakukan latihan buka: minta teman datang sebagai pelanggan, uji pesanan, pembayaran, dan struk.",
          "Pasang cadangan internet dan uji dengan mematikan WiFi sebentar.",
          "Setelah ramai, tambahkan layar dapur, printer dapur, dan fitur stok serta resep (paket Operations) bila memang dibutuhkan.",
        ],
      },
      { type: "h2", text: "Kesalahan yang sering terjadi" },
      {
        type: "list",
        items: [
          "Membeli perangkat mahal sebelum tahu kebutuhannya. Mulai sederhana dan tambah saat terasa kurang",
          "Lupa mengajukan QRIS terlalu mepet hari buka",
          "Tidak menguji printer dan kasir dengan pesanan nyata sebelum buka",
          "Tidak punya cadangan internet atau power bank",
          "Meletakkan printer thermal di tempat panas sehingga kertas cepat rusak",
          "Menganggap menu QR di paket gratis sudah bisa menerima pesanan online",
          "Tidak melatih karyawan sebelum hari pertama",
        ],
      },
      {
        type: "p",
        text: "Modal paling berharga di hari pertama bukan perangkat termahal, melainkan alur yang sudah diuji: pelanggan datang, memesan, membayar, menerima struk, dan dapur tahu apa yang harus dibuat. Susun perlahan, uji sebelum buka, dan tambah perangkat saat usahamu benar-benar membutuhkannya.",
      },
    ],
  },
];
