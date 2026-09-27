/**
 * The Kitchen & Bar page's layout: the page intro sits above KdsShell, whose
 * root is h-full. KdsShell has to sit in a min-h-0 flex box, or it keeps the
 * page's full height under the intro and the page's overflow-hidden clips the
 * bottom of the last ticket in a busy column.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type React from "react";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(async () => ({ user: { id: "u1" } })),
}));
vi.mock("@/lib/utils/store-verification", () => ({ verifyStoreAccess: vi.fn() }));
vi.mock("@/lib/auth/require-staff-page-access", () => ({ requireStaffPageAccess: vi.fn() }));
const staff = vi.hoisted(() => ({ getActiveStaffSession: vi.fn() }));
vi.mock("@/lib/staff-session", () => staff);
vi.mock("@/features/pos/components/kds/kds-shell", () => ({
  KdsShell: ({ canManageSettings }: { canManageSettings: boolean }) => (
    <div data-testid="kds-shell" data-can-manage={String(canManageSettings)} />
  ),
}));
vi.mock("@/features/guide/components/page-intro", () => ({
  PageIntro: ({ id, className }: { id: string; className?: string }) => (
    <section data-testid="page-intro" data-id={id} className={className} />
  ),
}));

import KdsPage from "../page";

async function renderPage() {
  const element = (await KdsPage({
    params: Promise.resolve({ storeId: "s1" }),
  })) as React.ReactElement;
  return render(element);
}

beforeEach(() => {
  staff.getActiveStaffSession.mockReset().mockResolvedValue(null);
});

describe("/pos/kds layout", () => {
  it("keeps KdsShell in a min-h-0 flex box under the intro, so a busy column isn't clipped", async () => {
    await renderPage();
    const intro = screen.getByTestId("page-intro");
    const shell = screen.getByTestId("kds-shell");
    const body = shell.parentElement!;

    expect(intro).toHaveAttribute("data-id", "kitchen");
    expect(intro).toHaveClass("shrink-0");
    // The box between the page and KdsShell takes what the intro leaves, and
    // may shrink below the tickets' height (min-h-0) instead of overflowing.
    expect(body).not.toBe(intro.parentElement);
    expect(body).toHaveClass("flex", "min-h-0", "flex-1", "flex-col");
    // Intro first, then the shell's box, both children of the page column.
    expect(body.parentElement).toBe(intro.parentElement);
    expect(intro.nextElementSibling).toBe(body);
    expect(body.parentElement).toHaveClass(
      "flex",
      "min-h-0",
      "flex-1",
      "flex-col",
      "overflow-hidden"
    );
  });

  it("still lets the owner manage the Kitchen & Bar setting", async () => {
    await renderPage();
    expect(screen.getByTestId("kds-shell")).toHaveAttribute("data-can-manage", "true");
  });
});
