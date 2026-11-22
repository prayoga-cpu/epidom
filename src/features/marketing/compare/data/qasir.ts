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
  th: {
    slug: "qasir",
    eyebrow: "Epidom vs. Qasir",
    titleParts: [
      "Qasir เป็นที่รู้จักในร้านค้าอินโดนีเซีย",
      "Epidom เพิ่มหน้าร้านออนไลน์ของคุณเอง",
    ],
    lede: "Qasir เป็นแอปแคชเชียร์จากอินโดนีเซียที่ธุรกิจขนาดเล็กรู้จักดี มีการจัดการสต็อก สิทธิ์การเข้าถึงของพนักงาน การลงเวลา และชุดฮาร์ดแวร์ Android ที่ Qasir จำหน่ายเอง ส่วน Epidom เหมาะเมื่อคุณต้องการหน้าร้านออนไลน์ฟรีที่มีเมนูของคุณ การสั่งอาหารออนไลน์จากหน้านั้น (แพ็กเกจ POS) และแอปบนเบราว์เซอร์ที่ใช้กับอุปกรณ์ที่คุณมีอยู่แล้ว",
    colCompetitor: "Qasir",
    rows: [
      {
        feature: "ราคาแพ็กเกจ",
        epidom: "POS: $14.99/เดือน ($12.49/เดือน เมื่อชำระรายปี) ก่อนภาษี",
        competitor: "Pro: Rp699,000 ต่อ 12 เดือน (แสดงควบคู่กับ Rp899,000) ไม่รวมภาษี",
      },
      {
        feature: "แพ็กเกจฟรี / ทดลองใช้",
        epidom: "หน้าร้านออนไลน์ฟรีตลอดไป POS ทดลองใช้ฟรี 14 วัน",
        competitor: "ทดลองใช้ Qasir Pro 7 วันสำหรับผู้สมัครใหม่ จากนั้นเป็นแบบสมัครสมาชิก",
      },
      {
        feature: "สต็อกและต้นทุนสูตร (HPP)",
        epidom: "แพ็กเกจ Operations ($29.99/เดือน): สูตร ต้นทุนต่อเมนู สต็อกอัตโนมัติ",
        competitor: "Pro รวมการจัดการสต็อก สินค้า และวัตถุดิบ",
      },
      {
        feature: "พนักงานและตารางงาน",
        epidom: "Operations: บทบาท การลงเวลาด้วย PIN ตารางงาน การลงเวลาด้วยเซลฟีและตำแหน่งที่ตั้ง",
        competitor: "สิทธิ์การเข้าถึงของพนักงานและการลงเวลาใน Pro",
      },
      {
        feature: "ฮาร์ดแวร์",
        epidom: "เบราว์เซอร์บนโทรศัพท์ แท็บเล็ต หรือคอมพิวเตอร์ เครื่องพิมพ์ Bluetooth ขนาด 58 mm และ 80 mm",
        competitor: "Qasir จำหน่ายชุดแท็บเล็ต Android (รวม Qasir Pro) และเครื่องพิมพ์",
      },
    ],
    note: "ข้อมูลของ Qasir ตรวจสอบบนเว็บไซต์ทางการของพวกเขา (qasir.id/qasir-pro และ qasir.id/perangkat) ในเดือนตุลาคม 2026 เปรียบเทียบเฉพาะข้อเท็จจริงที่ยืนยันได้ต่อสาธารณะ ราคาและฟีเจอร์อาจเปลี่ยนแปลง โปรดตรวจสอบเว็บไซต์ของพวกเขาเพื่อดูข้อมูลล่าสุด",
    faqEyebrow: "คำถามที่พบบ่อย",
    faqTitle: "Epidom vs Qasir",
    faqs: [
      {
        q: "Qasir มีแพ็กเกจฟรีหรือไม่",
        a: "หน้า Qasir Pro ปัจจุบันระบุว่าทดลองใช้ 7 วันสำหรับผู้สมัครใหม่ จากนั้นเป็นการสมัครสมาชิก Pro หรือ Pro Plus และไม่ได้อธิบายถึงแพ็กเกจฟรีถาวร ส่วนที่ Epidom หน้าร้านออนไลน์ที่มีเมนูของคุณฟรีตลอดไป ขณะที่ POS เป็นการสมัครสมาชิกหลังทดลองใช้ 14 วัน",
      },
      {
        q: "อันไหนถูกกว่ากัน",
        a: "เปรียบเทียบราคาโดยตรงไม่ได้ Qasir Pro แสดงที่ Rp699,000 ต่อ 12 เดือน (ไม่รวมภาษี) ส่วน Epidom POS ราคา $14.99 ต่อเดือน ($12.49 ต่อเดือน เมื่อชำระรายปี ก่อนภาษี) ซึ่งเป็นคนละสกุลเงิน และสิ่งที่รวมอยู่ในแพ็กเกจก็ต่างกัน จึงควรเปรียบเทียบฟีเจอร์ที่คุณต้องการ",
      },
      {
        q: "ต้องซื้อแท็บเล็ตรุ่นเฉพาะหรือไม่",
        a: "Epidom ทำงานบนเบราว์เซอร์ในโทรศัพท์ แท็บเล็ต หรือคอมพิวเตอร์ที่คุณมีอยู่แล้ว และติดตั้งเป็นแอปได้ด้วย ส่วน Qasir จำหน่ายชุดแท็บเล็ต Android และเครื่องพิมพ์ เรายังไม่ได้ตรวจสอบข้อกำหนดด้านอุปกรณ์ของพวกเขา โปรดสอบถาม Qasir โดยตรง",
      },
      {
        q: "เมื่อไรที่ Qasir เหมาะกว่า",
        a: "หากคุณต้องการแคชเชียร์บน Android พร้อมฮาร์ดแวร์จากผู้ให้บริการรายเดียว รวมถึงสต็อกและการลงเวลา Qasir ก็น่าพิจารณา Epidom เหมาะเมื่อคุณต้องการหน้าร้านออนไลน์ของตัวเอง การสั่งอาหารออนไลน์ และการคำนวณต้นทุนสูตร",
      },
    ],
    ctaTitle: "เริ่มต้นด้วยหน้าร้านออนไลน์ฟรี",
    ctaButton: "ทดลองใช้ POS ฟรี 14 วัน →",
  },
};
