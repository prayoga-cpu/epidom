import { Prisma, SubscriptionPlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { subscriptionService } from "@/lib/services";
import { PAGE_INTRO_IDS } from "@/lib/guide/contracts";
import { DEMO_SLUG } from "./demo-constants";

/**
 * The public, no-login demo: one shared, read-only café ("Your Café",
 * epidom.fr/@your-cafe) with complete dummy data, behind the home page's
 * "No login, live demo" links (src/app/demo/[target]/route.ts).
 *
 * Nothing here is a real customer: names, numbers and amounts are invented.
 * The demo user has NO password (no credential Account), so the only way in is
 * the demo entry route, whose sessions are recognisable (token prefix) and
 * blocked from every write by src/proxy.ts and the public order route.
 *
 * Idempotent: `ensureDemoCafe()` seeds when missing and re-dates the orders
 * when the newest one is stale, so "today" always has live-looking activity.
 */

export { DEMO_SLUG };
export const DEMO_EMAIL = "demo.your-cafe@epidom.fr";
const DEMO_NAME = "Your Café";
/** The owner is a person: the dashboard greets the first word of the account name. */
const DEMO_OWNER = "Camille Laurent";
/** Re-date the orders when the newest is older than this. */
const STALE_AFTER_MS = 10 * 60 * 60 * 1000;
const DAYS = 30;

type Dept = "BAR" | "KITCHEN";
const MENU: ReadonlyArray<{
  category: string;
  items: ReadonlyArray<{
    name: string;
    price: number;
    cost: number;
    dept: Dept;
    stock?: number;
    description: string;
  }>;
}> = [
  {
    category: "Coffee",
    items: [
      {
        name: "Espresso",
        price: 2.5,
        cost: 0.45,
        dept: "BAR",
        description: "Single origin, short and strong.",
      },
      {
        name: "Flat white",
        price: 3.8,
        cost: 0.8,
        dept: "BAR",
        description: "Double ristretto, silky milk.",
      },
      {
        name: "Cappuccino",
        price: 3.8,
        cost: 0.75,
        dept: "BAR",
        description: "Equal parts espresso, milk and foam.",
      },
      {
        name: "Iced latte",
        price: 4.5,
        cost: 0.9,
        dept: "BAR",
        description: "Espresso over ice and cold milk.",
      },
      {
        name: "Matcha latte",
        price: 4.9,
        cost: 1.3,
        dept: "BAR",
        description: "Ceremonial matcha, oat or whole milk.",
      },
    ],
  },
  {
    category: "Pastry",
    items: [
      {
        name: "Butter croissant",
        price: 2.6,
        cost: 0.7,
        dept: "KITCHEN",
        stock: 24,
        description: "Baked every morning.",
      },
      {
        name: "Pain au chocolat",
        price: 2.8,
        cost: 0.8,
        dept: "KITCHEN",
        stock: 18,
        description: "Two bars of dark chocolate.",
      },
      {
        name: "Butter cookie",
        price: 2.8,
        cost: 0.6,
        dept: "KITCHEN",
        stock: 30,
        description: "Crisp edges, soft middle.",
      },
      {
        name: "Cinnamon roll",
        price: 3.5,
        cost: 0.9,
        dept: "KITCHEN",
        stock: 12,
        description: "Warm, with cream cheese glaze.",
      },
    ],
  },
  {
    category: "Brunch",
    items: [
      {
        name: "Avocado toast",
        price: 9.5,
        cost: 2.6,
        dept: "KITCHEN",
        description: "Sourdough, avocado, soft egg, chili.",
      },
      {
        name: "Granola bowl",
        price: 7.5,
        cost: 1.9,
        dept: "KITCHEN",
        description: "Yoghurt, granola, seasonal fruit.",
      },
      {
        name: "Croque-monsieur",
        price: 8.9,
        cost: 2.4,
        dept: "KITCHEN",
        description: "Ham, gruyère, béchamel.",
      },
    ],
  },
];

/** [name, unit, unitCost, stock, min, max]: two sit under their minimum, so Alerts has something to show. */
const MATERIALS: ReadonlyArray<[string, string, number, number, number, number]> = [
  ["Coffee beans", "kg", 22, 8.4, 3, 20],
  ["Whole milk", "L", 1.1, 18, 10, 40],
  ["Oat milk", "L", 2.2, 4, 6, 24],
  ["Butter", "kg", 9, 6.5, 2, 12],
  ["Flour T55", "kg", 1.2, 25, 10, 60],
  ["Sugar", "kg", 1.1, 12, 4, 30],
  ["Eggs", "piece", 0.3, 90, 60, 240],
  ["Avocado", "piece", 1.1, 14, 12, 40],
  ["Sourdough loaf", "piece", 3.5, 6, 4, 16],
  ["Matcha powder", "kg", 60, 0.4, 0.5, 2],
];

const SUPPLIERS: ReadonlyArray<[string, string, string, string]> = [
  [
    "Torréfaction du Port",
    "Julie Moreau",
    "julie@torrefaction-du-port.example",
    "+33 4 78 00 00 01",
  ],
  ["Laiterie Alpine", "Marc Dubois", "commandes@laiterie-alpine.example", "+33 4 78 00 00 02"],
  ["Moulin & Fils", "Anaïs Petit", "anais@moulin-et-fils.example", "+33 4 78 00 00 03"],
  ["Maraîcher Bellecour", "Hugo Roche", "hugo@maraicher-bellecour.example", "+33 4 78 00 00 04"],
];

const CUSTOMERS = [
  "Emma Laurent",
  "Lucas Girard",
  "Chloé Fournier",
  "Nathan Lambert",
  "Inès Mercier",
  "Hugo Faure",
  "Jade Rousseau",
  "Louis Blanc",
  "Manon Garnier",
  "Théo Chevalier",
  "Zoé Robin",
  "Adam Henry",
];

const STAFF: ReadonlyArray<{
  name: string;
  role: "OWNER" | "MANAGER" | "CASHIER" | "KITCHEN";
  rate: number;
}> = [
  { name: "Camille Laurent", role: "OWNER", rate: 0 },
  { name: "Léa Martin", role: "MANAGER", rate: 16 },
  { name: "Tom Bernard", role: "CASHIER", rate: 12.5 },
  { name: "Sam Okafor", role: "KITCHEN", rate: 13 },
];

/** A tiny seeded generator, so a re-dated demo looks the same every time it refreshes. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a * 1664525 + 1013904223) % 4294967296;
    return a / 4294967296;
  };
}

export async function ensureDemoCafe(): Promise<{ userId: string; storeId: string }> {
  const existing = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    select: {
      id: true,
      name: true,
      guideState: true,
      business: { select: { stores: { select: { id: true }, take: 1 } } },
    },
  });
  const storeId = existing?.business?.stores[0]?.id;
  // A changed name means someone got a write through: rebuild rather than trust it.
  const shell = await prisma.storefront.findUnique({
    where: { slug: DEMO_SLUG },
    select: { openingHours: true },
  });
  if (
    existing &&
    storeId &&
    existing.name === DEMO_OWNER &&
    existing.guideState &&
    shell?.openingHours
  ) {
    const newest = await prisma.order.findFirst({
      where: { storeId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (newest && Date.now() - newest.createdAt.getTime() < STALE_AFTER_MS) {
      return { userId: existing.id, storeId };
    }
  }
  return seedDemoCafe();
}

/** (Re)builds the whole demo account. Safe to call again: it replaces its own data. */
export async function seedDemoCafe(): Promise<{ userId: string; storeId: string }> {
  const now = new Date();
  const { userId, storeId, storefrontId } = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('epidom-demo-cafe'))`;

      const user = await tx.user.upsert({
        where: { email: DEMO_EMAIL },
        update: { name: DEMO_OWNER, emailVerified: true, hasOnboarded: true, updatedAt: now },
        create: {
          email: DEMO_EMAIL,
          name: DEMO_OWNER,
          emailVerified: true,
          hasOnboarded: true,
          locale: "en",
          timezone: "Europe/Paris",
          createdAt: now,
          updatedAt: now,
        },
      });
      const business = await tx.business.upsert({
        where: { userId: user.id },
        update: { name: DEMO_NAME },
        create: {
          userId: user.id,
          name: DEMO_NAME,
          city: "Lyon",
          country: "FR",
          timezone: "Europe/Paris",
          locale: "en",
          businessType: "cafe",
        },
      });
      let store = await tx.store.findFirst({
        where: { businessId: business.id },
        select: { id: true },
      });
      if (!store) {
        store = await tx.store.create({
          data: { businessId: business.id, name: DEMO_NAME, city: "Lyon", country: "FR" },
          select: { id: true },
        });
      }
      const sid = store.id;

      // Everything below is replaced on every run (the account itself stays).
      await tx.order.deleteMany({ where: { storeId: sid } });
      await tx.shift.deleteMany({ where: { storeId: sid } });
      await tx.customer.deleteMany({ where: { storeId: sid } });
      await tx.stockMovement.deleteMany({
        where: { OR: [{ product: { storeId: sid } }, { material: { storeId: sid } }] },
      });
      await tx.supplier.deleteMany({ where: { storeId: sid } });
      await tx.storefront.deleteMany({ where: { storeId: sid } });
      await tx.product.deleteMany({ where: { storeId: sid } });
      await tx.material.deleteMany({ where: { storeId: sid } });
      await tx.table.deleteMany({ where: { storeId: sid } });
      await tx.staffMember.deleteMany({ where: { storeId: sid } });

      await tx.storeFinanceSettings.upsert({
        where: { storeId: sid },
        update: {
          currency: "EUR",
          market: "FRANCE",
          enabledPaymentMethods: ["CASH", "STRIPE_CARD"],
        },
        create: {
          storeId: sid,
          currency: "EUR",
          market: "FRANCE",
          enabledPaymentMethods: ["CASH", "STRIPE_CARD"],
          processingFeeEnabled: false,
        },
      });

      await tx.staffMember.createMany({
        data: STAFF.map((s) => ({
          storeId: sid,
          name: s.name,
          role: s.role,
          isActive: true,
          inviteStatus: "accepted",
          ...(s.rate ? { payType: "HOURLY" as const, payRate: s.rate } : {}),
        })),
      });
      await tx.table.createMany({
        data: ["T1", "T2", "T3", "T4", "T5", "Terrace"].map((label, i) => ({
          storeId: sid,
          label,
          capacity: i < 3 ? 2 : 4,
        })),
      });

      const storefront = await tx.storefront.create({
        data: {
          storeId: sid,
          slug: DEMO_SLUG,
          displayName: DEMO_NAME,
          tagline: "Coffee, pastry and brunch",
          description:
            "A demo café. Everything you see here (menu, prices, orders, stock, staff) is sample data: try the till and the dashboard, nothing is real and nothing can be changed.",
          themeColor: "#C9972B",
          isPublished: true,
          acceptsOrders: true,
          openingHours: Object.fromEntries(
            ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map(
              (day) => [day, { open: "07:00", close: "18:00", isClosed: false }]
            )
          ),
        },
        select: { id: true },
      });

      for (const [ci, group] of MENU.entries()) {
        const category = await tx.menuCategory.create({
          data: { storefrontId: storefront.id, name: group.category, displayOrder: ci },
          select: { id: true },
        });
        for (const [ii, item] of group.items.entries()) {
          const stocked = item.stock !== undefined;
          const product = await tx.product.create({
            data: {
              storeId: sid,
              sku: `DEMO-${ci}${ii}`,
              name: item.name,
              category: group.category,
              department: item.dept,
              costPrice: item.cost,
              costPriceManual: true,
              sellingPrice: item.price,
              unit: "piece",
              stockMode: stocked ? "BATCH_PRODUCED" : "MADE_TO_ORDER",
              currentStock: item.stock ?? 0,
              minStock: stocked ? 6 : 0,
              maxStock: stocked ? 48 : 1000,
            },
            select: { id: true },
          });
          await tx.menuItem.create({
            data: {
              storefrontId: storefront.id,
              categoryId: category.id,
              productId: product.id,
              department: item.dept,
              name: item.name,
              description: item.description,
              price: item.price,
              currency: "EUR",
              isFeatured: ii === 0,
              displayOrder: ii,
            },
          });
        }
      }

      await tx.material.createMany({
        data: MATERIALS.map(([name, unit, unitCost, stock, min, max], i) => ({
          storeId: sid,
          sku: `DEMO-M${i}`,
          name,
          unit,
          unitCost,
          currentStock: stock,
          minStock: min,
          maxStock: max,
        })),
      });
      await tx.supplier.createMany({
        data: SUPPLIERS.map(([name, contactPerson, email, phone]) => ({
          storeId: sid,
          name,
          contactPerson,
          email,
          phone,
          city: "Lyon",
          country: "FR",
        })),
      });
      await tx.customer.createMany({
        data: CUSTOMERS.map((name, i) => ({
          storeId: sid,
          name,
          email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
          phone: `+33 6 12 34 ${String(50 + i).padStart(2, "0")} ${String(10 + i * 3).padStart(2, "0")}`,
          points: 10 + ((i * 37) % 180),
          memberSince: new Date(now.getTime() - (20 + i * 9) * 86_400_000),
        })),
      });

      return { userId: user.id, storeId: sid, storefrontId: storefront.id };
    },
    { timeout: 60_000, maxWait: 15_000 }
  );

  await subscriptionService.grantPlanWithoutPayment(userId, SubscriptionPlan.OPERATIONS);
  // No welcome tour, tips or checklist over a demo: the visitor came to look at the screens.
  await prisma.user.update({
    where: { id: userId },
    data: {
      guideState: {
        tourSeenAt: now.toISOString(),
        dismissedTips: [...PAGE_INTRO_IDS],
        dismissedChecklists: [storeId],
      },
    },
  });
  await seedOrders(storeId, storefrontId, now);
  return { userId, storeId };
}

/** Thirty days of orders (busier on weekends), plus a live queue for "now". */
async function seedOrders(storeId: string, storefrontId: string, now: Date): Promise<void> {
  const [products, customers, staff] = await Promise.all([
    prisma.product.findMany({
      where: { storeId },
      select: {
        id: true,
        name: true,
        sellingPrice: true,
        costPrice: true,
        department: true,
        menuItems: { select: { id: true }, take: 1 },
      },
    }),
    prisma.customer.findMany({ where: { storeId }, select: { id: true, name: true } }),
    prisma.staffMember.findMany({ where: { storeId }, select: { id: true, role: true } }),
  ]);
  const cashier = staff.find((s) => s.role === "CASHIER") ?? staff[0];
  const rand = rng(20261107);
  // Coffee sells most; the rest in proportion.
  const weights = products.map((p) => (p.department === "BAR" ? 3 : 1.4));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const pick = () => {
    let r = rand() * totalWeight;
    for (let i = 0; i < products.length; i++) {
      r -= weights[i];
      if (r <= 0) return products[i];
    }
    return products[0];
  };

  type OrderRow = Prisma.OrderCreateManyInput;
  type ItemRow = Prisma.OrderItemCreateManyInput;
  const orders: OrderRow[] = [];
  const items: ItemRow[] = [];
  const payments: Prisma.OrderPaymentCreateManyInput[] = [];
  let seq = 0;

  const addOrder = (
    when: Date,
    status: "DELIVERED" | "CONFIRMED" | "IN_PRODUCTION" | "READY",
    queue: number
  ) => {
    const lines = 1 + Math.floor(rand() * 3);
    const id = `demo${String(++seq).padStart(5, "0")}`;
    let subtotal = 0;
    for (let l = 0; l < lines; l++) {
      const product = pick();
      const quantity = rand() < 0.2 ? 2 : 1;
      const price = Number(product.sellingPrice);
      const total = Math.round(price * quantity * 100) / 100;
      subtotal += total;
      items.push({
        id: `${id}i${l}`,
        orderId: id,
        productId: product.id,
        menuItemId: product.menuItems[0]?.id ?? null,
        name: product.name,
        quantity,
        unit: "piece",
        unitPrice: price,
        total,
        department: product.department,
        unitCostSnapshot: product.costPrice,
        status: status === "DELIVERED" ? "SERVED" : status === "READY" ? "READY" : "PENDING",
        createdAt: when,
      });
    }
    subtotal = Math.round(subtotal * 100) / 100;
    const customer = rand() < 0.35 ? customers[Math.floor(rand() * customers.length)] : null;
    const storefrontOrder = rand() < 0.12;
    const card = rand() < 0.62;
    const paid = status === "DELIVERED";
    const day = when.toISOString().slice(0, 10).replace(/-/g, "");
    orders.push({
      id,
      orderNumber: `DEMO-${day}-${String(seq).padStart(4, "0")}`,
      customerName: customer?.name ?? "Walk-in",
      customerId: customer?.id ?? null,
      status,
      orderDate: when,
      deliveredDate: paid ? new Date(when.getTime() + 9 * 60_000) : null,
      subtotal,
      total: subtotal,
      storeId,
      storefrontId: storefrontOrder ? storefrontId : null,
      source: storefrontOrder ? "STOREFRONT" : "POS",
      orderType: rand() < 0.5 ? "DINE_IN" : "TAKEAWAY",
      paymentMethod: card ? "STRIPE_CARD" : "CASH",
      paymentStatus: paid ? "PAID" : "PENDING",
      queueNumber: queue,
      createdAt: when,
      updatedAt: when,
    });
    if (paid) {
      payments.push({
        orderId: id,
        method: card ? "STRIPE_CARD" : "CASH",
        amount: subtotal,
        createdAt: when,
      });
    }
  };

  for (let d = DAYS; d >= 1; d--) {
    const dayStart = new Date(now.getTime() - d * 86_400_000);
    const weekend = [0, 6].includes(dayStart.getUTCDay());
    const count = (weekend ? 26 : 17) + Math.floor(rand() * 8);
    for (let n = 0; n < count; n++) {
      const when = new Date(dayStart);
      when.setUTCHours(6 + Math.floor(rand() * 10), Math.floor(rand() * 60), 0, 0);
      addOrder(when, "DELIVERED", n + 1);
    }
  }
  // Today: finished orders earlier, and a live queue in the last half hour.
  for (let n = 0; n < 9; n++) {
    addOrder(new Date(now.getTime() - (60 + rand() * 240) * 60_000), "DELIVERED", n + 1);
  }
  (["IN_PRODUCTION", "IN_PRODUCTION", "CONFIRMED", "CONFIRMED", "READY"] as const).forEach(
    (status, i) => {
      addOrder(new Date(now.getTime() - (4 + i * 5) * 60_000), status, 10 + i);
    }
  );

  for (let i = 0; i < orders.length; i += 500) {
    await prisma.order.createMany({ data: orders.slice(i, i + 500) });
  }
  for (let i = 0; i < items.length; i += 500) {
    await prisma.orderItem.createMany({ data: items.slice(i, i + 500) });
  }
  for (let i = 0; i < payments.length; i += 500) {
    await prisma.orderPayment.createMany({ data: payments.slice(i, i + 500) });
  }

  // One closed shift per past day, and one open now (the till shows "Shift open").
  await prisma.shift.createMany({
    data: [
      ...Array.from({ length: 7 }, (_, k) => {
        const open = new Date(now.getTime() - (k + 1) * 86_400_000);
        open.setUTCHours(6, 30, 0, 0);
        const close = new Date(open.getTime() + 10 * 3_600_000);
        return {
          storeId,
          staffMemberId: cashier.id,
          openedAt: open,
          closedAt: close,
          openingCash: 150,
          closingCash: 612.4 + k * 11.3,
          expectedCash: 612.4 + k * 11.3,
          cashDifference: 0,
          closedByStaffMemberId: cashier.id,
        };
      }),
      {
        storeId,
        staffMemberId: cashier.id,
        openedAt: new Date(now.getTime() - 5 * 3_600_000),
        openingCash: 150,
      },
    ],
  });
}
