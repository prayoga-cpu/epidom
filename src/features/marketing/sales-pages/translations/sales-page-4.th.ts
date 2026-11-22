import type { SalesPageTranslation } from "../lib/translate-sales-page";
import { THAI_FONTS, thaiHeadCss } from "./thai-style";

/** Thai copy of /sales-page-4, applied to its French original (see ../lib/translate-sales-page.ts). */
const translation: SalesPageTranslation = {
  locale: "th",
  pairs: [
    ["Epidom | Centralisez votre coffee shop", "Epidom | รวมการบริหารร้านกาแฟของคุณไว้ที่เดียว"],
    // "พบกับเครื่องมือที่ [ง่ายที่สุด] / ในการ [รวมทุกอย่าง] ของร้านกาแฟไว้ที่เดียว!"
    ["Découvrez l’outil le plus", "พบกับเครื่องมือที่"],
    ["simple", "ง่ายที่สุด"],
    ["pour", "ในการ"],
    ["centraliser", "รวมทุกอย่าง"],
    ["votre coffee shop !", "ของร้านกาแฟไว้ที่เดียว!"],
    ["Vidéo de présentation d’Epidom", "วิดีโอแนะนำ Epidom"],
    ["Commencer gratuitement →", "เริ่มใช้ฟรี →"],
    ["Gratuit à vie. Sans carte bancaire.", "ฟรีตลอดชีพ ไม่ต้องใช้บัตรเครดิต"],
    ["Utilisateurs", "ผู้ใช้"],
    [
      "Font confiance à Epidom pour leur coffee shop et restaurant dans 27 pays.",
      "ไว้วางใจให้ Epidom ดูแลร้านกาแฟและร้านอาหารของตนใน 27 ประเทศ",
    ],
    // The counter's unit (data-suffix), written after the number: "100 ชั่วโมง".
    ["heures", "ชั่วโมง"],
    ["0 heure", "0 ชั่วโมง"],
    ["Économisées chaque mois", "ที่ประหยัดได้ทุกเดือน"],
    ["Grâce à Epidom et à une gestion quotidienne plus simple.", "ด้วย Epidom และการจัดการประจำวันที่ง่ายขึ้น"],
    ["De chiffre d’affaires en plus", "รายได้ที่เพิ่มขึ้น"],
    ["En optimisant la gestion de votre coffee shop.", "จากการบริหารร้านกาแฟของคุณให้มีประสิทธิภาพยิ่งขึ้น"],
    ["EPIDOM · LA GESTION DE VOTRE COFFEE SHOP, SIMPLIFIÉE", "EPIDOM · บริหารร้านกาแฟได้ง่ายขึ้น"],
    ["fr-FR", "th-TH"],
    ["Restez informé·e", "รับข่าวสารจากเรา"],
    ["Recevez nos conseils gratuits pour développer votre coffee shop.", "รับเคล็ดลับฟรีจากเราเพื่อพัฒนาร้านกาแฟของคุณ"],
    ["votre@email.fr", "your@email.com"],
    ["S'abonner", "สมัครรับ"],
    ["Demander une démo personnalisée →", "ขอเดโมสำหรับร้านคุณ →"],
    ["Merci ! Vous êtes abonné·e.", "ขอบคุณ! คุณสมัครรับข่าวสารแล้ว"],
  ],
  keep: ["Epidom"],
  headCss: thaiHeadCss([
    `html:lang(th) body{font-family:Inter,${THAI_FONTS},Arial,sans-serif}`,
    "html:lang(th) h1{line-height:1.4}",
  ]),
};

export default translation;
