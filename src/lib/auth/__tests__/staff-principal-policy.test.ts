import { describe, it, expect, vi, beforeEach } from "vitest";

const getActiveStaffSession = vi.fn();
vi.mock("@/lib/staff-session", () => ({
  getActiveStaffSession: () => getActiveStaffSession(),
}));

import {
  authorizeStaffPrincipal,
  listStaffPolicyKeys,
  resolveStaffRoutePolicy,
} from "../staff-principal-policy";

const STORE = "store_abc12345";
const ME = "staff_me";
const OTHER = "staff_other";

function persona(overrides: Record<string, unknown> = {}) {
  return {
    storeId: STORE,
    staffMemberId: ME,
    name: "Me",
    role: "CASHIER",
    allowedPages: ["/pos", "/pos/orders", "/tables", "/pos/schedule"],
    ...overrides,
  };
}

function req(method: string, path: string, body?: unknown, search = "") {
  return new Request(`http://localhost${path}${search}`, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function run(request: Request) {
  return authorizeStaffPrincipal({ storeId: STORE, staffMemberId: ME, request });
}

async function status(request: Request) {
  const res = await run(request);
  return res ? res.status : null;
}

beforeEach(() => {
  getActiveStaffSession.mockReset();
});

describe("the staff allow-list itself", () => {
  // If this list changes, a human should have decided it should. It is the
  // ENTIRE surface a linked staff account can reach — everything else is
  // owner-only by default.
  it("is exactly the reviewed set of routes", () => {
    expect(listStaffPolicyKeys().sort()).toEqual(
      [
        "DELETE /api/stores/*/tables/*",
        "DELETE /api/stores/*/reservations/*",
        "GET /api/stores/*/attendance/history",
        "GET /api/stores/*/attendance/status",
        "GET /api/stores/*/customers",
        "GET /api/stores/*/discount-presets",
        "GET /api/stores/*/finance/settings",
        "GET /api/stores/*/notifications",
        "GET /api/stores/*/orders",
        "GET /api/stores/*/orders/payment-totals",
        "GET /api/stores/*/orders/stream",
        "GET /api/stores/*/pos/kds/settings",
        "GET /api/stores/*/pos/menu",
        "GET /api/stores/*/pos/orders",
        "GET /api/stores/*/pos/orders/*",
        "GET /api/stores/*/pos/orders/*/receipt",
        "GET /api/stores/*/pos/orders/*/send-receipt",
        "GET /api/stores/*/reports/shift-report",
        "GET /api/stores/*/reservations",
        // A roster image is the same for the whole team, read on My Schedule.
        "GET /api/stores/*/schedule-images",
        "GET /api/stores/*/schedule-shifts",
        "GET /api/stores/*/loyalty-settings",
        "GET /api/stores/*/schedule/my-log",
        "GET /api/stores/*/shifts",
        "GET /api/stores/*/shifts/*",
        "GET /api/stores/*/staff",
        "GET /api/stores/*/staff-schedules",
        "GET /api/stores/*/tables",
        "GET /api/stores/*/tables/*",
        "PATCH /api/stores/*/pos/orders/*",
        "PATCH /api/stores/*/pos/orders/*/customer",
        "PATCH /api/stores/*/pos/orders/*/items/*",
        "PATCH /api/stores/*/reservations/*",
        "PATCH /api/stores/*/shifts/*",
        "PATCH /api/stores/*/tables/*",
        "POST /api/stores/*/attendance/*/retake-photo",
        "POST /api/stores/*/attendance/absence",
        "POST /api/stores/*/attendance/clock-in",
        "POST /api/stores/*/attendance/clock-out",
        "POST /api/stores/*/coupons/validate",
        "POST /api/stores/*/customers",
        "POST /api/stores/*/pos/orders",
        "POST /api/stores/*/pos/orders/*/finalize",
        "POST /api/stores/*/pos/orders/*/refund",
        "POST /api/stores/*/pos/orders/*/send-receipt",
        "POST /api/stores/*/pos/orders/*/send-receipt-email",
        "POST /api/stores/*/pos/orders/hold",
        "POST /api/stores/*/pos/orders/merge",
        "POST /api/stores/*/reservations",
        "POST /api/stores/*/shifts",
        "POST /api/stores/*/staff/logout",
        "POST /api/stores/*/staff/verify-pin",
        "POST /api/stores/*/tables",
      ].sort()
    );
  });

  it("never grants anything that changes who can access the store or its money settings", () => {
    const forbidden: Array<[string, string]> = [
      ["POST", `/api/stores/${STORE}/staff`], // create staff
      ["PATCH", `/api/stores/${STORE}/staff/${OTHER}`], // edit anyone's role/pages/PIN
      ["DELETE", `/api/stores/${STORE}/staff/${OTHER}`],
      ["POST", `/api/stores/${STORE}/staff/${OTHER}/invite`], // mint account access
      ["POST", `/api/stores/${STORE}/transfer-ownership`],
      ["DELETE", `/api/stores/${STORE}/transfer-ownership`],
      ["PATCH", `/api/stores/${STORE}`], // store settings
      ["DELETE", `/api/stores/${STORE}`],
      ["POST", `/api/subscriptions/checkout`],
      ["POST", `/api/billing/portal`],
      ["PATCH", `/api/user/business`],
      ["POST", `/api/user/owner-pin`],
      ["GET", `/api/stores/${STORE}/finance/by-category`],
      ["GET", `/api/stores/${STORE}/materials/export`],
      ["PATCH", `/api/stores/${STORE}/finance/settings`], // read-only for staff
      ["POST", `/api/stores/${STORE}/cash-movements`],
      ["DELETE", `/api/stores/${STORE}/cash-movements/m1`],
      // A staff account may READ the roster image; publishing or removing one is
      // the manager's, and not being listed is what keeps it that way.
      ["POST", `/api/stores/${STORE}/schedule-images`],
      ["DELETE", `/api/stores/${STORE}/schedule-images/i1`],
    ];
    for (const [method, path] of forbidden) {
      expect(resolveStaffRoutePolicy(method, path), `${method} ${path}`).toBeNull();
    }
  });

  it("matches exactly one dynamic segment and tolerates a trailing slash", () => {
    expect(resolveStaffRoutePolicy("GET", `/api/stores/${STORE}/pos/orders/`)).not.toBeNull();
    expect(resolveStaffRoutePolicy("GET", `/api/stores/${STORE}/pos/orders/o1/receipt`)).not.toBeNull();
    // Extra segment / different shape must NOT slip through a `*`.
    expect(resolveStaffRoutePolicy("GET", `/api/stores/${STORE}/pos/orders/o1/receipt/x`)).toBeNull();
    expect(resolveStaffRoutePolicy("GET", `/api/stores/${STORE}/pos/orders-secret`)).toBeNull();
    expect(resolveStaffRoutePolicy("get", `/api/stores/${STORE}/pos/menu`)).not.toBeNull();
  });
});

describe("authorizeStaffPrincipal — default deny", () => {
  it("refuses a route that isn't in the allow-list, even with a valid persona", async () => {
    getActiveStaffSession.mockResolvedValue(persona());
    expect(await status(req("POST", `/api/stores/${STORE}/staff`, { name: "x" }))).toBe(403);
    expect(await status(req("GET", `/api/stores/${STORE}/finance/by-category`))).toBe(403);
  });
});

describe("authorizeStaffPrincipal — you can only act as yourself", () => {
  it("lets the picker verify the caller's OWN PIN, before any persona exists", async () => {
    getActiveStaffSession.mockResolvedValue(null);
    expect(
      await status(req("POST", `/api/stores/${STORE}/staff/verify-pin`, { staffId: ME, pin: "1234" }))
    ).toBeNull();
  });

  it("refuses to verify anyone else's PIN — the cross-persona escalation this exists to stop", async () => {
    getActiveStaffSession.mockResolvedValue(null);
    expect(
      await status(req("POST", `/api/stores/${STORE}/staff/verify-pin`, { staffId: OTHER, pin: "" }))
    ).toBe(403);
  });

  it("refuses a body that names a different staffMemberId (e.g. opening a till as a coworker)", async () => {
    getActiveStaffSession.mockResolvedValue(persona());
    expect(await status(req("POST", `/api/stores/${STORE}/shifts`, { staffMemberId: OTHER }))).toBe(403);
  });

  it("refuses a query string that names someone else", async () => {
    getActiveStaffSession.mockResolvedValue(persona());
    expect(
      await status(req("GET", `/api/stores/${STORE}/schedule/my-log`, undefined, `?staffId=${OTHER}`))
    ).toBe(403);
  });

  it("refuses a staff id that isn't a plain string rather than skipping the check", async () => {
    getActiveStaffSession.mockResolvedValue(persona());
    expect(
      await status(req("POST", `/api/stores/${STORE}/shifts`, { staffMemberId: { $ne: ME } }))
    ).toBe(403);
    expect(await status(req("POST", `/api/stores/${STORE}/shifts`, { staffId: [ME, OTHER] }))).toBe(403);
  });

  it("refuses when ANY of several named ids is someone else", async () => {
    getActiveStaffSession.mockResolvedValue(persona());
    expect(
      await status(
        req("GET", `/api/stores/${STORE}/schedule/my-log`, undefined, `?staffId=${ME}&staffId=${OTHER}`)
      )
    ).toBe(403);
  });

  it("requires the caller to name themselves on endpoints that would otherwise list everyone", async () => {
    getActiveStaffSession.mockResolvedValue(persona());
    // No staffId at all → would return the whole roster's schedule.
    expect(await status(req("GET", `/api/stores/${STORE}/staff-schedules`))).toBe(403);
    expect(
      await status(req("GET", `/api/stores/${STORE}/staff-schedules`, undefined, `?staffId=${ME}`))
    ).toBeNull();
  });

  it("does not choke on a non-JSON body", async () => {
    getActiveStaffSession.mockResolvedValue(persona());
    const r = new Request(`http://localhost/api/stores/${STORE}/pos/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    expect(await status(r)).toBeNull(); // policy passes; the handler rejects the body itself
  });
});

describe("authorizeStaffPrincipal — the PIN is a real second factor", () => {
  it("refuses post-PIN routes when no PIN persona exists yet", async () => {
    getActiveStaffSession.mockResolvedValue(null);
    expect(await status(req("GET", `/api/stores/${STORE}/pos/menu`))).toBe(403);
  });

  it("refuses when the live persona is a DIFFERENT staff member (shared browser leftovers)", async () => {
    getActiveStaffSession.mockResolvedValue(persona({ staffMemberId: OTHER }));
    expect(await status(req("GET", `/api/stores/${STORE}/pos/menu`))).toBe(403);
  });

  it("refuses when the persona belongs to a different store", async () => {
    getActiveStaffSession.mockResolvedValue(persona({ storeId: "store_other999" }));
    expect(await status(req("GET", `/api/stores/${STORE}/pos/menu`))).toBe(403);
  });

  it("allows the caller's own persona on a route their pages cover", async () => {
    getActiveStaffSession.mockResolvedValue(persona());
    expect(await status(req("GET", `/api/stores/${STORE}/pos/menu`))).toBeNull();
    expect(await status(req("POST", `/api/stores/${STORE}/pos/orders`, { items: [] }))).toBeNull();
  });
});

describe("authorizeStaffPrincipal — role and page grants", () => {
  it("refuses a route none of the persona's pages cover (Kitchen cannot ring up orders)", async () => {
    getActiveStaffSession.mockResolvedValue(persona({ role: "KITCHEN", allowedPages: ["/pos/kds"] }));
    expect(await status(req("POST", `/api/stores/${STORE}/pos/orders`, { items: [] }))).toBe(403);
    expect(await status(req("GET", `/api/stores/${STORE}/orders/stream`))).toBeNull();
  });

  it("keeps manager-only actions (refunds, table CRUD) away from a Cashier", async () => {
    getActiveStaffSession.mockResolvedValue(persona());
    expect(await status(req("POST", `/api/stores/${STORE}/pos/orders/o1/refund`, {}))).toBe(403);
    expect(await status(req("DELETE", `/api/stores/${STORE}/tables/t1`))).toBe(403);
  });

  it("lets a Manager persona through the manager-only actions its pages cover", async () => {
    getActiveStaffSession.mockResolvedValue(
      persona({ role: "MANAGER", allowedPages: ["/pos", "/pos/orders", "/tables"] })
    );
    expect(await status(req("POST", `/api/stores/${STORE}/pos/orders/o1/refund`, {}))).toBeNull();
    expect(await status(req("DELETE", `/api/stores/${STORE}/tables/t1`))).toBeNull();
  });
});

describe("authorizeStaffPrincipal — the identity rule can't be dodged by the body's Content-Type", () => {
  // Handlers call request.json(), which ignores the header; a plain
  // fetch(url, { body: JSON.stringify(...) }) is sent as text/plain.
  function rawReq(path: string, contentType: string | null, body: string) {
    return new Request(`http://localhost${path}`, {
      method: "POST",
      headers: contentType ? { "content-type": contentType } : undefined,
      body,
    });
  }

  it.each([["text/plain"], ["application/x-www-form-urlencoded"], ["text/plain;charset=UTF-8"], [null]])(
    "refuses verify-pin naming another staffer in a %s body",
    async (contentType) => {
      getActiveStaffSession.mockResolvedValue(null);
      const r = rawReq(
        `/api/stores/${STORE}/staff/verify-pin`,
        contentType,
        JSON.stringify({ staffId: OTHER, pin: "" })
      );
      expect(await status(r)).toBe(403);
    }
  );

  it("still allows the caller's own id in a text/plain body", async () => {
    getActiveStaffSession.mockResolvedValue(null);
    const r = rawReq(
      `/api/stores/${STORE}/staff/verify-pin`,
      "text/plain",
      JSON.stringify({ staffId: ME, pin: "1234" })
    );
    expect(await status(r)).toBeNull();
  });

  it("selfRequired routes count an id hidden in a text/plain body", async () => {
    getActiveStaffSession.mockResolvedValue(persona());
    const other = rawReq(
      `/api/stores/${STORE}/attendance/clock-in`,
      "text/plain",
      JSON.stringify({ staffMemberId: OTHER })
    );
    expect(await status(other)).toBe(403);
    const mine = rawReq(
      `/api/stores/${STORE}/attendance/clock-in`,
      "text/plain",
      JSON.stringify({ staffMemberId: ME })
    );
    expect(await status(mine)).toBeNull();
  });
});

describe("authorizeStaffPrincipal — the floor: table status vs table editing", () => {
  const tables = ["/tables"];

  it("a non-manager with the Tables page can cycle a table's status — that's the host's job", async () => {
    getActiveStaffSession.mockResolvedValue(persona({ allowedPages: tables }));
    const path = `/api/stores/${STORE}/tables/t1`;
    expect(await status(req("PATCH", path, { status: "OCCUPIED" }))).toBeNull();
    expect(await status(req("PATCH", path, { status: "AVAILABLE", expectedStatus: "OCCUPIED" }))).toBeNull();
  });

  it("...but not rename or resize it, alone or smuggled in beside a status change", async () => {
    getActiveStaffSession.mockResolvedValue(persona({ allowedPages: tables }));
    const path = `/api/stores/${STORE}/tables/t1`;
    expect(await status(req("PATCH", path, { label: "VIP" }))).toBe(403);
    expect(await status(req("PATCH", path, { capacity: 99 }))).toBe(403);
    expect(await status(req("PATCH", path, { status: "OCCUPIED", label: "VIP" }))).toBe(403);
  });

  it("an empty, missing, or unparseable body is treated as the privileged action, not the routine one", async () => {
    getActiveStaffSession.mockResolvedValue(persona({ allowedPages: tables }));
    const path = `/api/stores/${STORE}/tables/t1`;
    expect(await status(req("PATCH", path, {}))).toBe(403);
    expect(await status(req("PATCH", path))).toBe(403);
    expect(
      await status(
        new Request(`http://localhost${path}`, { method: "PATCH", body: "{not json" })
      )
    ).toBe(403);
  });

  it("a Manager can still edit tables", async () => {
    getActiveStaffSession.mockResolvedValue(persona({ role: "MANAGER", allowedPages: tables }));
    expect(await status(req("PATCH", `/api/stores/${STORE}/tables/t1`, { label: "VIP" }))).toBeNull();
  });

  it("without the Tables page, not even a status change", async () => {
    getActiveStaffSession.mockResolvedValue(persona({ allowedPages: ["/pos"] }));
    expect(await status(req("PATCH", `/api/stores/${STORE}/tables/t1`, { status: "OCCUPIED" }))).toBe(403);
  });

  it("reservations follow the Tables page: allowed with it, refused without", async () => {
    const withTables = persona({ allowedPages: tables });
    getActiveStaffSession.mockResolvedValue(withTables);
    expect(await status(req("GET", `/api/stores/${STORE}/reservations`))).toBeNull();
    expect(await status(req("POST", `/api/stores/${STORE}/reservations`, { guestName: "A" }))).toBeNull();
    expect(await status(req("PATCH", `/api/stores/${STORE}/reservations/r1`, { status: "SEATED" }))).toBeNull();
    expect(await status(req("DELETE", `/api/stores/${STORE}/reservations/r1`))).toBeNull();

    getActiveStaffSession.mockResolvedValue(persona({ allowedPages: ["/pos"] }));
    expect(await status(req("GET", `/api/stores/${STORE}/reservations`))).toBe(403);
    expect(await status(req("DELETE", `/api/stores/${STORE}/reservations/r1`))).toBe(403);
  });
});

describe("authorizeStaffPrincipal — shared reads every POS page needs", () => {
  it.each([["/pos"], ["/pos/orders"], ["/pos/kds"], ["/tables"], ["/pos/schedule"]])(
    "finance settings (currency, tax, service charge) are readable with just %s",
    async (page) => {
      getActiveStaffSession.mockResolvedValue(persona({ allowedPages: [page] }));
      expect(await status(req("GET", `/api/stores/${STORE}/finance/settings`))).toBeNull();
    }
  );

  it("...but only readable: the PATCH stays owner-only, and a persona-less caller gets nothing", async () => {
    getActiveStaffSession.mockResolvedValue(persona({ role: "MANAGER" }));
    expect(await status(req("PATCH", `/api/stores/${STORE}/finance/settings`, { taxRate: 0 }))).toBe(403);
    getActiveStaffSession.mockResolvedValue(null);
    expect(await status(req("GET", `/api/stores/${STORE}/finance/settings`))).toBe(403);
  });
});

describe("authorizeStaffPrincipal — cashier revamp routes (2.88.0)", () => {
  const cashierRoutes: Array<[string, string, unknown?]> = [
    ["GET", "/customers"],
    ["POST", "/customers", { name: "Ana" }],
    ["GET", "/discount-presets"],
    ["POST", "/coupons/validate", { code: "SAVE10", itemsTotal: 20 }],
    ["GET", "/loyalty-settings"],
    ["POST", "/pos/orders/merge", { targetOrderId: "a", sourceOrderIds: ["b"] }],
  ];

  it.each(cashierRoutes)("a cashier with the till page can %s %s", async (method, path, body) => {
    getActiveStaffSession.mockResolvedValue(persona({ allowedPages: ["/pos"] }));
    expect(await status(req(method, `/api/stores/${STORE}${path}`, body))).toBeNull();
  });

  it.each(cashierRoutes)("...but not %s %s without the till page or a PIN persona", async (method, path, body) => {
    getActiveStaffSession.mockResolvedValue(persona({ allowedPages: ["/tables"] }));
    expect(await status(req(method, `/api/stores/${STORE}${path}`, body))).toBe(403);
    getActiveStaffSession.mockResolvedValue(null);
    expect(await status(req(method, `/api/stores/${STORE}${path}`, body))).toBe(403);
  });

  it("e-mail receipts follow the order queue, like the WhatsApp send beside them", async () => {
    const path = `/api/stores/${STORE}/pos/orders/o1/send-receipt-email`;
    getActiveStaffSession.mockResolvedValue(persona({ allowedPages: ["/pos/orders"] }));
    expect(await status(req("POST", path, { email: "a@b.co" }))).toBeNull();
    getActiveStaffSession.mockResolvedValue(persona({ allowedPages: ["/tables"] }));
    expect(await status(req("POST", path, { email: "a@b.co" }))).toBe(403);
  });

  // The whole point of listing GET /customers exactly and never GET /customers/*:
  // a `*` would also have admitted the CSV export of every customer.
  it("no staff account — not even a manager — reaches the Back Office customer and promotion routes", () => {
    const ownerOnly: Array<[string, string]> = [
      ["GET", `/api/stores/${STORE}/customers/export`],
      ["GET", `/api/stores/${STORE}/customers/analytics`],
      ["GET", `/api/stores/${STORE}/customers/c1`],
      ["PATCH", `/api/stores/${STORE}/customers/c1`],
      ["POST", `/api/stores/${STORE}/customers/c1/points`],
      ["GET", `/api/stores/${STORE}/coupons`],
      ["POST", `/api/stores/${STORE}/coupons`],
      ["PATCH", `/api/stores/${STORE}/coupons/k1`],
      ["POST", `/api/stores/${STORE}/discount-presets`],
      ["PATCH", `/api/stores/${STORE}/discount-presets/p1`],
      ["DELETE", `/api/stores/${STORE}/discount-presets/p1`],
      ["PUT", `/api/stores/${STORE}/loyalty-settings`],
    ];
    for (const [method, path] of ownerOnly) {
      expect(resolveStaffRoutePolicy(method, path), `${method} ${path}`).toBeNull();
    }
  });

  it("a manager persona on a linked account is refused those routes at the policy layer too", async () => {
    getActiveStaffSession.mockResolvedValue(persona({ role: "MANAGER", allowedPages: ["/pos", "/data"] }));
    expect(await status(req("POST", `/api/stores/${STORE}/discount-presets`, { name: "x" }))).toBe(403);
    expect(await status(req("GET", `/api/stores/${STORE}/customers/export`))).toBe(403);
  });
});

describe("authorizeStaffPrincipal — the team's roster image", () => {
  const read = () =>
    status(req("GET", `/api/stores/${STORE}/schedule-images`, undefined, "?from=2026-09-19"));

  it("a persona with My Schedule may read it — it is the same for everyone, so no staffId is required", async () => {
    getActiveStaffSession.mockResolvedValue(persona());
    expect(await read()).toBeNull();
  });

  it("a persona without the My Schedule page may not", async () => {
    getActiveStaffSession.mockResolvedValue(persona({ allowedPages: ["/pos"] }));
    expect(await read()).toBe(403);
  });

  it("with no persona at all there is nothing to read as", async () => {
    getActiveStaffSession.mockResolvedValue(null);
    expect(await read()).toBe(403);
  });
});
