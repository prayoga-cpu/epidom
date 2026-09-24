import type { Locale } from "@/components/lang/i18n-provider";

/**
 * Sample content for the Services page mockups: the online order, the till's
 * bill, the customer screen, the end-of-shift count, a recipe card and the
 * Finance summary. Each locale gets its own market's currency and dishes; the
 * recipe and report mockups used to show rupiah and English ingredient names to
 * every visitor, French ones included.
 *
 * Every figure is invented (each mockup is captioned as simulated or sample),
 * and the arithmetic inside each mockup adds up. Labels follow the product's own
 * wording where it has one: "Save Bill", "Expected Cash", "Net Profit", …
 * No e-mail addresses and no named real businesses: see home-proof.test.tsx.
 */

export interface ShowcaseSamples {
  order: {
    who: string;
    amount: string;
    paid: string;
    lands: string;
    queue: string;
  };
  till: {
    context: string;
    queue: string;
    lines: { qty: number; name: string; price: string }[];
    subtotal: [label: string, value: string];
    coupon: [label: string, value: string];
    total: [label: string, value: string];
    save: string;
    split: string;
    charge: string;
    synced: string;
  };
  customer: {
    phoneLabel: string;
    phone: string;
    greeting: string;
    stats: string[];
    receipt: string;
    receiptStatus: string;
  };
  shift: {
    title: string;
    started: string;
    lines: [label: string, value: string][];
    expected: [label: string, value: string];
    counted: [label: string, value: string];
    difference: [label: string, value: string];
    balanced: string;
    clockedIn: string;
    staff: { name: string; time: string }[];
  };
  recipe: {
    label: string;
    name: string;
    cost: string;
    costLabel: string;
    ingredients: { name: string; qty: string; cost: string }[];
    margin: string;
    profit: string;
  };
  report: {
    label: string;
    headline: string;
    delta: string;
    vs: string;
    rows: { label: string; value: string; gold: boolean }[];
  };
}

export const SHOWCASE_SAMPLES: Record<Locale, ShowcaseSamples> = {
  fr: {
    order: {
      who: "Hugo · commande en ligne",
      amount: "12,40 € · payée par carte",
      paid: "Payée ✓",
      lands: "Arrive sur la caisse · onglet En ligne",
      queue: "N° 12",
    },
    till: {
      context: "Table 4 · 2 couverts · Sur place",
      queue: "N° 12",
      lines: [
        { qty: 2, name: "Café crème", price: "7,00 €" },
        { qty: 1, name: "Croissant", price: "1,80 €" },
        { qty: 1, name: "Croque-monsieur", price: "9,50 €" },
      ],
      subtotal: ["Sous-total", "18,30 €"],
      coupon: ["Coupon BIENVENUE · −10 %", "−1,83 €"],
      total: ["Total", "16,47 €"],
      save: "En attente",
      split: "Diviser",
      charge: "Encaisser 16,47 €",
      synced: "Toutes les ventes sont synchronisées",
    },
    customer: {
      phoneLabel: "Votre numéro WhatsApp",
      phone: "+33 6 •• •• 12 48",
      greeting: "Content de vous revoir, Camille !",
      stats: ["320 points", "14 visites", "186 € dépensés"],
      receipt: "Reçu envoyé sur son adresse e-mail",
      receiptStatus: "Envoyé ✓",
    },
    shift: {
      title: "Fermer le quart",
      started: "Ouvert à 07:58 par Inès",
      lines: [
        ["Caisse Ouverture", "150,00 €"],
        ["Ventes en Espèces", "412,60 €"],
        ["Entrées / sorties", "−20,00 €"],
      ],
      expected: ["Caisse Attendue", "542,60 €"],
      counted: ["Compté", "542,60 €"],
      difference: ["Écart", "0,00 €"],
      balanced: "Équilibré",
      clockedIn: "Pointés avec selfie",
      staff: [
        { name: "Inès", time: "07:52" },
        { name: "Karim", time: "08:03" },
      ],
    },
    recipe: {
      label: "Recette",
      name: "Croque-monsieur",
      cost: "2,85 €",
      costLabel: "coût / portion",
      ingredients: [
        { name: "Pain de mie", qty: "2 tr.", cost: "0,45 €" },
        { name: "Jambon", qty: "40 g", cost: "1,10 €" },
        { name: "Emmental", qty: "30 g", cost: "0,70 €" },
        { name: "Béchamel", qty: "40 g", cost: "0,40 €" },
        { name: "Beurre", qty: "10 g", cost: "0,20 €" },
      ],
      margin: "Vendu 9,50 € · marge 70 %",
      profit: "+6,65 €",
    },
    report: {
      label: "Finance · mai 2026",
      headline: "Marge brute · 66,2 %",
      delta: "+2,1 pts",
      vs: "vs avril",
      rows: [
        { label: "Chiffre d'affaires", value: "48 250 €", gold: true },
        { label: "Coût des ventes", value: "−16 310 €", gold: false },
        { label: "Pertes & gaspillage", value: "−540 €", gold: false },
        { label: "Bénéfice net", value: "31 400 €", gold: true },
      ],
    },
  },
  id: {
    order: {
      who: "Maya · pesanan online",
      amount: "Rp 58.000 · dibayar via QRIS",
      paid: "Lunas ✓",
      lands: "Masuk ke kasir · tab Online",
      queue: "#12",
    },
    till: {
      context: "Meja 4 · 2 tamu · Makan di tempat",
      queue: "#12",
      lines: [
        { qty: 2, name: "Es Kopi Susu", price: "Rp 44.000" },
        { qty: 1, name: "Nasi Goreng Ayam", price: "Rp 35.000" },
        { qty: 1, name: "Pisang Goreng", price: "Rp 15.000" },
      ],
      subtotal: ["Subtotal", "Rp 94.000"],
      coupon: ["Kupon HEMAT10 · −10%", "−Rp 9.400"],
      total: ["Total", "Rp 84.600"],
      save: "Simpan Bill",
      split: "Pisah",
      charge: "Bayar Rp 84.600",
      synced: "Semua penjualan tersinkronisasi",
    },
    customer: {
      phoneLabel: "Nomor WhatsApp Anda",
      phone: "+62 812 •••• 4417",
      greeting: "Selamat datang kembali, Putri!",
      stats: ["320 poin", "14 kunjungan", "Rp 1,2 jt belanja"],
      receipt: "Struk terkirim ke email pelanggan",
      receiptStatus: "Terkirim ✓",
    },
    shift: {
      title: "Tutup shift",
      started: "Dibuka 07:58 oleh Dewi",
      lines: [
        ["Kas Awal", "Rp 500.000"],
        ["Penjualan Tunai", "Rp 2.340.000"],
        ["Kas masuk / keluar", "−Rp 100.000"],
      ],
      expected: ["Kas Diharapkan", "Rp 2.740.000"],
      counted: ["Dihitung", "Rp 2.740.000"],
      difference: ["Selisih", "Rp 0"],
      balanced: "Seimbang",
      clockedIn: "Absen dengan selfie",
      staff: [
        { name: "Dewi", time: "07:52" },
        { name: "Agus", time: "08:03" },
      ],
    },
    recipe: {
      label: "Resep",
      name: "Nasi Goreng Ayam",
      cost: "Rp 12.000",
      costLabel: "biaya / porsi",
      ingredients: [
        { name: "Nasi", qty: "200 g", cost: "Rp 2.400" },
        { name: "Ayam", qty: "80 g", cost: "Rp 4.800" },
        { name: "Telur", qty: "1", cost: "Rp 2.200" },
        { name: "Bumbu & kecap", qty: "25 g", cost: "Rp 1.500" },
        { name: "Minyak goreng", qty: "15 ml", cost: "Rp 600" },
        { name: "Kerupuk", qty: "1", cost: "Rp 500" },
      ],
      margin: "Dijual Rp 35.000 · margin 66%",
      profit: "+Rp 23.000",
    },
    report: {
      label: "Keuangan · Mei 2026",
      headline: "Margin Kotor · 66,2%",
      delta: "+2,1 poin",
      vs: "vs. April",
      rows: [
        { label: "Pendapatan", value: "Rp 124,5 jt", gold: true },
        { label: "HPP", value: "−Rp 42,1 jt", gold: false },
        { label: "Waste & kehilangan", value: "−Rp 1,4 jt", gold: false },
        { label: "Laba Bersih", value: "Rp 81,0 jt", gold: true },
      ],
    },
  },
  en: {
    order: {
      who: "Jordan · online order",
      amount: "$11.60 · paid by card",
      paid: "Paid ✓",
      lands: "Lands on the till · Online tab",
      queue: "#12",
    },
    till: {
      context: "Table 4 · 2 guests · Dine in",
      queue: "#12",
      lines: [
        { qty: 2, name: "Latte", price: "$9.00" },
        { qty: 1, name: "Croissant", price: "$3.25" },
        { qty: 1, name: "Avocado toast", price: "$10.50" },
      ],
      subtotal: ["Subtotal", "$22.75"],
      coupon: ["Coupon WELCOME · −10%", "−$2.28"],
      total: ["Total", "$20.47"],
      save: "Save Bill",
      split: "Split",
      charge: "Charge $20.47",
      synced: "All sales synced",
    },
    customer: {
      phoneLabel: "Your WhatsApp number",
      phone: "+1 415 ••• 0142",
      greeting: "Welcome back, Sam!",
      stats: ["320 points", "14 visits", "$212 spent"],
      receipt: "Receipt sent to their email address",
      receiptStatus: "Sent ✓",
    },
    shift: {
      title: "Finish shift",
      started: "Opened 07:58 by Maria",
      lines: [
        ["Opening Cash", "$150.00"],
        ["Cash Sales", "$412.60"],
        ["Cash in / out", "−$20.00"],
      ],
      expected: ["Expected Cash", "$542.60"],
      counted: ["Counted", "$542.60"],
      difference: ["Difference", "$0.00"],
      balanced: "Balanced",
      clockedIn: "Clocked in with a selfie",
      staff: [
        { name: "Maria", time: "07:52" },
        { name: "Tom", time: "08:03" },
      ],
    },
    recipe: {
      label: "Recipe",
      name: "Avocado toast",
      cost: "$3.05",
      costLabel: "cost / portion",
      ingredients: [
        { name: "Sourdough", qty: "2 slices", cost: "$0.60" },
        { name: "Avocado", qty: "1", cost: "$1.40" },
        { name: "Feta", qty: "30 g", cost: "$0.55" },
        { name: "Egg", qty: "1", cost: "$0.35" },
        { name: "Chili & lemon", qty: "5 g", cost: "$0.15" },
      ],
      margin: "Sells for $10.50 · margin 71%",
      profit: "+$7.45",
    },
    report: {
      label: "Finance · May 2026",
      headline: "Gross Margin · 66.2%",
      delta: "+2.1 pts",
      vs: "vs. April",
      rows: [
        { label: "Revenue", value: "$52,400", gold: true },
        { label: "COGS", value: "−$17,710", gold: false },
        { label: "Waste & loss", value: "−$590", gold: false },
        { label: "Net Profit", value: "$34,100", gold: true },
      ],
    },
  },
};
