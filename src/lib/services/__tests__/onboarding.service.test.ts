import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Prisma } from "@prisma/client";
import { PAYMENT_METHODS_BY_MARKET } from "@/config/payment-fees.config";

/**
 * Setup wizard backend. Prisma is replaced by a tiny in-memory model of the
 * rows this service touches (one user, their business / first store /
 * storefront / finance rows / menu, plus storefronts owned by OTHER tenants),
 * so retries, resumes and ordering can be asserted on the resulting state
 * rather than on a script of mocked return values.
 */

type Row = Record<string, any>;

const h = vi.hoisted(() => {
  const db = {
    user: {} as Row,
    business: null as Row | null,
    store: null as Row | null,
    staff: [] as Row[],
    storefront: null as Row | null,
    storeFinance: null as Row | null,
    businessFinance: null as Row | null,
    subscription: null as Row | null,
    categories: [] as Row[],
    items: [] as Row[],
    /** Storefronts belonging to other tenants: slug -> id. */
    others: new Map<string, string>(),
  };

  /** Interactive-transaction client (step 1's business rows, step 2's menu). */
  const tx = {
    user: { update: vi.fn() },
    business: { upsert: vi.fn() },
    store: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    staffMember: { findFirst: vi.fn(), create: vi.fn() },
    storeFinanceSettings: { findUnique: vi.fn(), upsert: vi.fn() },
    businessFinanceSettings: { findUnique: vi.fn(), upsert: vi.fn() },
    menuItem: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    menuCategory: { findMany: vi.fn(), create: vi.fn() },
    /** Records the advisory-lock statement; the lock itself is modelled in $transaction. */
    $executeRaw: vi.fn(),
  };

  const prisma = {
    user: { findUnique: vi.fn(), update: vi.fn() },
    store: { findFirst: vi.fn() },
    business: { update: vi.fn() },
    subscription: { findUnique: vi.fn() },
    storefront: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    menuItem: { findMany: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  };

  // Step 2 writes the menu through `tx` only (under its lock); the
  // storefrontService menu helpers use the global client and are not mocked,
  // so a call to one fails the test.
  const storefrontService = {
    getStorefrontByStoreId: vi.fn(),
  };

  return {
    db,
    tx,
    prisma,
    storefrontService,
    activateFree: vi.fn(),
    getFinanceSettings: vi.fn(),
    /** Blob storage delete (a replaced logo). */
    storageDelete: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/lib/storage", () => ({ getStorageAdapter: () => ({ delete: h.storageDelete }) }));
vi.mock("../storefront.service", () => ({ storefrontService: h.storefrontService }));
vi.mock("../subscription.service", () => ({
  subscriptionService: { activateFree: h.activateFree },
}));
vi.mock("../finance-settings.service", () => ({ getFinanceSettings: h.getFinanceSettings }));

import {
  checkSlugAvailability,
  completeOnboarding,
  findAvailableSlug,
  getOnboardingState,
  publicStorefrontUrl,
  saveStoreStep,
  saveStorefrontStep,
  slugify,
  uiLocaleFromRequest,
} from "../onboarding.service";

const USER_ID = "user_1";
const { db, tx, prisma, storefrontService } = h;

// --------------------------------------------------------------------------
// The in-memory model
// --------------------------------------------------------------------------

function resetDb(user: Row = {}) {
  db.user = {
    id: USER_ID,
    name: "Camille",
    email: "camille@example.fr",
    locale: "fr",
    timezone: "Europe/Paris",
    timezoneUpdatedAt: new Date("2026-09-01T00:00:00Z"),
    hasOnboarded: false,
    ...user,
  };
  db.business = null;
  db.store = null;
  db.staff = [];
  db.storefront = null;
  db.storeFinance = null;
  db.businessFinance = null;
  db.subscription = null;
  db.categories = [];
  db.items = [];
  db.others = new Map();
}

/** What StorefrontService.slugify makes of a name: it DROPS accented letters. */
const legacySlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/-+/g, "-");

function slugHolder(slug: string): string | undefined {
  if (db.storefront?.slug === slug) return db.storefront.id;
  return db.others.get(slug);
}

function wireModel() {
  prisma.user.findUnique.mockImplementation(async ({ where }: Row) =>
    where.id === db.user.id
      ? { ...db.user, business: db.business ? { ...db.business } : null }
      : null
  );
  prisma.user.update.mockImplementation(async ({ where, data }: Row) => {
    expect(where).toEqual({ id: USER_ID });
    Object.assign(db.user, data);
    return db.user;
  });
  prisma.store.findFirst.mockImplementation(async ({ where }: Row) => {
    if (where.business?.userId !== db.user.id || !db.business || !db.store) return null;
    return {
      id: db.store.id,
      name: db.store.name,
      storefront: db.storefront ? { ...db.storefront } : null,
    };
  });
  prisma.business.update.mockImplementation(async ({ where, data }: Row) => {
    expect(where).toEqual({ userId: USER_ID });
    Object.assign(db.business!, data);
    return db.business;
  });
  prisma.subscription.findUnique.mockImplementation(async ({ where }: Row) => {
    expect(where).toEqual({ userId: USER_ID });
    return db.subscription;
  });
  h.activateFree.mockImplementation(async (userId: string, plan: string) => {
    expect(userId).toBe(USER_ID);
    expect(plan).toBe("FREE");
    db.subscription = { id: "sub_1", plan: "FREE" };
  });

  prisma.storefront.findUnique.mockImplementation(async ({ where }: Row) => {
    if (where.storeId !== undefined) {
      return db.storefront && db.storefront.storeId === where.storeId
        ? { id: db.storefront.id }
        : null;
    }
    const id = slugHolder(where.slug);
    return id ? { id } : null;
  });
  prisma.storefront.findMany.mockImplementation(async ({ where }: Row) =>
    (where.slug.in as string[])
      .map((slug) => ({ slug, id: slugHolder(slug) }))
      .filter((row) => row.id)
  );
  prisma.storefront.update.mockImplementation(async ({ where, data }: Row) => {
    expect(where).toEqual({ id: db.storefront?.id });
    if (data.slug && db.others.has(data.slug)) {
      throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      });
    }
    Object.assign(db.storefront!, data);
    return db.storefront;
  });

  storefrontService.getStorefrontByStoreId.mockImplementation(async (storeId: string) => {
    expect(storeId).toBe(db.store?.id);
    if (!db.storefront) {
      db.storefront = {
        id: "sf_1",
        storeId,
        slug: legacySlug(db.store!.name),
        displayName: db.store!.name,
        tagline: null,
        logoUrl: null,
        themeColor: "#FF6B35",
        instagramUrl: null,
        whatsappNumber: null,
        isPublished: false,
      };
    }
    return { ...db.storefront, menuCategories: [] };
  });

  const findItems = async ({ where, take }: Row) => {
    expect(where.storefrontId).toBe(db.storefront?.id);
    const rows = [...db.items].sort((a, b) => a.displayOrder - b.displayOrder);
    return (take ? rows.slice(0, take) : rows).map((item) => ({ ...item }));
  };
  prisma.menuItem.findMany.mockImplementation(findItems);
  prisma.menuItem.updateMany.mockImplementation(async ({ where, data }: Row) => {
    expect(where.storefrontId).toBe(db.storefront?.id);
    let count = 0;
    for (const item of db.items) {
      if (item.currency !== where.currency.not) {
        Object.assign(item, data);
        count++;
      }
    }
    return { count };
  });

  // --- inside the step-2 transaction
  tx.menuItem.findMany.mockImplementation(findItems);
  tx.menuItem.updateMany.mockImplementation(async ({ where, data }: Row) => {
    expect(where.storefrontId).toBe(db.storefront?.id);
    const item = db.items.find((i) => i.id === where.id && i.storefrontId === where.storefrontId);
    if (!item) return { count: 0 };
    Object.assign(item, data);
    return { count: 1 };
  });
  tx.menuItem.deleteMany.mockImplementation(async ({ where }: Row) => {
    expect(where.storefrontId).toBe(db.storefront?.id);
    const before = db.items.length;
    db.items = db.items.filter(
      (i) => !(where.id.in.includes(i.id) && i.storefrontId === where.storefrontId)
    );
    return { count: before - db.items.length };
  });
  h.storageDelete.mockResolvedValue(undefined);
  tx.menuItem.aggregate.mockImplementation(async ({ where }: Row) => {
    const orders = db.items
      .filter((i) => i.categoryId === where.categoryId)
      .map((i) => i.displayOrder);
    return { _max: { displayOrder: orders.length ? Math.max(...orders) : null } };
  });
  tx.menuItem.create.mockImplementation(async ({ data }: Row) => {
    expect(data.storefrontId).toBe(db.storefront?.id);
    const item = { id: `item_${db.items.length + 1}`, ...data };
    db.items.push(item);
    return { id: item.id };
  });
  tx.menuCategory.findMany.mockImplementation(async ({ where }: Row) => {
    expect(where.storefrontId).toBe(db.storefront?.id);
    return db.categories.map((c) => ({ ...c }));
  });
  tx.menuCategory.create.mockImplementation(async ({ data }: Row) => {
    expect(data.storefrontId).toBe(db.storefront?.id);
    const category = { id: `cat_${db.categories.length + 1}`, ...data };
    db.categories.push(category);
    return { id: category.id };
  });

  h.getFinanceSettings.mockImplementation(async (storeId: string) => {
    expect(storeId).toBe(db.store?.id);
    return {
      currency: db.storeFinance?.currency ?? "IDR",
      market: db.storeFinance?.market ?? "INDONESIA",
    };
  });

  // --- inside the step-1 transaction
  tx.user.update.mockImplementation(async ({ where, data }: Row) => {
    expect(where).toEqual({ id: USER_ID });
    Object.assign(db.user, data);
    return { id: USER_ID };
  });
  tx.business.upsert.mockImplementation(async ({ where, create, update }: Row) => {
    expect(where).toEqual({ userId: USER_ID });
    if (db.business) Object.assign(db.business, update);
    else db.business = { id: "biz_1", onboardingGoals: [], businessType: null, ...create };
    return { id: db.business!.id };
  });
  tx.store.findFirst.mockImplementation(async ({ where }: Row) =>
    db.store && where.businessId === db.business?.id
      ? { id: db.store.id, name: db.store.name }
      : null
  );
  tx.store.create.mockImplementation(async ({ data }: Row) => {
    const store = { id: "store_clx9abcdef", syncFinanceWithBusiness: false, ...data };
    db.store = store;
    return { id: store.id, name: store.name };
  });
  tx.store.update.mockImplementation(async ({ where, data }: Row) => {
    expect(where).toEqual({ id: db.store?.id });
    Object.assign(db.store!, data);
    return db.store;
  });
  tx.staffMember.findFirst.mockImplementation(
    async ({ where }: Row) =>
      db.staff.find((s) => s.storeId === where.storeId && s.role === where.role) ?? null
  );
  tx.staffMember.create.mockImplementation(async ({ data }: Row) => {
    db.staff.push({ id: `staff_${db.staff.length + 1}`, ...data });
    return data;
  });
  tx.storeFinanceSettings.findUnique.mockImplementation(async ({ where }: Row) =>
    db.storeFinance && where.storeId === db.store?.id ? { ...db.storeFinance } : null
  );
  tx.storeFinanceSettings.upsert.mockImplementation(async ({ where, create, update }: Row) => {
    expect(where).toEqual({ storeId: db.store?.id });
    if (db.storeFinance) Object.assign(db.storeFinance, update);
    else db.storeFinance = { ...create };
    return db.storeFinance;
  });
  tx.businessFinanceSettings.findUnique.mockImplementation(async ({ where }: Row) =>
    db.businessFinance && where.businessId === db.business?.id ? { ...db.businessFinance } : null
  );
  tx.businessFinanceSettings.upsert.mockImplementation(async ({ where, create, update }: Row) => {
    expect(where).toEqual({ businessId: db.business?.id });
    if (db.businessFinance) Object.assign(db.businessFinance, update);
    else db.businessFinance = { ...create };
    return db.businessFinance;
  });

  // Interactive transactions get `tx`, whose $executeRaw (the advisory lock)
  // behaves like pg_advisory_xact_lock: it waits for any transaction holding
  // the lock to end, and holds it until its own transaction ends. One lock
  // for everything is enough here (a single storefront).
  let lockTail: Promise<void> = Promise.resolve();
  prisma.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg !== "function") return Promise.all(arg as unknown[]);
    let release = () => {};
    const client = {
      ...tx,
      $executeRaw: async (...args: unknown[]) => {
        await tx.$executeRaw(...args);
        const held = lockTail;
        lockTail = new Promise<void>((resolve) => (release = resolve));
        await held;
        return 1;
      },
    };
    try {
      return await (arg as (t: typeof client) => unknown)(client);
    } finally {
      release();
    }
  });
}

/** A business + store + storefront as a finished step 1 in France leaves them. */
function seedFrenchStore(overrides: { business?: Row; storefront?: Row } = {}) {
  db.business = {
    id: "biz_1",
    name: "Crêperie du Port",
    country: "France",
    city: "Brest",
    timezone: "Europe/Paris",
    locale: "fr",
    businessType: "cafe",
    onboardingStep: 2,
    onboardingGoals: [],
    ...overrides.business,
  };
  db.store = { id: "store_clx9abcdef", businessId: "biz_1", name: db.business.name };
  db.staff = [{ id: "staff_1", storeId: db.store.id, role: "OWNER" }];
  db.storeFinance = {
    currency: "EUR",
    market: "FRANCE",
    enabledPaymentMethods: PAYMENT_METHODS_BY_MARKET.FRANCE,
  };
  db.businessFinance = { ...db.storeFinance };
  db.subscription = { id: "sub_1", plan: "FREE" };
  db.storefront = {
    id: "sf_1",
    storeId: db.store.id,
    slug: "creperie-du-port",
    displayName: db.business.name,
    tagline: null,
    logoUrl: null,
    themeColor: "#FF6B35",
    instagramUrl: null,
    whatsappNumber: null,
    isPublished: false,
    ...overrides.storefront,
  };
}

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    return e as { statusCode?: number; code?: string; message: string; details?: Row };
  }
  throw new Error("expected the promise to reject");
}

const frenchStep = {
  name: "Crêperie du Port",
  countryCode: "FR",
  city: "Brest",
  businessType: "cafe" as const,
  browserTimezone: "Europe/Paris",
};

beforeEach(() => {
  vi.clearAllMocks();
  resetDb();
  wireModel();
});

// ==========================================================================
// slugify / findAvailableSlug
// ==========================================================================

describe("slugify", () => {
  it("transliterates accents instead of dropping the letters", () => {
    expect(slugify("Crêperie du Port")).toBe("creperie-du-port");
    expect(slugify("Pâtisserie Éloïse")).toBe("patisserie-eloise");
  });

  it("spells out ligatures and turns everything else into single dashes", () => {
    expect(slugify("Cœur de Pain")).toBe("coeur-de-pain");
    expect(slugify("  --L'Atelier  & Co!!-- ")).toBe("l-atelier-co");
    expect(slugify("Warung Bu Sri")).toBe("warung-bu-sri");
  });

  it("caps at 50 characters without leaving a trailing dash", () => {
    const slug = slugify("Boulangerie artisanale du vieux port de Saint-Malo et environs");
    expect(slug.length).toBeLessThanOrEqual(50);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug.startsWith("boulangerie-artisanale")).toBe(true);
  });

  it("falls back to store-<first 5 of the storeId> when the name is too short", () => {
    expect(slugify("Ô", "clx9abcdef")).toBe("store-clx9a");
    expect(slugify("!!", "clx9abcdef")).toBe("store-clx9a");
    expect(slugify("Bô", "clx9abcdef")).toBe("store-clx9a");
  });

  it("returns the short result as is without a storeId (callers treat it as invalid)", () => {
    expect(slugify("Ô")).toBe("o");
  });
});

describe("findAvailableSlug", () => {
  it("returns the base when nobody holds it, in one query", async () => {
    await expect(findAvailableSlug("sunset-cafe")).resolves.toBe("sunset-cafe");
    expect(prisma.storefront.findMany).toHaveBeenCalledTimes(1);
  });

  it("appends -2, -3… past slugs other storefronts hold", async () => {
    db.others.set("sunset-cafe", "other_1");
    await expect(findAvailableSlug("sunset-cafe")).resolves.toBe("sunset-cafe-2");

    db.others.set("sunset-cafe-2", "other_2");
    await expect(findAvailableSlug("sunset-cafe")).resolves.toBe("sunset-cafe-3");
  });

  it("treats the caller's own storefront as free", async () => {
    db.others.set("sunset-cafe", "sf_mine");
    await expect(findAvailableSlug("sunset-cafe", "sf_mine")).resolves.toBe("sunset-cafe");
  });

  it("keeps a suffixed slug within 50 characters", async () => {
    const base = "a".repeat(50);
    db.others.set(base, "other_1");
    const slug = await findAvailableSlug(base);
    expect(slug).toBe(`${"a".repeat(48)}-2`);
    expect(slug.length).toBe(50);
  });

  it("falls back to random suffixes when -2…-20 are all taken", async () => {
    db.others.set("cafe", "o");
    for (let n = 2; n <= 20; n++) db.others.set(`cafe-${n}`, `o${n}`);
    const slug = await findAvailableSlug("cafe");
    expect(slug).toMatch(/^cafe-[a-z0-9]+$/);
    expect(db.others.has(slug)).toBe(false);
  });
});

// ==========================================================================
// Step 1 — saveStoreStep
// ==========================================================================

describe("saveStoreStep", () => {
  it("France: business, store, OWNER row, FREE plan, EUR/FRANCE settings and a draft storefront", async () => {
    const state = await saveStoreStep(USER_ID, frenchStep, "en");

    expect(db.business).toMatchObject({
      name: "Crêperie du Port",
      country: "France",
      city: "Brest",
      timezone: "Europe/Paris",
      locale: "fr",
      businessType: "cafe",
      onboardingStep: 2,
    });
    expect(db.store).toMatchObject({
      businessId: "biz_1",
      name: "Crêperie du Port",
      city: "Brest",
      country: "France",
      syncFinanceWithBusiness: false,
    });
    expect(db.staff).toEqual([
      expect.objectContaining({
        storeId: db.store!.id,
        name: "Camille",
        email: "camille@example.fr",
        role: "OWNER",
        pin: null,
        isActive: true,
        inviteStatus: "accepted",
      }),
    ]);
    const finance = {
      currency: "EUR",
      market: "FRANCE",
      enabledPaymentMethods: PAYMENT_METHODS_BY_MARKET.FRANCE,
    };
    expect(db.storeFinance).toMatchObject(finance);
    expect(db.businessFinance).toMatchObject(finance);
    expect(h.activateFree).toHaveBeenCalledTimes(1);

    // The auto-created draft's slug dropped the ê ("crperie-du-port"); step 1
    // re-derives it from the name.
    expect(db.storefront).toMatchObject({
      slug: "creperie-du-port",
      displayName: "Crêperie du Port",
      isPublished: false,
    });

    expect(state).toMatchObject({
      step: 2,
      completed: false,
      storeId: db.store!.id,
      currency: "EUR",
      business: {
        countryCode: "FR",
        city: "Brest",
        businessType: "cafe",
        timezone: "Europe/Paris",
      },
      storefront: { slug: "creperie-du-port", isPublished: false },
      menuItems: [],
      goals: [],
    });
  });

  it("Indonesia: an owner in Bali gets Asia/Makassar, IDR, the INDONESIA rails and Indonesian", async () => {
    await saveStoreStep(
      USER_ID,
      { name: "Warung Bu Sri", countryCode: "ID", browserTimezone: "Asia/Makassar" },
      "fr"
    );

    expect(db.business).toMatchObject({
      country: "Indonesia",
      timezone: "Asia/Makassar",
      locale: "id",
      city: null,
    });
    expect(db.storeFinance).toMatchObject({
      currency: "IDR",
      market: "INDONESIA",
      enabledPaymentMethods: PAYMENT_METHODS_BY_MARKET.INDONESIA,
    });
    expect(db.businessFinance).toMatchObject({ currency: "IDR", market: "INDONESIA" });
    expect(db.storefront!.slug).toBe("warung-bu-sri");
  });

  it("a browser zone outside the chosen country falls back to the country's main zone", async () => {
    await saveStoreStep(
      USER_ID,
      { name: "Warung Bu Sri", countryCode: "ID", browserTimezone: "Europe/Paris" },
      null
    );
    expect(db.business!.timezone).toBe("Asia/Jakarta");
  });

  it("Other (ZZ): the picked currency, INTERNATIONAL, the browser zone and the UI language", async () => {
    const state = await saveStoreStep(
      USER_ID,
      { name: "Mama Put", countryCode: "ZZ", currency: "NGN", browserTimezone: "Africa/Lagos" },
      "en"
    );

    expect(db.business).toMatchObject({ country: null, timezone: "Africa/Lagos", locale: "en" });
    expect(db.store!.country).toBeNull();
    expect(db.storeFinance).toMatchObject({
      currency: "NGN",
      market: "INTERNATIONAL",
      enabledPaymentMethods: PAYMENT_METHODS_BY_MARKET.INTERNATIONAL,
    });
    // Read back as Other, not as unset: an unset country would be re-guessed
    // by the form (France for a French UI) and flip the currency on Back.
    expect(state.business?.countryCode).toBe("ZZ");
    expect(state.currency).toBe("NGN");
  });

  it("Other (ZZ) re-saved without a currency keeps the store's currency and its items' labels", async () => {
    seedFrenchStore({ business: { country: null, timezone: "Africa/Douala" } });
    db.storeFinance = {
      currency: "XAF",
      market: "INTERNATIONAL",
      enabledPaymentMethods: PAYMENT_METHODS_BY_MARKET.INTERNATIONAL,
    };
    db.businessFinance = { ...db.storeFinance };
    db.items = [
      {
        id: "item_1",
        name: "Ndolé",
        price: new Prisma.Decimal(2500),
        currency: "XAF",
        displayOrder: 0,
      },
    ];

    const state = await saveStoreStep(
      USER_ID,
      { name: "Crêperie du Port", countryCode: "ZZ", browserTimezone: "Africa/Douala" },
      "fr"
    );

    expect(db.storeFinance).toMatchObject({ currency: "XAF", market: "INTERNATIONAL" });
    expect(db.businessFinance).toMatchObject({ currency: "XAF" });
    expect(db.items[0]).toMatchObject({ currency: "XAF" });
    expect(state).toMatchObject({ currency: "XAF", business: { countryCode: "ZZ" } });
  });

  it("Other (ZZ) without a UI language from the request falls back to User.locale", async () => {
    resetDb({ locale: "id" });
    await saveStoreStep(USER_ID, { name: "Mama Put", countryCode: "ZZ" }, null);
    expect(db.business).toMatchObject({ locale: "id", timezone: "UTC" });
    expect(db.storeFinance!.currency).toBe("USD");
  });

  it("Other (ZZ) keeps a free-text country an older form stored, but drops a known one", async () => {
    seedFrenchStore({ business: { country: "Nigeria" } });
    await saveStoreStep(USER_ID, { name: "Crêperie du Port", countryCode: "ZZ", currency: "NGN" });
    expect(db.business!.country).toBe("Nigeria");

    seedFrenchStore({ business: { country: "France" } });
    await saveStoreStep(USER_ID, { name: "Crêperie du Port", countryCode: "ZZ", currency: "NGN" });
    expect(db.business!.country).toBeNull();
  });

  it("is idempotent: a retry updates the same store and adds no second OWNER row or plan", async () => {
    await saveStoreStep(USER_ID, frenchStep);
    await saveStoreStep(USER_ID, { ...frenchStep, city: "Quimper" });

    expect(tx.store.create).toHaveBeenCalledTimes(1);
    expect(tx.staffMember.create).toHaveBeenCalledTimes(1);
    expect(h.activateFree).toHaveBeenCalledTimes(1);
    expect(db.store!.city).toBe("Quimper");
    expect(db.storefront!.slug).toBe("creperie-du-port");
  });

  it("never downgrades an existing subscription", async () => {
    db.subscription = { id: "sub_pos", plan: "POS" };
    await saveStoreStep(USER_ID, frenchStep);
    expect(h.activateFree).not.toHaveBeenCalled();
    expect(db.subscription.plan).toBe("POS");
  });

  it("resuming never moves the owner backwards", async () => {
    seedFrenchStore({ business: { onboardingStep: 3 } });
    const state = await saveStoreStep(USER_ID, frenchStep);
    expect(db.business!.onboardingStep).toBe(3);
    expect(state.step).toBe(3);
  });

  it("an owner who already finished setup and deleted every store can set one up; no wizard step", async () => {
    resetDb({ hasOnboarded: true });
    db.business = {
      id: "biz_1",
      name: "Old",
      country: "France",
      city: null,
      timezone: "Europe/Paris",
      locale: "fr",
      businessType: null,
      onboardingStep: null,
      onboardingGoals: ["storefront"],
    };
    await saveStoreStep(USER_ID, frenchStep);
    expect(db.store).not.toBeNull();
    expect(db.business!.onboardingStep).toBeNull();
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(db.user.hasOnboarded).toBe(true);
  });

  it("an invited staff account (onboarded, no business) opening its own store gets the normal wizard", async () => {
    // staff-invite.service sets hasOnboarded on new staff accounts so they
    // skip merchant setup; that account has never set a store up.
    resetDb({ hasOnboarded: true });
    const state = await saveStoreStep(USER_ID, frenchStep);

    expect(state).toMatchObject({ completed: false, step: 2 });
    expect(db.business!.onboardingStep).toBe(2);
    expect(db.user.hasOnboarded).toBe(false);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { hasOnboarded: false },
    });

    // Still in the wizard: step 1 can be re-saved and step 2 advances.
    await saveStoreStep(USER_ID, { ...frenchStep, city: "Quimper" });
    expect(db.store!.city).toBe("Quimper");
    expect((await saveStorefrontStep(USER_ID, { menuItems: [] })).step).toBe(3);
  });

  it("refuses to rewrite a finished owner's live store", async () => {
    resetDb({ hasOnboarded: true });
    seedFrenchStore();
    const err = await rejection(saveStoreStep(USER_ID, { ...frenchStep, countryCode: "ID" }));
    expect(err.statusCode).toBe(409);
    expect(err.details?.reason).toBe("already_completed");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(db.storeFinance!.currency).toBe("EUR");
  });

  it("refuses to rewrite a store set up outside the wizard (no step), even when not onboarded", async () => {
    // An owner who quit the old wizard after it created their store, or an
    // account that predates the flag: hasOnboarded is false, but the store
    // runs (orders, items priced in its currency).
    seedFrenchStore({ business: { onboardingStep: null } });
    db.items = [
      {
        id: "item_1",
        name: "Galette",
        price: new Prisma.Decimal(9.5),
        currency: "EUR",
        displayOrder: 0,
      },
    ];

    const err = await rejection(
      saveStoreStep(USER_ID, { ...frenchStep, name: "PT Kopi Nusantara", countryCode: "ID" })
    );

    expect(err.statusCode).toBe(409);
    expect(err.details?.reason).toBe("already_completed");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.menuItem.updateMany).not.toHaveBeenCalled();
    expect(db.store!.name).toBe("Crêperie du Port");
    expect(db.storeFinance).toMatchObject({ currency: "EUR", market: "FRANCE" });
    expect(db.items[0]).toMatchObject({ currency: "EUR" });
  });

  it("changing country later re-labels the draft's items in the new currency, prices as typed", async () => {
    seedFrenchStore();
    db.items = [
      {
        id: "item_1",
        name: "Galette",
        price: new Prisma.Decimal(9.5),
        currency: "EUR",
        displayOrder: 0,
      },
    ];

    await saveStoreStep(USER_ID, { ...frenchStep, countryCode: "ID" });

    expect(db.storeFinance).toMatchObject({
      currency: "IDR",
      market: "INDONESIA",
      enabledPaymentMethods: PAYMENT_METHODS_BY_MARKET.INDONESIA,
    });
    expect(db.items[0]).toMatchObject({ currency: "IDR" });
    expect(Number(db.items[0].price)).toBe(9.5);
  });

  it("going Back without changing the market keeps a payment-method choice made since", async () => {
    seedFrenchStore();
    db.storeFinance!.enabledPaymentMethods = ["CASH"];
    await saveStoreStep(USER_ID, frenchStep);
    expect(db.storeFinance!.enabledPaymentMethods).toEqual(["CASH"]);
  });

  it("a renamed store gets a new link; an unchanged name keeps the current one", async () => {
    seedFrenchStore({ storefront: { slug: "ma-creperie" } });
    await saveStoreStep(USER_ID, frenchStep);
    expect(db.storefront!.slug).toBe("ma-creperie");

    await saveStoreStep(USER_ID, { ...frenchStep, name: "Crêperie de la Plage" });
    expect(db.storefront!.slug).toBe("creperie-de-la-plage");
    expect(db.storefront!.displayName).toBe("Crêperie de la Plage");
  });

  it("never changes a published link behind the owner's back", async () => {
    seedFrenchStore({ storefront: { slug: "ma-creperie", isPublished: true } });
    await saveStoreStep(USER_ID, { ...frenchStep, name: "Autre Nom" });
    expect(db.storefront!.slug).toBe("ma-creperie");
  });

  it("a derived link skips slugs other storefronts hold", async () => {
    db.others.set("creperie-du-port", "other_sf");
    await saveStoreStep(USER_ID, frenchStep);
    expect(db.storefront!.slug).toBe("creperie-du-port-2");
  });

  it("a custom link that is free is used", async () => {
    await saveStoreStep(USER_ID, { ...frenchStep, slug: "la-creperie-brest" });
    expect(db.storefront!.slug).toBe("la-creperie-brest");
  });

  it("a taken custom link is a 409 with a suggestion, and nothing is written", async () => {
    db.others.set("la-creperie", "other_sf");
    const err = await rejection(saveStoreStep(USER_ID, { ...frenchStep, slug: "la-creperie" }));

    expect(err.statusCode).toBe(409);
    expect(err.details).toMatchObject({ reason: "slug_taken", suggestion: "la-creperie-2" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(db.business).toBeNull();
  });

  it("a custom link lost to a race at write time is still a 409 with a suggestion", async () => {
    // Free when checked, taken by the time the storefront is written.
    prisma.storefront.findUnique.mockImplementationOnce(async () => null);
    db.others.set("la-creperie", "other_sf");
    const err = await rejection(saveStoreStep(USER_ID, { ...frenchStep, slug: "la-creperie" }));
    expect(err.statusCode).toBe(409);
    expect(err.details).toMatchObject({ reason: "slug_taken", suggestion: "la-creperie-2" });
  });

  it("sets the optional storefront fields when given, and clears them with an empty string", async () => {
    await saveStoreStep(USER_ID, {
      ...frenchStep,
      tagline: "Galettes & crêpes",
      instagramUrl: "https://instagram.com/creperie",
      whatsappNumber: "+33612345678",
      logoUrl: "https://x.public.blob.vercel-storage.com/logo.png",
      themeColor: "#123456",
    });
    expect(db.storefront).toMatchObject({
      tagline: "Galettes & crêpes",
      instagramUrl: "https://instagram.com/creperie",
      whatsappNumber: "+33612345678",
      logoUrl: "https://x.public.blob.vercel-storage.com/logo.png",
      themeColor: "#123456",
    });

    await saveStoreStep(USER_ID, { ...frenchStep, tagline: "", logoUrl: "" });
    expect(db.storefront).toMatchObject({ tagline: null, logoUrl: null, themeColor: "#123456" });
  });

  it("a business type un-pressed on screen is cleared on a re-save (the wizard always sends its pick)", async () => {
    seedFrenchStore({ business: { businessType: "bar" } });
    const { businessType: _dropped, ...withoutType } = frenchStep;
    const state = await saveStoreStep(USER_ID, withoutType);
    expect(db.business!.businessType).toBeNull();
    expect(state.business?.businessType).toBeNull();

    await saveStoreStep(USER_ID, { ...withoutType, businessType: "bakery" });
    expect(db.business!.businessType).toBe("bakery");
  });

  it("keeps a stored business type the picker doesn't know (it couldn't be shown or cleared)", async () => {
    seedFrenchStore({ business: { businessType: "legacy_brasserie" } });
    const { businessType: _dropped, ...withoutType } = frenchStep;
    await saveStoreStep(USER_ID, withoutType);
    expect(db.business!.businessType).toBe("legacy_brasserie");
  });

  it("Use my store name (slugFromName) swaps a custom link for the name's, although the name is unchanged", async () => {
    seedFrenchStore({ storefront: { slug: "creperie-insta" } });
    await saveStoreStep(USER_ID, frenchStep);
    expect(db.storefront!.slug).toBe("creperie-insta");

    await saveStoreStep(USER_ID, { ...frenchStep, slugFromName: true });
    expect(db.storefront!.slug).toBe("creperie-du-port");
  });

  it("slugFromName takes the first free link when the name's is taken, and never a published one", async () => {
    seedFrenchStore({ storefront: { slug: "creperie-insta" } });
    db.others.set("creperie-du-port", "sf_other");
    await saveStoreStep(USER_ID, { ...frenchStep, slugFromName: true });
    expect(db.storefront!.slug).toBe("creperie-du-port-2");

    db.storefront!.slug = "creperie-insta";
    db.storefront!.isPublished = true;
    await saveStoreStep(USER_ID, { ...frenchStep, slugFromName: true });
    expect(db.storefront!.slug).toBe("creperie-insta");
  });

  it("deletes the owner's own uploaded logo once a new one replaces it", async () => {
    const own = `https://abc.public.blob.vercel-storage.com/users/${USER_ID}/images/1-ig.png`;
    seedFrenchStore({ storefront: { logoUrl: own } });
    await saveStoreStep(USER_ID, {
      ...frenchStep,
      logoUrl: "https://abc.public.blob.vercel-storage.com/users/user_1/images/2-ig.png",
    });
    expect(h.storageDelete).toHaveBeenCalledWith(own);
  });

  it("only ever addresses the caller's own business and store", async () => {
    await saveStoreStep(USER_ID, frenchStep);
    for (const [args] of tx.business.upsert.mock.calls)
      expect(args.where).toEqual({ userId: USER_ID });
    for (const [args] of tx.store.findFirst.mock.calls)
      expect(args.where).toEqual({ businessId: "biz_1" });
    for (const [args] of prisma.store.findFirst.mock.calls) {
      expect(args.where).toEqual({ business: { userId: USER_ID } });
    }
  });
});

// ==========================================================================
// Step 2 — saveStorefrontStep
// ==========================================================================

describe("saveStorefrontStep", () => {
  const threeItems = {
    menuItems: [
      { name: "Galette complète", price: 9.5 },
      { name: "Crêpe beurre sucre", price: 4.5 },
      { name: "Bolée de cidre", price: 3 },
    ],
  };

  it("before step 1 is a 409 step_order", async () => {
    const err = await rejection(saveStorefrontStep(USER_ID, { menuItems: [] }));
    expect(err.statusCode).toBe(409);
    expect(err.details?.reason).toBe("step_order");
  });

  it("creates the items in the business-language category, priced in the store currency", async () => {
    seedFrenchStore();
    const state = await saveStorefrontStep(USER_ID, threeItems);

    expect(db.categories).toEqual([
      expect.objectContaining({ name: "Nos incontournables", displayOrder: 0 }),
    ]);
    expect(db.items.map((i) => [i.name, Number(i.price), i.currency, i.displayOrder])).toEqual([
      ["Galette complète", 9.5, "EUR", 0],
      ["Crêpe beurre sucre", 4.5, "EUR", 1],
      ["Bolée de cidre", 3, "EUR", 2],
    ]);
    // The currency is passed explicitly, never left to a fallback.
    for (const [args] of tx.menuItem.create.mock.calls) {
      expect(args.data).toMatchObject({
        storefrontId: "sf_1",
        currency: "EUR",
        categoryId: "cat_1",
        isAvailable: true,
      });
    }
    // All of it in one transaction, under the storefront's step-2 lock.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    const [sql, ...values] = tx.$executeRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(sql.join("?")).toContain("pg_advisory_xact_lock");
    expect(values).toEqual(["epidom-onboarding-menu:sf_1"]);
    expect(db.business!.onboardingStep).toBe(3);
    expect(state.step).toBe(3);
    expect(state.menuItems).toEqual([
      { id: "item_1", name: "Galette complète", price: 9.5 },
      { id: "item_2", name: "Crêpe beurre sucre", price: 4.5 },
      { id: "item_3", name: "Bolée de cidre", price: 3 },
    ]);
  });

  it("writes the finance settings (currency) before creating any menu item", async () => {
    await saveStoreStep(USER_ID, frenchStep);
    await saveStorefrontStep(USER_ID, threeItems);

    const financeAt = tx.storeFinanceSettings.upsert.mock.invocationCallOrder[0];
    const firstItemAt = tx.menuItem.create.mock.invocationCallOrder[0];
    expect(financeAt).toBeLessThan(firstItemAt);
    expect(db.items.every((i) => i.currency === "EUR")).toBe(true);
  });

  it("a retried request creates no second category and no duplicate items", async () => {
    seedFrenchStore();
    await saveStorefrontStep(USER_ID, threeItems);
    await saveStorefrontStep(USER_ID, threeItems);
    // Same names, different case / spacing: still the same items.
    await saveStorefrontStep(USER_ID, {
      menuItems: [{ name: "  galette COMPLÈTE ", price: 9.5 }],
    });

    expect(db.categories).toHaveLength(1);
    expect(db.items).toHaveLength(3);
    expect(tx.menuCategory.create).toHaveBeenCalledTimes(1);
  });

  it("a double submit (two overlapping saves) creates one category and one set of items", async () => {
    seedFrenchStore();
    const [first, second] = await Promise.all([
      saveStorefrontStep(USER_ID, threeItems),
      saveStorefrontStep(USER_ID, threeItems),
    ]);

    expect(db.categories).toHaveLength(1);
    expect(db.items.map((i) => i.name)).toEqual([
      "Galette complète",
      "Crêpe beurre sucre",
      "Bolée de cidre",
    ]);
    expect(tx.menuItem.create).toHaveBeenCalledTimes(3);
    // Both saves took the lock; the second one found the first one's rows.
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(first.menuItems).toHaveLength(3);
    expect(second.menuItems).toEqual(first.menuItems);
  });

  it("a price too large for the column is refused before anything is written", async () => {
    seedFrenchStore();
    const err = await rejection(
      saveStorefrontStep(USER_ID, {
        logoUrl: "https://x.public.blob.vercel-storage.com/logo.png",
        menuItems: [
          { name: "Galette", price: 9.5 },
          { name: "Caviar", price: 99_999_999_999 },
        ],
      })
    );
    expect(err.statusCode).toBe(400);
    expect(prisma.storefront.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(db.storefront!.logoUrl).toBeNull();
    expect(db.items).toEqual([]);
  });

  it("reuses a category of that name the owner already has", async () => {
    seedFrenchStore();
    db.categories = [{ id: "cat_existing", name: "nos incontournables", displayOrder: 4 }];
    await saveStorefrontStep(USER_ID, threeItems);
    expect(tx.menuCategory.create).not.toHaveBeenCalled();
    expect(db.items.every((i) => i.categoryId === "cat_existing")).toBe(true);
  });

  it("names the category in Indonesian or English per the business language", async () => {
    seedFrenchStore({ business: { locale: "id" } });
    await saveStorefrontStep(USER_ID, { menuItems: [{ name: "Nasi goreng", price: 25000 }] });
    expect(db.categories[0].name).toBe("Rekomendasi");

    resetDb();
    wireModel();
    seedFrenchStore({ business: { locale: "en" } });
    await saveStorefrontStep(USER_ID, { menuItems: [{ name: "Flat white", price: 4 }] });
    expect(db.categories[0].name).toBe("Recommendations");
  });

  it("items sent back with their id are updated in place (name and price)", async () => {
    seedFrenchStore();
    await saveStorefrontStep(USER_ID, threeItems);
    await saveStorefrontStep(USER_ID, {
      menuItems: [
        { id: "item_1", name: "Galette saucisse", price: 10 },
        { id: "item_2", name: "Crêpe beurre sucre", price: 4.5 },
        { id: "item_3", name: "Bolée de cidre", price: 3.5 },
      ],
    });

    expect(db.items).toHaveLength(3);
    expect(db.items.map((i) => [i.id, i.name, Number(i.price)])).toEqual([
      ["item_1", "Galette saucisse", 10],
      ["item_2", "Crêpe beurre sucre", 4.5],
      ["item_3", "Bolée de cidre", 3.5],
    ]);
    // item_2 didn't change, so it isn't written; the others only on this storefront.
    expect(tx.menuItem.updateMany.mock.calls.map(([args]) => args.where)).toEqual([
      { id: "item_1", storefrontId: "sf_1" },
      { id: "item_3", storefrontId: "sf_1" },
    ]);
  });

  it("renaming an item frees its old name for a new one in the same request", async () => {
    seedFrenchStore();
    await saveStorefrontStep(USER_ID, { menuItems: [{ name: "Galette", price: 9 }] });
    await saveStorefrontStep(USER_ID, {
      menuItems: [
        { id: "item_1", name: "Galette complète", price: 9 },
        { name: "Galette", price: 8 },
      ],
    });
    expect(db.items.map((i) => i.name)).toEqual(["Galette complète", "Galette"]);
  });

  it("never touches an item id from another storefront; the entry is saved as a new item", async () => {
    seedFrenchStore();
    await saveStorefrontStep(USER_ID, {
      menuItems: [{ id: "someone_elses_item", name: "Kouign-amann", price: 3.2 }],
    });

    expect(tx.menuItem.updateMany).not.toHaveBeenCalled();
    expect(db.items).toEqual([
      expect.objectContaining({ id: "item_1", name: "Kouign-amann", storefrontId: "sf_1" }),
    ]);
  });

  it("rounds prices to cents", async () => {
    seedFrenchStore();
    await saveStorefrontStep(USER_ID, { menuItems: [{ name: "Café", price: 2.456 }] });
    expect(Number(db.items[0].price)).toBe(2.46);
  });

  it("sets logo, colour and tagline; an empty string clears logo and tagline", async () => {
    seedFrenchStore();
    await saveStorefrontStep(USER_ID, {
      logoUrl: "https://x.public.blob.vercel-storage.com/logo.png",
      themeColor: "#0f172a",
      tagline: "Face à la mer",
      menuItems: [],
    });
    expect(db.storefront).toMatchObject({
      logoUrl: "https://x.public.blob.vercel-storage.com/logo.png",
      themeColor: "#0f172a",
      tagline: "Face à la mer",
    });

    await saveStorefrontStep(USER_ID, { logoUrl: "", tagline: "", menuItems: [] });
    expect(db.storefront).toMatchObject({ logoUrl: null, tagline: null, themeColor: "#0f172a" });
  });

  it("deletes a saved item whose row the owner cleared, and only on this storefront", async () => {
    seedFrenchStore();
    await saveStorefrontStep(USER_ID, threeItems);
    db.items.push({
      id: "someone_elses_item",
      storefrontId: "sf_other",
      name: "Not mine",
      price: new Prisma.Decimal(1),
      displayOrder: 9,
    });

    const state = await saveStorefrontStep(USER_ID, {
      menuItems: [
        { id: "item_1", name: "Galette complète", price: 9.5 },
        { id: "item_3", name: "Bolée de cidre", price: 3 },
      ],
      removedItemIds: ["item_2", "someone_elses_item"],
    });

    expect(tx.menuItem.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["item_2", "someone_elses_item"] }, storefrontId: "sf_1" },
    });
    expect(db.items.map((i) => i.id)).toEqual(["item_1", "item_3", "someone_elses_item"]);
    expect(state.menuItems.map((i) => i.name)).not.toContain("Crêpe beurre sucre");
  });

  it("clearing every row (no items left) still deletes them, under the menu lock", async () => {
    seedFrenchStore();
    await saveStorefrontStep(USER_ID, threeItems);
    vi.clearAllMocks();
    wireModel();

    const state = await saveStorefrontStep(USER_ID, {
      menuItems: [],
      removedItemIds: ["item_1", "item_2", "item_3"],
    });

    expect(db.items).toEqual([]);
    expect(state.menuItems).toEqual([]);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.menuItem.create).not.toHaveBeenCalled();
  });

  it("an id sent both as an item and as removed is kept", async () => {
    seedFrenchStore();
    await saveStorefrontStep(USER_ID, threeItems);
    await saveStorefrontStep(USER_ID, {
      menuItems: [{ id: "item_1", name: "Galette complète", price: 9.5 }],
      removedItemIds: ["item_1"],
    });
    expect(tx.menuItem.deleteMany).not.toHaveBeenCalled();
    expect(db.items).toHaveLength(3);
  });

  it("deletes a replaced or removed logo the owner uploaded, only once the new value is saved", async () => {
    const own = `https://abc.public.blob.vercel-storage.com/users/${USER_ID}/images/1-logo.png`;
    seedFrenchStore({ storefront: { logoUrl: own } });

    // Skipping (no logoUrl) keeps the saved file.
    await saveStorefrontStep(USER_ID, { menuItems: [] });
    expect(h.storageDelete).not.toHaveBeenCalled();
    // Re-saving the same logo keeps it too.
    await saveStorefrontStep(USER_ID, { logoUrl: own, menuItems: [] });
    expect(h.storageDelete).not.toHaveBeenCalled();

    const next = `https://abc.public.blob.vercel-storage.com/users/${USER_ID}/images/2-logo.png`;
    await saveStorefrontStep(USER_ID, { logoUrl: next, menuItems: [] });
    expect(db.storefront!.logoUrl).toBe(next);
    expect(h.storageDelete).toHaveBeenCalledWith(own);
    expect(h.storageDelete.mock.invocationCallOrder[0]).toBeGreaterThan(
      prisma.storefront.update.mock.invocationCallOrder.at(-1)!
    );

    // Removing it ("" clears) deletes it as well.
    await saveStorefrontStep(USER_ID, { logoUrl: "", menuItems: [] });
    expect(h.storageDelete).toHaveBeenLastCalledWith(next);
  });

  it("never deletes a logo that isn't the caller's own upload, and a failed delete doesn't fail the step", async () => {
    seedFrenchStore({
      storefront: { logoUrl: "https://abc.public.blob.vercel-storage.com/users/user_2/images/x.png" },
    });
    await saveStorefrontStep(USER_ID, { logoUrl: "", menuItems: [] });
    seedFrenchStore({ storefront: { logoUrl: "https://example.com/logo.png" } });
    await saveStorefrontStep(USER_ID, { logoUrl: "", menuItems: [] });
    expect(h.storageDelete).not.toHaveBeenCalled();

    h.storageDelete.mockRejectedValueOnce(new Error("blob down"));
    seedFrenchStore({
      storefront: {
        logoUrl: `https://abc.public.blob.vercel-storage.com/users/${USER_ID}/images/1.png`,
      },
    });
    const state = await saveStorefrontStep(USER_ID, { logoUrl: "", menuItems: [] });
    expect(state.step).toBe(3);
    expect(db.storefront!.logoUrl).toBeNull();
  });

  it("skipping (empty body) still advances to step 3 and creates nothing", async () => {
    seedFrenchStore();
    const state = await saveStorefrontStep(USER_ID, { menuItems: [] });
    expect(state.step).toBe(3);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.menuCategory.create).not.toHaveBeenCalled();
    expect(prisma.storefront.update).not.toHaveBeenCalled();
  });

  it("an owner who already finished setup is not put back into the wizard", async () => {
    resetDb({ hasOnboarded: true });
    seedFrenchStore({ business: { onboardingStep: null } });
    await saveStorefrontStep(USER_ID, threeItems);
    expect(prisma.business.update).not.toHaveBeenCalled();
    expect(db.business!.onboardingStep).toBeNull();
  });
});

// ==========================================================================
// Step 3 — completeOnboarding
// ==========================================================================

describe("completeOnboarding", () => {
  const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://epidom.fr/";
  });
  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
  });

  it("publishes, saves the goals, clears the step and marks the account onboarded", async () => {
    seedFrenchStore({ business: { onboardingStep: 3 } });
    const result = await completeOnboarding(USER_ID, { goals: ["storefront", "counter"] });

    expect(result).toEqual({
      storeId: "store_clx9abcdef",
      slug: "creperie-du-port",
      publicUrl: "https://epidom.fr/@creperie-du-port",
      goals: ["storefront", "counter"],
    });
    expect(db.storefront!.isPublished).toBe(true);
    expect(db.business).toMatchObject({
      onboardingGoals: ["storefront", "counter"],
      onboardingStep: null,
    });
    expect(db.user.hasOnboarded).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    const state = await getOnboardingState(USER_ID);
    expect(state.completed).toBe(true);
    expect(state.goals).toEqual(["storefront", "counter"]);
  });

  it("without a store / storefront is a 409 step_order and changes nothing", async () => {
    const err = await rejection(completeOnboarding(USER_ID, { goals: [] }));
    expect(err.statusCode).toBe(409);
    expect(err.details?.reason).toBe("step_order");
    expect(db.user.hasOnboarded).toBe(false);
  });

  it("is idempotent; a repeat with an empty body keeps the goals saved the first time", async () => {
    seedFrenchStore();
    await completeOnboarding(USER_ID, { goals: ["operations"] });
    const again = await completeOnboarding(USER_ID, { goals: [] });

    expect(again.goals).toEqual(["operations"]);
    expect(db.business!.onboardingGoals).toEqual(["operations"]);
    expect(db.storefront!.isPublished).toBe(true);
  });

  it("does not touch online orders or reservations (the storefront settings route owns those)", async () => {
    seedFrenchStore();
    await completeOnboarding(USER_ID, { goals: [] });
    const [publish] = prisma.storefront.update.mock.calls.map(([args]) => args);
    expect(publish.data).toEqual({ isPublished: true });
  });
});

// ==========================================================================
// getOnboardingState
// ==========================================================================

describe("getOnboardingState", () => {
  it("a brand-new account: step 1, nothing saved, currency guessed from the browser zone", async () => {
    const state = await getOnboardingState(USER_ID);
    expect(state).toEqual({
      step: 1,
      completed: false,
      storeId: null,
      business: null,
      storefront: null,
      currency: "EUR",
      menuItems: [],
      goals: [],
    });
    expect(h.getFinanceSettings).not.toHaveBeenCalled();
  });

  it("an unknown user is a 404", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const err = await rejection(getOnboardingState(USER_ID));
    expect(err.statusCode).toBe(404);
  });

  it("maps older free-text countries to a code, and unknown text to ZZ", async () => {
    seedFrenchStore({ business: { country: "Indonésie" } });
    expect((await getOnboardingState(USER_ID)).business?.countryCode).toBe("ID");

    seedFrenchStore({ business: { country: "Atlantis" } });
    expect((await getOnboardingState(USER_ID)).business?.countryCode).toBe("ZZ");
  });

  it("a null country with a store is Other (step 1 stores Other as null); without one it is unset", async () => {
    seedFrenchStore({ business: { country: null } });
    expect((await getOnboardingState(USER_ID)).business?.countryCode).toBe("ZZ");

    // A business the old flow created before any store: nothing was chosen.
    db.store = null;
    db.storefront = null;
    expect((await getOnboardingState(USER_ID)).business?.countryCode).toBeNull();
  });

  it("clamps the stored step to 1–3, drops unknown goals and business types", async () => {
    seedFrenchStore({
      business: {
        onboardingStep: 9,
        onboardingGoals: ["counter", "world-domination"],
        businessType: "spaceship",
      },
    });
    const state = await getOnboardingState(USER_ID);
    expect(state.step).toBe(3);
    expect(state.goals).toEqual(["counter"]);
    expect(state.business?.businessType).toBeNull();
  });

  it("a business without a store is back on step 1", async () => {
    seedFrenchStore({ business: { onboardingStep: 3 } });
    db.store = null;
    expect((await getOnboardingState(USER_ID)).step).toBe(1);
  });

  it("returns the first three menu items with plain-number prices", async () => {
    seedFrenchStore();
    db.items = [0, 1, 2, 3].map((n) => ({
      id: `item_${n}`,
      name: `Item ${n}`,
      price: new Prisma.Decimal("12.50"),
      currency: "EUR",
      displayOrder: n,
    }));
    const state = await getOnboardingState(USER_ID);
    expect(state.menuItems).toHaveLength(3);
    expect(state.menuItems[0]).toEqual({ id: "item_0", name: "Item 0", price: 12.5 });
  });
});

// ==========================================================================
// Slug check, request locale, public URL
// ==========================================================================

describe("checkSlugAvailability", () => {
  it("normalizes the input and reports a free link", async () => {
    await expect(checkSlugAvailability(USER_ID, "Mon Café")).resolves.toEqual({
      slug: "mon-cafe",
      available: true,
      suggestion: null,
    });
  });

  it("a link another storefront holds is unavailable, with a suggestion", async () => {
    db.others.set("mon-cafe", "other_sf");
    await expect(checkSlugAvailability(USER_ID, "mon-cafe")).resolves.toEqual({
      slug: "mon-cafe",
      available: false,
      suggestion: "mon-cafe-2",
    });
  });

  it("the caller's own current link counts as available", async () => {
    seedFrenchStore();
    await expect(checkSlugAvailability(USER_ID, "creperie-du-port")).resolves.toMatchObject({
      available: true,
    });
  });

  it("too short is unavailable with no suggestion", async () => {
    await expect(checkSlugAvailability(USER_ID, "ab")).resolves.toEqual({
      slug: "ab",
      available: false,
      suggestion: null,
    });
    expect(prisma.storefront.findUnique).not.toHaveBeenCalled();
  });
});

describe("uiLocaleFromRequest", () => {
  const req = (headers: Record<string, string>) =>
    new Request("http://localhost/api/onboarding/store", { headers });

  it("reads the x-epidom-locale header first", () => {
    expect(
      uiLocaleFromRequest(req({ "x-epidom-locale": "id", cookie: "epidom_locale_pref=en" }))
    ).toBe("id");
  });

  it("then the marketing site's language-pick cookie", () => {
    expect(uiLocaleFromRequest(req({ cookie: "a=1; epidom_locale_pref=fr; b=2" }))).toBe("fr");
  });

  it("ignores anything that isn't a supported locale", () => {
    expect(uiLocaleFromRequest(req({ "x-epidom-locale": "de" }))).toBeNull();
    expect(uiLocaleFromRequest(req({}))).toBeNull();
  });
});

describe("publicStorefrontUrl", () => {
  it("joins NEXT_PUBLIC_APP_URL and /@slug without a double slash", () => {
    const original = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://epidom.fr/";
    expect(publicStorefrontUrl("sunset-cafe")).toBe("https://epidom.fr/@sunset-cafe");
    process.env.NEXT_PUBLIC_APP_URL = original;
  });
});
