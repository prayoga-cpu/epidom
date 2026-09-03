import { describe, it, expect } from "vitest";
import {
  resolveRouteAction,
  deriveFallbackCode,
  isMutatingMethod,
  isWaived,
  extractStoreId,
  ROUTE_ACTION_MAP,
  TRAIL_WAIVERS,
} from "../route-map";

describe("route -> action map", () => {
  describe("method filtering", () => {
    it("treats only state-changing verbs as mutations", () => {
      expect(isMutatingMethod("POST")).toBe(true);
      expect(isMutatingMethod("patch")).toBe(true);
      expect(isMutatingMethod("DELETE")).toBe(true);
      expect(isMutatingMethod("PUT")).toBe(true);
      expect(isMutatingMethod("GET")).toBe(false);
      expect(isMutatingMethod("HEAD")).toBe(false);
    });

    it("records nothing for a read", () => {
      expect(resolveRouteAction("GET", "/api/stores/abc/products")).toBeNull();
    });
  });

  describe("specificity", () => {
    // The regression this guards: `/products/bulk` being swallowed by
    // `/products/*` would file a store-wide bulk delete under the single-row
    // code, hiding the most destructive of the two.
    it("prefers a literal segment over a wildcard at the same depth", () => {
      const bulk = resolveRouteAction("DELETE", "/api/stores/s1/products/bulk");
      expect(bulk?.code).toBe("product.bulk_delete");

      const single = resolveRouteAction("DELETE", "/api/stores/s1/products/p1");
      expect(single?.code).toBe("product.delete");
    });

    it("matches deeper sub-routes ahead of their parent collection", () => {
      const finalize = resolveRouteAction("POST", "/api/stores/s1/pos/orders/o1/finalize");
      expect(finalize?.code).toBe("pos.order.finalize");

      const hold = resolveRouteAction("POST", "/api/stores/s1/pos/orders/hold");
      expect(hold?.code).toBe("pos.order.hold");
    });
  });

  describe("target extraction", () => {
    it("pulls the target id from the segment the spec names", () => {
      const r = resolveRouteAction("DELETE", "/api/stores/store-1/products/prod-9");
      expect(r?.targetType).toBe("Product");
      expect(r?.targetId).toBe("prod-9");
      expect(r?.params).toEqual(["store-1", "prod-9"]);
    });

    it("indexes past intermediate wildcards", () => {
      const r = resolveRouteAction("PATCH", "/api/stores/s1/pos/orders/o1/items/i1");
      expect(r?.targetType).toBe("OrderItem");
      expect(r?.targetId).toBe("i1");
    });

    it("leaves targetId unset for collection routes", () => {
      const r = resolveRouteAction("POST", "/api/stores/s1/products");
      expect(r?.targetId).toBeUndefined();
    });
  });

  describe("coverage floor", () => {
    // The property that makes an empty Activity page meaningful: an unmapped
    // mutation still produces a row, so "nothing listed" means "nothing
    // happened" rather than "nobody instrumented this".
    it("derives a code for an unmapped mutating route", () => {
      const r = resolveRouteAction("POST", "/api/some/brand/new/endpoint");
      expect(r).not.toBeNull();
      expect(r?.derived).toBe(true);
      expect(r?.severity).toBe("NOTICE");
    });

    it("collapses ids so a derived code groups by endpoint, not by row", () => {
      const a = deriveFallbackCode("POST", "/api/stores/clx1234567890abcdefghij/widgets");
      const b = deriveFallbackCode("POST", "/api/stores/clx0987654321zyxwvutsrq/widgets");
      expect(a).toBe(b);
    });

    it("skips waived routes", () => {
      expect(resolveRouteAction("POST", "/api/health")).toBeNull();
      expect(resolveRouteAction("POST", "/api/inngest")).toBeNull();
      expect(isWaived("/api/auth/sign-in")).toBe(true);
    });

    it("gives every waiver a stated reason", () => {
      for (const [route, reason] of Object.entries(TRAIL_WAIVERS)) {
        expect(reason.length, `${route} has an empty waiver reason`).toBeGreaterThan(10);
      }
    });
  });

  describe("catalogue hygiene", () => {
    it("uses a well-formed METHOD /path key for every entry", () => {
      for (const key of Object.keys(ROUTE_ACTION_MAP)) {
        expect(key, `malformed map key: ${key}`).toMatch(
          /^(POST|PATCH|PUT|DELETE) \/api\/[\w\-*/[\]]*$/
        );
      }
    });

    it("never files a delete as merely informational", () => {
      // Deliberately weaker than "every DELETE is CRITICAL". Cancelling a
      // reservation or removing a table is routine, and promoting those would
      // flood the CRITICAL filter and the alert mailbox until both are ignored
      // — which costs more than it buys. The invariant that matters is that a
      // delete is never dismissed as INFO.
      for (const [key, spec] of Object.entries(ROUTE_ACTION_MAP)) {
        if (!key.startsWith("DELETE ")) continue;
        expect(spec.severity, `${key} is a delete filed as INFO`).not.toBe("INFO");
      }
    });

    it("marks deletes that destroy business records as CRITICAL", () => {
      // These are the ones an operator must be able to find without filtering:
      // they destroy priced inventory, costing data, or a whole tenant.
      const mustBeCritical = [
        "DELETE /api/stores/*",
        "DELETE /api/stores/*/products/*",
        "DELETE /api/stores/*/products/bulk",
        "DELETE /api/stores/*/materials/*",
        "DELETE /api/stores/*/recipes/*",
        "DELETE /api/stores/*/suppliers/*",
        "DELETE /api/stores/*/waste/*",
        "DELETE /api/stores/*/staff/*",
      ];
      for (const key of mustBeCritical) {
        expect(ROUTE_ACTION_MAP[key], `missing map entry: ${key}`).toBeDefined();
        expect(ROUTE_ACTION_MAP[key].severity, `${key} should be CRITICAL`).toBe("CRITICAL");
      }
    });

    it("keeps action codes unique per route", () => {
      const codes = Object.values(ROUTE_ACTION_MAP).map((s) => s.code);
      expect(new Set(codes).size).toBe(codes.length);
    });
  });

  describe("store scoping", () => {
    it("extracts the tenant from a store-scoped route", () => {
      expect(extractStoreId("/api/stores/store-42/waste")).toBe("store-42");
    });

    it("returns undefined off the store path", () => {
      expect(extractStoreId("/api/admin/users")).toBeUndefined();
    });
  });
});
