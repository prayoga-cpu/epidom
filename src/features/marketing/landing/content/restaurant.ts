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
  {
    slug: "restaurant-pos-system-th",
    locale: "th",
    group: "restaurant",
    kind: "vertical",
    metaTitle: "ระบบ POS ร้านอาหาร: โต๊ะ ครัว และสต็อก",
    metaDescription:
      "ระบบ POS ร้านอาหารพร้อมจัดการโต๊ะ จอครัว แยกจ่ายหลายวิธี ค่าบริการและภาษี โหมดออฟไลน์ แพ็กเกจ POS เริ่มต้น $14.99 ต่อเดือน",
    eyebrow: "POS ร้านอาหาร",
    h1: "ระบบ POS ร้านอาหาร: โต๊ะ ครัว และสต็อกในระบบเดียว",
    lede: "ร้านอาหารต้องการระบบขายที่เข้าใจโต๊ะ ตั๋วออเดอร์ในครัว และการแยกจ่าย ไม่ใช่แค่เครื่องคิดเลข ต่อไปนี้คือสิ่งที่ต้องมี และวิธีที่ Epidom จัดการ",
    blocks: [
      {
        type: "h2",
        text: "ระบบ POS ร้านอาหารต่างจากระบบขายหน้าร้านทั่วไปอย่างไร",
      },
      {
        type: "p",
        text: "ในร้านค้าทั่วไป ลูกค้าเลือกสินค้า ชำระเงิน แล้วก็กลับไป แต่ในร้านอาหาร ออเดอร์ถูกสร้างก่อน แล้วปรุง เสิร์ฟ และชำระเงินเมื่อจบมื้อ โต๊ะเดียวอาจสั่งเพิ่มสามรอบ แล้วขอแยกบิล ระบบ POS ร้านอาหารจึงต้องเก็บออเดอร์ให้เปิดค้างไว้ ส่งเข้าครัว และปิดออเดอร์เมื่อชำระเงินเสร็จเท่านั้น",
      },
      { type: "h2", text: "ฟีเจอร์ที่เจ้าของร้านอาหารมองหา" },
      {
        type: "list",
        items: [
          "การจัดการโต๊ะและโซน (ในร้าน กลางแจ้ง ชั้นบน): ออเดอร์รายโต๊ะ ย้ายโต๊ะ รวมโต๊ะ",
          "ออเดอร์ทานที่ร้านแสดงบนจอครัวทันที พร้อมสถานะของแต่ละรายการ",
          "ตั๋วออเดอร์ครัวและตั๋วบาร์จากเครื่องพิมพ์คนละเครื่อง",
          "แยกจ่ายหลายวิธี: ออเดอร์เดียวชำระได้หลายวิธี เช่น บางส่วนเป็นเงินสดและบางส่วนเป็นบัตร",
          "ค่าบริการและภาษีที่ตั้งเป็นพรีเซ็ตไว้ จึงไม่ต้องคำนวณเอง",
          "ออเดอร์ออนไลน์จากหน้าร้านออนไลน์ เข้าคิวเดียวกับออเดอร์ที่โต๊ะ",
          "ขายต่อได้แม้อินเทอร์เน็ตหลุด",
        ],
      },
      { type: "h2", text: "จากโต๊ะสู่ครัว: ขั้นตอนใน Epidom" },
      {
        type: "steps",
        items: [
          {
            title: "เลือกโต๊ะ",
            text: "แคชเชียร์หรือพนักงานเสิร์ฟเปิดโต๊ะในโซนที่ถูกต้อง แล้วเลือกเมนูตามหมวดหมู่หรือค้นหา",
          },
          {
            title: "ส่งเข้าครัวและบาร์",
            text: "ออเดอร์ขึ้นบนจอครัวแบบเรียลไทม์พร้อมเสียงแจ้งเตือน เครื่องดื่มพิมพ์เป็นตั๋วบาร์ได้ ส่วนอาหารพิมพ์เป็นตั๋วครัว",
          },
          {
            title: "ติดตามสถานะ",
            text: "คิวออเดอร์เดินจาก ใหม่ กำลังทำ พร้อมเสิร์ฟ ไปจนถึง เสิร์ฟแล้ว พนักงานเสิร์ฟจึงรู้ว่าต้องนำไปเสิร์ฟเมื่อไร",
          },
          {
            title: "ชำระเงินและพิมพ์ใบเสร็จ",
            text: "บิลคำนวณค่าบริการและภาษีตามพรีเซ็ต ชำระได้หลายวิธี แล้วพิมพ์ใบเสร็จผ่านเครื่องพิมพ์บลูทูธ 58 mm หรือ 80 mm หรือส่งทางอีเมล",
          },
        ],
      },
      {
        type: "callout",
        text: "ตัวอย่าง: บิลโต๊ะ 6 เป็นค่าอาหาร เมื่อตั้งพรีเซ็ตค่าบริการ 10% และภาษีมูลค่าเพิ่ม (VAT) 7% ระบบจะคำนวณยอดรวมให้อัตโนมัติ จากนั้นลูกค้าสี่คนจ่ายแยกกันได้ สองคนจ่ายเงินสด สองคนจ่ายบัตร โดยไม่ต้องใช้เครื่องคิดเลข เปอร์เซ็นต์ในที่นี้เป็นเพียงตัวอย่าง ให้ตั้งค่าตามข้อกำหนดของร้านคุณ",
      },
      {
        type: "h2",
        text: "จอครัวและเครื่องพิมพ์: เลือกให้เหมาะกับขนาดร้าน",
      },
      {
        type: "p",
        text: "แพ็กเกจ POS มีจอครัวหนึ่งจอ หากครัวและบาร์แยกกัน และต้องการส่งตั๋วออเดอร์ไปยังหลายจอตามสเตชัน ฟีเจอร์นั้นอยู่ในแพ็กเกจ Operations เครื่องพิมพ์ใบเสร็จ ตั๋วครัว ตั๋วบาร์ และฉลากรายการ ติดตั้งพร้อมกันได้บนเครื่องคิดเงินเครื่องเดียว",
      },
      { type: "h2", text: "ออเดอร์ออนไลน์และโหมดออฟไลน์" },
      {
        type: "p",
        text: "ลูกค้าสั่งจากหน้าร้านออนไลน์ของคุณได้ (ทานที่ร้านโดยระบุหมายเลขโต๊ะ กลับบ้าน หรือเดลิเวอรี) และจองโต๊ะได้ ขณะนี้ออเดอร์จากหน้าร้านออนไลน์มีสถานะชำระที่แคชเชียร์ แคชเชียร์จะได้รับเสียงเตือนและการแจ้งเตือน แล้วทำเครื่องหมายว่าชำระแล้ว หากอินเทอร์เน็ตหลุดในช่วงเร่งด่วน แคชเชียร์ยังขายต่อได้ ธุรกรรมจะถูกเก็บไว้ในอุปกรณ์และซิงค์เมื่อเชื่อมต่อกลับมา พร้อมเวลาธุรกรรมจริง",
      },
      { type: "h2", text: "พนักงานและสต็อกในแพ็กเกจ Operations" },
      {
        type: "p",
        text: "เมื่อเครื่องคิดเงินใช้งานได้แล้ว ปัญหาถัดไปมักเป็นเรื่องพนักงานและวัตถุดิบ Operations เพิ่มบทบาท (ผู้จัดการ แคชเชียร์ ครัว พนักงานเสิร์ฟ) การลงเวลาด้วย PIN ตารางงาน กะพร้อมการนับเงินสด สูตรที่คิดต้นทุนอัตโนมัติรายเมนู สต็อกที่ตัดเมื่อออเดอร์เสร็จ และการแจ้งเตือนสต็อกใกล้หมด ราคา: POS $14.99 ต่อเดือน ($12.49 ต่อเดือน เมื่อชำระรายปี) Operations $29.99 ต่อเดือน ($24.99 เมื่อชำระรายปี)",
      },
    ],
    faqs: [
      {
        q: "ระบบ POS ร้านอาหารของ Epidom จัดการโต๊ะได้ไหม",
        a: "ได้ แพ็กเกจ POS มีโต๊ะและโซน คุณกำหนดออเดอร์ให้โต๊ะ ย้ายโต๊ะ และรวมโต๊ะได้ ออเดอร์ของโต๊ะแสดงในคิวและบนจอครัว",
      },
      {
        q: "แยกบิลในร้านอาหารอย่างไร",
        a: "ออเดอร์เดียวชำระได้หลายวิธีพร้อมกัน (แยกจ่ายหลายวิธี) แคชเชียร์บันทึกการชำระแต่ละรายการจนกว่าบิลจะครบ",
      },
      {
        q: "ใช้งานได้โดยไม่มีอินเทอร์เน็ตไหม",
        a: "ได้ โหมดออฟไลน์ทำให้แคชเชียร์ขายต่อได้ ยอดขายจะถูกเก็บไว้ในอุปกรณ์และซิงค์อัตโนมัติเมื่ออินเทอร์เน็ตกลับมา",
      },
      {
        q: "ระบบ POS ร้านอาหารของ Epidom ราคาเท่าไร",
        a: "POS $14.99 ต่อเดือน ($12.49 ต่อเดือน เมื่อชำระรายปี) พร้อมทดลองใช้ฟรี 14 วัน แพ็กเกจ Operations $29.99 ต่อเดือน ($24.99 เมื่อชำระรายปี) เพิ่มพนักงาน สต็อก สูตร และรายงานการเงิน ราคายังไม่รวมภาษี",
      },
      {
        q: "หนึ่งแพ็กเกจใช้กับหลายสาขาได้ไหม",
        a: "POS สำหรับหนึ่งสาขา Operations รองรับสูงสุด 3 สาขา พร้อมมุมมองการเงินรวมทุกสาขา สำหรับ 4 สาขาขึ้นไป มี Enterprise พร้อมใบเสนอราคาเฉพาะ",
      },
    ],
    cta: {
      title: "ลองใช้ระบบ POS ร้านอาหารด้วยตัวคุณเอง",
      text: "POS ทดลองใช้ฟรี 14 วัน ตั้งค่าโต๊ะ เมนู และจอครัว แล้วลองเปิดให้บริการหนึ่งวันก่อนตัดสินใจ",
      button: "เริ่มทดลองใช้ 14 วัน →",
      target: "trial",
    },
    updated: "2026-10-14",
  },
];
