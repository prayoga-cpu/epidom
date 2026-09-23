import { NextResponse } from "next/server";
import { getActiveStaffSession } from "@/lib/staff-session";
import { ApiErrorCode, createErrorResponse } from "@/types/api/responses";

/**
 * What a LINKED STAFF ACCOUNT (a Better Auth user tied to one StaffMember via
 * StaffMember.userId — not the store's owner) may call on the API.
 *
 * Why a table and not per-route flags: the owner's signed-in device has always
 * been treated as "the owner", with staff personas layered on top by PIN, so
 * most store routes authorize on "is this session the store's owner" alone.
 * A linked staff account breaks that equivalence — it is a real session that
 * is NOT the owner — and ~110 store routes would each need a considered answer
 * to "may a Cashier do this?". This file is that answer, in one reviewable
 * place, and it is DEFAULT-DENY: a route missing from POLICY stays owner-only,
 * so forgetting to list something can only make a staff account less capable,
 * never more.
 *
 * Enforced from exactly two places, both after the caller has been resolved to
 * a linked staff member of THIS store (verifyStoreAccess):
 *   - withApiHandler (src/lib/api-handler.ts) for every `requireStoreAuth`
 *     route, and
 *   - verifyStoreAccessWithResponse (src/lib/utils/store-verification.ts) for
 *     the plain handlers that check ownership inline.
 * The store's owner never reaches this file.
 */

export interface StaffRoutePolicy {
  /**
   * "pre-pin" — the staff picker's own endpoints, which by definition run
   * before any PIN persona exists.
   * "post-pin" — everything else: the caller must hold a live StaffSession
   * (PIN entered) for THIS exact linked staff member, so the PIN really is a
   * second factor on top of the account login, not decoration.
   */
  phase: "pre-pin" | "post-pin";
  /** post-pin: the persona must be granted at least one of these pages. */
  pages?: readonly string[];
  /** The persona's role must be MANAGER or OWNER (refunds, table CRUD, ...). */
  managerOnly?: boolean;
  /**
   * With `managerOnly`: a non-manager may still call the route when the JSON
   * body's top-level keys are ALL in this list. For routes where one endpoint
   * carries both a routine action and a privileged one (PATCH tables/* cycles a
   * table's status — every host's job — and also renames/resizes it).
   */
  nonManagerBodyKeys?: readonly string[];
  /**
   * The request must name the caller's own staff id (`staffId` /
   * `staffMemberId`, query or JSON body). For endpoints that would otherwise
   * list or act on everyone at the store.
   */
  selfRequired?: boolean;
}

const PRE: StaffRoutePolicy = { phase: "pre-pin" };

// Page grants (see navigation.config.ts posModeNavItems / staff-permissions).
const POS = ["/pos"] as const;
const POS_QUEUE = ["/pos", "/pos/orders"] as const;
const POS_ANY = ["/pos", "/pos/orders", "/pos/kds"] as const;
const FLOOR = ["/tables", "/pos"] as const;
const MY_SCHEDULE = ["/pos/schedule"] as const;
const ALL_POS_PAGES = ["/pos", "/pos/orders", "/pos/kds", "/tables", "/pos/schedule"] as const;

const post = (pages: readonly string[], extra: Partial<StaffRoutePolicy> = {}): StaffRoutePolicy => ({
  phase: "post-pin",
  pages,
  ...extra,
});

/**
 * `METHOD /path` with `*` for exactly one dynamic segment — the same pattern
 * syntax as src/lib/audit/route-map.ts. Add a line here to give staff accounts
 * a route; there is deliberately no other way.
 */
const POLICY: Record<string, StaffRoutePolicy> = {
  // ---- the staff picker (StoreAccessGate / PosStaffGate) ------------------
  // GET returns only the caller's own row for a staff principal — enforced in
  // the handler (it must not hand a cashier every coworker's contact details
  // and pay rate).
  "GET /api/stores/*/staff": PRE,
  // The PIN check itself. The identity rule below pins `staffId` to the
  // caller's own linked member, so a linked account can never assume another
  // staffer's persona — most importantly, a Manager with no PIN set.
  "POST /api/stores/*/staff/verify-pin": PRE,
  "POST /api/stores/*/staff/logout": PRE,

  // ---- POS: taking and settling orders ------------------------------------
  "GET /api/stores/*/pos/menu": post(POS),
  "GET /api/stores/*/pos/orders": post(POS_ANY),
  "POST /api/stores/*/pos/orders": post(POS),
  "GET /api/stores/*/pos/orders/*": post(POS_ANY),
  "PATCH /api/stores/*/pos/orders/*": post(POS_ANY),
  "PATCH /api/stores/*/pos/orders/*/items/*": post(POS_ANY),
  "POST /api/stores/*/pos/orders/hold": post(POS),
  "POST /api/stores/*/pos/orders/*/finalize": post(POS),
  "PATCH /api/stores/*/pos/orders/*/customer": post(POS_QUEUE),
  "GET /api/stores/*/pos/orders/*/receipt": post(POS_QUEUE),
  "GET /api/stores/*/pos/orders/*/send-receipt": post(POS_QUEUE),
  "POST /api/stores/*/pos/orders/*/send-receipt": post(POS_QUEUE),
  // Money leaves the till: a manager decision, not a cashier's.
  "POST /api/stores/*/pos/orders/*/refund": post(POS_QUEUE, { managerOnly: true }),
  "GET /api/stores/*/orders": post(POS_ANY),
  "GET /api/stores/*/orders/payment-totals": post(POS_QUEUE),
  "GET /api/stores/*/orders/stream": post(POS_ANY),

  // ---- POS: customers, promotions, merge and e-mail receipts (2.88.0) -----
  // The cart's inline customer box and discount tiles. ONLY the list/create
  // pair of customers is here — `GET /customers/*` is deliberately absent so a
  // `*` can never also admit `/customers/export` (the whole customer table as a
  // CSV) or `/customers/analytics`. Editing a customer, adjusting points,
  // exporting, and every promotion WRITE (presets, coupons, loyalty settings)
  // are Back Office actions with no staff-account route: default-deny leaves
  // them to the owner (and, on the owner's own device, a manager persona via
  // requireManagerOrOwnerApi in the handler).
  //
  // The promotion reads below are OPERATIONS-tier and the routes enforce that
  // on the STORE OWNER's plan (requirePromotionsPlanApi), so a staff account is
  // judged on what its employer pays for — not on its own empty subscription.
  "GET /api/stores/*/customers": post(POS),
  "POST /api/stores/*/customers": post(POS),
  "GET /api/stores/*/discount-presets": post(POS),
  "POST /api/stores/*/coupons/validate": post(POS),
  "GET /api/stores/*/loyalty-settings": post(POS),
  "POST /api/stores/*/pos/orders/merge": post(POS),
  // Same reach as the WhatsApp send above: the order queue's receipt actions.
  "POST /api/stores/*/pos/orders/*/send-receipt-email": post(POS_QUEUE),

  // ---- POS: kitchen display -----------------------------------------------
  // Read-only for staff. The PATCH (the store-wide Active Queue on/off switch)
  // is owner-only by its own rule and deliberately absent.
  "GET /api/stores/*/pos/kds/settings": post(["/pos", "/pos/kds"]),

  // ---- POS: floor ---------------------------------------------------------
  "GET /api/stores/*/tables": post(FLOOR),
  "GET /api/stores/*/tables/*": post(FLOOR),
  "POST /api/stores/*/tables": post(["/tables"], { managerOnly: true }),
  // Tapping a table to cycle Available -> Occupied -> ... is the floor staff's
  // core action and goes through this same PATCH as renaming/resizing it, so
  // anyone with the Tables page may send a status change (and only that);
  // editing the table itself stays a manager's.
  "PATCH /api/stores/*/tables/*": post(["/tables"], {
    managerOnly: true,
    nonManagerBodyKeys: ["status", "expectedStatus"],
  }),
  "DELETE /api/stores/*/tables/*": post(["/tables"], { managerOnly: true }),
  // Bookings live on the Tables page; taking them is the host's job.
  "GET /api/stores/*/reservations": post(["/tables"]),
  "POST /api/stores/*/reservations": post(["/tables"]),
  "PATCH /api/stores/*/reservations/*": post(["/tables"]),
  "DELETE /api/stores/*/reservations/*": post(["/tables"]),

  // ---- POS: till sessions and shared plumbing -----------------------------
  "GET /api/stores/*/shifts": post(POS),
  "POST /api/stores/*/shifts": post(POS),
  "GET /api/stores/*/shifts/*": post(POS),
  "PATCH /api/stores/*/shifts/*": post(POS),
  "GET /api/stores/*/reports/shift-report": post(POS),
  "GET /api/stores/*/notifications": post(["/pos", "/pos/orders", "/pos/kds", "/tables"]),
  // Read-only. Every store page mounts CurrencyProvider, which reads the
  // store's currency from here, and the till prices each bill with the same
  // tax / service-charge settings — denied, a staffer would see the wrong
  // currency and ring up wrong totals. The PATCH stays owner-only.
  "GET /api/stores/*/finance/settings": post(ALL_POS_PAGES),
  // (Realtime channel auth, POST /api/pusher/auth, is not listed: it resolves
  // its own identity from the PIN persona — see resolveIdentity there — and
  // never goes through this table.)

  // ---- "My schedule" and clock in/out (the light staff view) --------------
  "GET /api/stores/*/attendance/status": post(MY_SCHEDULE, { selfRequired: true }),
  "GET /api/stores/*/attendance/history": post(MY_SCHEDULE, { selfRequired: true }),
  "POST /api/stores/*/attendance/clock-in": post(MY_SCHEDULE, { selfRequired: true }),
  "POST /api/stores/*/attendance/clock-out": post(MY_SCHEDULE, { selfRequired: true }),
  "POST /api/stores/*/attendance/absence": post(MY_SCHEDULE, { selfRequired: true }),
  "POST /api/stores/*/attendance/*/retake-photo": post(MY_SCHEDULE),
  "GET /api/stores/*/schedule/my-log": post(MY_SCHEDULE, { selfRequired: true }),
  "GET /api/stores/*/staff-schedules": post(MY_SCHEDULE, { selfRequired: true }),
  "GET /api/stores/*/schedule-shifts": post(MY_SCHEDULE),
  // A roster image is the same for the whole team, so any persona with My
  // Schedule may read it — no selfRequired. Writes stay manager/owner-only and
  // are not listed (default-deny keeps them off a linked staff account).
  "GET /api/stores/*/schedule-images": post(MY_SCHEDULE),
};

// ---------------------------------------------------------------------------

interface CompiledPolicy {
  method: string;
  regex: RegExp;
  policy: StaffRoutePolicy;
}

function compile(key: string, policy: StaffRoutePolicy): CompiledPolicy {
  const space = key.indexOf(" ");
  const method = key.slice(0, space);
  const path = key.slice(space + 1);
  const source = path
    .split("/")
    .map((seg) => (seg === "*" ? "([^/]+)" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return { method, regex: new RegExp(`^${source}/?$`), policy };
}

const COMPILED: CompiledPolicy[] = Object.entries(POLICY).map(([k, p]) => compile(k, p));

/** The policy for a request, or null when staff accounts have no access. */
export function resolveStaffRoutePolicy(method: string, pathname: string): StaffRoutePolicy | null {
  const upper = method.toUpperCase();
  for (const entry of COMPILED) {
    if (entry.method === upper && entry.regex.test(pathname)) return entry.policy;
  }
  return null;
}

/** Every listed route — exported for the test that pins the allow-list. */
export function listStaffPolicyKeys(): string[] {
  return Object.keys(POLICY);
}

// ---------------------------------------------------------------------------

const IDENTITY_FIELDS = ["staffId", "staffMemberId"] as const;

function deny(message: string): NextResponse {
  return NextResponse.json(createErrorResponse(ApiErrorCode.FORBIDDEN, message), { status: 403 });
}

/**
 * The JSON body as a plain object, or null (no body / not JSON / not an object).
 *
 * Deliberately IGNORES the Content-Type header: route handlers call
 * `request.json()`, which parses whatever bytes arrive whatever the header
 * says, and a plain `fetch(url, { body: JSON.stringify(...) })` is sent as
 * text/plain. Trusting the header here would let a caller hide another
 * staffer's id from this check in a body the handler then happily reads.
 */
async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD") return null;
  try {
    const body: unknown = await request.clone().json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    // Not parseable — the handler will reject it on its own terms.
    return null;
  }
}

/**
 * Every `staffId` / `staffMemberId` the request names — query string and, for
 * JSON bodies, top-level fields. A value that isn't a plain string is returned
 * as null-marked so the caller can refuse it rather than silently skip it.
 */
function namedStaffIds(request: Request, body: Record<string, unknown> | null): Array<string | null> {
  const found: Array<string | null> = [];

  const query = new URL(request.url).searchParams;
  for (const field of IDENTITY_FIELDS) {
    for (const v of query.getAll(field)) found.push(v);
  }

  if (body) {
    for (const field of IDENTITY_FIELDS) {
      if (field in body) {
        const v = body[field];
        found.push(typeof v === "string" ? v : null);
      }
    }
  }

  return found;
}

/**
 * Decide whether a linked staff account may make this request. Returns a 403
 * response to send back, or null to proceed. Never call this for the owner.
 */
export async function authorizeStaffPrincipal(input: {
  storeId: string;
  staffMemberId: string;
  request: Request;
}): Promise<NextResponse | null> {
  const { storeId, staffMemberId, request } = input;

  const pathname = new URL(request.url).pathname;
  const policy = resolveStaffRoutePolicy(request.method, pathname);
  if (!policy) {
    return deny("This isn't available to staff accounts");
  }

  // A linked account is exactly one person. Any staff id the request names
  // must be that person — this is what stops one cashier's login from
  // clocking in a coworker, opening a till as them, or trying their PIN.
  const body = await readJsonObject(request);
  const named = namedStaffIds(request, body);
  if (named.some((id) => id !== staffMemberId)) {
    return deny("You can only act as yourself");
  }
  if (policy.selfRequired && named.length === 0) {
    return deny("You can only act as yourself");
  }

  if (policy.phase === "pre-pin") return null;

  // Second factor: the PIN persona must be THIS linked member, verified by the
  // existing PIN flow (a leftover StaffSession from a different persona on the
  // same browser does not count).
  const persona = await getActiveStaffSession();
  if (!persona || persona.storeId !== storeId || persona.staffMemberId !== staffMemberId) {
    return deny("Enter your PIN to continue");
  }

  if (policy.pages && !policy.pages.some((p) => persona.allowedPages.includes(p))) {
    return deny("Your role doesn't include this");
  }

  if (policy.managerOnly && persona.role !== "MANAGER" && persona.role !== "OWNER") {
    // A body that isn't a plain object, is empty, or names ANY key outside the
    // routine set is treated as the privileged action.
    const keys = body ? Object.keys(body) : [];
    const routine =
      !!policy.nonManagerBodyKeys &&
      keys.length > 0 &&
      keys.every((k) => policy.nonManagerBodyKeys!.includes(k));
    if (!routine) return deny("Only a manager can do this");
  }

  return null;
}
