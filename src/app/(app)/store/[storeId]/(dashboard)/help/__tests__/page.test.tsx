/**
 * The Help page's server side: open to every member of the store (no page
 * grant, like /changelog), and the shortcuts it offers follow the persona.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
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

const auth = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth", () => auth);
const staff = vi.hoisted(() => ({ getActiveStaffSession: vi.fn() }));
vi.mock("@/lib/staff-session", () => staff);
const changelog = vi.hoisted(() => ({ getReleases: vi.fn() }));
vi.mock("@/lib/services/changelog.service", () => ({ changelogService: changelog }));
// Any page gate would show up here: the Help page must not call one.
const guard = vi.hoisted(() => ({ requireStaffPageAccess: vi.fn() }));
vi.mock("@/lib/auth/require-staff-page-access", () => guard);
vi.mock("@/features/guide/components/help-center", () => ({ HelpCenter: () => null }));

import HelpPage from "../page";

type Props = {
  context: string;
  storeId: string;
  canManage: boolean;
  canOpenDashboard: boolean;
  releases: unknown[];
  initialGuideSlug: string | null;
};

async function renderPage(query: Record<string, string> = {}) {
  const element = (await HelpPage({
    params: Promise.resolve({ storeId: "s1" }),
    searchParams: Promise.resolve(query),
  })) as React.ReactElement<Props>;
  return element;
}

const persona = (over: Record<string, unknown> = {}) => ({
  storeId: "s1",
  staffMemberId: "staff-1",
  role: "CASHIER",
  allowedPages: ["/pos", "/pos/orders"],
  ...over,
});

const release = (version: string) => ({
  version,
  releasedAt: "2026-09-27T00:00:00.000Z",
  tag: "feat",
  items: [],
});

beforeEach(() => {
  auth.getSession.mockReset().mockResolvedValue({ user: { id: "u1" } });
  staff.getActiveStaffSession.mockReset().mockResolvedValue(null);
  changelog.getReleases
    .mockReset()
    .mockResolvedValue([release("3.3.0"), release("3.2.0"), release("3.1.1"), release("3.1.0")]);
  guard.requireStaffPageAccess.mockReset();
});

describe("/store/[storeId]/help", () => {
  it("sends a signed-out visitor to /login", async () => {
    auth.getSession.mockResolvedValue(null);
    await expect(renderPage()).rejects.toMatchObject({ url: "/login" });
  });

  it("the owner gets every shortcut", async () => {
    const { props } = await renderPage();
    expect(props.context).toBe("backoffice");
    expect(props.storeId).toBe("s1");
    expect(props.canManage).toBe(true);
    expect(props.canOpenDashboard).toBe(true);
  });

  it("opens for a Cashier persona with no Back Office pages — no gate, no redirect", async () => {
    staff.getActiveStaffSession.mockResolvedValue(persona());
    const { props } = await renderPage();
    expect(guard.requireStaffPageAccess).not.toHaveBeenCalled();
    expect(props.canManage).toBe(false);
    expect(props.canOpenDashboard).toBe(false);
  });

  it("a Manager persona with the dashboard gets the checklist and the tour", async () => {
    staff.getActiveStaffSession.mockResolvedValue(
      persona({ role: "MANAGER", allowedPages: ["/dashboard", "/pos"] })
    );
    const { props } = await renderPage();
    expect(props.canManage).toBe(true);
    expect(props.canOpenDashboard).toBe(true);
  });

  it("an OWNER-role persona is the owner", async () => {
    staff.getActiveStaffSession.mockResolvedValue(persona({ role: "OWNER", allowedPages: [] }));
    const { props } = await renderPage();
    expect(props.canManage).toBe(true);
    expect(props.canOpenDashboard).toBe(true);
  });

  it("passes ?guide= through and keys the reader on it", async () => {
    const element = await renderPage({ guide: "demarrage" });
    expect(element.props.initialGuideSlug).toBe("demarrage");
    expect(element.key).toBe("demarrage");

    const plain = await renderPage();
    expect(plain.props.initialGuideSlug).toBeNull();
    expect(plain.key).toBe("index");
  });

  it("hands over the latest three releases, and an empty list if the read fails", async () => {
    const { props } = await renderPage();
    expect(props.releases).toHaveLength(3);

    changelog.getReleases.mockRejectedValue(new Error("db down"));
    const failed = await renderPage();
    expect(failed.props.releases).toEqual([]);
  });
});
