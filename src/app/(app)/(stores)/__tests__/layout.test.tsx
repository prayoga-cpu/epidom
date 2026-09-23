import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({ session: null as unknown }));
vi.mock("@/lib/auth", () => ({ getSession: async () => h.session }));
// redirect() never returns in Next; throwing is what stops the layout the same way.
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/components/lang/i18n-provider", () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/features/marketing/shared/components/site-header", () => ({
  SiteHeader: () => <header data-testid="site-header" />,
}));

import StoresLayout from "../layout";

beforeEach(() => {
  h.session = null;
});

describe("(stores) layout — who may see Your Stores", () => {
  it("no session at all goes to sign in — the proxy only saw a cookie, not a live session", async () => {
    await expect(StoresLayout({ children: null })).rejects.toThrow("REDIRECT:/login");
  });

  it("a session with no user goes to sign in too", async () => {
    h.session = { user: null };
    await expect(StoresLayout({ children: null })).rejects.toThrow("REDIRECT:/login");
  });

  it("a deactivated account still goes to its profile, not to sign in", async () => {
    h.session = { user: { id: "u1", deactivatedAt: new Date() } };
    await expect(StoresLayout({ children: null })).rejects.toThrow("REDIRECT:/profile");
  });

  it("a signed-in account gets the page", async () => {
    h.session = { user: { id: "u1", deactivatedAt: null } };
    render(await StoresLayout({ children: <p>your stores</p> }));
    expect(screen.getByText("your stores")).toBeInTheDocument();
    expect(screen.getByTestId("site-header")).toBeInTheDocument();
  });
});
