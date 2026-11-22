import type { Locale } from "@/components/lang/i18n-provider";
import type { CompetitorComparisonData } from "../types";

// Facts verified against klikit.io (2026-08): pricing is "flexible" /
// custom-quoted, not public; they do advertise a zero-commission "Owned
// Channel" branded ordering website. Do not add claims beyond what's
// confirmed there.
// Epidom column corrected 2026-10-14: only the storefront page is free; online
// ordering is a POS-plan feature (14-day trial). No setup-time claims.
export const klikitComparison: Partial<Record<Locale, CompetitorComparisonData>> = {
  id: {
    slug: "klikit",
    eyebrow: "Epidom vs. Klikit",
    titleParts: ["Klikit: kuat di aggregator,", "custom quote. Epidom: harga jelas dari awal."],
    lede: "Klikit punya dashboard aggregator yang kuat buat gabungin pesanan dari banyak platform, dan bahkan sudah nawarin \"Owned Channel\" tanpa komisi. Bedanya: harga Klikit disesuaikan per merchant lewat penawaran khusus, sementara harga Epidom publik dan sama buat semua orang.",
    colCompetitor: "Klikit",
    rows: [
      { feature: "Transparansi harga", epidom: "Harga publik, sama buat semua merchant", competitor: "Disesuaikan per merchant, hubungi sales buat penawaran" },
      { feature: "Toko online tanpa komisi", epidom: "Termasuk paket POS (Rp 229.000/bulan, uji coba 14 hari)", competitor: "Ada (\"Owned Channel\"), bagian dari paket custom" },
      { feature: "Setup", epidom: "Self-serve, tanpa demo", competitor: "Proses onboarding lewat sales/demo" },
      { feature: "Cocok buat", epidom: "Warung/kafe satu outlet yang baru mulai online", competitor: "Bisnis dengan pesanan dari banyak platform aggregator sekaligus" },
    ],
    note: "Data Klikit diambil dari klikit.io per Agustus 2026. Klikit nggak mempublikasikan harga di situsnya — bandingan di atas soal transparansi dan cara akses, bukan perbandingan fitur lengkap.",
    faqEyebrow: "Pertanyaan",
    faqTitle: "Epidom vs Klikit",
    faqs: [
      {
        q: "Kapan Klikit lebih masuk akal dibanding Epidom?",
        a: "Kalau bisnis kamu udah gede dan pesanan datang dari banyak platform aggregator sekaligus (GrabFood, GoFood, Foodpanda, dll di satu dashboard), fitur konsolidasi Klikit memang dirancang buat itu.",
      },
      {
        q: "Apa Epidom juga bisa gabungin pesanan dari banyak platform?",
        a: "Epidom fokus di toko online milik sendiri plus kasir dan operasional — bukan dashboard konsolidasi aggregator multi-platform seperti Klikit.",
      },
    ],
    ctaTitle: "Harga jelas, nggak perlu nunggu penawaran.",
    ctaButton: "Mulai gratis →",
  },
  en: {
    slug: "klikit",
    eyebrow: "Epidom vs. Klikit",
    titleParts: ["Klikit: strong on aggregator ops,", "custom-quoted. Epidom: clear pricing upfront."],
    lede: "Klikit has a strong aggregator dashboard for consolidating orders across platforms, and already offers a zero-commission \"Owned Channel\" too. The difference: Klikit's pricing is tailored per merchant through a custom quote, while Epidom's pricing is public and the same for everyone.",
    colCompetitor: "Klikit",
    rows: [
      { feature: "Pricing transparency", epidom: "Public pricing, same for every merchant", competitor: "Tailored per merchant, contact sales for a quote" },
      { feature: "Zero-commission storefront", epidom: "Included in the POS plan (Rp 229,000/month, 14-day trial)", competitor: "Available (\"Owned Channel\"), part of a custom plan" },
      { feature: "Setup", epidom: "Self-serve, no demo", competitor: "Sales/demo-driven onboarding" },
      { feature: "Best fit for", epidom: "Single-outlet cafés/warungs just getting started online", competitor: "Businesses juggling orders from many aggregator platforms at once" },
    ],
    note: "Klikit facts sourced from klikit.io as of August 2026. Klikit doesn't publish pricing on its site — the comparison above is about transparency and access, not a full feature match.",
    faqEyebrow: "Questions",
    faqTitle: "Epidom vs Klikit",
    faqs: [
      {
        q: "When does Klikit make more sense than Epidom?",
        a: "If your business is already sizeable and orders come in from many aggregator platforms at once (GrabFood, GoFood, Foodpanda, etc. in one dashboard), Klikit's consolidation features are built for exactly that.",
      },
      {
        q: "Can Epidom also consolidate orders across platforms?",
        a: "Epidom focuses on your own storefront plus cashier and operations — not a multi-platform aggregator consolidation dashboard like Klikit's.",
      },
    ],
    ctaTitle: "Clear pricing, no quote required.",
    ctaButton: "Start free →",
  },
  th: {
    slug: "klikit",
    eyebrow: "Epidom เทียบกับ Klikit",
    titleParts: ["Klikit: เก่งเรื่องการจัดการ aggregator", "ราคาเสนอเป็นรายราย Epidom: ราคาชัดเจนตั้งแต่แรก"],
    lede: "Klikit มีแดชบอร์ด aggregator ที่แข็งแกร่งสำหรับรวมออเดอร์จากหลายแพลตฟอร์ม และมี \"Owned Channel\" แบบไม่เสียค่าคอมมิชชันอยู่แล้วด้วย ความต่างคือ ราคาของ Klikit ปรับตามผู้ประกอบการแต่ละรายผ่านใบเสนอราคาเฉพาะ ส่วนราคาของ Epidom เปิดเผยต่อสาธารณะและเท่ากันสำหรับทุกคน",
    colCompetitor: "Klikit",
    rows: [
      { feature: "ความโปร่งใสด้านราคา", epidom: "ราคาเปิดเผยต่อสาธารณะ เท่ากันสำหรับทุกร้าน", competitor: "ปรับตามร้านแต่ละราย ติดต่อฝ่ายขายเพื่อขอใบเสนอราคา" },
      { feature: "หน้าร้านออนไลน์ที่ไม่เสียค่าคอมมิชชัน", epidom: "รวมอยู่ในแพ็กเกจ POS (Rp 229,000/เดือน ทดลองใช้ 14 วัน)", competitor: "มี (\"Owned Channel\") เป็นส่วนหนึ่งของแพ็กเกจแบบกำหนดเอง" },
      { feature: "การตั้งค่า", epidom: "ตั้งค่าเองได้ ไม่ต้องมีการสาธิต", competitor: "การเริ่มใช้งานผ่านฝ่ายขายและการสาธิต" },
      { feature: "เหมาะกับ", epidom: "คาเฟ่/warung สาขาเดียวที่เพิ่งเริ่มขายออนไลน์", competitor: "ธุรกิจที่ต้องรับออเดอร์จากแพลตฟอร์ม aggregator หลายเจ้าพร้อมกัน" },
    ],
    note: "ข้อมูลของ Klikit มาจาก klikit.io ณ เดือนสิงหาคม 2026 Klikit ไม่เผยแพร่ราคาบนเว็บไซต์ การเปรียบเทียบข้างต้นจึงเป็นเรื่องความโปร่งใสและวิธีเข้าถึง ไม่ใช่การเทียบฟีเจอร์ครบทุกด้าน",
    faqEyebrow: "คำถาม",
    faqTitle: "Epidom เทียบกับ Klikit",
    faqs: [
      {
        q: "เมื่อไรที่ Klikit เหมาะกว่า Epidom",
        a: "หากธุรกิจของคุณมีขนาดใหญ่แล้วและมีออเดอร์เข้ามาจากแพลตฟอร์ม aggregator หลายเจ้าพร้อมกัน (GrabFood, GoFood, Foodpanda ฯลฯ ในแดชบอร์ดเดียว) ฟีเจอร์การรวมออเดอร์ของ Klikit สร้างมาเพื่อการนี้โดยเฉพาะ",
      },
      {
        q: "Epidom รวมออเดอร์จากหลายแพลตฟอร์มได้ด้วยหรือไม่",
        a: "Epidom เน้นหน้าร้านออนไลน์ของคุณเอง พร้อมระบบแคชเชียร์และการดำเนินงาน ไม่ใช่แดชบอร์ดรวมออเดอร์จาก aggregator หลายแพลตฟอร์มแบบของ Klikit",
      },
    ],
    ctaTitle: "ราคาชัดเจน ไม่ต้องรอใบเสนอราคา",
    ctaButton: "เริ่มต้นฟรี →",
  },
};
