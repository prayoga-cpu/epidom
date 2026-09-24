/**
 * The Operational page's server side: the access gate, the per-tab rules fed
 * from the real session, and the redirects that replace the old pages.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type React from "react";

class Redirect extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));

const guard = vi.hoisted(() => ({ requireStaffPageAccess: vi.fn() }));
vi.mock("@/lib/auth/require-staff-page-access", () => guard);
const viewer = vi.hoisted(() => ({ getStoreViewer: vi.fn() }));
vi.mock("@/lib/auth/store-viewer", () => viewer);
const staff = vi.hoisted(() => ({ getActiveStaffSession: vi.fn() }));
vi.mock("@/lib/staff-session", () => staff);
const db = vi.hoisted(() => ({ count: vi.fn(), findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { staffMember: { count: db.count, findMany: db.findMany } },
}));
const plan = vi.hoisted(() => ({ getStorePlan: vi.fn() }));
vi.mock("@/lib/plans/store-plan", () => plan);
vi.mock("@/features/pos-mode/pos-mode-operational", () => ({
  PosModeOperational: () => null,
}));

import OperationalPage from "../page";
import ShiftRedirect from "../../shift/page";
import ScheduleRedirect from "../../schedule/page";

const params = Promise.resolve({ storeId: "s1" });
const TEAM = [
  { id: "staff-1", name: "Kim", role: "KITCHEN" },
  { id: "staff-2", name: "Sam", role: "CASHIER" },
];

type Props = {
  storeId: string;
  tabs: string[];
  scheduleStaffMemberId: string | null;
  renderedFor: string;
  rosterStaff: { id: string; name: string; role: string }[];
};
async function renderProps(): Promise<Props> {
  const element = (await OperationalPage({ params })) as React.ReactElement<Props>;
  return element.props;
}

const session = (over: Record<string, unknown> = {}) => ({
  storeId: "s1",
  staffMemberId: "staff-1",
  name: "Kim",
  role: "KITCHEN",
  allowedPages: ["/pos/kds", "/pos/schedule"],
  ...over,
});

beforeEach(() => {
  guard.requireStaffPageAccess.mockReset().mockResolvedValue(undefined);
  viewer.getStoreViewer.mockReset().mockResolvedValue({ kind: "owner" });
  staff.getActiveStaffSession.mockReset().mockResolvedValue(null);
  db.count.mockReset().mockResolvedValue(3);
  db.findMany.mockReset().mockResolvedValue(TEAM);
  plan.getStorePlan.mockReset().mockResolvedValue("OPERATIONS");
});

describe("/pos/operational", () => {
  it("opens for ANY POS Mode grant — the schedule grant included, so /pos/schedule can't loop", async () => {
    await renderProps();
    const [storeId, pages] = guard.requireStaffPageAccess.mock.calls[0];
    expect(storeId).toBe("s1");
    expect(pages).toEqual(
      expect.arrayContaining(["/pos", "/pos/orders", "/pos/kds", "/tables", "/pos/schedule"])
    );
  });

  it("the owner gets Shift, the team's published schedule and the Clock kiosk — not sent away to Back Office", async () => {
    expect(await renderProps()).toEqual({
      storeId: "s1",
      tabs: ["shift", "roster", "clock"],
      scheduleStaffMemberId: null,
      renderedFor: "owner",
      rosterStaff: TEAM,
    });
    // The roster lists active staff by name and role only — what Back Office's own grid shows.
    expect(db.findMany).toHaveBeenCalledWith({
      where: { storeId: "s1", isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    });
  });

  it("no Team Schedule on a plan without rosters — and no staff list fetched for it", async () => {
    plan.getStorePlan.mockResolvedValue("POS");
    const props = await renderProps();
    expect(props.tabs).toEqual(["shift", "clock"]);
    expect(props.rosterStaff).toEqual([]);
    expect(db.findMany).not.toHaveBeenCalled();
  });

  it("a kitchen persona gets its own schedule and the clock — not the whole team's roster", async () => {
    staff.getActiveStaffSession.mockResolvedValue(session());
    expect(await renderProps()).toMatchObject({
      tabs: ["schedule", "clock"],
      scheduleStaffMemberId: "staff-1",
      renderedFor: "staff-1",
      rosterStaff: [],
    });
  });

  it("ignores a staff session left over from another store", async () => {
    staff.getActiveStaffSession.mockResolvedValue(session({ storeId: "other" }));
    expect(await renderProps()).toMatchObject({
      tabs: ["shift", "roster", "clock"],
      scheduleStaffMemberId: null,
    });
  });

  it("counts only active non-owner staff as someone to clock in", async () => {
    db.count.mockResolvedValue(0);
    expect((await renderProps()).tabs).toEqual(["shift", "roster"]);
    expect(db.count).toHaveBeenCalledWith({
      where: { storeId: "s1", isActive: true, role: { not: "OWNER" } },
    });
  });

  it("sends a persona with nothing here to the POS tab it does have, not a blank page", async () => {
    viewer.getStoreViewer.mockResolvedValue({ kind: "staff", staffMemberId: "staff-1" });
    staff.getActiveStaffSession.mockResolvedValue(session({ allowedPages: ["/pos/kds"] }));
    await expect(OperationalPage({ params })).rejects.toMatchObject({
      url: "/store/s1/pos/kds",
    });
  });
});

describe("the old pages", () => {
  it("/pos/shift lands on the Shift tab", async () => {
    await expect(ShiftRedirect({ params })).rejects.toMatchObject({
      url: "/store/s1/pos/operational?tab=shift",
    });
  });

  it("/pos/schedule lands on the Schedule tab", async () => {
    await expect(ScheduleRedirect({ params })).rejects.toMatchObject({
      url: "/store/s1/pos/operational?tab=schedule",
    });
  });
});
