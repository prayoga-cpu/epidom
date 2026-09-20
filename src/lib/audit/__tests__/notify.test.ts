import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const send = vi.hoisted(() => vi.fn());

vi.mock("@/lib/inngest/client", () => ({ inngest: { send } }));

import { notifyAccountAction, notifyCriticalAction } from "../notify";

const CUSTOMER = { id: "user-1", email: "customer@example.com", name: "A Customer" };
const ADMIN = { id: "user-2", email: "prayogadevelopment@gmail.com", name: "An Admin" };

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("notifyAccountAction", () => {
  it.each(["production", "development", undefined])(
    "emits the notice for a customer when VERCEL_ENV=%s (unchanged behaviour)",
    async (env) => {
      if (env) vi.stubEnv("VERCEL_ENV", env);
      await notifyAccountAction(CUSTOMER, "temp-password");
      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0][0]).toMatchObject({
        name: "audit/account.changed",
        data: { userId: "user-1", userEmail: "customer@example.com", action: "temp-password" },
      });
    }
  );

  it("does not email a real customer from a preview, where the DB is a clone of production", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    await notifyAccountAction(CUSTOMER, "temp-password");
    expect(send).not.toHaveBeenCalled();
  });

  it("still notifies an admin on a preview, so temp access can be exercised end to end", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    await notifyAccountAction(ADMIN, "temp-password");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("never throws when the event bus is down", async () => {
    send.mockRejectedValue(new Error("inngest unreachable"));
    await expect(notifyAccountAction(CUSTOMER, "reset-password")).resolves.toBeUndefined();
  });
});

describe("notifyCriticalAction", () => {
  it("still alerts the operator on a preview — that email goes to the operator, not a customer", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    await notifyCriticalAction("admin.user.temp_password", "customer@example.com", "op@example.com");
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ name: "audit/critical.recorded" });
  });
});
