import type { Article } from "@/features/marketing/shared/content/article-types";

export const enPosts: Article[] = [
  {
    slug: "reduce-delivery-app-commission-dependency",
    locale: "en",
    title: "How to Reduce Delivery-App Commission Dependency",
    description:
      "Delivery apps are still useful for discovery, but every order that goes through one pays a commission. Here's how to build a direct ordering channel without dropping delivery apps altogether.",
    date: "2026-06-09",
    readMinutes: 6,
    category: "Direct sales",
    blocks: [
      {
        type: "p",
        text: "Most restaurant and café owners never fully drop delivery apps — and this isn't a pitch to do that. The problem isn't the platform itself, it's when every order, including from customers who already know you, has to route through one and pay a commission.",
      },
      { type: "h2", text: "What an order through a delivery app actually costs" },
      {
        type: "p",
        text: "Every order through a delivery platform pays a commission off the top, before you see the money. There's a second cost that's easy to miss: the customer relationship — who ordered, when, what — stays with the platform. You can't directly reach the customer who loved last week's order.",
      },
      { type: "h2", text: "A direct channel is a complement, not a replacement" },
      {
        type: "list",
        items: [
          "Your own online storefront — a link for your Instagram bio, a table QR code, or a WhatsApp broadcast",
          "Zero commission on orders through that link",
          "Direct WhatsApp contact with the customer, for repeat orders",
          "It doesn't replace delivery apps — most businesses run both",
        ],
      },
      {
        type: "quote",
        text: "The goal isn't to beat delivery apps. It's to stop depending on them entirely for customers who already know you.",
      },
      { type: "h2", text: "Where to start" },
      {
        type: "p",
        text: "The simplest move: create a free storefront with your menu, share the link everywhere customers already find you (Instagram bio, table, social), and let both channels — direct and delivery apps — run side by side. No technical setup required.",
      },
    ],
  },
  {
    slug: "free-qr-code-menu-guide",
    locale: "en",
    title: "The Complete Guide to Free QR Code Menus for Restaurants",
    description:
      "Everything to know before setting up a QR code menu: what actually changes for customers, the common mistakes, and how to do it without spending anything.",
    date: "2026-06-23",
    readMinutes: 5,
    category: "Setup",
    blocks: [
      {
        type: "p",
        text: "QR code menus became standard after 2020, but a lot of places are still stuck on the most basic version: a scanned PDF, unreadable on mobile, never updated. A real QR code menu is a different thing entirely.",
      },
      { type: "h2", text: "A PDF is not a QR code menu" },
      {
        type: "p",
        text: "Scanning your paper menu into a PDF behind a QR code solves one problem (no physical menu to touch) and creates another: it's unreadable on a small screen, impossible to update without redoing the whole thing, and doesn't allow any direct ordering.",
      },
      { type: "h2", text: "What a real QR code menu needs" },
      {
        type: "list",
        items: [
          "Readable and fast on mobile, no zooming required",
          "Editable in seconds — an item runs out, a price changes",
          "Photos per item, clear categories",
          "Ideally, ordering directly from the menu, without switching to a separate app",
        ],
      },
      { type: "h2", text: "Setting it up for free" },
      {
        type: "p",
        text: "No developer or design budget needed. A free online storefront with a structured menu, downloadable QR code, and shareable link takes about 5 minutes to set up — the longest part is entering your items and prices.",
      },
    ],
  },
];
