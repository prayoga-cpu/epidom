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

vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn() } };
});

import { apiClient, ApiClientError } from "@/lib/api/client";
import {
  clearCustomerIntake,
  useCustomerDisplayPublisher,
  useCustomerIntake,
  useCustomerIntakeChannel,
  askCustomerForDetails,
} from "../use-customer-display";
import { useCustomerDisplaySettings } from "../use-customer-display-settings";
import { usePosCart } from "../use-pos-cart";
import type { CartCustomer } from "../../types/pos.types";

const get = vi.mocked(apiClient.get);
const post = vi.mocked(apiClient.post);
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
  post.mockReset();
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
      submittedFor: 0,
      takenOverFor: 0,
      autoSave: "idle",
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

describe("cashier -> display: asking for the customer's details", () => {
  it("reaches the display window, and only as a nudge (it carries no data)", () => {
    const windows = mountWindows();
    expect(windows.display.result.current.askedAt).toBe(0);

    act(() => askCustomerForDetails("s1"));

    expect(windows.display.result.current.askedAt).toBeGreaterThan(0);
    expect(intake().phone).toBeNull();
  });

  it("each ask is a fresh one, so asking twice re-opens the pad", () => {
    const windows = mountWindows();
    act(() => askCustomerForDetails("s1"));
    const first = windows.display.result.current.askedAt;
    vi.spyOn(Date, "now").mockReturnValue(first + 1000);
    act(() => askCustomerForDetails("s1"));
    expect(windows.display.result.current.askedAt).toBe(first + 1000);
    vi.restoreAllMocks();
  });

  it("never reaches another store's display", () => {
    const other = renderHook(() => useCustomerIntakeChannel("s2"));
    act(() => askCustomerForDetails("s1"));
    expect(other.result.current.askedAt).toBe(0);
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

describe("the customer finishes on the display — the till saves them", () => {
  const submit = async (
    display: ReturnType<typeof mountWindows>["display"],
    name = "",
    email = ""
  ) => {
    await act(async () => {
      display.result.current.submitDetails(name, email);
    });
  };

  /** A new number, answered, then Done on the display. */
  const newCustomerFinishes = async (name = "Claire Moreau", email = "claire@example.com") => {
    serveCustomers([]);
    const windows = mountWindows();
    await sendPhone(windows.display, PHONE);
    await waitFor(() => expect(intake().match).toBe("new"));
    await submit(windows.display, name, email);
    return windows;
  };

  const created = (over: Record<string, unknown> = {}) =>
    member({ id: "c7", name: "Claire Moreau", email: "claire@example.com", points: 0, ...over });

  it("saves a new customer with what they typed and attaches them — no Save from the cashier", async () => {
    post.mockResolvedValue(created() as never);
    const windows = await newCustomerFinishes();

    await waitFor(() => expect(cart().customer?.id).toBe("c7"));
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("/stores/s1/customers", {
      name: "Claire Moreau",
      phone: PHONE,
      email: "claire@example.com",
    });
    expect(intake().autoSave).toBe("saved");
    // ...and the display is told they are a customer now.
    await waitFor(() => expect(windows.display.result.current.status?.match).toBe("existing"));
    expect(windows.display.result.current.status?.firstName).toBe("Claire");
  });

  it("Skip saves the number alone — the server names the record after it", async () => {
    post.mockResolvedValue(created({ name: PHONE, email: null }) as never);
    await newCustomerFinishes("", "");

    await waitFor(() => expect(cart().customer?.id).toBe("c7"));
    expect(post).toHaveBeenCalledWith("/stores/s1/customers", {
      name: undefined,
      phone: PHONE,
      email: undefined,
    });
  });

  it("does not take the submission on trust: an invalid email is dropped, not saved", async () => {
    post.mockResolvedValue(created({ email: null }) as never);
    await newCustomerFinishes("Claire", "not-an-email");

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1]).toMatchObject({ name: "Claire", email: undefined });
  });

  it("nothing is saved while the customer is still typing — only once they finish", async () => {
    serveCustomers([]);
    const windows = mountWindows();
    await sendPhone(windows.display, PHONE);
    await waitFor(() => expect(intake().match).toBe("new"));

    act(() => windows.display.result.current.sendDetails("Claire", ""));

    expect(post).not.toHaveBeenCalled();
    expect(intake().autoSave).toBe("idle");
  });

  it("a customer who finishes before the lookup answers is saved when it does", async () => {
    let answerLookup: (value: unknown) => void = () => {};
    get.mockReturnValue(new Promise((resolve) => (answerLookup = resolve)) as never);
    post.mockResolvedValue(created() as never);
    const windows = mountWindows();
    await sendPhone(windows.display, PHONE);
    await submit(windows.display, "Claire Moreau", "claire@example.com");
    expect(post).not.toHaveBeenCalled();

    await act(async () => {
      answerLookup({ customers: [], nextCursor: null, totalCount: 0 });
    });

    await waitFor(() => expect(cart().customer?.id).toBe("c7"));
  });

  it("saves each submission once, however often the resolver re-renders", async () => {
    post.mockResolvedValue(created() as never);
    const windows = await newCustomerFinishes();
    await waitFor(() => expect(cart().customer?.id).toBe("c7"));

    windows.cashier.rerender();
    await submit(windows.display, "Claire Moreau", "claire@example.com");

    expect(post).toHaveBeenCalledTimes(1);
  });

  it("never over a customer the cashier already put on the sale", async () => {
    cart().setCustomer(asCartCustomer());
    await newCustomerFinishes();

    expect(post).not.toHaveBeenCalled();
    expect(cart().customer?.id).toBe("c2");
  });

  it("leaves a form the cashier took over for the cashier to save", async () => {
    serveCustomers([]);
    const windows = mountWindows();
    await sendPhone(windows.display, PHONE);
    await waitFor(() => expect(intake().match).toBe("new"));

    act(() => intake().markTakenOver(intake().receivedAt));
    await submit(windows.display, "Claire", "");

    expect(post).not.toHaveBeenCalled();
    expect(cart().customer).toBeNull();
  });

  it("a number the till could not check is not saved blind", async () => {
    get.mockRejectedValue(new Error("boom"));
    const windows = mountWindows();
    await sendPhone(windows.display, PHONE);
    await waitFor(() => expect(intake().match).toBe("unknown"));

    await submit(windows.display, "Claire", "");

    expect(post).not.toHaveBeenCalled();
  });

  it("a number saved meanwhile elsewhere (409) attaches that record instead of failing", async () => {
    post.mockRejectedValue(
      new ApiClientError(
        { success: false, error: { code: "CONFLICT", message: "Phone already used" } } as never,
        409
      )
    );
    // Not on file when the number was checked; on file by the time the save lands.
    get
      .mockResolvedValueOnce({ customers: [], nextCursor: null, totalCount: 0 } as never)
      .mockResolvedValue({
        customers: [member({ id: "c8", name: "Claire M." })],
        nextCursor: null,
        totalCount: 1,
      } as never);
    const windows = mountWindows();
    await sendPhone(windows.display, PHONE);
    await waitFor(() => expect(intake().match).toBe("new"));
    await submit(windows.display, "Claire", "");

    await waitFor(() => expect(cart().customer?.id).toBe("c8"));
    expect(intake().autoSave).toBe("saved");
  });

  it("a failed save attaches nothing and says so — the prepared form is still there", async () => {
    post.mockRejectedValue(new Error("network down"));
    await newCustomerFinishes();

    await waitFor(() => expect(intake().autoSave).toBe("failed"));
    expect(cart().customer).toBeNull();
  });

  it("a save that lands after the order was placed is not attached to the next sale", async () => {
    let finishSave: (value: unknown) => void = () => {};
    post.mockReturnValue(new Promise((resolve) => (finishSave = resolve)) as never);
    await newCustomerFinishes();
    await waitFor(() => expect(intake().autoSave).toBe("saving"));

    // Checkout clears the intake for the next customer.
    act(() => clearCustomerIntake());
    await act(async () => {
      finishSave(created());
    });

    expect(cart().customer).toBeNull();
    expect(intake().autoSave).toBe("idle");
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
