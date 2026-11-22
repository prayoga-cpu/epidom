import type { Locale } from "@/components/lang/i18n-provider";
import type { CompetitorComparisonData } from "../types";

// Facts checked 2026-10 on https://www.popina.com (home page, official site only):
// - Basic Pack, Starter Pack ("point d'encaissement complet") and Premium Pack are
//   named; the word "prix" does not appear on the page; demo offered ("Demande une
//   démo"); "Sans engagement, ni carte bleue".
// - T-ONE order-taking and payment terminal; "encaissement en mode hors-ligne".
// - Menu items: "Gestion des stocks avancée", "Planning travail", Click & Collect
//   under "Commande à distance".
// popina.com/tarifs returns 403 to our fetch, so no pricing page was read and no
// price is compared. Third-party sites: not used. Do not add claims beyond the above.
export const popinaComparison: Partial<Record<Locale, CompetitorComparisonData>> = {
  fr: {
    slug: "popina",
    eyebrow: "Epidom vs. Popina",
    titleParts: [
      "Popina : une caisse avec son terminal.",
      "Epidom : prix affichés, sur navigateur.",
    ],
    lede: "Popina propose une solution de caisse avec un terminal de prise de commande et de paiement (le T-ONE), l'encaissement hors ligne, la gestion des stocks et un planning de travail. Sa page d'accueil présente des packs (Basic, Starter, Premium) sans afficher de prix. Epidom fonctionne dans le navigateur, sans terminal imposé, et publie ses prix.",
    colCompetitor: "Popina",
    rows: [
      {
        feature: "Matériel",
        epidom: "Navigateur sur téléphone, tablette ou ordinateur ; imprimantes Bluetooth ESC/POS",
        competitor: "Terminal de prise de commande et de paiement T-ONE",
      },
      {
        feature: "Mode hors ligne",
        epidom: "Inclus dans POS : les ventes sont gardées puis synchronisées",
        competitor: "Encaissement hors ligne sur le T-ONE",
      },
      {
        feature: "Stocks et coût de revient",
        epidom: "Dans Operations : recettes, coût par plat, alertes de stock",
        competitor: "« Gestion des stocks avancée » listée",
      },
      {
        feature: "Planning du personnel",
        epidom: "Dans Operations : planning, pointage, heures vs planning",
        competitor: "« Planning travail » listé dans leur menu",
      },
      {
        feature: "Commande en ligne",
        epidom: "Dans POS : depuis votre page, paiement à la caisse",
        competitor: "Click & Collect listé sous « Commande à distance »",
      },
    ],
    note: "Données Popina vérifiées sur le site officiel (popina.com) en octobre 2026 ; leur page tarifs n'a pas pu être consultée, aucun prix n'est donc comparé. Comparaison limitée aux faits publiquement confirmés.",
    faqEyebrow: "Questions",
    faqTitle: "Epidom vs Popina",
    faqs: [
      {
        q: "Combien coûte Popina ?",
        a: "Nous n'avons pas pu consulter leur page tarifs, et leur page d'accueil n'affiche pas de prix ; nous ne comparons donc aucun chiffre. Chez Epidom, POS est à 13,99 € par mois (avant taxes), avec 14 jours d'essai.",
      },
      {
        q: "Faut-il acheter un terminal avec Epidom ?",
        a: "Non, Epidom tourne dans le navigateur sur le téléphone, la tablette ou l'ordinateur que vous avez déjà, avec des imprimantes Bluetooth de tickets si vous le souhaitez. Si vous préférez un terminal de prise de commande et de paiement fourni, Popina peut mieux vous convenir.",
      },
      {
        q: "Les deux fonctionnent-ils sans internet ?",
        a: "Oui : Popina indique l'encaissement en mode hors ligne sur son terminal T-ONE, et le POS d'Epidom continue de vendre hors ligne puis synchronise les ventes au retour de la connexion.",
      },
      {
        q: "Popina ou Epidom pour mon café ?",
        a: "Si vous voulez un terminal fourni avec la solution, Popina est une option à considérer. Si vous voulez voir les prix, commencer par une vitrine gratuite et suivre stocks, recettes et personnel dans un seul outil, essayez Epidom.",
      },
    ],
    ctaTitle: "Commencez par la vitrine gratuite.",
    ctaButton: "Essayer le POS 14 jours gratuitement →",
  },
  en: {
    slug: "popina",
    eyebrow: "Epidom vs. Popina",
    titleParts: [
      "Popina: a register with its own terminal.",
      "Epidom: public prices, in the browser.",
    ],
    lede: "Popina offers a POS solution with an order-taking and payment terminal (the T-ONE), offline payment, stock management and a work schedule. Its home page presents packs (Basic, Starter, Premium) without showing prices. Epidom runs in the browser, needs no set terminal, and publishes its prices.",
    colCompetitor: "Popina",
    rows: [
      {
        feature: "Hardware",
        epidom: "Browser on a phone, tablet or computer; Bluetooth ESC/POS printers",
        competitor: "T-ONE order-taking and payment terminal",
      },
      {
        feature: "Offline mode",
        epidom: "Included in POS: sales are kept, then synced",
        competitor: "Offline payment on the T-ONE",
      },
      {
        feature: "Stock and recipe cost",
        epidom: "In Operations: recipes, cost per dish, low-stock alerts",
        competitor: '"Advanced stock management" listed',
      },
      {
        feature: "Staff scheduling",
        epidom: "In Operations: roster, clock-in, hours vs. roster",
        competitor: '"Planning travail" listed in their menu',
      },
      {
        feature: "Online ordering",
        epidom: "In POS: from your own page, pay at the cashier",
        competitor: 'Click & Collect listed under "Commande à distance"',
      },
    ],
    note: "Popina facts checked on the official site (popina.com) in October 2026; their pricing page could not be read, so no prices are compared. Comparison limited to publicly confirmed facts.",
    faqEyebrow: "Questions",
    faqTitle: "Epidom vs Popina",
    faqs: [
      {
        q: "How much does Popina cost?",
        a: "We could not read their pricing page, and their home page shows no prices, so we compare no figures. At Epidom, POS is $14.99 per month (before tax), with a 14-day trial.",
      },
      {
        q: "Do I need to buy a terminal with Epidom?",
        a: "No. Epidom runs in the browser on the phone, tablet or computer you already have, with Bluetooth receipt printers if you want them. If you prefer a supplied order-taking and payment terminal, Popina may suit you better.",
      },
      {
        q: "Do both work without internet?",
        a: "Yes: Popina lists offline payment on its T-ONE, and Epidom's POS keeps selling offline and syncs sales when the connection returns.",
      },
      {
        q: "Popina or Epidom for my café?",
        a: "If you want a terminal supplied with the solution, Popina is an option to consider. If you want visible prices, a free storefront to start, and stock, recipes and staff in one tool, try Epidom.",
      },
    ],
    ctaTitle: "Start with the free storefront.",
    ctaButton: "Try the POS free for 14 days →",
  },
  th: {
    slug: "popina",
    eyebrow: "Epidom vs. Popina",
    titleParts: [
      "Popina: เครื่องคิดเงินพร้อมเทอร์มินัลของตัวเอง",
      "Epidom: ราคาเปิดเผย ใช้งานบนเบราว์เซอร์",
    ],
    lede: "Popina มีโซลูชัน POS พร้อมเทอร์มินัลรับออเดอร์และรับชำระเงิน (T-ONE) รองรับการชำระเงินแบบออฟไลน์ การจัดการสต็อก และตารางงาน หน้าแรกของพวกเขาแสดงแพ็ก (Basic, Starter, Premium) โดยไม่แสดงราคา ส่วน Epidom ทำงานบนเบราว์เซอร์ ไม่ต้องใช้เทอร์มินัลเฉพาะ และเปิดเผยราคา",
    colCompetitor: "Popina",
    rows: [
      {
        feature: "ฮาร์ดแวร์",
        epidom: "เบราว์เซอร์บนโทรศัพท์ แท็บเล็ต หรือคอมพิวเตอร์ เครื่องพิมพ์ Bluetooth ESC/POS",
        competitor: "เทอร์มินัลรับออเดอร์และรับชำระเงิน T-ONE",
      },
      {
        feature: "โหมดออฟไลน์",
        epidom: "รวมอยู่ใน POS: เก็บยอดขายไว้ แล้วซิงก์ภายหลัง",
        competitor: "ชำระเงินแบบออฟไลน์บน T-ONE",
      },
      {
        feature: "สต็อกและต้นทุนสูตร",
        epidom: "ใน Operations: สูตร ต้นทุนต่อเมนู การแจ้งเตือนสต็อกใกล้หมด",
        competitor: "ระบุว่ามี \"Advanced stock management\"",
      },
      {
        feature: "ตารางงานพนักงาน",
        epidom: "ใน Operations: ตารางงาน การลงเวลา ชั่วโมงทำงานเทียบกับตารางงาน",
        competitor: "ระบุ \"Planning travail\" ไว้ในเมนูของพวกเขา",
      },
      {
        feature: "การสั่งอาหารออนไลน์",
        epidom: "ใน POS: จากหน้าของคุณเอง ชำระเงินที่แคชเชียร์",
        competitor: "ระบุ Click & Collect ไว้ภายใต้ \"Commande à distance\"",
      },
    ],
    note: "ข้อมูลของ Popina ตรวจสอบบนเว็บไซต์ทางการ (popina.com) ในเดือนตุลาคม 2026 ไม่สามารถอ่านหน้าราคาของพวกเขาได้ จึงไม่เปรียบเทียบราคา การเปรียบเทียบจำกัดอยู่เฉพาะข้อเท็จจริงที่ยืนยันได้ต่อสาธารณะ",
    faqEyebrow: "คำถามที่พบบ่อย",
    faqTitle: "Epidom vs Popina",
    faqs: [
      {
        q: "Popina ราคาเท่าไหร่",
        a: "เราไม่สามารถอ่านหน้าราคาของพวกเขาได้ และหน้าแรกก็ไม่แสดงราคา จึงไม่เปรียบเทียบตัวเลข ส่วนที่ Epidom แพ็กเกจ POS ราคา $14.99 ต่อเดือน (ก่อนภาษี) พร้อมทดลองใช้ 14 วัน",
      },
      {
        q: "ต้องซื้อเทอร์มินัลเมื่อใช้ Epidom หรือไม่",
        a: "ไม่ต้อง Epidom ทำงานบนเบราว์เซอร์ในโทรศัพท์ แท็บเล็ต หรือคอมพิวเตอร์ที่คุณมีอยู่แล้ว และใช้เครื่องพิมพ์ใบเสร็จ Bluetooth ได้หากต้องการ หากคุณต้องการเทอร์มินัลรับออเดอร์และรับชำระเงินที่จัดมาให้ Popina อาจเหมาะกับคุณมากกว่า",
      },
      {
        q: "ทั้งสองใช้งานได้โดยไม่มีอินเทอร์เน็ตหรือไม่",
        a: "ได้ Popina ระบุว่ารองรับการชำระเงินแบบออฟไลน์บน T-ONE และ POS ของ Epidom ขายต่อได้แม้ออฟไลน์ แล้วซิงก์ยอดขายเมื่อกลับมาเชื่อมต่อ",
      },
      {
        q: "ควรเลือก Popina หรือ Epidom สำหรับคาเฟ่ของฉัน",
        a: "หากคุณต้องการเทอร์มินัลที่จัดมาพร้อมโซลูชัน Popina เป็นตัวเลือกที่น่าพิจารณา หากคุณต้องการราคาที่เห็นได้ชัดเจน หน้าร้านออนไลน์ฟรีสำหรับเริ่มต้น และสต็อก สูตร พนักงานในเครื่องมือเดียว ลองใช้ Epidom",
      },
    ],
    ctaTitle: "เริ่มต้นด้วยหน้าร้านออนไลน์ฟรี",
    ctaButton: "ทดลองใช้ POS ฟรี 14 วัน →",
  },
};
