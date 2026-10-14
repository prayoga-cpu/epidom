import type { BlogPost } from "./types";

export const enPosts: BlogPost[] = [
  {
    slug: "reduce-delivery-app-commission-dependency",
    locale: "en",
    title: "How to Reduce Delivery-App Commission Dependency",
    description:
      "Keep delivery apps for discovery, but stop paying a commission on regulars. A practical plan for building your own ordering channel, step by step.",
    date: "2026-06-09",
    updated: "2026-10-14",
    readMinutes: 5,
    category: "Direct sales",
    related: ["delivery-app-commission-calculator", "commission-free-online-ordering"],
    blocks: [
      {
        type: "p",
        text: "Most restaurant and café owners never fully drop delivery apps, and this is not a pitch to do that. Apps bring new customers who would never have found you otherwise. The problem starts when every order, including those from people who already know you and would happily order directly, has to travel through a platform and pay a commission.",
      },
      {
        type: "p",
        text: "This guide explains what those orders really cost, who is worth moving to your own channel, and how to do it without upsetting the apps that still bring you business.",
      },
      { type: "h2", text: "What an order through a delivery app actually costs" },
      {
        type: "p",
        text: "Every order placed through a delivery platform pays a commission before you see the money. Rates differ by platform, city and contract, so read your own agreement rather than relying on a general number. As an example, take a 25 percent commission. On a $20 order you keep $15, and that $15 still has to cover the ingredients, the packaging, the cook's time and the rent.",
      },
      {
        type: "p",
        text: "Now compare it with a $20 order that has a food cost of $6.50. In your shop you keep $13.50 before labor and overhead. Through the app, with a bag and box that cost you another dollar, you keep $7.50. The same food leaves you roughly half as much. That is why a menu that looks healthy in-store can quietly lose money on a delivery platform.",
      },
      {
        type: "p",
        text: "There is a second cost that is easy to miss. The customer relationship stays with the platform. You do not get to say thank you, announce a new dish, or remind someone who loved last week's order that you are open on Sunday.",
      },
      { type: "h2", text: "Step 1: Measure how much you pay today" },
      {
        type: "p",
        text: "Before changing anything, add up a month. For each platform, note the number of orders, the sales, and the commission and fees deducted. Then compare the share of your revenue that comes through apps with the share of your profit. Many owners are surprised that apps are a fifth of revenue and a much smaller part of profit.",
      },
      {
        type: "p",
        text: "A delivery app commission calculator makes this quick: enter your average order, food cost and commission rate and it shows what you keep per order. If you record app orders at the POS as their own channel, a finance report can split revenue and commission by platform, which helps in later months. In Epidom that channel breakdown is part of the Operations plan. Epidom does not connect directly to delivery-app systems, so app orders are entered by hand at the cashier.",
      },
      { type: "h2", text: "Step 2: Decide who belongs on your own channel" },
      {
        type: "p",
        text: "Not every customer should be moved. Apps are great at discovery, so a first-time customer who found you on a platform is exactly what you are paying for. The ones worth moving are the people who already know you:",
      },
      {
        type: "list",
        items: [
          "Regulars who order every week from the same app",
          "People who follow you on Instagram or TikTok",
          "Office groups and neighbors who order for a team",
          "Customers who walk in, like it, and would reorder from home",
        ],
      },
      {
        type: "p",
        text: "These customers are the ones paying commission on a relationship you built yourself.",
      },
      { type: "h2", text: "Step 3: Build a direct channel that is easy to use" },
      {
        type: "p",
        text: "A direct channel does not need to be complicated. It needs a link a customer can open on a phone, a menu that is readable and current, and a clear way to get in touch. The simplest version is a storefront page with your menu, photos, opening hours and WhatsApp button. With Epidom, that page is free forever.",
      },
      {
        type: "p",
        text: "If you also want customers to place orders on that page, online ordering (dine-in with a table number, takeaway, and delivery by your own staff) is part of the POS plan, which starts with a 14-day free trial. Orders from the page are paid at the cashier: the POS is alerted, and you mark the order as paid when the customer pays. There is no online payment on the page today, so a customer ordering for delivery needs a way to pay you on handover.",
      },
      {
        type: "p",
        text: "Owning the channel also means owning the delivery. If you do not have a rider, start with takeaway and dine-in, or limit delivery to a short radius you can cover yourself. A direct channel that promises delivery you cannot deliver damages your reputation faster than a commission ever would.",
      },
      { type: "h2", text: "Step 4: Put the link where customers already look" },
      {
        type: "list",
        items: [
          "Your Instagram and TikTok bio",
          "A QR code on the table, the counter and the takeaway bag",
          "A WhatsApp broadcast or status message when you have a new item",
          "A small card in every delivery bag that says you also take orders directly",
          "Your Google Maps listing",
        ],
      },
      {
        type: "p",
        text: "The card in the bag is one of the most effective moves because it reaches the exact people who already ordered from you. Keep the wording friendly and honest: order direct next time, and here is the link. Check the terms of your platform agreement first, as some contracts restrict how you promote other channels.",
      },
      { type: "h2", text: "Step 5: Give people a reason to switch" },
      {
        type: "p",
        text: "Saving you the commission is a reason for you, not for them. Give the customer something too. A small extra, a free drink on the third order, or a loyalty stamp costs far less than the commission you would have paid. If you keep the same prices on your channel as on the app, the customer notices nothing but a smoother experience. If you list app prices slightly higher than in-store prices, your own link becomes the cheaper option on its own.",
      },
      { type: "h2", text: "A realistic example" },
      {
        type: "p",
        text: "A café gets 40 app orders a week at an average of $18. With a 25 percent commission, that is $180 a week in commission, or about $780 a month. The owner puts a card in every bag and a link in the Instagram bio. After a couple of months, say 10 of those weekly orders move to direct. That is $45 a week the café keeps, roughly $195 a month, with no change to how the food is made. These figures are an illustration, not a forecast. Your numbers will depend on your regulars and your area.",
      },
      {
        type: "quote",
        text: "The goal isn't to beat delivery apps. It's to stop depending on them entirely for customers who already know you.",
      },
      { type: "h2", text: "Mistakes to avoid" },
      {
        type: "list",
        items: [
          "Switching off the apps in anger. You lose discovery along with the commission.",
          "Launching a direct channel with no plan to deliver or serve those orders",
          "Never telling anyone it exists",
          "Forgetting that your own channel still has costs: packaging, staff time, a rider",
          "Comparing commission alone and ignoring the extra customers an app brings",
        ],
      },
      { type: "h2", text: "Where to start this week" },
      {
        type: "p",
        text: "Add up last month's app orders and commission. Publish a storefront page with your menu and WhatsApp button. Print a card with the link and put it in every delivery bag. After a month, look at how many orders moved, and decide whether the ordering link in the POS plan is worth turning on. Keep both channels running side by side, and let the numbers tell you how much weight each one deserves.",
      },
    ],
  },
  {
    slug: "free-qr-code-menu-guide",
    locale: "en",
    title: "The Complete Guide to Free QR Code Menus for Restaurants",
    description:
      "What a good QR code menu needs, the mistakes that make customers give up, and how to publish a free menu page with a printable QR code.",
    date: "2026-06-23",
    updated: "2026-10-14",
    readMinutes: 5,
    category: "Setup",
    related: ["free-qr-code-menu", "cafe-pos-system"],
    blocks: [
      {
        type: "p",
        text: "QR code menus became standard after 2020, but a lot of places are still stuck on the most basic version: a scanned PDF, unreadable on a phone, never updated. A good QR code menu is a different thing. It loads fast, reads well on a small screen, and is easy for you to change in the middle of service.",
      },
      {
        type: "p",
        text: "This guide covers what to put on the menu, how to lay it out, where to place the code, and the mistakes that make customers ask for a paper menu anyway.",
      },
      { type: "h2", text: "A PDF is not a QR code menu" },
      {
        type: "p",
        text: "Scanning your paper menu into a PDF behind a QR code solves one problem, which is that nobody has to touch a shared menu. It creates others. The text is tiny, so people pinch and scroll sideways. Updating it means redoing the whole file and printing a new code if the link changes. There are no photos per dish, no sold-out state, and no way to link to your WhatsApp or Instagram.",
      },
      {
        type: "p",
        text: "A page built for phones fixes all of that. Customers scroll through categories, tap an item to see its photo and description, and see what is available right now.",
      },
      { type: "h2", text: "What a good QR code menu needs" },
      {
        type: "list",
        items: [
          "Readable and fast on mobile, with no zooming and no waiting on a heavy file",
          "Editable in seconds: an item runs out, a price changes, a special is added",
          "A photo, a short description and a price for each item",
          "Clear categories in the order people think: drinks, breakfast, mains, desserts",
          "Options such as size or add-ons shown on the item, not in a separate note",
          "Opening hours and a way to contact you on the same page",
        ],
      },
      { type: "h2", text: "Writing the menu itself" },
      {
        type: "p",
        text: "A phone screen rewards short, scannable text. Keep item names the way customers say them, not the way the kitchen files them. One line of description is enough: what it is, the main ingredient, and anything people ask about, such as spice level or whether it contains nuts or dairy.",
      },
      {
        type: "p",
        text: "Photos matter more than most owners expect. A clear photo taken near a window with a plain background sells a dish better than three sentences. Square photos, similar lighting and a consistent angle make the page look professional without any design work. You do not need a photo for every item. Start with your best sellers and the dishes you want to push.",
      },
      {
        type: "p",
        text: "Put the items you most want to sell in a featured section and keep the category list short. Ten categories on a phone become a long scroll that people abandon.",
      },
      {
        type: "p",
        text: "Check the page on a slow connection too. If your dining room has weak signal, a few customers will be on mobile data, so keep photos light and avoid anything that needs a long load. It also helps to read the menu aloud as a stranger would: if a dish name needs explaining to a waiter every time, the description is missing a line.",
      },
      { type: "h2", text: "Where to place the code" },
      {
        type: "list",
        items: [
          "On every table, in a stand or sticker that is easy to find",
          "At the counter next to the register, for takeaway customers",
          "On the window, so passers-by can read the menu after closing",
          "On the takeaway bag, the receipt and your flyers",
          "In your Instagram bio and Google Maps listing as the same link",
        ],
      },
      {
        type: "p",
        text: "Print the code at least about 2 inches wide, keep a good margin of blank space around it, and test it with two or three different phones before you print fifty. Put a short line next to it, such as scan to see the menu, so nobody has to wonder what it is. Avoid laminating with a glossy finish that reflects the lights and makes scanning difficult.",
      },
      { type: "h2", text: "Setting it up for free" },
      {
        type: "p",
        text: "You do not need a developer or a design budget. With Epidom, the storefront page is free forever: you add your logo, colors, opening hours and links, then enter your categories, items, photos and prices. The page gets its own address, and you can download a printable QR code that points to it. The longest part is entering your menu, so start with the top items and add the rest later.",
      },
      {
        type: "p",
        text: "Because the QR code points to the page and not to a file, you can change the menu any time and the printed code keeps working. Mark an item as sold out when the kitchen runs out, so customers do not order something you cannot serve.",
      },
      { type: "h2", text: "Taking orders from the menu" },
      {
        type: "p",
        text: "A menu is a good starting point, and some places want customers to order from it as well. That is a separate step. Online ordering, with dine-in by table number, takeaway and delivery by your own staff, is part of the POS plan, which starts with a 14-day free trial. Orders from the page are paid at the cashier, and the POS alerts your staff when a new one arrives. The free page, on its own, is the menu and the QR code.",
      },
      { type: "h2", text: "Mistakes that make customers give up" },
      {
        type: "list",
        items: [
          "Linking to a large PDF that takes a long time to open on mobile data",
          "Forgetting to update prices or sold-out items, so the menu and the counter disagree",
          "A QR code too small, too low on the table, or printed on a curved surface",
          "A menu with no photos and no descriptions for dishes that need explaining",
          "No paper fallback at all, for customers who cannot or would rather not scan",
          "Making the QR code the only way to see the menu in a place where many customers are older or have limited data",
        ],
      },
      {
        type: "p",
        text: "A QR code is a convenience, not a rule. Keep a few paper menus behind the counter and let customers choose.",
      },
      { type: "h2", text: "A simple plan for this week" },
      {
        type: "p",
        text: "Pick your top ten items and take a photo of each. Write a one-line description for every item and set the prices. Publish the page, download the QR code, print it, and put it on three tables for a day to see how it works. Ask a few regulars what they thought, fix what confuses them, and then roll it out to the rest of the room. After that, treat the menu as something you tune weekly, the same way you tune a recipe.",
      },
    ],
  },
  {
    slug: "how-to-price-a-cafe-menu",
    locale: "en",
    title: "How to Price a Café Menu (With a Worked Example)",
    description:
      "Food cost percentage, overhead, labor and delivery-app prices, step by step, with a worked example in dollars you can copy for your own menu.",
    date: "2026-10-14",
    readMinutes: 7,
    category: "Pricing",
    related: ["recipe-cost-calculator", "delivery-app-commission-calculator", "cafe-pos-system"],
    blocks: [
      {
        type: "p",
        text: "Most café menus are priced the same way: look at the café down the street, subtract a little, hope for the best. It works until the month you add up the invoices and wonder where the money went. A price is not a feeling. It is the one number that has to cover your ingredients, your staff, your rent and still leave something for you.",
      },
      {
        type: "p",
        text: "This guide walks through the full logic, from the cost of one cup to the final price on the board, with a worked example in dollars. All the numbers are examples and rules of thumb, not benchmarks. Replace them with your own.",
      },
      { type: "h2", text: "Step 1: Know what each item really costs" },
      {
        type: "p",
        text: "Start with the plate or cup, not the invoice. For every item, list each ingredient, the quantity that goes into one serving, and the price per unit you actually pay. Then add the small things people forget: the cup, the lid, the sleeve, the napkin, the sugar sachet, the oil you fry in, the garnish.",
      },
      {
        type: "p",
        text: "Two habits make this number honest. First, count waste: the milk that gets poured out, the croissants unsold at closing, the avocado that turned. A common rule of thumb is to add a few percent on top of the raw cost for fresh items. Second, update it when suppliers change their prices. A recipe cost you calculated a year ago is a guess, not a cost. A recipe cost calculator, or the recipe costing in a back-office tool, saves you from redoing this by hand each time a price moves.",
      },
      { type: "h2", text: "Step 2: Choose a food cost target" },
      {
        type: "p",
        text: "Food cost percentage is the cost of the ingredients divided by the selling price. A latte that costs you $1.20 to make and sells for $4.75 has a food cost of about 25 percent. Many cafés aim for somewhere between 25 and 35 percent overall, with drinks usually lower than food, because coffee, tea and milk drinks carry a high markup. Treat that range as a starting point, not a law. A bakery that makes everything from scratch and a café that buys in pastries will land in different places.",
      },
      {
        type: "p",
        text: "The formula is simple: ingredient cost divided by your target food cost percentage gives you a starting price. At a 30 percent target, a dish that costs $2.40 to make starts at $8.00. At a 25 percent target, a $1.20 latte starts at $4.80.",
      },
      { type: "h2", text: "Step 3: Check that the whole business can live on it" },
      {
        type: "p",
        text: "Food cost alone does not tell you whether you are profitable. You also have to pay for labor and overhead, and those eat a share of every sale. A useful way to think about it is to split each dollar of sales into four buckets: ingredients, labor, overhead, and what is left.",
      },
      {
        type: "p",
        text: "Here is a small café, as an example. It sells $20,000 a month, about 4,000 items at an average of $5.",
      },
      {
        type: "list",
        items: [
          "Ingredients and packaging: $6,000, which is 30 percent of sales",
          "Labor, including a wage for the owner who works the counter: $6,500, which is 32.5 percent",
          "Overhead (rent $3,000, utilities $450, insurance, software, licenses and everything else $750): $4,200, which is 21 percent",
          "What is left before tax and loan payments: $3,300, which is 16.5 percent",
        ],
      },
      {
        type: "p",
        text: "A frequently used rule of thumb is that ingredients plus labor, often called prime cost, should stay under about 60 to 65 percent of sales. In this example it is 62.5 percent, so the café is inside that range with little room to spare. If rent goes up or sales dip, the margin disappears quickly. This is exactly why pricing too low is so dangerous: you cannot fix it with volume.",
      },
      { type: "h2", text: "Step 4: See what one item has to carry" },
      {
        type: "p",
        text: "A simple, if crude, way to spread labor and overhead across the menu is to divide them by the number of items sold. In the example, overhead of $4,200 over 4,000 items is $1.05 per item, and labor of $6,500 is about $1.63 per item. A latte with $1.20 of ingredients therefore carries about $3.88 of total cost. At $4.75 it leaves roughly 87 cents, or 18 percent.",
      },
      {
        type: "p",
        text: "This is an average, so a complicated item that needs five minutes of a cook's time deserves more labor than a drip coffee that takes thirty seconds. You do not need to be perfect. You need to notice when an item looks fine on food cost but loses money once its labor is counted, such as a made-to-order sandwich priced like a pastry.",
      },
      { type: "h2", text: "A worked example: three items" },
      {
        type: "list",
        items: [
          "Latte: ingredients $1.20 (coffee $0.35, milk $0.55, cup and lid $0.30). At a 25 percent target the starting price is $4.80. Menu price: $4.75, food cost about 25 percent.",
          "Butter croissant: $1.10 each from the oven. At 33 percent the starting price is $3.33. Menu price: $3.50, food cost about 31 percent.",
          "Avocado toast: bread $0.45, avocado $1.40, egg $0.45, oil and seasoning $0.20, total $2.50. At 32 percent the starting price is $7.81. Menu price: $8.00, food cost about 31 percent.",
        ],
      },
      {
        type: "p",
        text: "Notice that the menu price is not the formula result, it is the formula result nudged to a price that looks natural. That is the next step.",
      },
      { type: "h2", text: "Step 5: Psychological pricing, used lightly" },
      {
        type: "p",
        text: "Once the math says what a price should be, you have some room to choose the exact number. Some common practices, which you should test rather than trust blindly:",
      },
      {
        type: "list",
        items: [
          "Charm endings such as .75 or .95 feel lower than a round number, and many cafés use them. Others prefer clean prices like $5 because they look calm and premium. Pick one style and use it everywhere.",
          "Drop the currency symbol and the cents on a printed menu if your style is relaxed: 4.75 reads lighter than $4.75.",
          "Show one premium item on purpose. A $12 brunch plate makes a $9 plate look reasonable, even if few people order the expensive one.",
          "Price sizes by steps that match the real cost. If a large cup costs you 25 cents more than a small, a 50-cent step keeps your percentage steady while the customer sees a small upgrade.",
          "Do not change everything at once. Move a few items, watch what sells for two weeks, and keep the ones that hold up.",
        ],
      },
      {
        type: "p",
        text: "Pricing is also about positioning. If your coffee is better and your room is nicer than the one next door, a 25-cent premium is easy to justify. If you are cheaper but slower, you may be discounting something customers do not value.",
      },
      { type: "h2", text: "Step 6: Delivery-app prices versus in-store prices" },
      {
        type: "p",
        text: "Delivery platforms take a commission on every order. Rates vary by platform, city and contract, so check your own agreement. For the example, assume 25 percent. A $4.75 latte then brings in $3.56 instead of $4.75. Add 20 cents for the delivery box and bag and the item costs you $1.40, so you keep $2.16 instead of $3.55. The same latte earns about 40 percent less.",
      },
      {
        type: "p",
        text: "To earn the same dollar margin, the app price has to be much higher. You want to keep $3.55 after paying $1.40 of cost, which means the platform has to leave you $4.95, so the menu price is $4.95 divided by 0.75, or $6.60. That is a big jump, and not every café can hold it. Your options are to raise app prices a little and accept a lower margin on those orders, to keep a smaller app menu of items that survive the commission well (usually food and packaged goods rather than cheap drinks), or to move your regulars to your own ordering link. A delivery app commission calculator lets you test your own rate and menu before you decide.",
      },
      {
        type: "p",
        text: "Whatever you pick, price the app channel on purpose instead of copying the in-store menu. If you do list higher prices, be honest about it: customers often compare, and a surprise erodes the trust you were trying to build.",
      },
      { type: "h2", text: "Step 7: Review every month" },
      {
        type: "p",
        text: "Prices are never finished. Ingredients move, rent moves, and your own menu mix moves. Once a month, look at your best sellers and your worst margins, and ask three questions. Which item sells a lot but earns little? Which item earns a lot but sells little, and could be featured? Which item can I drop because it adds complexity and waste?",
      },
      {
        type: "p",
        text: "A POS that records every sale makes this review much easier, because you can see item sales and margins instead of reconstructing them from memory. If you run a café, a café-focused POS system can also hold your recipes so the cost of each drink updates when you change a supplier price. In Epidom, recipe costing and margin reports are part of the Operations plan, while the cashier itself comes with the POS plan and a 14-day free trial.",
      },
      { type: "h2", text: "Common mistakes to avoid" },
      {
        type: "list",
        items: [
          "Pricing from the competitor's menu without knowing your own costs",
          "Forgetting packaging, waste and the free extras (sugar, napkins, a second shot)",
          "Leaving prices untouched for years while ingredients rise",
          "Pricing delivery orders exactly like in-store orders and not noticing the commission",
          "Judging an item only by food cost and ignoring how long it takes to make",
          "Raising every price by the same amount instead of looking at each item",
        ],
      },
      { type: "h2", text: "A short checklist" },
      {
        type: "list",
        items: [
          "Cost each item, including packaging and waste",
          "Set a food cost target per category (drinks lower, food higher)",
          "Divide cost by target to get a starting price, then round to a natural number",
          "Check ingredients plus labor against your monthly sales",
          "Give delivery apps their own prices, or their own smaller menu",
          "Review the numbers once a month and change a few items at a time",
        ],
      },
      {
        type: "p",
        text: "Good pricing is not about charging as much as possible. It is about knowing the cost of every cup and plate, so that the café you open every morning actually pays you back.",
      },
    ],
  },
];
