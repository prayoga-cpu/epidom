import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { ApiErrorCode } from "@/types/api/responses";
import { PAYMENT_METHODS_BY_MARKET } from "@/config/payment-fees.config";
import { createStoreSchema, type CreateStoreInput } from "@/lib/validation/business.schemas";

const h = vi.hoisted(() => {
  const events: string[] = [];
  const tx = {
    $queryRaw: vi.fn(),
    business: { findUnique: vi.fn() },
    subscription: { findUnique: vi.fn() },
    store: { count: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn() },
    staffMember: { create: vi.fn() },
    storeFinanceSettings: { create: vi.fn() },
  };
  const prisma = { $transaction: vi.fn() };
  return {
    events,
    tx,
    prisma,
    findSubscriptionByUserId: vi.fn(),
    getStorefrontByStoreId: vi.fn(),
    logError: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/lib/storage", () => ({ getStorageAdapter: vi.fn() }));
vi.mock("@/lib/repositories/subscription.repository", () => ({
  subscriptionRepository: { findByUserId: h.findSubscriptionByUserId },
}));
vi.mock("@/lib/repositories/business.repository", () => ({ businessRepository: {} }));
vi.mock("@/lib/repositories/store.repository", () => ({ storeRepository: {} }));
vi.mock("../storefront.service", () => ({
  storefrontService: { getStorefrontByStoreId: h.getStorefrontByStoreId },
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: h.logError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { BusinessService } from "../business.service";

const BUSINESS_ID = "biz_1";
const USER_ID = "user_1";
const NEW_STORE_ID = "store_new";

const businessRepo = {
  findByUserId: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
};
const storeRepo = {
  count: vi.fn(),
  belongsToBusiness: vi.fn(),
  existsByName: vi.fn(),
  update: vi.fn(),
};

const service = new BusinessService(businessRepo as never, storeRepo as never);

/** Parse through the real schema so tests exercise what the route would pass. */
function body(raw: Record<string, unknown>): CreateStoreInput {
  return createStoreSchema.parse({ name: "Kopi Dua", ...raw });
}

function financeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "fin_src",
    storeId: "store_src",
    currency: "EUR",
    market: "FRANCE",
    enabledPaymentMethods: ["CASH", "STRIPE_CARD", "TITRE_RESTAURANT"],
    taxEnabled: true,
    taxRate: new Prisma.Decimal("0.1000"),
    taxLabel: "TVA",
    taxInclusive: true,
    serviceChargeEnabled: true,
    serviceChargeRate: new Prisma.Decimal("0.0500"),
    processingFeeEnabled: false,
    processingFeeOverrides: { STRIPE_CARD: { percent: 1.4, flat: 0.25 } },
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-02-01T00:00:00Z"),
    ...overrides,
  };
}

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    return e as {
      statusCode?: number;
      code?: string;
      message: string;
      details?: Record<string, unknown>;
    };
  }
  throw new Error("expected the promise to reject");
}

const createdStoreData = () => h.tx.store.create.mock.calls[0][0].data;
const createdFinanceData = () => h.tx.storeFinanceSettings.create.mock.calls[0][0].data;

beforeEach(() => {
  vi.clearAllMocks();
  h.events.length = 0;

  h.prisma.$transaction.mockImplementation(async (cb: (t: typeof h.tx) => unknown) => {
    const result = await cb(h.tx);
    h.events.push("commit");
    return result;
  });

  h.tx.business.findUnique.mockResolvedValue({ id: BUSINESS_ID, userId: USER_ID });
  h.tx.$queryRaw.mockResolvedValue([{ id: BUSINESS_ID }]);
  h.tx.subscription.findUnique.mockResolvedValue({ status: "ACTIVE", plan: "OPERATIONS" });
  h.tx.store.count.mockResolvedValue(1);
  h.tx.store.findFirst.mockResolvedValue(null);
  h.tx.store.findUnique.mockResolvedValue(null);
  h.tx.store.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    h.events.push("store.create");
    return { id: NEW_STORE_ID, ...data };
  });
  h.tx.user.findUnique.mockResolvedValue({ name: "Sari", email: "sari@kopi.id" });
  h.tx.staffMember.create.mockImplementation(async () => {
    h.events.push("staffMember.create");
    return { id: "staff_owner" };
  });
  h.tx.storeFinanceSettings.create.mockImplementation(async () => {
    h.events.push("storeFinanceSettings.create");
    return {};
  });

  h.getStorefrontByStoreId.mockImplementation(async (storeId: string) => {
    h.events.push("storefront");
    return { id: "sf_1", storeId, slug: "kopi-dua" };
  });

  businessRepo.findByUserId.mockResolvedValue({ id: BUSINESS_ID, userId: USER_ID });
  h.findSubscriptionByUserId.mockResolvedValue({ status: "ACTIVE", plan: "OPERATIONS" });
  storeRepo.count.mockResolvedValue(1);
});

describe("BusinessService.createStore — provisioning", () => {
  it("gives the new store an OWNER staff row with the same fields the first store gets", async () => {
    await service.createStore(BUSINESS_ID, USER_ID, body({}));

    expect(h.tx.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: USER_ID } })
    );
    expect(h.tx.staffMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          storeId: NEW_STORE_ID,
          name: "Sari",
          email: "sari@kopi.id",
          role: "OWNER",
          pin: null,
          isActive: true,
          inviteStatus: "accepted",
        },
      })
    );
  });

  it('names the OWNER row "Owner" when the account has no name', async () => {
    h.tx.user.findUnique.mockResolvedValue({ name: null, email: "x@y.fr" });

    await service.createStore(BUSINESS_ID, USER_ID, body({}));

    expect(h.tx.staffMember.create.mock.calls[0][0].data.name).toBe("Owner");
  });

  it("creates the draft storefront only after the transaction commits", async () => {
    const store = await service.createStore(BUSINESS_ID, USER_ID, body({}));

    expect(store.id).toBe(NEW_STORE_ID);
    expect(h.getStorefrontByStoreId).toHaveBeenCalledWith(NEW_STORE_ID);
    expect(h.events).toEqual(["store.create", "staffMember.create", "commit", "storefront"]);
  });

  it("a storefront failure is logged and never fails store creation", async () => {
    h.getStorefrontByStoreId.mockRejectedValue(new Error("slug race"));

    const store = await service.createStore(BUSINESS_ID, USER_ID, body({}));

    expect(store.id).toBe(NEW_STORE_ID);
    expect(h.logError).toHaveBeenCalledWith(
      expect.stringContaining("storefront"),
      expect.any(Error),
      { storeId: NEW_STORE_ID }
    );
  });

  it('only the free-text country "France" (the old Create-store form): EUR / FRANCE row, not IDR', async () => {
    await service.createStore(
      BUSINESS_ID,
      USER_ID,
      body({ city: "Lyon", country: "France", address: "1 rue X", phone: "", email: "" })
    );

    expect(h.tx.store.findUnique).not.toHaveBeenCalled();
    expect(createdStoreData()).toEqual({
      businessId: BUSINESS_ID,
      name: "Kopi Dua",
      address: "1 rue X",
      city: "Lyon",
      country: "France",
      phone: undefined,
      email: undefined,
      image: undefined,
    });
    expect(createdFinanceData()).toEqual({
      storeId: NEW_STORE_ID,
      currency: "EUR",
      market: "FRANCE",
      enabledPaymentMethods: PAYMENT_METHODS_BY_MARKET.FRANCE,
    });
    // The OWNER row and draft storefront are for every new store.
    expect(h.tx.staffMember.create).toHaveBeenCalledTimes(1);
    expect(h.getStorefrontByStoreId).toHaveBeenCalledTimes(1);
  });

  it("a free-text country in another spelling is read too, and stored as its English name", async () => {
    await service.createStore(BUSINESS_ID, USER_ID, body({ country: "  indonésie " }));

    expect(createdStoreData().country).toBe("Indonesia");
    expect(createdFinanceData()).toMatchObject({ currency: "IDR", market: "INDONESIA" });
  });

  it("a sent countryCode wins over the free-text country", async () => {
    await service.createStore(BUSINESS_ID, USER_ID, body({ countryCode: "GB", country: "France" }));

    expect(createdStoreData().country).toBe("United Kingdom");
    expect(createdFinanceData().currency).toBe("GBP");
  });

  it("country mode with only a free-text country uses that country (no 400)", async () => {
    await service.createStore(
      BUSINESS_ID,
      USER_ID,
      body({ country: "Belgique", financeSource: { mode: "country" } })
    );

    expect(createdStoreData().country).toBe("Belgium");
    expect(createdFinanceData().currency).toBe("EUR");
  });

  it("no countryCode and a free-text country that names no listed country: no finance row, text kept", async () => {
    await service.createStore(BUSINESS_ID, USER_ID, body({ country: "Atlantis" }));

    expect(h.tx.storeFinanceSettings.create).not.toHaveBeenCalled();
    expect(createdStoreData().country).toBe("Atlantis");
    expect(createdStoreData()).not.toHaveProperty("syncFinanceWithBusiness");
  });

  it("no countryCode, no country, no financeSource: no finance row (nothing to go on)", async () => {
    await service.createStore(BUSINESS_ID, USER_ID, body({}));

    expect(h.tx.storeFinanceSettings.create).not.toHaveBeenCalled();
    expect(createdStoreData().country).toBeUndefined();
  });

  it("never passes the create-only fields to the Store row", async () => {
    await service.createStore(
      BUSINESS_ID,
      USER_ID,
      body({ countryCode: "FR", financeSource: { mode: "country" } })
    );

    expect(createdStoreData()).not.toHaveProperty("countryCode");
    expect(createdStoreData()).not.toHaveProperty("financeSource");
  });

  it('country mode, France: EUR / FRANCE with the French payment methods, and country = "France"', async () => {
    await service.createStore(
      BUSINESS_ID,
      USER_ID,
      body({ countryCode: "fr", country: "ignored free text", financeSource: { mode: "country" } })
    );

    expect(createdStoreData().country).toBe("France");
    expect(createdStoreData()).not.toHaveProperty("syncFinanceWithBusiness");
    expect(createdFinanceData()).toEqual({
      storeId: NEW_STORE_ID,
      currency: "EUR",
      market: "FRANCE",
      enabledPaymentMethods: PAYMENT_METHODS_BY_MARKET.FRANCE,
    });
    // Finance settings exist before the transaction commits (menu items fix their currency on create).
    expect(h.events.indexOf("storeFinanceSettings.create")).toBeLessThan(
      h.events.indexOf("commit")
    );
  });

  it("country mode ignores a currency sent with a listed country", async () => {
    await service.createStore(
      BUSINESS_ID,
      USER_ID,
      body({ countryCode: "FR", financeSource: { mode: "country", currency: "usd" } })
    );

    expect(createdFinanceData().currency).toBe("EUR");
  });

  it('"Other" (ZZ) + a chosen currency: that currency, INTERNATIONAL, and the free-text country is kept', async () => {
    await service.createStore(
      BUSINESS_ID,
      USER_ID,
      body({
        countryCode: "ZZ",
        country: "Brasil",
        financeSource: { mode: "country", currency: "brl" },
      })
    );

    expect(createdStoreData().country).toBe("Brasil");
    expect(createdFinanceData()).toEqual({
      storeId: NEW_STORE_ID,
      currency: "BRL",
      market: "INTERNATIONAL",
      enabledPaymentMethods: PAYMENT_METHODS_BY_MARKET.INTERNATIONAL,
    });
  });

  it("countryCode without financeSource: the country's defaults (Indonesia → IDR / INDONESIA)", async () => {
    await service.createStore(BUSINESS_ID, USER_ID, body({ countryCode: "ID" }));

    expect(createdStoreData().country).toBe("Indonesia");
    expect(createdFinanceData()).toEqual({
      storeId: NEW_STORE_ID,
      currency: "IDR",
      market: "INDONESIA",
      enabledPaymentMethods: PAYMENT_METHODS_BY_MARKET.INDONESIA,
    });
  });

  it("country mode without countryCode is refused with 400 and creates nothing", async () => {
    const err = await rejection(
      service.createStore(BUSINESS_ID, USER_ID, body({ financeSource: { mode: "country" } }))
    );

    expect(err.statusCode).toBe(400);
    expect(err.code).toBe(ApiErrorCode.VALIDATION_ERROR);
    expect(h.tx.store.create).not.toHaveBeenCalled();
    expect(h.getStorefrontByStoreId).not.toHaveBeenCalled();
  });

  describe("copy mode", () => {
    it("copies every config column of an unsynced source's row into the new store's own row", async () => {
      h.tx.store.findUnique.mockResolvedValue({
        businessId: BUSINESS_ID,
        syncFinanceWithBusiness: false,
        financeSettings: financeRow(),
      });

      await service.createStore(
        BUSINESS_ID,
        USER_ID,
        body({ countryCode: "BE", financeSource: { mode: "copy", storeId: "store_src" } })
      );

      expect(h.tx.store.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "store_src" } })
      );
      expect(createdStoreData()).not.toHaveProperty("syncFinanceWithBusiness");
      expect(createdFinanceData()).toEqual({
        storeId: NEW_STORE_ID,
        currency: "EUR",
        market: "FRANCE",
        enabledPaymentMethods: ["CASH", "STRIPE_CARD", "TITRE_RESTAURANT"],
        taxEnabled: true,
        taxRate: new Prisma.Decimal("0.1000"),
        taxLabel: "TVA",
        taxInclusive: true,
        serviceChargeEnabled: true,
        serviceChargeRate: new Prisma.Decimal("0.0500"),
        processingFeeEnabled: false,
        processingFeeOverrides: { STRIPE_CARD: { percent: 1.4, flat: 0.25 } },
      });
      // The copied row is the source's, not the new country's defaults.
      expect(createdStoreData().country).toBe("Belgium");
    });

    it("a source that follows the shared business settings makes the new store follow them too (no own row)", async () => {
      h.tx.store.findUnique.mockResolvedValue({
        businessId: BUSINESS_ID,
        syncFinanceWithBusiness: true,
        financeSettings: financeRow(),
      });

      await service.createStore(
        BUSINESS_ID,
        USER_ID,
        body({ countryCode: "FR", financeSource: { mode: "copy", storeId: "store_src" } })
      );

      expect(createdStoreData().syncFinanceWithBusiness).toBe(true);
      expect(h.tx.storeFinanceSettings.create).not.toHaveBeenCalled();
    });

    it("a source without a row + countryCode: the new store gets its country's defaults", async () => {
      h.tx.store.findUnique.mockResolvedValue({
        businessId: BUSINESS_ID,
        syncFinanceWithBusiness: false,
        financeSettings: null,
      });

      await service.createStore(
        BUSINESS_ID,
        USER_ID,
        body({ countryCode: "GB", financeSource: { mode: "copy", storeId: "store_src" } })
      );

      expect(createdFinanceData()).toEqual({
        storeId: NEW_STORE_ID,
        currency: "GBP",
        market: "INTERNATIONAL",
        enabledPaymentMethods: PAYMENT_METHODS_BY_MARKET.INTERNATIONAL,
      });
    });

    it("a source without a row and no countryCode: nothing to copy, no row", async () => {
      h.tx.store.findUnique.mockResolvedValue({
        businessId: BUSINESS_ID,
        syncFinanceWithBusiness: false,
        financeSettings: null,
      });

      await service.createStore(
        BUSINESS_ID,
        USER_ID,
        body({ financeSource: { mode: "copy", storeId: "store_src" } })
      );

      expect(h.tx.storeFinanceSettings.create).not.toHaveBeenCalled();
      expect(createdStoreData()).not.toHaveProperty("syncFinanceWithBusiness");
    });

    it("refuses a source store from another business with 403, before creating anything", async () => {
      h.tx.store.findUnique.mockResolvedValue({
        businessId: "someone_elses_business",
        syncFinanceWithBusiness: false,
        financeSettings: financeRow(),
      });

      const err = await rejection(
        service.createStore(
          BUSINESS_ID,
          USER_ID,
          body({ countryCode: "FR", financeSource: { mode: "copy", storeId: "store_foreign" } })
        )
      );

      expect(err.statusCode).toBe(403);
      expect(err.code).toBe(ApiErrorCode.FORBIDDEN);
      expect(h.tx.store.create).not.toHaveBeenCalled();
      expect(h.tx.staffMember.create).not.toHaveBeenCalled();
      expect(h.tx.storeFinanceSettings.create).not.toHaveBeenCalled();
      expect(h.getStorefrontByStoreId).not.toHaveBeenCalled();
    });

    it("answers a source id that doesn't exist exactly like a foreign one (no probing)", async () => {
      h.tx.store.findUnique.mockResolvedValue(null);

      const err = await rejection(
        service.createStore(
          BUSINESS_ID,
          USER_ID,
          body({ financeSource: { mode: "copy", storeId: "nope" } })
        )
      );

      expect(err.statusCode).toBe(403);
      expect(h.tx.store.create).not.toHaveBeenCalled();
    });
  });

  it("the in-transaction limit check names the Operations plan (no more 'Upgrade to Pro')", async () => {
    h.tx.subscription.findUnique.mockResolvedValue({ status: "ACTIVE", plan: "FREE" });
    h.tx.store.count.mockResolvedValue(1);

    const err = await rejection(service.createStore(BUSINESS_ID, USER_ID, body({})));

    expect(err.statusCode).toBe(403);
    expect(err.code).toBe(ApiErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED);
    expect(err.message).toBe(
      "Your plan includes 1 store. Upgrade to the Operations plan to add more stores."
    );
    expect(err.message).not.toMatch(/pro\b/i);
    expect(err.details).toMatchObject({
      current: 1,
      limit: 1,
      upgradeRequired: true,
      requiredPlan: "OPERATIONS",
    });
    expect(h.tx.store.create).not.toHaveBeenCalled();
  });
});

describe("BusinessService.createStore — business row lock", () => {
  /** The SQL text of a tagged-template $queryRaw call, with "?" for each value. */
  const sqlOf = (call: unknown[]) => (call[0] as TemplateStringsArray).join("?");

  it("locks the business row FOR UPDATE, after the ownership check and before the limit and name checks", async () => {
    await service.createStore(BUSINESS_ID, USER_ID, body({}));

    expect(h.tx.$queryRaw).toHaveBeenCalledTimes(1);
    const call = h.tx.$queryRaw.mock.calls[0];
    expect(sqlOf(call)).toMatch(/^SELECT id FROM businesses WHERE id = \? FOR UPDATE$/);
    expect(call[1]).toBe(BUSINESS_ID);

    const lockAt = h.tx.$queryRaw.mock.invocationCallOrder[0];
    expect(h.tx.business.findUnique.mock.invocationCallOrder[0]).toBeLessThan(lockAt);
    for (const later of [h.tx.subscription.findUnique, h.tx.store.count, h.tx.store.findFirst]) {
      expect(later.mock.invocationCallOrder[0]).toBeGreaterThan(lockAt);
    }
  });

  it("someone else's business is refused without taking its lock", async () => {
    h.tx.business.findUnique.mockResolvedValue({ id: BUSINESS_ID, userId: "someone_else" });

    await expect(service.createStore(BUSINESS_ID, USER_ID, body({}))).rejects.toThrow(
      "Unauthorized"
    );
    expect(h.tx.$queryRaw).not.toHaveBeenCalled();
  });

  /**
   * Two creates for one business at the same time, against a small fake of the
   * database: a store inserted in a transaction becomes visible to others only
   * at commit (ReadCommitted), and the business row lock is held from the
   * FOR UPDATE until commit. Every query yields, so the two transactions
   * interleave; without the lock both would count the same stores and both insert.
   */
  function fakeDatabase() {
    const committed: Array<{ id: string; name: string }> = [];
    let lockHeld: Promise<void> | null = null;
    const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

    h.prisma.$transaction.mockImplementation(async (cb: (t: unknown) => unknown) => {
      const inserted: Array<{ id: string; name: string }> = [];
      let releaseLock: (() => void) | null = null;
      const tx = {
        ...h.tx,
        $queryRaw: vi.fn(async () => {
          while (lockHeld) await lockHeld;
          lockHeld = new Promise<void>((resolve) => {
            releaseLock = () => {
              lockHeld = null;
              resolve();
            };
          });
          return [{ id: BUSINESS_ID }];
        }),
        store: {
          ...h.tx.store,
          count: vi.fn(async () => {
            await tick();
            return committed.length + inserted.length;
          }),
          findFirst: vi.fn(async ({ where }: { where: { name: { equals: string } } }) => {
            await tick();
            const wanted = where.name.equals.toLowerCase();
            return (
              [...committed, ...inserted].find((s) => s.name.toLowerCase() === wanted) ?? null
            );
          }),
          create: vi.fn(async ({ data }: { data: { name: string } }) => {
            await tick();
            const store = { ...data, id: `store_${committed.length + inserted.length + 1}` };
            inserted.push(store);
            return store;
          }),
        },
      };
      try {
        const result = await cb(tx);
        committed.push(...inserted);
        return result;
      } finally {
        (releaseLock as (() => void) | null)?.();
      }
    });

    return { committed };
  }

  it("two concurrent creates on a one-store plan: the second waits, sees the first store and is refused", async () => {
    const db = fakeDatabase();
    h.tx.subscription.findUnique.mockResolvedValue({ status: "ACTIVE", plan: "FREE" });

    const results = await Promise.allSettled([
      service.createStore(BUSINESS_ID, USER_ID, body({ name: "Kopi Satu" })),
      service.createStore(BUSINESS_ID, USER_ID, body({ name: "Kopi Dua" })),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    const refused = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(refused.reason).toMatchObject({ code: ApiErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED });
    expect(db.committed).toHaveLength(1);
  });

  it("two concurrent creates with the same name (any case): only one store is created", async () => {
    const db = fakeDatabase();

    const results = await Promise.allSettled([
      service.createStore(BUSINESS_ID, USER_ID, body({ name: "Kopi Dua" })),
      service.createStore(BUSINESS_ID, USER_ID, body({ name: "KOPI DUA" })),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    const refused = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect((refused.reason as Error).message).toMatch(/already exists/);
    expect(db.committed).toHaveLength(1);
  });
});

describe("BusinessService.createStoreForUser", () => {
  it("a FREE or POS plan at its one store is refused with a message naming the Operations plan", async () => {
    for (const plan of ["FREE", "POS"]) {
      h.findSubscriptionByUserId.mockResolvedValue({ status: "ACTIVE", plan });
      storeRepo.count.mockResolvedValue(1);

      const err = await rejection(service.createStoreForUser(USER_ID, body({})));

      expect(err.statusCode).toBe(403);
      expect(err.code).toBe(ApiErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED);
      expect(err.message).toContain("Operations plan");
      expect(err.details).toMatchObject({ upgradeRequired: true, requiredPlan: "OPERATIONS" });
    }
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("the limit error is still a StoreLimitExceededError (existing catch sites keep working)", async () => {
    const { StoreLimitExceededError } = await import("@/lib/errors");
    h.findSubscriptionByUserId.mockResolvedValue({ status: "ACTIVE", plan: "FREE" });

    const err = await rejection(service.createStoreForUser(USER_ID, body({})));

    expect(err).toBeInstanceOf(StoreLimitExceededError);
  });

  it("an Operations plan creates and provisions the store", async () => {
    const store = await service.createStoreForUser(
      USER_ID,
      body({ countryCode: "FR", financeSource: { mode: "country" } })
    );

    expect(store.id).toBe(NEW_STORE_ID);
    expect(h.tx.staffMember.create).toHaveBeenCalledTimes(1);
    expect(createdFinanceData().currency).toBe("EUR");
  });

  it("auto-creating a missing business takes its clock, language and country from countryCode", async () => {
    businessRepo.findByUserId.mockResolvedValue(null);
    businessRepo.create.mockResolvedValue({ id: BUSINESS_ID, userId: USER_ID });

    await service.createStoreForUser(USER_ID, body({ countryCode: "FR" }));

    expect(businessRepo.create).toHaveBeenCalledWith({
      userId: USER_ID,
      name: "My Business",
      timezone: "Europe/Paris",
      locale: "fr",
      country: "France",
    });
  });

  it("auto-creating a missing business reads a free-text store country the same way", async () => {
    businessRepo.findByUserId.mockResolvedValue(null);
    businessRepo.create.mockResolvedValue({ id: BUSINESS_ID, userId: USER_ID });

    await service.createStoreForUser(USER_ID, body({ country: "france" }));

    expect(businessRepo.create).toHaveBeenCalledWith({
      userId: USER_ID,
      name: "My Business",
      timezone: "Europe/Paris",
      locale: "fr",
      country: "France",
    });
    expect(createdFinanceData().currency).toBe("EUR");
  });

  it("auto-creating a missing business without countryCode keeps the old UTC / en defaults", async () => {
    businessRepo.findByUserId.mockResolvedValue(null);
    businessRepo.create.mockResolvedValue({ id: BUSINESS_ID, userId: USER_ID });

    await service.createStoreForUser(USER_ID, body({}));

    expect(businessRepo.create).toHaveBeenCalledWith({
      userId: USER_ID,
      name: "My Business",
      timezone: "UTC",
      locale: "en",
    });
  });
});

describe("BusinessService.updateStore — create-only fields sent to PATCH", () => {
  beforeEach(() => {
    storeRepo.belongsToBusiness.mockResolvedValue(true);
    businessRepo.findById.mockResolvedValue({ id: BUSINESS_ID, userId: USER_ID });
    storeRepo.existsByName.mockResolvedValue(false);
    storeRepo.update.mockImplementation(async (id: string, data: unknown) => ({
      id,
      ...(data as object),
    }));
  });

  it("strips countryCode / financeSource (not Store columns) and stores the country's name", async () => {
    const input = createStoreSchema.partial().parse({
      city: "Nantes",
      countryCode: "FR",
      financeSource: { mode: "country" },
    });

    await service.updateStore("store_1", BUSINESS_ID, USER_ID, input);

    expect(storeRepo.update).toHaveBeenCalledWith("store_1", { city: "Nantes", country: "France" });
  });

  it("an update without countryCode is untouched", async () => {
    await service.updateStore("store_1", BUSINESS_ID, USER_ID, {
      name: "New name",
      country: "Belgique",
    });

    expect(storeRepo.update).toHaveBeenCalledWith("store_1", {
      name: "New name",
      country: "Belgique",
    });
  });

  it("an optional field emptied in Edit store is cleared, not silently kept", async () => {
    await service.updateStore("store_1", BUSINESS_ID, USER_ID, {
      name: "",
      address: "",
      phone: "",
      email: "",
      city: "Lyon",
    });

    // The name can't be emptied (dropped); the emptied optional columns become null.
    expect(storeRepo.update).toHaveBeenCalledWith("store_1", {
      address: null,
      phone: null,
      email: null,
      city: "Lyon",
    });
  });
});
