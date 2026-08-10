import { describe, it, expect, vi, beforeEach } from "vitest";

const findUniqueStore = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    store: {
      findUnique: (...args: unknown[]) => findUniqueStore(...args),
    },
  },
}));

const ORIGINAL_ENV = { ...process.env };

function setConfigured(configured: boolean) {
  if (configured) {
    process.env.MAGICBELL_API_KEY = "pk_test";
    process.env.MAGICBELL_API_SECRET = "sk_test";
  } else {
    delete process.env.MAGICBELL_API_KEY;
    delete process.env.MAGICBELL_API_SECRET;
  }
}

// sendMerchantAlert caches a "warned once" flag in a module-level variable, so
// (like sendPushToStore) each test needs a fresh module instance.
async function freshClient() {
  vi.resetModules();
  return import("../client");
}

// Flush the fire-and-forget microtask chain kicked off inside sendMerchantAlert.
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  vi.stubGlobal("fetch", vi.fn());
});

describe("sendMerchantAlert", () => {
  it("no-ops without throwing when MagicBell is not configured", async () => {
    setConfigured(false);
    const { sendMerchantAlert } = await freshClient();

    expect(() =>
      sendMerchantAlert({
        recipientEmail: "owner@example.com",
        recipientExternalId: "user-1",
        category: "new-order",
        title: "t",
        content: "b",
      })
    ).not.toThrow();
    await flush();

    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts to the MagicBell API with the right auth headers and recipient when configured", async () => {
    setConfigured(true);
    (fetch as any).mockResolvedValue({ ok: true });
    const { sendMerchantAlert } = await freshClient();

    sendMerchantAlert({
      recipientEmail: "owner@example.com",
      recipientExternalId: "user-1",
      category: "low-stock",
      title: "Stok rendah",
      content: "Sisa stok: 2 kg",
      actionUrl: "/store/store-1/data",
    });
    await flush();

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toBe("https://api.magicbell.com/notifications");
    expect(init.headers["x-magicbell-api-key"]).toBe("pk_test");
    expect(init.headers["x-magicbell-api-secret"]).toBe("sk_test");
    const body = JSON.parse(init.body);
    expect(body.notification).toMatchObject({
      title: "Stok rendah",
      content: "Sisa stok: 2 kg",
      category: "low-stock",
      action_url: "/store/store-1/data",
      recipients: [{ email: "owner@example.com", external_id: "user-1" }],
    });
  });

  it("never throws even when the API call fails", async () => {
    setConfigured(true);
    (fetch as any).mockResolvedValue({ ok: false, status: 500, text: async () => "server error" });
    const { sendMerchantAlert } = await freshClient();

    expect(() =>
      sendMerchantAlert({
        recipientEmail: "owner@example.com",
        recipientExternalId: "user-1",
        category: "new-order",
        title: "t",
        content: "b",
      })
    ).not.toThrow();
    await flush();
  });
});

describe("getStoreOwnerContact", () => {
  it("returns the store's owning user's email + id", async () => {
    findUniqueStore.mockResolvedValue({
      business: { user: { id: "user-1", email: "owner@example.com" } },
    });
    const { getStoreOwnerContact } = await freshClient();

    const contact = await getStoreOwnerContact("store-1");
    expect(contact).toEqual({ email: "owner@example.com", externalId: "user-1" });
  });

  it("returns null when the store doesn't exist", async () => {
    findUniqueStore.mockResolvedValue(null);
    const { getStoreOwnerContact } = await freshClient();

    const contact = await getStoreOwnerContact("missing-store");
    expect(contact).toBeNull();
  });
});
