import { describe, it, expect } from "vitest";
import {
  ALL_STAFF_PAGES,
  ROLE_DEFAULT_PAGES,
  resolveStaffAllowedPages,
  STAFF_ROLE_TEMPLATES,
  isBaseRoleTemplate,
  pickStaffHomePage,
  pickStaffLandingPage,
} from "../staff-permissions.config";
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

  // Customer records are a manager's page: a Cashier captures a customer at the
  // till (POS), but browsing/exporting the whole list is not theirs.
  it("Manager (and the back-office Admin template) can reach /customers; Cashier and Kitchen cannot", () => {
    expect(ALL_STAFF_PAGES).toContain("/customers");
    expect(ROLE_DEFAULT_PAGES.MANAGER).toContain("/customers");
    expect(STAFF_ROLE_TEMPLATES.find((t) => t.id === "admin")!.allowedPages).toContain("/customers");
    expect(ROLE_DEFAULT_PAGES.CASHIER).not.toContain("/customers");
    expect(ROLE_DEFAULT_PAGES.KITCHEN).not.toContain("/customers");
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

describe("STAFF_ROLE_TEMPLATES (merged Role + Job-title picker)", () => {
  it("every template's pages are grantable — updateStaffSchema accepts them all", () => {
    for (const tpl of STAFF_ROLE_TEMPLATES) {
      const result = updateStaffSchema.safeParse({ allowedPages: tpl.allowedPages });
      expect(result.success, `template "${tpl.id}" has an ungrantable page`).toBe(true);
    }
  });

  it("has a unique id per template", () => {
    const ids = STAFF_ROLE_TEMPLATES.map((tpl) => tpl.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("back-office-only templates (admin, finance) never grant a POS Mode page", () => {
    const posOnlyPages = new Set(["/pos", "/pos/orders", "/pos/kds", "/tables"]);
    for (const id of ["admin", "finance"]) {
      const tpl = STAFF_ROLE_TEMPLATES.find((t) => t.id === id)!;
      expect(tpl.role).toBe("MANAGER");
      for (const page of tpl.allowedPages) {
        expect(posOnlyPages.has(page)).toBe(false);
      }
    }
  });

  it("front-of-house templates (waiter, bartender, host) never grant a Back Office-only page", () => {
    const backOfficeOnlyPages = new Set(["/finance", "/management", "/production", "/data", "/staff"]);
    for (const id of ["waiter", "bartender", "host"]) {
      const tpl = STAFF_ROLE_TEMPLATES.find((t) => t.id === id)!;
      expect(tpl.role).toBe("CASHIER");
      for (const page of tpl.allowedPages) {
        expect(backOfficeOnlyPages.has(page)).toBe(false);
      }
    }
  });

  it("isBaseRoleTemplate is true only for the plain role templates", () => {
    expect(isBaseRoleTemplate("manager")).toBe(true);
    expect(isBaseRoleTemplate("cashier")).toBe(true);
    expect(isBaseRoleTemplate("kitchen")).toBe(true);
    for (const id of ["admin", "finance", "waiter", "bartender", "host"]) {
      expect(isBaseRoleTemplate(id)).toBe(false);
    }
  });
});

describe("linked staff landing page", () => {
  it("pickStaffHomePage takes POS Mode pages in tab order, never a Back Office page", () => {
    expect(pickStaffHomePage(["/dashboard", "/pos/kds", "/pos"])).toBe("/pos");
    expect(pickStaffHomePage(["/pos/kds", "/tables"])).toBe("/pos/kds");
    expect(pickStaffHomePage(["/dashboard", "/finance", "/staff"])).toBeNull();
    expect(pickStaffHomePage([])).toBeNull();
  });

  it("pickStaffLandingPage honours a requested POS page only when it's granted", () => {
    const granted = ["/pos", "/pos/orders", "/pos/kds"];
    expect(pickStaffLandingPage(granted, "/pos/kds")).toBe("/pos/kds");
    expect(pickStaffLandingPage(granted, "/tables")).toBe("/pos"); // not granted
    expect(pickStaffLandingPage(granted, "/finance")).toBe("/pos"); // Back Office
    expect(pickStaffLandingPage(granted, "/pos/../etc")).toBe("/pos"); // junk
    expect(pickStaffLandingPage(granted, null)).toBe("/pos");
    expect(pickStaffLandingPage(granted)).toBe("/pos");
  });

  it("pickStaffLandingPage never lands on a page they weren't granted, even if requested", () => {
    expect(pickStaffLandingPage(["/dashboard"], "/pos")).toBeNull();
  });
});
