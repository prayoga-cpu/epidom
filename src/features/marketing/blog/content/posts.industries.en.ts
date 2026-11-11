import type { BlogPost } from "./types";

/**
 * One practical guide per kind of food and drink business. The home page's
 * "What is Epidom used for?" cards link here (slugs are mirrored in
 * src/features/marketing/home/lib/industry-guides.ts). Advice first, product
 * second, no invented numbers.
 */
export const enIndustryPosts: BlogPost[] = [
  {
    slug: "run-a-cafe-orders-margin-stock",
    locale: "en",
    title: "Running a Café Day to Day: Orders, Margin and Stock in One Place",
    description:
      "A practical routine for café owners: shorten the morning queue, know what a cup really costs, order stock before it runs out and keep trading when the Wi-Fi drops.",
    date: "2026-11-11",
    readMinutes: 6,
    category: "Cafés",
    blocks: [
      {
        type: "p",
        text: "A café looks simple from the outside: coffee in, coffee out. Behind the counter it is three jobs at once. You take orders fast, you protect a thin margin on every cup, and you keep the shelves full without buying too much milk that will turn before Friday. Most cafés lose money in the gaps between those three jobs, not in any single one of them.",
      },
      {
        type: "p",
        text: "This guide walks through a daily routine that closes those gaps. It is written for owner-operators with one or two outlets, and it does not assume any particular tool. Where it helps, it shows how the same step looks in Epidom, so you can see whether it fits how you already work.",
      },
      { type: "h2", text: "Shorten the morning queue before you buy anything" },
      {
        type: "p",
        text: "The morning rush is where a café makes or loses its day. A queue that looks long makes walk-ins keep walking, and regulars who wait too often start going elsewhere. The cheapest fix is not a faster barista. It is moving part of the ordering away from the till.",
      },
      {
        type: "list",
        items: [
          "Give regulars a link or a QR code on the counter so they can order and pay from their phone, and collect when their name is called. The till then only serves people who want to talk to you.",
          "Keep the till menu to what actually sells in the morning. A short, well-ordered screen is faster than a complete one, and the full menu can stay one tap away.",
          "Decide who does what at peak: one person on orders, one on the machine, one on handover. A tool cannot fix a team that is all standing at the machine.",
        ],
      },
      {
        type: "p",
        text: "In Epidom, the order page of your café is a public link on your own address. Customers order from the phone, the ticket lands on the till and, if you use one, on the kitchen or bar screen. You can try it in the live demo without creating an account.",
      },
      { type: "h2", text: "Know what a cup really costs" },
      {
        type: "p",
        text: "Cost per cup is the number most owners guess. Milk, beans, syrup, the cup, the lid, the sleeve: each is small, and together they decide whether a four-euro drink earns you anything. The only reliable way is to write the recipe down once and let the tool do the arithmetic every time a price changes.",
      },
      {
        type: "list",
        items: [
          "List every ingredient of your ten best sellers with the quantity used, including the cup and the lid. Weigh a few shots and pours instead of trusting memory.",
          "Enter the price you actually pay per kilo or per litre, and update it when your supplier changes it. A margin built on last year's milk price is a guess.",
          "Review the result once a month. Items with a high price and a thin margin deserve a small increase; items that sell a lot at a thin margin deserve a closer look at the recipe.",
        ],
      },
      {
        type: "p",
        text: "Once recipes are linked to your products, each sale can deduct its ingredients from stock and record its cost at the time of the sale. That is what lets a report show gross profit instead of just revenue.",
      },
      { type: "h2", text: "Order stock before it runs out, not after" },
      {
        type: "p",
        text: "Running out of oat milk at nine in the morning costs more than the milk. It costs the sales of every drink that uses it, and it costs the goodwill of the customer who asked. A low-stock list that you check on a fixed day beats any amount of memory.",
      },
      {
        type: "list",
        items: [
          "Set a minimum level for the handful of items that stop service when they run out: milk, beans, cups, lids.",
          "Check the low-stock list once or twice a week and send one order per supplier, instead of several small ones.",
          "Note waste when it happens. A split jug or a dropped tray is cheap to record at the time and impossible to reconstruct at month end.",
        ],
      },
      { type: "h2", text: "Keep selling when the connection drops" },
      {
        type: "p",
        text: "Wi-Fi in a café is rarely perfect. A till that freezes when the connection drops turns a ten-second problem into a lost rush. Check how your tool behaves offline before you need it: whether it keeps taking sales, what it does with them afterwards, and which actions still need a connection.",
      },
      {
        type: "p",
        text: "Epidom's till app for desktop and Android keeps taking sales when the connection drops and sends them when it returns. Opening and closing the shift, cash movements and refunds still need the connection, by design, so the figures stay trustworthy. Test it once on a quiet afternoon by switching the router off, so the first time is not during a rush.",
      },
      { type: "h2", text: "A ten-minute closing routine" },
      {
        type: "list",
        items: [
          "Close the shift and count the cash against what the till expects. Write down the difference, even when it is small.",
          "Look at the day's sales by hour. If the rush starts earlier than your rota, move one shift.",
          "Glance at the low-stock list and note anything for tomorrow's order.",
          "Mark any waste you have not recorded yet.",
        ],
      },
      {
        type: "p",
        text: "None of this needs a big system. It needs the same few numbers, looked at on the same days, by the same person. If a tool makes that easier, good; if it adds a screen nobody opens, drop it. You can try Epidom free, on a demo café with a month of sample orders, before you decide whether it fits.",
      },
    ],
  },
  {
    slug: "restaurant-table-ordering-kitchen-flow",
    locale: "en",
    title: "Restaurant Table Ordering and Kitchen Flow: A Practical Setup",
    description:
      "How to let guests order from the table, send tickets to the right station, keep one till for dine-in, takeaway and delivery, and run stock and the rota from the same place.",
    date: "2026-11-11",
    readMinutes: 7,
    category: "Restaurants",
    blocks: [
      {
        type: "p",
        text: "In a restaurant the order is a relay. A guest decides, a server writes, the kitchen cooks, a runner delivers, and the till closes the loop. Every handoff is a chance for a lost ticket, a wrong table or a dish that sits under the lamp. Better software cannot remove people from that relay, but it can remove the shouting and the paper.",
      },
      {
        type: "p",
        text: "This guide covers the setup that makes the biggest difference for a small or mid-sized restaurant: ordering from the table, a kitchen screen that shows tickets in order, one till for every channel, and the back-office basics of stock, recipes and the rota. It is practical rather than theoretical, and it shows where Epidom fits at each step.",
      },
      { type: "h2", text: "Let guests order from the table" },
      {
        type: "p",
        text: "Table ordering is not about replacing the server. It is about taking the repeat, low-value trips out of the room: the second round of drinks, the extra bread, the bill. Staff spend their time on guests who want advice, and the others order when they are ready.",
      },
      {
        type: "list",
        items: [
          "Put a QR code on each table that opens your menu on the guest's phone, with photos for the dishes people ask about most.",
          "Keep a server for the first order and for anyone who prefers to talk. Table ordering works best as an option, not a rule.",
          "Mark what is unavailable the moment it runs out, so guests never order the last portion twice.",
        ],
      },
      {
        type: "p",
        text: "In Epidom, an order placed from the table arrives as a ticket on the till and on the kitchen screen, tied to the table, with no one retyping it. The live demo lets you see the guest's side and the till's side without signing up.",
      },
      { type: "h2", text: "A kitchen screen instead of paper and shouting" },
      {
        type: "p",
        text: "A paper printer is fine until the rush, when tickets pile up and the order they arrived in is no longer the order they are cooked. A kitchen screen shows every ticket in order, with the time it has waited, and lets the cook mark a dish as ready so the floor knows.",
      },
      {
        type: "list",
        items: [
          "Send starters, mains and desserts to the right station, so the grill does not read the dessert tickets.",
          "Use course timing: fire the main when the starter is cleared, not when it is ordered.",
          "Keep a printer as a backup. A screen that loses power during service should never mean a kitchen that cannot read an order.",
        ],
      },
      {
        type: "p",
        text: "Epidom lets you route tickets to different printers, such as a kitchen printer and a bar printer, and offers a kitchen display for kitchens that prefer a screen. Pick whichever your cooks will really use; a feature nobody looks at is worse than none.",
      },
      { type: "h2", text: "One till for dine-in, takeaway and delivery" },
      {
        type: "p",
        text: "Many restaurants run three or four separate lists: the till, a tablet for a delivery app, a notebook for phone orders. At the end of the week nobody can say what the real numbers are. One till for every channel puts all sales in one report, and it is the only way to compare the channels honestly.",
      },
      {
        type: "list",
        items: [
          "Record each order with its channel, so you can see what dine-in, takeaway and delivery each bring in.",
          "Compare delivery-app sales with the commission they cost. A busy channel with a thin margin is not the same as a busy channel.",
          "Offer your own ordering link for takeaway, so regulars can order direct and you keep the full amount.",
        ],
      },
      { type: "h2", text: "Stock, recipes and the rota in the same place" },
      {
        type: "p",
        text: "Behind the pass, three numbers decide the month: the cost of each dish, what you threw away, and the hours you paid. They tend to live in three different places, which is why they are checked rarely.",
      },
      {
        type: "list",
        items: [
          "Write each recipe once with its ingredients and quantities, and let the system work out the cost per portion as prices change.",
          "Track waste as it happens: a dropped plate, a batch that turned. Over a month it is often the largest cost you cannot see.",
          "Build the weekly rota from last week's busiest hours, then compare hours worked with what the roster said.",
        ],
      },
      {
        type: "p",
        text: "Epidom keeps recipes, stock, supplier orders and staff rosters next to the till, so a sale updates stock and the cost of the dish shows up beside its price. That is the part that usually takes the longest to set up, so start with your twenty best sellers and add the rest over a few weeks.",
      },
      { type: "h2", text: "Where to start this week" },
      {
        type: "p",
        text: "You do not need to switch everything at once. Pick the handoff that hurts most. If tickets get lost, start with the kitchen screen or a second printer. If the bill is slow, start with table ordering. If the margin is a mystery, start with five recipes. Try it on the demo restaurant first, then on a quiet Tuesday service, and only then on a Saturday night.",
      },
    ],
  },
  {
    slug: "bakery-costing-batch-stock",
    locale: "en",
    title: "Bakery Costing and Stock: Pricing Pastries You Bake in Batches",
    description:
      "How bakeries can cost a batch recipe, sell by the piece, the tray or the box, bake the right amount each morning and take orders ahead without a notebook.",
    date: "2026-11-11",
    readMinutes: 7,
    category: "Bakeries",
    blocks: [
      {
        type: "p",
        text: "A bakery sells one croissant at a time, but it makes forty at a time. That mismatch is the whole business problem. You commit to the batch before you know who will buy it, the leftovers are worth much less by evening, and the cost of one piece is hidden inside a recipe written for a tray.",
      },
      {
        type: "p",
        text: "This guide is about three habits that fix most of it: costing a recipe per piece, baking to a number instead of a feeling, and taking orders ahead so the cakes and the morning boxes are never a surprise. It assumes a small bakery with a counter and a few regulars, and it shows how each habit looks in Epidom.",
      },
      { type: "h2", text: "Cost the batch, then divide" },
      {
        type: "p",
        text: "Flour, butter, eggs and sugar are bought by the kilo, used by the gram and sold by the piece. The arithmetic is easy to get wrong in your head and tedious to do by hand every time butter changes price. Write the recipe once, with the yield, and let the cost per piece follow.",
      },
      {
        type: "list",
        items: [
          "Enter the full recipe with the number of pieces it makes, not the number you hope it makes. Weigh a real batch once to check the yield.",
          "Include the things that are easy to forget: the paper, the box, the glaze, the gas or electricity for the oven if you want a full cost.",
          "Keep one price per recipe for ingredients and update it when a supplier changes a price. Butter alone can move a croissant's margin.",
        ],
      },
      {
        type: "p",
        text: "In Epidom, a recipe is linked to a product and its ingredients are raw materials with their own prices. The cost per piece updates when a price does, and each sale records the cost at that moment, so a report shows the real gross profit of a croissant, not the one from last spring.",
      },
      { type: "h2", text: "Sell by the piece, the tray or the box" },
      {
        type: "p",
        text: "The same product often sells in different formats: one pastry, a box of six, a tray for an office. Each format has its own price and its own packaging cost, and mixing them up quietly eats margin.",
      },
      {
        type: "list",
        items: [
          "Create the box and the tray as their own items, with their own price and packaging, instead of discounting the single piece in your head.",
          "Offer a mixed box that customers can compose. It raises the average ticket and it is a good way to move items that sell slowly.",
          "Review prices when an ingredient jumps. A small increase on the items people buy without looking is easier than a large one later.",
        ],
      },
      { type: "h2", text: "Bake the right amount" },
      {
        type: "p",
        text: "Baking too little loses sales; baking too much loses money, because yesterday's bread sells for far less than today's. The answer is not a feeling in your wrist. It is the last few weeks of sales for the same day of the week, and a record of what you threw away.",
      },
      {
        type: "list",
        items: [
          "Look at sales by item for the same weekday over the last month, and set a starting quantity from that.",
          "Record what is left at closing, every day. After two weeks you have a number for each item that is more reliable than memory.",
          "Decide in advance what happens to the unsold items: a discount at a set hour, a donation, tomorrow's bread pudding. A plan beats improvising at closing time.",
        ],
      },
      {
        type: "p",
        text: "Epidom tracks stock and waste per item, and the sales report shows what sold by hour and by day. That is enough to turn the baking list from guesswork into a table you adjust weekly. Start with your five best sellers, because they carry most of the waste.",
      },
      { type: "h2", text: "Take orders ahead without a notebook" },
      {
        type: "p",
        text: "Cakes, party boxes and the Sunday morning order are the most profitable and the most fragile part of a bakery, because they live in a notebook, a phone and someone's head. One lost line is a disappointed customer on a birthday.",
      },
      {
        type: "list",
        items: [
          "Give customers one link where they can see what you offer and place an order from their phone, instead of sending messages that you retype later.",
          "Ask for the pickup time and any note at the moment of ordering, so you never call back for details.",
          "Print or display the day's orders at the start of the shift, so the baker sees what is committed before deciding the batch.",
        ],
      },
      {
        type: "p",
        text: "Your Epidom page is a public link on your own address, with the menu, photos and an order form. The orders land on the till next to the counter sales, so one list tells you what to bake. Try the demo to see the customer side.",
      },
      { type: "h2", text: "A simple weekly review" },
      {
        type: "p",
        text: "Once a week, take ten minutes with three numbers: gross profit per item, waste per item and the busiest hours. If an item has a good margin and little waste, make it easier to find. If it has high waste, bake fewer. If the rush starts before the oven is ready, move the first batch earlier. That loop, repeated, does more for a bakery than any single tool.",
      },
    ],
  },
  {
    slug: "bar-pour-cost-rounds-closing",
    locale: "en",
    title: "Bar Operations: Rounds, Pour Costs and a Closing Routine",
    description:
      "How small bars can take rounds fast, order from the table without queueing, route drinks and food to the right station, and know the margin per drink and per night.",
    date: "2026-11-11",
    readMinutes: 7,
    category: "Bars",
    blocks: [
      {
        type: "p",
        text: "A bar has the opposite problem from a café. Nobody is in a hurry to leave, but everybody wants the next round at the same moment. Orders come in groups, tabs stay open for hours and the cost of a drink depends on a pour that is different every time. The risk is not a lost sale, it is a night that looks busy and earns less than it should.",
      },
      {
        type: "p",
        text: "This guide covers four things a small bar can fix without a big investment: taking rounds quickly, letting guests order from the table, sending drinks and food to the right place, and knowing the margin per drink and per night. It shows how each one looks in Epidom, so you can judge whether it fits.",
      },
      { type: "h2", text: "Take rounds fast, and keep tabs honest" },
      {
        type: "p",
        text: "At peak, a round of six drinks for one table should take a few taps, not a conversation. The same applies to a tab that grows through the evening: if adding to it is slow, bartenders skip it, and a skipped drink is a drink you paid for.",
      },
      {
        type: "list",
        items: [
          "Put your ten most ordered drinks on the first screen, with modifiers such as ice, size and mixer within a tap.",
          "Keep a bill open per table or per name, add to it as the night goes on and settle it once, instead of keeping the tab in your head or on a napkin.",
          "Settle tabs at a fixed moment, such as last call, so nothing is left behind a closing queue.",
        ],
      },
      { type: "h2", text: "Let guests order from the table" },
      {
        type: "p",
        text: "On a busy night the bar itself is the bottleneck. Guests wait to catch a bartender's eye, and the ones who give up leave without the extra round. Table ordering moves that wait off the bar and onto the guest's phone, where it costs you nothing.",
      },
      {
        type: "list",
        items: [
          "Put a QR code on each table or on the menu card, and let guests order their next round when they are ready.",
          "Keep a clear pickup rule: table service, or collect at the bar when your name appears. Guests accept either if it is obvious.",
          "Check the age and licensing rules that apply where you operate, and keep the handover of alcohol in a person's hands, whatever the tool.",
        ],
      },
      {
        type: "p",
        text: "In Epidom, an order from the table arrives as a ticket on the till and, if you use a bar printer or screen, at the right station. Nothing is retyped, and the table is on the ticket. The live demo shows both sides.",
      },
      { type: "h2", text: "Drinks to the bar, food to the kitchen" },
      {
        type: "p",
        text: "A bar that serves food runs two stations from one order. If a ticket with a cocktail and a burger prints in one place, either the bartender reads food or the cook reads drinks. Splitting the ticket by item type fixes that and keeps both stations moving.",
      },
      {
        type: "list",
        items: [
          "Assign every item a station: bar, kitchen or both. A mixed order then prints in two places and nobody reads what is not theirs.",
          "Add a label printer if you sell bottled drinks, takeaway cups or want a ticket on each glass.",
          "Test the whole path with a real order before the evening, from the guest's phone to each printer.",
        ],
      },
      {
        type: "p",
        text: "Epidom supports several printers with different roles, such as receipt, kitchen, bar and label, so one order can print where it needs to. Check the hardware you already own first; many common receipt printers work.",
      },
      { type: "h2", text: "Know the margin per drink and per night" },
      {
        type: "p",
        text: "Pour cost is the share of a drink's price that goes to what is in the glass. It is the first number a bar owner should know and the last one most estimate. Build it from the recipe: the spirit in millilitres, the mixer, the garnish, the ice and the glass, at the price you actually pay.",
      },
      {
        type: "list",
        items: [
          "Write each cocktail as a recipe with exact measures, and standardise the pour with a jigger so the recipe is true.",
          "Count the bottles at closing for your top spirits, and compare with what the sales say should be left. A gap is the signal to look closer.",
          "Look at margin per drink and per night, not only revenue. A packed night of low-margin drinks can earn less than a quieter one.",
        ],
      },
      {
        type: "p",
        text: "With recipes linked to products, Epidom records the cost of each drink at the time of sale and shows gross profit in the finance report. The accuracy still depends on your measures and on keeping the prices of your bottles up to date.",
      },
      { type: "h2", text: "A closing routine that fits in a short time" },
      {
        type: "list",
        items: [
          "Close the tabs and the shift, count the cash and write down any difference.",
          "Count the bottles that matter and record any breakage or spillage as waste.",
          "Look at the night's sales by hour and note when the rush really started.",
          "Write the order for tomorrow if the low-stock list says something is short.",
        ],
      },
      {
        type: "p",
        text: "Do the same few steps every night and the numbers start to mean something. You can try the demo bar, with a month of sample sales and recipes, free and without an account, to see how the screens look before you set up your own.",
      },
    ],
  },
  {
    slug: "food-truck-short-menu-fast-line",
    locale: "en",
    title: "Food Truck Playbook: A Short Menu, a Fast Line and Patchy Wi-Fi",
    description:
      "A field guide for food trucks: build a short menu that sells fast, let customers order from a QR code in the line, keep trading offline and know your margin per event.",
    date: "2026-11-11",
    readMinutes: 6,
    category: "Food trucks",
    blocks: [
      {
        type: "p",
        text: "A food truck is a restaurant with a serving window, no dining room and a connection that is only as good as the car park. The constraints are tight: a small space, a short service, a line of people who will not wait long and a signal that comes and goes. The trucks that do well turn those constraints into rules.",
      },
      {
        type: "p",
        text: "This guide covers four rules: keep the menu short, move ordering out of the window, keep trading when the signal drops and measure each event separately. It is for owner-operators of one truck, and it shows where Epidom helps at each step, so you can judge whether it fits.",
      },
      { type: "h2", text: "Rule one: a short menu that sells fast" },
      {
        type: "p",
        text: "Every extra item slows the line, adds stock to carry and makes the window harder to read. A short menu is quicker to cook, easier to cost and easier to remember. Most trucks sell a few signature items far more than the rest.",
      },
      {
        type: "list",
        items: [
          "Cut the menu to what you can serve in a couple of minutes per order at the busiest moment. Keep the rest for a special day.",
          "Make the best seller the easiest to order and the easiest to make, and put its price where the line can read it.",
          "Offer choices as simple options, such as size or sauce, rather than as new items. It keeps the till screen small.",
        ],
      },
      { type: "h2", text: "Rule two: take the order before the window" },
      {
        type: "p",
        text: "The window is the bottleneck: one person taking, cooking and handing over. Anything that moves ordering earlier shortens the wait for everyone. A QR code on a board in the line lets people choose and pay while they queue, so the window only collects.",
      },
      {
        type: "list",
        items: [
          "Put a large QR code where the line forms, with a short line of text saying what it does.",
          "Show the pickup name or number clearly, so people know when to step forward.",
          "Keep a till at the window for those who prefer to order there. Both channels should land in the same list.",
        ],
      },
      {
        type: "p",
        text: "In Epidom, your truck has a public order page on your own address. Orders from phones arrive on the till alongside window sales, in one list. Try the live demo to see what a customer sees, then print your own QR code.",
      },
      { type: "h2", text: "Rule three: keep trading when the signal drops" },
      {
        type: "p",
        text: "Markets, car parks and festivals are exactly where connections fail. A till that needs the internet for every sale loses the best hour of the day. Before you rely on any tool, test how it behaves offline: does it keep taking sales, and what happens to them afterwards?",
      },
      {
        type: "list",
        items: [
          "Test the till with the phone in airplane mode before the first event, not during it.",
          "Know which actions still need a connection. In Epidom these are the shift, cash movements and refunds, so plan to open and close in a place with signal.",
          "Keep a card reader that has its own mobile data, separate from the till, so a weak connection on one does not stop the other.",
        ],
      },
      {
        type: "p",
        text: "Epidom's till app for desktop and Android keeps taking sales without a connection and sends them when it comes back. Treat the first event as a rehearsal and check that every sale made offline appears afterwards.",
      },
      { type: "h2", text: "Rule four: measure each event" },
      {
        type: "p",
        text: "A truck's week is made of very different days: a lunchtime car park, a Saturday market, an evening festival. A single monthly total hides which of them is worth the fee and the fuel. Measure each one on its own.",
      },
      {
        type: "list",
        items: [
          "Note the pitch or event cost and compare it with the gross profit of that day, not only the revenue.",
          "Record the stock you took and the stock you brought back. It tells you what to prep next time.",
          "Look at sales by hour. If the rush is shorter than the event, you can leave earlier or bring less.",
        ],
      },
      {
        type: "p",
        text: "Epidom's reports show sales by hour and by item, and gross profit once your recipes are costed. Add the event cost as an expense and you have the day's real result. A weekly look at the same few numbers will tell you where to park next month.",
      },
      { type: "h2", text: "A checklist for the morning of an event" },
      {
        type: "list",
        items: [
          "Charge the phone, the printer and the card reader, and pack a spare cable.",
          "Open the till and the shift while you still have signal.",
          "Print or display the QR code and check it opens the order page.",
          "Check the low-stock list against what is on the truck.",
        ],
      },
      {
        type: "p",
        text: "Run through the same list every time and the day becomes routine. You can try Epidom free on a demo food truck with sample sales before you set up your own menu.",
      },
    ],
  },
];
