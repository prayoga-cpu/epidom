/**
 * The customer's number entry, end to end across the two windows: what the
 * customer-facing display sends, how the cashier's window resolves it, and what
 * it is allowed to tell the display in return.
 *
 * Both windows run in one test, joined by a fake BroadcastChannel — the real one
 * doesn't deliver a message to its own sender, and neither does this.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const net = vi.hoisted(() => ({ online: true }));
vi.mock("@/hooks/use-network-status", () => ({ useOnlineStatus: () => net.online }));

vi.mock("@/lib/api/client", () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));

import { apiClient } from "@/lib/api/client";
import {
  clearCustomerIntake,
  useCustomerDisplayPublisher,
  useCustomerIntake,
  useCustomerIntakeChannel,
} from "../use-customer-display";
import { useCustomerDisplaySettings } from "../use-customer-display-settings";
import { usePosCart } from "../use-pos-cart";
import type { CartCustomer } from "../../types/pos.types";

const get = vi.mocked(apiClient.get);
const cart = () => usePosCart.getState();
const intake = () => useCustomerIntake.getState();

class FakeChannel {
  static instances: FakeChannel[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  closed = false;
  constructor(public name: string) {
    FakeChannel.instances.push(this);
  }
  postMessage(data: unknown) {
    for (const other of FakeChannel.instances) {
      if (other !== this && !other.closed && other.name === this.name) other.onmessage?.({ data });
    }
  }
  close() {
    this.closed = true;
  }
}

const PHONE = "+33612345678";

const member = (over: Record<string, unknown> = {}) => ({
  id: "c1",
  name: "Alice Martin",
  phone: PHONE,
  email: "alice@example.com",
  notes: null,
  points: 120,
  memberSince: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  lifetimeSpend: 1200,
  orderCount: 6,
  lastOrderAt: null,
  ...over,
});

/** Serve the customer list: the endpoint searches by substring, so return whatever `rows` holds. */
const serveCustomers = (rows: unknown[]) =>
  get.mockResolvedValue({ customers: rows, nextCursor: null, totalCount: rows.length } as never);

/** Both windows: the cashier's publisher (which owns the resolver) and the customer display's channel. */
function mountWindows() {
  const cashier = renderHook(() => useCustomerDisplayPublisher("s1"));
  const display = renderHook(() => useCustomerIntakeChannel("s1"));
  return { cashier, display };
}

const sendPhone = async (
  display: ReturnType<typeof mountWindows>["display"],
  phone: string | null
) => {
  await act(async () => {
    display.result.current.sendPhone(phone);
  });
};

const asCartCustomer = (over: Partial<CartCustomer> = {}): CartCustomer => ({
  id: "c2",
  name: "Bob",
  phone: "+33699999999",
  email: null,
  points: 0,
  lifetimeSpend: 0,
  ...over,
});

beforeEach(() => {
  FakeChannel.instances = [];
  vi.stubGlobal("BroadcastChannel", FakeChannel);
  localStorage.clear();
  net.online = true;
  get.mockReset();
  cart().clearCart();
  clearCustomerIntake();
  useCustomerDisplaySettings.setState({ enabled: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCustomerIntake — the store", () => {
  it("keeps what the customer typed when the SAME number is confirmed again", () => {
    intake().setPhone(PHONE);
    intake().setDetails("Claire", "claire@example.com");
    intake().setMatch("new");

    intake().setPhone(PHONE);

    expect(intake()).toMatchObject({ phone: PHONE, name: "Claire", email: "claire@example.com" });
    expect(intake().match).toBe("new");
  });

  it("starts from nothing for a DIFFERENT number — it is a different person", () => {
    intake().setPhone(PHONE);
    intake().setDetails("Claire", "claire@example.com");
    intake().setMatch("existing");

    intake().setPhone("+33699999999");

    expect(intake()).toMatchObject({ phone: "+33699999999", name: "", email: "", match: null });
  });

  it("bumps receivedAt on every submission, even two in the same millisecond", () => {
    vi.spyOn(Date, "now").mockReturnValue(5_000);
    intake().setPhone(PHONE);
    const first = intake().receivedAt;
    intake().setPhone(PHONE);
    expect(intake().receivedAt).toBeGreaterThan(first);
    vi.restoreAllMocks();
  });

  it("does not take the details channel on trust: trims, caps, and drops an invalid email", () => {
    intake().setDetails("  Claire  ", "not-an-email");
    expect(intake()).toMatchObject({ name: "Claire", email: "" });

    intake().setDetails("x".repeat(500), " claire@example.com ");
    expect(intake().name).toHaveLength(100);
    expect(intake().email).toBe("claire@example.com");
  });

  it("clearCustomerIntake wipes number, details, result and the form marker", () => {
    intake().setPhone(PHONE);
    intake().setDetails("Claire", "claire@example.com");
    intake().setMatch("new");
    intake().markFormOpened(intake().receivedAt);

    clearCustomerIntake();

    expect(intake()).toMatchObject({
      phone: null,
      name: "",
      email: "",
      match: null,
      receivedAt: 0,
      formOpenedFor: 0,
    });
  });
});

describe("display -> cashier: the number and the optional details", () => {
  it("lands in the cashier's intake, and nowhere else", async () => {
    serveCustomers([]);
    const windows = mountWindows();

    await sendPhone(windows.display, PHONE);
    act(() => windows.display.result.current.sendDetails("Claire", "claire@example.com"));

    expect(intake()).toMatchObject({ phone: PHONE, name: "Claire", email: "claire@example.com" });
    // A suggestion only: nothing was created, attached, or written.
    expect(cart().customer).toBeNull();
  });

  it("clearing the number (a mistake) clears the intake", async () => {
    serveCustomers([]);
    const windows = mountWindows();
    await sendPhone(windows.display, PHONE);
    await sendPhone(windows.display, null);
    expect(intake().phone).toBeNull();
  });
});

describe("cashier -> display: who is this number?", () => {
  it("an existing customer is attached to the sale and greeted by FIRST NAME only", async () => {
    serveCustomers([member()]);
    const windows = mountWindows();

    await sendPhone(windows.display, PHONE);

    await waitFor(() => expect(windows.display.result.current.status?.match).toBe("existing"));
    expect(windows.display.result.current.status).toEqual({
      phone: PHONE,
      match: "existing",
      firstName: "Alice",
    });
    expect(cart().customer).toMatchObject({ id: "c1", name: "Alice Martin" });
    expect(intake().match).toBe("existing");
  });

  it("never sends the display anything about the customer beyond a first name", async () => {
    serveCustomers([member({ email: "alice@example.com", points: 999, lifetimeSpend: 5000 })]);
    const windows = mountWindows();
    await sendPhone(windows.display, PHONE);
    await waitFor(() => expect(windows.display.result.current.status).not.toBeNull());

    // Anyone can type any number into this screen, and anyone at the till can read it.
    const status = windows.display.result.current.status!;
    expect(Object.keys(status).sort()).toEqual(["firstName", "match", "phone"]);
    expect(JSON.stringify(status)).not.toMatch(/Martin|alice@|999|5000/);
  });

  it("an unknown number is reported as new, and nothing is attached", async () => {
    serveCustomers([]);
    const windows = mountWindows();

    await sendPhone(windows.display, PHONE);

    await waitFor(() => expect(windows.display.result.current.status?.match).toBe("new"));
    expect(windows.display.result.current.status?.firstName).toBeNull();
    expect(cart().customer).toBeNull();
    expect(intake().match).toBe("new");
  });

  it("only an EXACT number is a match — a longer number that contains it is not", async () => {
    // The endpoint searches by substring, so it can return near-misses.
    serveCustomers([member({ id: "c9", name: "Zed", phone: "+336123456789" })]);
    const windows = mountWindows();

    await sendPhone(windows.display, PHONE);

    await waitFor(() => expect(windows.display.result.current.status?.match).toBe("new"));
    expect(cart().customer).toBeNull();
  });

  it("looks the number up in this store's customers, by the number", async () => {
    serveCustomers([]);
    const windows = mountWindows();
    await sendPhone(windows.display, PHONE);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(get).toHaveBeenCalledWith("/stores/s1/customers", { q: PHONE, limit: "8" });
  });

  it("says 'unknown' — never guesses — when the lookup fails", async () => {
    get.mockRejectedValue(new Error("boom"));
    const windows = mountWindows();

    await sendPhone(windows.display, PHONE);

    await waitFor(() => expect(windows.display.result.current.status?.match).toBe("unknown"));
    expect(cart().customer).toBeNull();
  });

  it("says 'unknown' without calling the network when offline", async () => {
    net.online = false;
    const windows = mountWindows();

    await sendPhone(windows.display, PHONE);

    await waitFor(() => expect(windows.display.result.current.status?.match).toBe("unknown"));
    expect(get).not.toHaveBeenCalled();
  });

  it("a customer with no real name (named after their number) is greeted without one", async () => {
    serveCustomers([member({ name: PHONE })]);
    const windows = mountWindows();
    await sendPhone(windows.display, PHONE);
    await waitFor(() => expect(windows.display.result.current.status?.match).toBe("existing"));
    expect(windows.display.result.current.status?.firstName).toBeNull();
  });
});

describe("attaching — never over the cashier's own choice", () => {
  it("leaves a customer the cashier attached alone (the display still gets its answer)", async () => {
    cart().setCustomer(asCartCustomer());
    serveCustomers([member()]);
    const windows = mountWindows();

    await sendPhone(windows.display, PHONE);

    await waitFor(() => expect(windows.display.result.current.status?.match).toBe("existing"));
    expect(cart().customer?.id).toBe("c2");
  });

  it("a customer correcting a mistyped number swaps the match instead of stacking one on another", async () => {
    const windows = mountWindows();

    serveCustomers([member()]);
    await sendPhone(windows.display, PHONE);
    await waitFor(() => expect(cart().customer?.id).toBe("c1"));

    serveCustomers([member({ id: "c3", name: "Bob Durand", phone: "+33677777777" })]);
    await sendPhone(windows.display, "+33677777777");
    await waitFor(() => expect(cart().customer?.id).toBe("c3"));

    // ...and a corrected number that matches nobody detaches the wrong person.
    serveCustomers([]);
    await sendPhone(windows.display, "+33688888888");
    await waitFor(() => expect(cart().customer).toBeNull());
  });

  it("removing the number detaches the customer IT attached, and only that one", async () => {
    serveCustomers([member()]);
    const windows = mountWindows();
    await sendPhone(windows.display, PHONE);
    await waitFor(() => expect(cart().customer?.id).toBe("c1"));

    await sendPhone(windows.display, null);
    await waitFor(() => expect(cart().customer).toBeNull());
  });

  it("removing the number leaves a customer the cashier chose themselves", async () => {
    serveCustomers([]);
    const windows = mountWindows();
    await sendPhone(windows.display, PHONE);
    await waitFor(() => expect(intake().match).toBe("new"));

    // The cashier picks somebody else, then the customer clears their number.
    act(() => cart().setCustomer(asCartCustomer()));
    await sendPhone(windows.display, null);

    expect(cart().customer?.id).toBe("c2");
  });

  it("confirming the same number twice does not detach and re-attach", async () => {
    serveCustomers([member()]);
    const windows = mountWindows();
    await sendPhone(windows.display, PHONE);
    await waitFor(() => expect(cart().customer?.id).toBe("c1"));

    await sendPhone(windows.display, PHONE);
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(cart().customer?.id).toBe("c1");
  });
});

describe("the cashier saves the new customer while the display waits", () => {
  it("tells the display it is an existing customer now, so it can move on to the welcome", async () => {
    serveCustomers([]);
    const windows = mountWindows();
    await sendPhone(windows.display, PHONE);
    await waitFor(() => expect(windows.display.result.current.status?.match).toBe("new"));

    act(() =>
      cart().setCustomer(asCartCustomer({ id: "c5", name: "Claire Moreau", phone: PHONE }))
    );

    await waitFor(() => expect(windows.display.result.current.status?.match).toBe("existing"));
    expect(windows.display.result.current.status?.firstName).toBe("Claire");
    expect(intake().match).toBe("existing");
  });

  it("a number-only record greets without a name", async () => {
    serveCustomers([]);
    const windows = mountWindows();
    await sendPhone(windows.display, PHONE);
    await waitFor(() => expect(intake().match).toBe("new"));

    act(() => cart().setCustomer(asCartCustomer({ id: "c5", name: PHONE, phone: PHONE })));

    await waitFor(() => expect(windows.display.result.current.status?.match).toBe("existing"));
    expect(windows.display.result.current.status?.firstName).toBeNull();
  });
});

describe("useCustomerIntakeChannel", () => {
  it("forgets an old answer the moment a new number is sent", async () => {
    serveCustomers([member()]);
    const windows = mountWindows();
    await sendPhone(windows.display, PHONE);
    await waitFor(() => expect(windows.display.result.current.status).not.toBeNull());

    // A status held for the previous number must never greet the next customer.
    serveCustomers([]);
    act(() => windows.display.result.current.sendPhone("+33699999999"));
    expect(windows.display.result.current.status).toBeNull();
  });
});
