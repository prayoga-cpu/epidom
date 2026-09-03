/**
 * Route -> action map for the Layer 1 activity trail.
 *
 * Every mutating API request resolves to an action code here. Routes that are
 * not listed still produce a trail row via {@link deriveFallbackCode}, so
 * coverage is total and a gap in the log is never mistaken for "nothing
 * happened". The map exists to give the rows that matter a stable, readable
 * code and an honest severity, not to gate what gets recorded.
 *
 * Patterns are `METHOD /path` with `*` standing for exactly one dynamic
 * segment. Longer patterns win over shorter ones, so a specific sub-route is
 * never shadowed by its parent collection.
 */

import type { AuditSeverity } from "@prisma/client";

export interface RouteActionSpec {
  /** Stable dotted code, e.g. "admin.user.delete". */
  code: string;
  severity: AuditSeverity;
  /** Prisma model the request targets, when it is knowable from the route. */
  targetType?: string;
  /**
   * Which `*` capture holds the target id, 0-based. Omitted when the target is
   * a collection or the id lives in the body rather than the path.
   */
  targetIdIndex?: number;
}

/**
 * CRITICAL is reserved for actions that destroy data, move money, or change
 * who can access an account. Those are the rows an operator must never have to
 * search for, and the ones that trigger alerting.
 */
const C: AuditSeverity = "CRITICAL";
const N: AuditSeverity = "NOTICE";
const I: AuditSeverity = "INFO";

export const ROUTE_ACTION_MAP: Record<string, RouteActionSpec> = {
  // ---------------------------------------------------------------- admin
  // Every branch of the admin users PATCH is CRITICAL. The specific branch is
  // resolved from the request body by the Layer 2 catalogue; at Layer 1 we
  // only know the route was hit.
  "PATCH /api/admin/users": { code: "admin.user.mutate", severity: C, targetType: "User" },
  "POST /api/admin/seed-demo": { code: "admin.seed_demo", severity: C },
  "PATCH /api/admin/feedback": { code: "admin.feedback.triage", severity: I, targetType: "Feedback" },
  "PATCH /api/admin/custom-development": {
    code: "admin.custom_development.triage",
    severity: I,
    targetType: "CustomDevelopmentRequest",
  },
  "POST /api/admin/backups": { code: "admin.backup.run", severity: N },
  // The log logs itself. A reversal is a privileged write like any other, and
  // an audit trail that cannot show who reverted what is missing the one
  // action most worth reviewing.
  "POST /api/admin/activity/actions": { code: "audit.action.operate", severity: C, targetType: "ActionLog" },

  // ------------------------------------------------------------- account
  "PATCH /api/user/account-settings": { code: "account.settings.update", severity: C, targetType: "User" },
  "DELETE /api/user/account-settings": { code: "account.deactivate", severity: C, targetType: "User" },
  "POST /api/user/account-settings": { code: "account.reactivate", severity: C, targetType: "User" },
  "PATCH /api/user/profile": { code: "account.profile.update", severity: I, targetType: "User" },
  "POST /api/user/owner-pin": { code: "account.owner_pin.set", severity: C, targetType: "Business" },
  "POST /api/user/owner-pin/reset": { code: "account.owner_pin.reset", severity: C, targetType: "Business" },
  "POST /api/user/owner-pin/request-otp": { code: "account.owner_pin.request_otp", severity: N },
  "POST /api/user/verify-owner-pin": { code: "account.owner_pin.verify", severity: I },
  "PATCH /api/user/business": { code: "account.business.update", severity: N, targetType: "Business" },
  "PATCH /api/user/business/finance-settings": {
    code: "account.finance_settings.update",
    severity: N,
    targetType: "BusinessFinanceSettings",
  },
  "POST /api/user/timezone": { code: "account.timezone.set", severity: I, targetType: "User" },

  // ------------------------------------------------------- subscriptions
  "POST /api/subscriptions/checkout": { code: "billing.checkout.start", severity: N },
  "POST /api/subscriptions/custom-price/checkout": { code: "billing.custom_checkout.start", severity: N },
  "POST /api/subscriptions/cancel": { code: "billing.subscription.cancel", severity: C },
  "POST /api/subscriptions/cleanup": { code: "billing.subscription.cleanup", severity: C },
  "POST /api/subscriptions/sync": { code: "billing.subscription.sync", severity: C },
  "POST /api/subscriptions/audit": { code: "billing.subscription.audit", severity: C },
  "POST /api/subscriptions/activate-free": { code: "billing.plan.activate_free", severity: N },
  "POST /api/subscriptions/beta-plan": { code: "billing.plan.beta", severity: N },
  "POST /api/subscriptions/setup": { code: "billing.setup", severity: N },
  "POST /api/billing/portal": { code: "billing.portal.open", severity: I },
  "POST /api/connect/onboarding": { code: "billing.connect.onboard", severity: N },

  // -------------------------------------------------------------- stores
  "POST /api/stores": { code: "store.create", severity: N, targetType: "Store" },
  "PATCH /api/stores/*": { code: "store.update", severity: N, targetType: "Store", targetIdIndex: 0 },
  "DELETE /api/stores/*": { code: "store.delete", severity: C, targetType: "Store", targetIdIndex: 0 },

  // ------------------------------------------------------------ products
  "POST /api/stores/*/products": { code: "product.create", severity: I, targetType: "Product" },
  "PATCH /api/stores/*/products/*": { code: "product.update", severity: N, targetType: "Product", targetIdIndex: 1 },
  "DELETE /api/stores/*/products/*": { code: "product.delete", severity: C, targetType: "Product", targetIdIndex: 1 },
  "DELETE /api/stores/*/products/bulk": { code: "product.bulk_delete", severity: C, targetType: "Product" },
  "DELETE /api/stores/*/products/categories/*": {
    code: "product.category_delete",
    severity: C,
    targetType: "Product",
  },
  "PATCH /api/stores/*/products/categories/*": { code: "product.category_rename", severity: N, targetType: "Product" },

  // ----------------------------------------------------------- materials
  "POST /api/stores/*/materials": { code: "material.create", severity: I, targetType: "Material" },
  "PATCH /api/stores/*/materials/*": { code: "material.update", severity: N, targetType: "Material", targetIdIndex: 1 },
  "DELETE /api/stores/*/materials/*": {
    code: "material.delete",
    severity: C,
    targetType: "Material",
    targetIdIndex: 1,
  },
  "DELETE /api/stores/*/materials/bulk": { code: "material.bulk_delete", severity: C, targetType: "Material" },
  "DELETE /api/stores/*/materials/categories/*": {
    code: "material.category_delete",
    severity: C,
    targetType: "Material",
  },
  "PATCH /api/stores/*/materials/categories/*": {
    code: "material.category_rename",
    severity: N,
    targetType: "Material",
  },

  // ------------------------------------------------------------- recipes
  "POST /api/stores/*/recipes": { code: "recipe.create", severity: I, targetType: "Recipe" },
  "PATCH /api/stores/*/recipes/*": { code: "recipe.update", severity: N, targetType: "Recipe", targetIdIndex: 1 },
  "DELETE /api/stores/*/recipes/*": { code: "recipe.delete", severity: C, targetType: "Recipe", targetIdIndex: 1 },
  "POST /api/stores/*/recipes/*/duplicate": { code: "recipe.duplicate", severity: I, targetType: "Recipe" },
  "DELETE /api/stores/*/recipes/bulk": { code: "recipe.bulk_delete", severity: C, targetType: "Recipe" },
  "DELETE /api/stores/*/recipes/categories/*": { code: "recipe.category_delete", severity: C, targetType: "Recipe" },

  // ----------------------------------------------------------- suppliers
  "POST /api/stores/*/suppliers": { code: "supplier.create", severity: I, targetType: "Supplier" },
  "PATCH /api/stores/*/suppliers/*": { code: "supplier.update", severity: N, targetType: "Supplier", targetIdIndex: 1 },
  "DELETE /api/stores/*/suppliers/*": {
    code: "supplier.delete",
    severity: C,
    targetType: "Supplier",
    targetIdIndex: 1,
  },
  "DELETE /api/stores/*/suppliers/bulk": { code: "supplier.bulk_delete", severity: C, targetType: "Supplier" },
  "POST /api/stores/*/supplier-orders": { code: "supplier_order.create", severity: N, targetType: "SupplierOrder" },
  "PATCH /api/stores/*/supplier-orders/*": {
    code: "supplier_order.status_change",
    severity: C,
    targetType: "SupplierOrder",
    targetIdIndex: 1,
  },
  "POST /api/stores/*/supplier-orders/*/send": {
    code: "supplier_order.send",
    severity: C,
    targetType: "SupplierOrder",
    targetIdIndex: 1,
  },

  // --------------------------------------------------------------- stock
  "POST /api/stores/*/stock/adjust": { code: "stock.adjust", severity: C, targetType: "StockMovement" },
  "POST /api/stores/*/stock/import": { code: "stock.import", severity: C, targetType: "StockMovement" },
  "POST /api/stores/*/waste": { code: "waste.create", severity: N, targetType: "WasteEntry" },
  "DELETE /api/stores/*/waste/*": { code: "waste.delete", severity: C, targetType: "WasteEntry", targetIdIndex: 1 },
  "POST /api/stores/*/production/stock-count": { code: "stock.count", severity: C, targetType: "Product" },

  // --------------------------------------------------- production batches
  "POST /api/stores/*/production-batches": {
    code: "production_batch.create",
    severity: N,
    targetType: "ProductionBatch",
  },
  "PATCH /api/stores/*/production-batches/*": {
    code: "production_batch.update",
    severity: N,
    targetType: "ProductionBatch",
    targetIdIndex: 1,
  },
  "DELETE /api/stores/*/production-batches/*": {
    code: "production_batch.delete",
    severity: C,
    targetType: "ProductionBatch",
    targetIdIndex: 1,
  },
  "POST /api/stores/*/production-batches/*/complete": {
    code: "production_batch.complete",
    severity: C,
    targetType: "ProductionBatch",
    targetIdIndex: 1,
  },
  "POST /api/stores/*/production-batches/*/cancel": {
    code: "production_batch.cancel",
    severity: C,
    targetType: "ProductionBatch",
    targetIdIndex: 1,
  },

  // ----------------------------------------------------------------- POS
  "POST /api/stores/*/pos/orders": { code: "pos.order.create", severity: N, targetType: "Order" },
  "PATCH /api/stores/*/pos/orders/*": { code: "pos.order.update", severity: C, targetType: "Order", targetIdIndex: 1 },
  "POST /api/stores/*/pos/orders/hold": { code: "pos.order.hold", severity: N, targetType: "Order" },
  "POST /api/stores/*/pos/orders/*/finalize": {
    code: "pos.order.finalize",
    severity: C,
    targetType: "Order",
    targetIdIndex: 1,
  },
  "POST /api/stores/*/pos/orders/*/refund": {
    code: "pos.order.refund",
    severity: C,
    targetType: "Order",
    targetIdIndex: 1,
  },
  "PATCH /api/stores/*/pos/orders/*/customer": {
    code: "pos.order.customer_update",
    severity: N,
    targetType: "Order",
    targetIdIndex: 1,
  },
  "POST /api/stores/*/pos/orders/*/send-receipt": {
    code: "pos.order.send_receipt",
    severity: C,
    targetType: "Order",
    targetIdIndex: 1,
  },
  "PATCH /api/stores/*/pos/orders/*/items/*": {
    code: "pos.order_item.update",
    severity: N,
    targetType: "OrderItem",
    targetIdIndex: 2,
  },
  "PATCH /api/stores/*/orders/*": { code: "order.status_change", severity: N, targetType: "Order", targetIdIndex: 1 },
  "PATCH /api/stores/*/pos/kds/settings": { code: "pos.kds_settings.update", severity: I, targetType: "Store" },

  // -------------------------------------------------------------- shifts
  "POST /api/stores/*/shifts": { code: "shift.open", severity: N, targetType: "Shift" },
  "PATCH /api/stores/*/shifts/*": { code: "shift.close", severity: C, targetType: "Shift", targetIdIndex: 1 },

  // ------------------------------------------------------- cash movements
  // CRITICAL on both: these rows move physical money, and deleting a paid-out
  // is precisely how a till shortage would be papered over.
  "POST /api/stores/*/cash-movements": {
    code: "cash_movement.create",
    severity: C,
    targetType: "CashMovement",
  },
  "DELETE /api/stores/*/cash-movements/*": {
    code: "cash_movement.delete",
    severity: C,
    targetType: "CashMovement",
    targetIdIndex: 1,
  },

  // --------------------------------------------------------------- staff
  "POST /api/stores/*/staff": { code: "staff.create", severity: N, targetType: "StaffMember" },
  "PATCH /api/stores/*/staff/*": { code: "staff.update", severity: C, targetType: "StaffMember", targetIdIndex: 1 },
  "DELETE /api/stores/*/staff/*": { code: "staff.delete", severity: C, targetType: "StaffMember", targetIdIndex: 1 },
  "POST /api/stores/*/staff/verify-pin": { code: "staff.pin_verify", severity: N, targetType: "StaffMember" },
  "POST /api/stores/*/staff/logout": { code: "staff.logout", severity: I },

  // ------------------------------------------------------------ schedule
  "POST /api/stores/*/staff-schedules": { code: "schedule.create", severity: I, targetType: "StaffSchedule" },
  "PATCH /api/stores/*/staff-schedules/*": {
    code: "schedule.update",
    severity: N,
    targetType: "StaffSchedule",
    targetIdIndex: 1,
  },
  "DELETE /api/stores/*/staff-schedules/*": {
    code: "schedule.delete",
    severity: C,
    targetType: "StaffSchedule",
    targetIdIndex: 1,
  },
  "POST /api/stores/*/staff-schedules/bulk": { code: "schedule.bulk_write", severity: C, targetType: "StaffSchedule" },
  "POST /api/stores/*/staff-schedules/publish": { code: "schedule.publish", severity: C, targetType: "StaffSchedule" },
  "POST /api/stores/*/schedule-shifts": { code: "schedule_shift.create", severity: I, targetType: "ScheduleShift" },
  "PATCH /api/stores/*/schedule-shifts/*": {
    code: "schedule_shift.update",
    severity: N,
    targetType: "ScheduleShift",
    targetIdIndex: 1,
  },
  "DELETE /api/stores/*/schedule-shifts/*": {
    code: "schedule_shift.delete",
    severity: C,
    targetType: "ScheduleShift",
    targetIdIndex: 1,
  },

  // ---------------------------------------------------------- attendance
  "POST /api/stores/*/attendance/clock-in": { code: "attendance.clock_in", severity: I, targetType: "AttendanceRecord" },
  "POST /api/stores/*/attendance/clock-out": {
    code: "attendance.clock_out",
    severity: I,
    targetType: "AttendanceRecord",
  },
  "POST /api/stores/*/attendance/absence": { code: "attendance.absence", severity: N, targetType: "AttendanceRecord" },
  "POST /api/stores/*/attendance/*/close": {
    code: "attendance.manager_close",
    severity: C,
    targetType: "AttendanceRecord",
    targetIdIndex: 1,
  },
  "POST /api/stores/*/attendance/*/retake-photo": {
    code: "attendance.retake_photo",
    severity: C,
    targetType: "AttendanceRecord",
    targetIdIndex: 1,
  },
  "PATCH /api/stores/*/attendance/settings": { code: "attendance.settings.update", severity: N, targetType: "Store" },

  // ---------------------------------------------------------- storefront
  "PATCH /api/stores/*/storefront": { code: "storefront.update", severity: N, targetType: "Storefront" },
  "POST /api/stores/*/storefront/categories": {
    code: "storefront.category_create",
    severity: I,
    targetType: "MenuCategory",
  },
  "PATCH /api/stores/*/storefront/categories/*": {
    code: "storefront.category_update",
    severity: N,
    targetType: "MenuCategory",
    targetIdIndex: 1,
  },
  "DELETE /api/stores/*/storefront/categories/*": {
    code: "storefront.category_delete",
    severity: C,
    targetType: "MenuCategory",
    targetIdIndex: 1,
  },
  "POST /api/stores/*/storefront/items": { code: "storefront.item_create", severity: I, targetType: "MenuItem" },
  "PATCH /api/stores/*/storefront/items/*": {
    code: "storefront.item_update",
    severity: N,
    targetType: "MenuItem",
    targetIdIndex: 1,
  },
  "DELETE /api/stores/*/storefront/items/*": {
    code: "storefront.item_delete",
    severity: C,
    targetType: "MenuItem",
    targetIdIndex: 1,
  },

  // ------------------------------------------------------------- tables
  "POST /api/stores/*/tables": { code: "table.create", severity: I, targetType: "Table" },
  "PATCH /api/stores/*/tables/*": { code: "table.update", severity: I, targetType: "Table", targetIdIndex: 1 },
  "DELETE /api/stores/*/tables/*": { code: "table.delete", severity: N, targetType: "Table", targetIdIndex: 1 },
  "POST /api/stores/*/reservations": { code: "reservation.create", severity: I, targetType: "Reservation" },
  "PATCH /api/stores/*/reservations/*": {
    code: "reservation.update",
    severity: I,
    targetType: "Reservation",
    targetIdIndex: 1,
  },
  "DELETE /api/stores/*/reservations/*": {
    code: "reservation.delete",
    severity: N,
    targetType: "Reservation",
    targetIdIndex: 1,
  },

  // -------------------------------------------------------- settings/AI
  "PATCH /api/stores/*/finance/settings": {
    code: "store.finance_settings.update",
    severity: C,
    targetType: "StoreFinanceSettings",
  },
  "PATCH /api/stores/*/receipt-settings": {
    code: "store.receipt_settings.update",
    severity: I,
    targetType: "StoreReceiptSettings",
  },
  "PATCH /api/stores/*/production/settings": { code: "store.production_settings.update", severity: N, targetType: "Store" },
  "PATCH /api/stores/*/custom-products/settings": {
    code: "store.custom_products_settings.update",
    severity: I,
    targetType: "Store",
  },
  "POST /api/ai/import/execute": { code: "ai_import.execute", severity: C },
  "POST /api/ai/import/analyze": { code: "ai_import.analyze", severity: I },

  // ------------------------------------------------------------ feedback
  "POST /api/feedback": { code: "feedback.create", severity: I, targetType: "Feedback" },
  "PATCH /api/feedback/*": { code: "feedback.update", severity: I, targetType: "Feedback", targetIdIndex: 0 },
  "DELETE /api/feedback/*": { code: "feedback.delete", severity: N, targetType: "Feedback", targetIdIndex: 0 },
  "POST /api/custom-development": {
    code: "custom_development.create",
    severity: I,
    targetType: "CustomDevelopmentRequest",
  },

  // ------------------------------------------------------------ webhooks
  // Recorded so a provider-driven state change is never invisible, even
  // though the actor is external and there is nothing to revert.
  "POST /api/webhooks/stripe": { code: "webhook.stripe", severity: N },
  "POST /api/webhooks/xendit": { code: "webhook.xendit", severity: C, targetType: "Order" },
  "POST /api/webhooks/email": { code: "webhook.email", severity: I },
  "POST /api/public/orders": { code: "public.order.create", severity: N, targetType: "Order" },
  "POST /api/public/reservations": { code: "public.reservation.create", severity: I, targetType: "Reservation" },

  // -------------------------------------------------------------- upload
  "POST /api/upload": { code: "upload.file", severity: I },
  "POST /api/onboarding/complete": { code: "onboarding.complete", severity: N },
};

/**
 * Routes deliberately excluded from the trail, with the reason.
 *
 * Kept as an explicit list rather than an implicit omission so the admin
 * coverage panel can render exactly what is not recorded. A waiver must say
 * why; an unexplained entry is a bug.
 */
export const TRAIL_WAIVERS: Record<string, string> = {
  "/api/health": "Liveness probe. High frequency, no state change.",
  "/api/inngest": "Job runner transport. Individual jobs record their own actions.",
  "/api/auth/[...all]": "Better Auth internal routes; session events are recorded by auth.ts.",
  "/api/analytics/web-vitals": "Client performance beacons. No user action, very high volume.",
  "/api/pusher/auth": "Realtime channel authorization, fires on every socket connect.",
  "/api/session": "Session read. No mutation.",
  "/api/exchange-rates": "Cached FX read.",
  "/api/public/changelog": "Public content read.",
};

interface CompiledPattern {
  method: string;
  regex: RegExp;
  spec: RouteActionSpec;
  /** Segment count, used to prefer the most specific match. */
  weight: number;
}

/**
 * Patterns are compiled once at module load and sorted most-specific-first.
 * A literal segment outranks a wildcard at the same depth, so
 * `/products/bulk` is never swallowed by `/products/*`.
 */
const COMPILED: CompiledPattern[] = Object.entries(ROUTE_ACTION_MAP)
  .map(([key, spec]) => {
    const spaceIdx = key.indexOf(" ");
    const method = key.slice(0, spaceIdx);
    const path = key.slice(spaceIdx + 1);
    const segments = path.split("/").filter(Boolean);
    const source =
      "^" +
      segments
        .map((s) => (s === "*" ? "([^/]+)" : s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
        .map((s) => "/" + s)
        .join("") +
      "/?$";
    return {
      method,
      regex: new RegExp(source),
      spec,
      // Literal segments are worth more than wildcards, so a fully literal
      // path of the same length always wins.
      weight: segments.length * 10 + segments.filter((s) => s !== "*").length,
    };
  })
  .sort((a, b) => b.weight - a.weight);

/** HTTP methods that change state. GET/HEAD/OPTIONS never produce a trail row. */
const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export function isMutatingMethod(method: string): boolean {
  return MUTATING.has(method.toUpperCase());
}

export function isWaived(route: string): boolean {
  if (TRAIL_WAIVERS[route]) return true;
  // Better Auth mounts a catch-all; match its prefix.
  return route.startsWith("/api/auth/");
}

export interface ResolvedRouteAction extends RouteActionSpec {
  /** Dynamic segments captured from the path, in order. */
  params: string[];
  /** Target id resolved via targetIdIndex, when the spec named one. */
  targetId?: string;
  /** True when no map entry matched and the code was derived. */
  derived: boolean;
}

/**
 * Derive a stable code for a route with no map entry.
 *
 * Concrete ids are collapsed to `*` so the code groups by endpoint rather than
 * fragmenting per row: `/api/stores/abc123/foo` and `/api/stores/def456/foo`
 * both become `foo.post`. Severity is NOTICE — unknown-but-mutating deserves
 * more attention than a mapped INFO route, and less than a known destructive one.
 */
export function deriveFallbackCode(method: string, route: string): string {
  const segments = route
    .replace(/^\/api\//, "")
    .split("/")
    .filter(Boolean)
    // A segment that looks like an id (cuid, uuid, or long hex) is a parameter.
    .map((s) => (/^(c[a-z0-9]{20,}|[0-9a-f-]{16,}|\d+)$/i.test(s) ? "*" : s))
    .filter((s) => s !== "*");
  const tail = segments.slice(-2).join(".") || "root";
  return `${tail}.${method.toLowerCase()}`;
}

/** Resolve a request to its action spec. Returns null for waived/non-mutating. */
export function resolveRouteAction(method: string, route: string): ResolvedRouteAction | null {
  const upper = method.toUpperCase();
  if (!isMutatingMethod(upper)) return null;
  if (isWaived(route)) return null;

  for (const pattern of COMPILED) {
    if (pattern.method !== upper) continue;
    const match = pattern.regex.exec(route);
    if (!match) continue;
    const params = match.slice(1);
    const targetId =
      pattern.spec.targetIdIndex !== undefined ? params[pattern.spec.targetIdIndex] : undefined;
    return { ...pattern.spec, params, targetId, derived: false };
  }

  return {
    code: deriveFallbackCode(upper, route),
    severity: "NOTICE",
    params: [],
    derived: true,
  };
}

/** Store id from a `/api/stores/:id/...` route, when present. */
export function extractStoreId(route: string): string | undefined {
  const m = /^\/api\/stores\/([^/]+)/.exec(route);
  return m?.[1];
}
