import type { Article } from "@/features/marketing/shared/content/article-types";

export const enGuides: Article[] = [
  {
    slug: "getting-started",
    locale: "en",
    title: "Create your free storefront in 5 minutes",
    description: "The steps to publish your first menu page and start taking orders, no technical setup required.",
    date: "2026-05-10",
    readMinutes: 4,
    category: "Getting started",
    blocks: [
      {
        type: "p",
        text: "Your Epidom storefront is the page your customers will see — in your Instagram bio, on a table QR code, or shared directly. Here's how to publish it.",
      },
      { type: "h2", text: "1. Create your account" },
      { type: "p", text: "Sign up with your email. No card required for the free plan." },
      { type: "h2", text: "2. Fill in your business details" },
      {
        type: "list",
        items: [
          "Business name and custom link (epidom.fr/@your-shop)",
          "Logo and theme color",
          "Short description and opening hours",
        ],
      },
      { type: "h2", text: "3. Add your first menu items" },
      {
        type: "p",
        text: "Create at least one category, then add items with a photo, price, and description. You can always add more later — you don't need the full menu ready to publish.",
      },
      { type: "h2", text: "4. Publish" },
      {
        type: "p",
        text: "Once published, your storefront is live at its address immediately. Download the QR code from settings to print on tables or your storefront window.",
      },
    ],
  },
  {
    slug: "setting-up-your-menu",
    locale: "en",
    title: "Setting up your menu: categories, items, options",
    description: "How to organize your menu so it's clear for customers and fast for you to update.",
    date: "2026-05-14",
    readMinutes: 4,
    category: "Setup",
    blocks: [
      { type: "p", text: "A well-structured menu reads in a few seconds on mobile. Here's how to organize it." },
      { type: "h2", text: "Categories" },
      {
        type: "p",
        text: "Group items into logical categories (Starters, Mains, Drinks...). You can reorder categories anytime — the display follows the order you set.",
      },
      { type: "h2", text: "Items" },
      {
        type: "list",
        items: [
          "Photo — an item with a photo sells better than one without",
          "Price and short description",
          "Marking an item \"sold out\" hides it temporarily without deleting it",
          "Highlight your best sellers with the \"featured\" badge",
        ],
      },
      { type: "h2", text: "Options and modifiers" },
      {
        type: "p",
        text: "For items with variants (size, spice level, add-ons), add option groups — the customer picks them directly when ordering.",
      },
    ],
  },
  {
    slug: "receiving-orders",
    locale: "en",
    title: "Receiving orders and WhatsApp notifications",
    description: "What happens between a customer placing an order on your storefront and you preparing it.",
    date: "2026-05-19",
    readMinutes: 4,
    category: "Operations",
    blocks: [
      {
        type: "p",
        text: "Once your menu is live, customers can order directly from your storefront — dine-in, takeaway, or delivery depending on what you enable.",
      },
      { type: "h2", text: "The order flow" },
      {
        type: "list",
        items: [
          "The customer adds items to their cart and checks out",
          "You get an instant WhatsApp notification with the order details",
          "The dashboard shows the order in real time",
          "The customer gets an automatic confirmation",
        ],
      },
      { type: "h2", text: "Payment" },
      {
        type: "p",
        text: "Depending on your market, you can enable card payment or leave payment as cash on pickup. You configure accepted payment methods in your storefront settings.",
      },
    ],
  },
  {
    slug: "sharing-your-storefront",
    locale: "en",
    title: "Sharing your storefront: QR code, Instagram bio, links",
    description: "A published storefront is only useful if people find it. Here's where to share it first.",
    date: "2026-05-24",
    readMinutes: 3,
    category: "Growth",
    blocks: [
      {
        type: "p",
        text: "Your storefront link (epidom.fr/@your-shop) works anywhere you can paste a link or display a QR code.",
      },
      { type: "h2", text: "Where to put it first" },
      {
        type: "list",
        items: [
          "Instagram and Facebook bio — replaces a Linktree link",
          "QR code printed on tables or in the window",
          "WhatsApp status and messages to regulars",
          "Google Maps, in your business profile's \"website\" field",
        ],
      },
      { type: "h2", text: "The QR code" },
      {
        type: "p",
        text: "Download it from your storefront settings, high resolution, print-ready. It points directly to your menu — no need to regenerate it if you update your items, the link stays the same.",
      },
    ],
  },
  {
    slug: "upgrading-to-pos",
    locale: "en",
    title: "Upgrading to the POS cashier: when and how",
    description: "The free plan covers the storefront and online ordering. Here's how to tell if you're ready for POS.",
    date: "2026-05-29",
    readMinutes: 3,
    category: "Upgrading",
    blocks: [
      {
        type: "p",
        text: "The POS plan adds a cashier register, a unified order queue (dine-in + online), receipts, and a basic kitchen display.",
      },
      { type: "h2", text: "Signs it's time to upgrade" },
      {
        type: "list",
        items: [
          "You're hiring your first cashier",
          "You're handling dine-in orders alongside online orders",
          "You need to print receipts",
        ],
      },
      { type: "h2", text: "The switch" },
      {
        type: "p",
        text: "No data is lost — your menu, past orders, and settings stay exactly the same. Upgrading to a paid plan from your dashboard takes under a minute.",
      },
    ],
  },
];
