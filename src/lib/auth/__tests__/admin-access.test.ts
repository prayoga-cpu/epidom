import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdminAccess, resolveAdminAccess } from "../admin-access";
import { getActingAdmin } from "../require-admin-api";
import { canOpenSection, visibleSections } from "@/config/admin-sections.config";

const row = (over: Partial<Parameters<typeof resolveAdminAccess>[0]> = {}) => ({
  id: "u1",
  email: "someone@example.com",
  name: "Someone",
  isAdmin: false,
  adminSections: [] as string[],
  partner: null as { id: string } | null,
  ...over,
});

describe("resolveAdminAccess", () => {
  it("a hardcoded email is a full admin", () => {
    const a = resolveAdminAccess(row({ email: "prayogadevelopment@gmail.com" }));
    expect(a).toMatchObject({ full: true, sections: [], grantSource: "HARDCODED_EMAIL" });
  });

  it("the DB flag is a full admin and wins over the hardcoded list", () => {
    const a = resolveAdminAccess(row({ email: "prayogadevelopment@gmail.com", isAdmin: true }));
    expect(a.grantSource).toBe("DB_FLAG");
  });

  it("granted pages make a section admin; unknown or full-only keys are dropped", () => {
    const a = resolveAdminAccess(
      row({ adminSections: ["sales-pages", "users", "activity", "retired"] })
    );
    expect(a).toMatchObject({
      full: false,
      sections: ["sales-pages"],
      grantSource: "SECTION_GRANT",
    });
  });

  it("a partner with no pages has no admin grant but may open their own page", () => {
    const a = resolveAdminAccess(row({ partner: { id: "p1" } }));
    expect(a.grantSource).toBeNull();
    expect(a.partnerId).toBe("p1");
    expect(canOpenSection(a, "my-referrals")).toBe(true);
    expect(canOpenSection(a, "partners")).toBe(false);
    expect(visibleSections(a).map((s) => s.key)).toEqual(["my-referrals"]);
  });
});

describe("partner page viewers", () => {
  it("a viewer opens the partner page of the partners it views, owning none of them", () => {
    const a = resolveAdminAccess(row({ partnerViews: [{ partnerId: "aaron" }] }));
    expect(a).toMatchObject({ partner: true, partnerId: null, viewablePartnerIds: ["aaron"] });
    expect(canOpenSection(a, "my-referrals")).toBe(true);
    expect(canOpenSection(a, "sales-pages")).toBe(false);
  });

  it("a partner who also views another sees their own page first", () => {
    const a = resolveAdminAccess(
      row({ partner: { id: "bob" }, partnerViews: [{ partnerId: "aaron" }, { partnerId: "bob" }] })
    );
    expect(a.viewablePartnerIds).toEqual(["bob", "aaron"]);
    expect(a.partnerId).toBe("bob");
  });
});

describe("canOpenSection", () => {
  const scoped = resolveAdminAccess(row({ adminSections: ["sales-pages", "partners"] }));
  const full = resolveAdminAccess(row({ isAdmin: true }));

  it("a section admin opens only their pages, never users or activity", () => {
    expect(canOpenSection(scoped, "sales-pages")).toBe(true);
    expect(canOpenSection(scoped, "partners")).toBe(true);
    for (const key of ["users", "activity", "revenue", "capacity", "pixel", "feedback"] as const) {
      expect(canOpenSection(scoped, key)).toBe(false);
    }
  });

  it("a full admin opens every admin page, but my-referrals only as a partner", () => {
    expect(canOpenSection(full, "users")).toBe(true);
    expect(canOpenSection(full, "activity")).toBe(true);
    expect(canOpenSection(full, "my-referrals")).toBe(false);
  });
});

describe("getActingAdmin", () => {
  const findUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;
  const session = getSession as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    findUnique.mockReset();
    session.mockReset();
    session.mockResolvedValue({ user: { id: "u1" } });
  });

  it("with no section, only a full admin passes (a route nobody mapped stays locked)", async () => {
    findUnique.mockResolvedValue({
      ...row({ adminSections: ["sales-pages"] }),
      deactivatedAt: null,
    });
    expect(await getActingAdmin()).toBeNull();
    expect(await getActingAdmin({ section: "sales-pages" })).toMatchObject({
      id: "u1",
      grantSource: "SECTION_GRANT",
      full: false,
    });
    expect(await getActingAdmin({ section: "revenue" })).toBeNull();
  });

  it("a full admin passes everywhere", async () => {
    findUnique.mockResolvedValue({ ...row({ isAdmin: true }), deactivatedAt: null });
    expect(await getActingAdmin()).toMatchObject({ full: true, grantSource: "DB_FLAG" });
    expect(await getActingAdmin({ section: "capacity" })).toMatchObject({ full: true });
  });

  it("a deactivated account has no access at all", async () => {
    findUnique.mockResolvedValue({ ...row({ isAdmin: true }), deactivatedAt: new Date() });
    expect(await getAdminAccess()).toBeNull();
    expect(await getActingAdmin()).toBeNull();
  });

  it("no session, no access", async () => {
    session.mockResolvedValue(null);
    expect(await getActingAdmin({ section: "pixel" })).toBeNull();
  });
});
