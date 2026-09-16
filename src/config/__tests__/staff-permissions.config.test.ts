import { describe, it, expect } from "vitest";
import { ALL_STAFF_PAGES, ROLE_DEFAULT_PAGES, resolveStaffAllowedPages } from "../staff-permissions.config";
import { updateStaffSchema } from "@/lib/validation/operations.schemas";

describe("POS Mode routes stay grantable after the shell split", () => {
  // The regression this guards: /pos/schedule deliberately has no
  // dashboardNavigation entry (it must never leak into the Back Office
  // rail), but ALL_STAFF_PAGES used to derive solely from that nav config.
  // Without POS_MODE_ONLY_PAGES, the first time an owner edited any
  // permission for an existing Cashier/Kitchen staffer, this page would
  // silently fail validation and drop out of their saved allowedPages —
  // losing clock-in access with no visible error at the point of loss.
  it("ALL_STAFF_PAGES includes /pos/schedule even though it's not in the Back Office nav", () => {
    expect(ALL_STAFF_PAGES).toContain("/pos/schedule");
  });

  it("does NOT leak /pos/schedule's siblings into a state where they'd be missing either", () => {
    for (const page of ["/pos", "/pos/orders", "/pos/kds", "/tables"]) {
      expect(ALL_STAFF_PAGES).toContain(page);
    }
  });

  it("Cashier and Kitchen defaults point at the light schedule view, not the full builder", () => {
    expect(ROLE_DEFAULT_PAGES.CASHIER).toContain("/pos/schedule");
    expect(ROLE_DEFAULT_PAGES.CASHIER).not.toContain("/schedule");
    expect(ROLE_DEFAULT_PAGES.KITCHEN).toContain("/pos/schedule");
    expect(ROLE_DEFAULT_PAGES.KITCHEN).not.toContain("/schedule");
  });

  it("Manager keeps the full roster builder AND can reach the light view from POS Mode's overflow menu", () => {
    expect(ROLE_DEFAULT_PAGES.MANAGER).toContain("/schedule");
    expect(ROLE_DEFAULT_PAGES.MANAGER).toContain("/pos/schedule");
  });

  it("resolveStaffAllowedPages falls back to the role default when no override is set", () => {
    expect(resolveStaffAllowedPages("CASHIER", [])).toEqual(ROLE_DEFAULT_PAGES.CASHIER);
  });

  // This is the exact failure mode the fix targets: an owner customizing an
  // EXISTING staffer's permissions (a non-empty allowedPages array) is the
  // schema-validation code path, not the resolver — reproduce it through
  // updateStaffSchema directly, the same schema the API route uses.
  it("updateStaffSchema accepts /pos/schedule in a hand-edited allowedPages array", () => {
    const result = updateStaffSchema.safeParse({
      allowedPages: ["/pos", "/pos/orders", "/tables", "/pos/schedule"],
    });
    expect(result.success).toBe(true);
  });

  it("updateStaffSchema still rejects a genuinely unknown page string", () => {
    const result = updateStaffSchema.safeParse({
      allowedPages: ["/pos", "/not-a-real-page"],
    });
    expect(result.success).toBe(false);
  });
});
