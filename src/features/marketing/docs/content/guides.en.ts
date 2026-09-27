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
  {
    slug: "pos-system-and-operational",
    locale: "en",
    title: "POS Mode: the POS System and the Operational page",
    description:
      "Where everything sits on the counter tablet: the Cashier, Order Queue, Kitchen & Bar and Tables, then the shift, schedules and clock-in.",
    date: "2026-09-27",
    readMinutes: 5,
    category: "Operations",
    blocks: [
      {
        type: "p",
        text: "POS Mode is the part of Epidom that runs on the counter tablet. It has two spaces: the POS System, for selling and serving, and the Operational page, for the shift and the team. POS Mode comes with the POS plan, which you can try free for 14 days.",
      },
      { type: "h2", text: "The POS System" },
      {
        type: "p",
        text: "Four tabs along the bottom of the screen. Each staff member only sees the tabs their role gives them.",
      },
      {
        type: "list",
        items: [
          "Cashier: pick Food or Drink, then a category, then the item. The bill builds as you tap. Save it for later, split it, merge it, or take one payment several ways.",
          "Order Queue: orders from the till and from your storefront, each on its own tab, opening on today's. The Log tab keeps every past order.",
          "Kitchen & Bar: separate screens for the kitchen and the bar. Items arrive as soon as an order is placed and are marked ready one by one.",
          "Tables: your tables with their status (available, occupied, reserved, cleaning) and the reservations to come.",
        ],
      },
      { type: "h2", text: "The Operational page" },
      {
        type: "p",
        text: "Open it from the Epidom menu. It has no tab bar of its own, and its tabs depend on who is signed in:",
      },
      {
        type: "list",
        items: [
          "Shift: open the till with its starting cash, record cash that comes in or goes out, and close the shift.",
          "My Schedule: a staff member's own shifts, and the schedule image if the manager uploaded one.",
          "Team Schedule: the whole team's published roster, for the owner and managers (Operations plan).",
          "Clock In / Out: staff pick their name, enter their PIN and take a selfie (Operations plan).",
        ],
      },
      { type: "h2", text: "One shift for the whole store" },
      {
        type: "p",
        text: "The shift belongs to the store, not to a tablet or a cashier. Every device and every staff member sells into the same open shift. It closes once, with a blind cash count: the drawer is counted before anyone sees what it should hold.",
      },
      { type: "h2", text: "The Epidom menu" },
      {
        type: "p",
        text: "The Epidom button at the top right of POS Mode opens a menu with everything that doesn't need a tab:",
      },
      {
        type: "list",
        items: [
          "Switch between the POS System, the Operational page and, for owners and managers, the Back Office",
          "Sync sales: send the sales rung up while offline and refresh this device's copy of the menu and orders",
          "Turn on the customer display and open it on a second screen",
          "Hardware settings: this device's printers and barcode scanner",
          "Language, theme and zoom for this device, switching account and logging out",
        ],
      },
    ],
  },
  {
    slug: "stock-and-supplier-orders",
    locale: "en",
    title: "Stock and supplier orders",
    description:
      "Keep stock levels right, record waste, and order from suppliers in two steps: create the order, then mark it Received.",
    date: "2026-09-27",
    readMinutes: 4,
    category: "Operations",
    blocks: [
      {
        type: "p",
        text: "The Stock page comes with the Operations plan. It has three tabs: Item, Delivery Order and Log.",
      },
      { type: "h2", text: "Item: what you have" },
      {
        type: "list",
        items: [
          "Every raw material and product with its current level, shown as a grid, in columns or as a list",
          "Adjust Stock corrects one item after a count; Bulk Adjust updates many at once",
          "Record Waste with a reason, so what was thrown away shows up in your reports",
          "Menu items linked to a product or recipe take what they use out of stock as you sell",
        ],
      },
      { type: "h2", text: "Delivery Order: ordering from suppliers" },
      { type: "p", text: "A supplier order has two steps." },
      {
        type: "list",
        items: [
          "Create the order: the supplier, the items and quantities, and the day you expect it. Send it by email or WhatsApp, or print it.",
          "When it arrives, tap Received and confirm. The items are added to stock.",
        ],
      },
      {
        type: "p",
        text: "Until then the order waits under Awaiting delivery, and shows as due today or late on its own once the expected day comes. If it will never arrive, cancel it: nothing is added to stock.",
      },
      { type: "h2", text: "Log: every movement" },
      {
        type: "p",
        text: "The Log lists every change to stock, newest first: deliveries, sales, production, adjustments, waste and returns, each with the balance after it.",
      },
      { type: "h2", text: "Where suppliers and ingredients live" },
      {
        type: "p",
        text: "Suppliers, raw materials, recipes and products are set up on the Data page. Add a supplier there first and you can pick it when you create an order.",
      },
    ],
  },
  {
    slug: "staff-schedules-and-shifts",
    locale: "en",
    title: "Staff, schedules and shifts",
    description:
      "Add your team with PINs and page access, publish the roster, and follow attendance and every till session.",
    date: "2026-09-27",
    readMinutes: 5,
    category: "Operations",
    blocks: [
      {
        type: "p",
        text: "Staff, Schedule and Shifts come with the Operations plan. In the Back Office menu, Staff and Schedule sit under Operations and Shifts under Reports.",
      },
      { type: "h2", text: "Staff" },
      {
        type: "list",
        items: [
          "Give each person a role: Manager, Cashier or Kitchen. Add a job label such as Waiter, Bartender or Host, or write your own",
          "Each person gets a 4-digit PIN for the shared tablet. PIN sessions log out at midnight, store time",
          "Page access starts from the role's template; tick or untick pages to change it",
          "Invite someone by email to sign in with their own Epidom account. Staff accounts work in POS Mode only for now",
        ],
      },
      { type: "h2", text: "Schedule" },
      {
        type: "list",
        items: [
          "Create shift blocks (Morning, 07:00–15:00, for example) and place them on the grid, or apply a block to several people and days at once",
          "Publish the week, and each person sees their shifts under My Schedule in POS Mode",
          "Or upload a photo of your roster for the dates shown: every staff member sees it on My Schedule",
          "Log & History lists clock-ins, clock-outs and absences, with the photo taken at clock-in",
        ],
      },
      { type: "h2", text: "Clocking in" },
      {
        type: "p",
        text: "Staff clock in and out on the Operational page in POS Mode: they pick their name, enter their PIN and take a selfie. The device's location is recorded too when it shares it.",
      },
      { type: "h2", text: "Shifts" },
      {
        type: "p",
        text: "The Shifts page lists every till session: who ran it, the cash it started with, and how the drawer closed — expected, counted and the difference. The Cash log tab shows each cash movement: tips, float top-ups, paid-outs and safe drops.",
      },
      {
        type: "p",
        text: "The shift itself is opened and closed in POS Mode, on the Operational page.",
      },
    ],
  },
  {
    slug: "hardware-printers-and-scanner",
    locale: "en",
    title: "Hardware: printers and barcode scanner",
    description:
      "Pair receipt, kitchen, bar and label printers to a device, and check that your barcode scanner reads.",
    date: "2026-09-27",
    readMinutes: 3,
    category: "Setup",
    blocks: [
      {
        type: "p",
        text: "Hardware settings belong to the device: each tablet or computer keeps its own printers and scanner settings. In POS Mode, open the Epidom menu, then Hardware settings. Printing comes with the POS plan.",
      },
      { type: "h2", text: "Printers" },
      {
        type: "p",
        text: "Pair up to four printers, one for each job. Turn on the ones you use; the others stay off.",
      },
      {
        type: "list",
        items: [
          "Receipt printer: the receipt with prices and total, the bill and the shift report",
          "Kitchen printer: order tickets for the kitchen, with no prices",
          "Bar printer: bar items only. Leave it off and bar items print on the Kitchen printer",
          "Label printer: one sticker per item ordered, for cups and packaging",
        ],
      },
      {
        type: "p",
        text: "Printers connect over Bluetooth, which needs Chrome on Android or on a computer. An iPad can't send receipts, kitchen or bar tickets, or labels to a printer. On an iPad, Print at the end of a shift opens the shift report in the print dialog, and a past receipt can be printed from View Receipt on an order in the Order Queue's Log tab. Paper can be 58 mm or 80 mm. Use Test print on each printer after pairing — label printing in particular isn't verified on every model.",
      },
      { type: "h2", text: "Barcode scanner" },
      {
        type: "list",
        items: [
          "Test your scanner: scan any barcode and Epidom says whether it read it and which menu item matches. Nothing is added to a sale",
          "Choose whether a scan counts anywhere on the screen or only in the search box",
          "If scans are being missed, switch the speed to Slow / Bluetooth",
        ],
      },
      {
        type: "p",
        text: "To check codes against your menu, open the Cashier once on that device first.",
      },
    ],
  },
];
