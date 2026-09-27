import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PlanTier } from "@/lib/plans/entitlements";
import { SETUP_ITEM_IDS, type SetupItemId, type SetupProgress } from "@/lib/guide/contracts";

const prismaMock = vi.hoisted(() => ({
  store: { findUnique: vi.fn() },
  menuItem: { count: vi.fn() },
  storefrontEvent: { findFirst: vi.fn() },
  order: { findFirst: vi.fn() },
  shift: { findFirst: vi.fn() },
  table: { findFirst: vi.fn() },
  material: { findFirst: vi.fn() },
  product: { findFirst: vi.fn() },
  supplier: { findFirst: vi.fn() },
  staffMember: { findFirst: vi.fn() },
  staffSchedule: { findFirst: vi.fn() },
  scheduleImage: { findFirst: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const getStorePlan = vi.hoisted(() => vi.fn());
vi.mock("@/lib/plans/store-plan", () => ({ getStorePlan }));

import {
  canOpenSetupItem,
  getSetupProgress,
  isWithinNewStoreWindow,
  normalizeGoals,
  orderSections,
  SETUP_ITEM_SPECS,
} from "../setup-progress.service";

const STORE = "store_1";
const NOW = new Date("2026-09-26T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const found = { id: "row" };

interface StoreRowOptions {
  createdAt?: Date;
  goals?: string[];
  storefront?: {
    isPublished?: boolean;
    logoUrl?: string | null;
    heroImageUrl?: string | null;
    whatsappNumber?: string | null;
  } | null;
}

function storeRow({
  createdAt = new Date(NOW.getTime() - 3 * DAY),
  goals = [],
  storefront,
}: StoreRowOptions = {}) {
  return {
    createdAt,
    business: { onboardingGoals: goals },
    storefront:
      storefront === null
        ? null
        : {
            isPublished: false,
            logoUrl: null,
            heroImageUrl: null,
            whatsappNumber: null,
            ...storefront,
          },
  };
}

/** menuItem.count is called twice: all items, then items with a photo. */
function menuCounts(items: number, photos: number) {
  prismaMock.menuItem.count.mockImplementation(
    async ({ where }: { where: Record<string, unknown> }) => ("imageUrl" in where ? photos : items)
  );
}

const byId = (progress: SetupProgress) =>
  Object.fromEntries(progress.items.map((item) => [item.id, item])) as Record<
    SetupItemId,
    SetupProgress["items"][number]
  >;

async function run(plan: PlanTier, options: StoreRowOptions = {}) {
  getStorePlan.mockResolvedValue(plan);
  prismaMock.store.findUnique.mockResolvedValue(storeRow(options));
  return getSetupProgress(STORE, NOW);
}

beforeEach(() => {
  vi.clearAllMocks();
  menuCounts(0, 0);
  for (const model of [
    prismaMock.storefrontEvent,
    prismaMock.order,
    prismaMock.shift,
    prismaMock.table,
    prismaMock.material,
    prismaMock.product,
    prismaMock.supplier,
    prismaMock.staffMember,
    prismaMock.staffSchedule,
    prismaMock.scheduleImage,
  ]) {
    model.findFirst.mockResolvedValue(null);
  }
});

describe("plan gating (the store owner's plan, via getStorePlan)", () => {
  it("resolves the plan for the store, not the viewer", async () => {
    await run("FREE");
    expect(getStorePlan).toHaveBeenCalledWith(STORE);
  });

  it("FREE: storefront unlocked; counter and operations locked with upgrade links; nothing locked is queried", async () => {
    const progress = await run("FREE");
    const items = byId(progress);

    for (const id of ["firstSale", "openShift", "addTables"] as const) {
      expect(items[id]).toMatchObject({
        locked: true,
        done: false,
        requiredPlan: "POS",
        href: "/pricing?trial=true#plans",
      });
    }
    for (const id of ["addStockItems", "addSupplier", "addStaff", "publishSchedule"] as const) {
      expect(items[id]).toMatchObject({
        locked: true,
        done: false,
        requiredPlan: "OPERATIONS",
        href: "/pricing?upgrade=true&required=OPERATIONS#plans",
      });
    }
    expect(progress.items.filter((i) => !i.locked).map((i) => i.id)).toEqual([
      "publishStorefront",
      "addMenuItems",
      "addItemPhotos",
      "addBranding",
      "addWhatsapp",
      "firstVisit",
    ]);
    expect(progress.total).toBe(6);
    expect(progress.plan).toBe("FREE");

    expect(prismaMock.order.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.shift.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.table.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.material.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.supplier.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.staffMember.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.staffSchedule.findFirst).not.toHaveBeenCalled();
  });

  it("a locked item never reads as done, whatever the data says", async () => {
    prismaMock.order.findFirst.mockResolvedValue(found);
    const items = byId(await run("FREE"));
    expect(items.firstSale.done).toBe(false);
  });

  it("POS: counter unlocked, operations still locked", async () => {
    const progress = await run("POS");
    const items = byId(progress);

    expect(items.firstSale).toMatchObject({
      locked: false,
      requiredPlan: "POS",
      href: `/store/${STORE}/pos`,
    });
    expect(items.openShift.locked).toBe(false);
    expect(items.addTables.locked).toBe(false);
    for (const id of ["addStockItems", "addSupplier", "addStaff", "publishSchedule"] as const) {
      expect(items[id].locked).toBe(true);
    }
    expect(progress.total).toBe(9);
  });

  it.each(["OPERATIONS", "ENTERPRISE"] as const)("%s: every item unlocked", async (plan) => {
    const progress = await run(plan);
    expect(progress.items.every((item) => !item.locked)).toBe(true);
    expect(progress.total).toBe(SETUP_ITEM_IDS.length);
    expect(progress.plan).toBe(plan);
  });
});

describe("hrefs", () => {
  it("each unlocked item links to its in-app page", async () => {
    const items = byId(await run("OPERATIONS"));
    const hrefs = Object.fromEntries(SETUP_ITEM_IDS.map((id) => [id, items[id].href]));

    expect(hrefs).toEqual({
      publishStorefront: `/store/${STORE}/storefront?tab=settings`,
      addMenuItems: `/store/${STORE}/storefront?tab=menu`,
      addItemPhotos: `/store/${STORE}/storefront?tab=menu`,
      addBranding: `/store/${STORE}/storefront?tab=settings`,
      addWhatsapp: `/store/${STORE}/storefront?tab=settings`,
      firstVisit: `/store/${STORE}/storefront?tab=analytics`,
      firstSale: `/store/${STORE}/pos`,
      openShift: `/store/${STORE}/pos/operational?tab=shift`,
      addTables: `/store/${STORE}/tables`,
      addStockItems: `/store/${STORE}/data?tab=materials`,
      addSupplier: `/store/${STORE}/data?tab=suppliers`,
      addStaff: `/store/${STORE}/staff`,
      publishSchedule: `/store/${STORE}/schedule`,
    });
  });

  it("covers every checklist item id", () => {
    expect(Object.keys(SETUP_ITEM_SPECS).sort()).toEqual([...SETUP_ITEM_IDS].sort());
  });
});

describe("storefront items", () => {
  it("nothing done on a brand-new store (even without a storefront row)", async () => {
    const progress = await run("FREE", { storefront: null });
    expect(progress.completed).toBe(0);
    expect(progress.allDone).toBe(false);
  });

  it("publish, branding (logo OR cover) and WhatsApp read the storefront row", async () => {
    let items = byId(
      await run("FREE", {
        storefront: {
          isPublished: true,
          heroImageUrl: "https://x/h.png",
          whatsappNumber: "+33612345678",
        },
      })
    );
    expect(items.publishStorefront.done).toBe(true);
    expect(items.addBranding.done).toBe(true);
    expect(items.addWhatsapp.done).toBe(true);

    items = byId(
      await run("FREE", { storefront: { logoUrl: "https://x/l.png", whatsappNumber: "   " } })
    );
    expect(items.addBranding.done).toBe(true);
    expect(items.addWhatsapp.done).toBe(false);
  });

  it("5 menu items and 3 photos are the thresholds; progress is capped at the target", async () => {
    menuCounts(4, 2);
    let items = byId(await run("FREE"));
    expect(items.addMenuItems).toMatchObject({ done: false, progress: { current: 4, target: 5 } });
    expect(items.addItemPhotos).toMatchObject({ done: false, progress: { current: 2, target: 3 } });

    menuCounts(12, 3);
    items = byId(await run("FREE"));
    expect(items.addMenuItems).toMatchObject({ done: true, progress: { current: 5, target: 5 } });
    expect(items.addItemPhotos).toMatchObject({ done: true, progress: { current: 3, target: 3 } });
  });

  it("counts photos as items with a non-empty imageUrl on this store's storefront", async () => {
    await run("FREE");
    const photoQuery = prismaMock.menuItem.count.mock.calls
      .map(([arg]) => arg.where)
      .find((where) => "imageUrl" in where);
    expect(photoQuery).toEqual({
      storefront: { storeId: STORE },
      imageUrl: { not: null },
      NOT: { imageUrl: "" },
    });
  });

  it("first visit = any public page view on this store's storefront (profile, menu or item page)", async () => {
    prismaMock.storefrontEvent.findFirst.mockResolvedValue(found);
    const items = byId(await run("FREE"));
    expect(items.firstVisit.done).toBe(true);
    // Table QR codes land on /menu, which only ever records MENU_VIEW / ITEM_VIEW.
    expect(prismaMock.storefrontEvent.findFirst).toHaveBeenCalledWith({
      where: { storefront: { storeId: STORE }, type: { in: ["VIEW", "MENU_VIEW", "ITEM_VIEW"] } },
      select: { id: true },
    });
  });

  it("first visit: CTA clicks (WhatsApp, review) are not visits", async () => {
    await run("FREE");
    const where = prismaMock.storefrontEvent.findFirst.mock.calls[0][0].where;
    expect(where.type.in).not.toContain("WHATSAPP_CLICK");
    expect(where.type.in).not.toContain("REVIEW_CLICK");
  });

  it("allDone once every unlocked item is done", async () => {
    menuCounts(5, 3);
    prismaMock.storefrontEvent.findFirst.mockResolvedValue(found);
    const progress = await run("FREE", {
      storefront: { isPublished: true, logoUrl: "https://x/l.png", whatsappNumber: "+62812" },
    });
    expect(progress.completed).toBe(6);
    expect(progress.total).toBe(6);
    expect(progress.allDone).toBe(true);
  });
});

describe("counter items", () => {
  it("first sale: a paid-or-open till order (POS, or a platform order keyed in with a queue number), never cancelled or held", async () => {
    prismaMock.order.findFirst.mockResolvedValue(found);
    const items = byId(await run("POS"));

    expect(items.firstSale.done).toBe(true);
    const where = prismaMock.order.findFirst.mock.calls[0][0].where;
    expect(where.storeId).toBe(STORE);
    expect(where.status).toEqual({ notIn: ["CANCELLED", "HELD"] });
    expect(where.OR[0]).toEqual({ source: "POS" });
    expect(where.OR[1].queueNumber).toEqual({ not: null });
    expect(where.OR[1].source.in).toEqual(
      expect.arrayContaining(["UBER_EATS", "GOFOOD", "OTHER_ONLINE"])
    );
    expect(where.OR[1].source.in).not.toContain("STOREFRONT");
    expect(where.OR[1].source.in).not.toContain("MANUAL");
  });

  it("open shift and tables tick from any row for the store", async () => {
    prismaMock.shift.findFirst.mockResolvedValue(found);
    prismaMock.table.findFirst.mockResolvedValue(found);
    const items = byId(await run("POS"));
    expect(items.openShift.done).toBe(true);
    expect(items.addTables.done).toBe(true);
    expect(prismaMock.shift.findFirst).toHaveBeenCalledWith({
      where: { storeId: STORE },
      select: { id: true },
    });
  });
});

describe("operations items", () => {
  it("stock items: a material OR a product", async () => {
    prismaMock.product.findFirst.mockResolvedValue(found);
    expect(byId(await run("OPERATIONS")).addStockItems.done).toBe(true);

    prismaMock.product.findFirst.mockResolvedValue(null);
    prismaMock.material.findFirst.mockResolvedValue(found);
    expect(byId(await run("OPERATIONS")).addStockItems.done).toBe(true);
  });

  it("staff: an active member who isn't the OWNER row", async () => {
    prismaMock.staffMember.findFirst.mockResolvedValue(found);
    expect(byId(await run("OPERATIONS")).addStaff.done).toBe(true);
    expect(prismaMock.staffMember.findFirst).toHaveBeenCalledWith({
      where: { storeId: STORE, isActive: true, role: { not: "OWNER" } },
      select: { id: true },
    });
  });

  it("schedule: a PUBLISHED roster day, or any roster image — a draft doesn't count", async () => {
    expect(byId(await run("OPERATIONS")).publishSchedule.done).toBe(false);
    expect(prismaMock.staffSchedule.findFirst).toHaveBeenCalledWith({
      where: { storeId: STORE, status: "PUBLISHED" },
      select: { id: true },
    });

    prismaMock.staffSchedule.findFirst.mockResolvedValue(found);
    expect(byId(await run("OPERATIONS")).publishSchedule.done).toBe(true);

    prismaMock.staffSchedule.findFirst.mockResolvedValue(null);
    prismaMock.scheduleImage.findFirst.mockResolvedValue(found);
    expect(byId(await run("OPERATIONS")).publishSchedule.done).toBe(true);
  });

  it("supplier", async () => {
    prismaMock.supplier.findFirst.mockResolvedValue(found);
    expect(byId(await run("OPERATIONS")).addSupplier.done).toBe(true);
  });
});

describe("a staff persona only sees the items it can open (personaPages)", () => {
  const DEFAULT_MANAGER = [
    "/dashboard",
    "/storefront",
    "/pos",
    "/pos/orders",
    "/pos/kds",
    "/tables",
    "/data",
    "/schedule",
    "/pos/schedule",
  ];

  async function runAs(plan: PlanTier, personaPages: string[] | null) {
    getStorePlan.mockResolvedValue(plan);
    prismaMock.store.findUnique.mockResolvedValue(storeRow());
    return getSetupProgress(STORE, NOW, personaPages);
  }

  it("each item names the page grant its href needs; Add staff is owner-only", () => {
    expect(
      Object.fromEntries(SETUP_ITEM_IDS.map((id) => [id, SETUP_ITEM_SPECS[id].page]))
    ).toEqual({
      publishStorefront: "/storefront",
      addMenuItems: "/storefront",
      addItemPhotos: "/storefront",
      addBranding: "/storefront",
      addWhatsapp: "/storefront",
      firstVisit: "/storefront",
      firstSale: "/pos",
      openShift: "/pos",
      addTables: "/tables",
      addStockItems: "/data",
      addSupplier: "/data",
      addStaff: null,
      publishSchedule: "/schedule",
    });
  });

  it("the owner (null) gets every item", async () => {
    const progress = await runAs("OPERATIONS", null);
    expect(progress.items.map((i) => i.id)).toEqual([...SETUP_ITEM_IDS]);
    expect(progress.total).toBe(SETUP_ITEM_IDS.length);
  });

  it("a default Manager never gets the owner-only Add staff row, and it isn't counted", async () => {
    prismaMock.staffMember.findFirst.mockResolvedValue(null);
    const progress = await runAs("OPERATIONS", DEFAULT_MANAGER);
    expect(progress.items.map((i) => i.id)).not.toContain("addStaff");
    expect(progress.total).toBe(SETUP_ITEM_IDS.length - 1);
    expect(progress.sections).toEqual(["storefront", "counter", "operations"]);
  });

  it("allDone only needs what the persona can do", async () => {
    menuCounts(5, 3);
    prismaMock.storefrontEvent.findFirst.mockResolvedValue(found);
    getStorePlan.mockResolvedValue("FREE");
    prismaMock.store.findUnique.mockResolvedValue(
      storeRow({
        storefront: { isPublished: true, logoUrl: "https://x/l.png", whatsappNumber: "+62812" },
      })
    );
    const progress = await getSetupProgress(STORE, NOW, DEFAULT_MANAGER);
    expect(progress.completed).toBe(6);
    expect(progress.total).toBe(6);
    expect(progress.allDone).toBe(true);
  });

  it("a Manager without /storefront or /data: those rows and the emptied section are gone", async () => {
    const progress = await runAs("OPERATIONS", ["/dashboard", "/pos", "/tables", "/schedule"]);
    expect(progress.items.map((i) => i.id)).toEqual([
      "firstSale",
      "openShift",
      "addTables",
      "publishSchedule",
    ]);
    expect(progress.sections).toEqual(["counter", "operations"]);
    expect(progress.total).toBe(4);
  });

  it("locked items stay (the section's upsell row), and don't count", async () => {
    const progress = await runAs("FREE", ["/dashboard", "/storefront"]);
    const ids = progress.items.map((i) => i.id);
    // Locked on FREE, so kept whatever the grants — including owner-only Add staff.
    expect(ids).toEqual(expect.arrayContaining(["firstSale", "addTables", "addStaff"]));
    expect(progress.items.filter((i) => i.locked)).toHaveLength(7);
    expect(progress.total).toBe(6);
  });

  it("a persona with none of the pages: no unlocked items, never allDone", async () => {
    const progress = await runAs("OPERATIONS", ["/dashboard"]);
    expect(progress.items).toEqual([]);
    expect(progress.sections).toEqual([]);
    expect(progress.total).toBe(0);
    expect(progress.allDone).toBe(false);
  });

  it("canOpenSetupItem", () => {
    expect(canOpenSetupItem({ page: "/data" }, null)).toBe(true);
    expect(canOpenSetupItem({ page: null }, null)).toBe(true);
    expect(canOpenSetupItem({ page: "/data" }, ["/data"])).toBe(true);
    expect(canOpenSetupItem({ page: "/data" }, ["/pos"])).toBe(false);
    expect(canOpenSetupItem({ page: null }, ["/data", "/staff"])).toBe(false);
  });
});

describe("section order follows the owner's goals", () => {
  it("no goals: the default order", async () => {
    const progress = await run("OPERATIONS");
    expect(progress.sections).toEqual(["storefront", "counter", "operations"]);
    expect(progress.goals).toEqual([]);
  });

  it("picked goals come first, in ONBOARDING_GOALS order; items follow their section", async () => {
    const progress = await run("OPERATIONS", { goals: ["operations", "counter"] });
    expect(progress.sections).toEqual(["counter", "operations", "storefront"]);
    expect(progress.goals).toEqual(["counter", "operations"]);
    expect(progress.items.map((i) => i.section)).toEqual([
      ...Array(3).fill("counter"),
      ...Array(4).fill("operations"),
      ...Array(6).fill("storefront"),
    ]);
  });

  it("unknown or repeated goals are ignored", async () => {
    const progress = await run("POS", { goals: ["operations", "bogus", "operations"] });
    expect(progress.goals).toEqual(["operations"]);
    expect(progress.sections).toEqual(["operations", "storefront", "counter"]);
  });

  it("helpers", () => {
    expect(normalizeGoals(null)).toEqual([]);
    expect(normalizeGoals(["counter", "storefront"])).toEqual(["storefront", "counter"]);
    expect(orderSections(["counter"])).toEqual(["counter", "storefront", "operations"]);
  });
});

describe("new-store window", () => {
  it("a store created within 60 days is new; older is not", async () => {
    expect((await run("FREE", { createdAt: new Date(NOW.getTime() - 59 * DAY) })).isNewStore).toBe(
      true
    );
    expect((await run("FREE", { createdAt: new Date(NOW.getTime() - 60 * DAY) })).isNewStore).toBe(
      true
    );
    expect((await run("FREE", { createdAt: new Date(NOW.getTime() - 61 * DAY) })).isNewStore).toBe(
      false
    );
    expect(isWithinNewStoreWindow(new Date(NOW.getTime() - DAY), NOW)).toBe(true);
  });
});

describe("unknown store", () => {
  it("throws", async () => {
    getStorePlan.mockResolvedValue("FREE");
    prismaMock.store.findUnique.mockResolvedValue(null);
    await expect(getSetupProgress("nope", NOW)).rejects.toThrow("Store not found");
  });
});

describe("response shape", () => {
  it("carries the store id and counts only unlocked items", async () => {
    prismaMock.order.findFirst.mockResolvedValue(found);
    const progress = await run("POS");
    expect(progress.storeId).toBe(STORE);
    expect(progress.completed).toBe(1);
    expect(progress.total).toBe(9);
    expect(progress.allDone).toBe(false);
  });
});
