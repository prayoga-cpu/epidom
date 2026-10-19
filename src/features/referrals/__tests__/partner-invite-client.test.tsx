import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "fr" | "id",
  user: null as null | { email: string; emailVerified: boolean },
}));
vi.mock("@/components/lang/i18n-provider", async () => {
  const { makeT } = await import("@/features/marketing/legal/__tests__/i18n-helper");
  return { useI18n: () => ({ locale: state.locale, t: makeT(state.locale, true) }) };
});
vi.mock("@/lib/auth-client", () => ({
  useUser: () => ({ user: state.user, loading: false }),
  signOut: vi.fn(),
}));
const post = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: { post: (...a: unknown[]) => post(...a) },
  ApiClientError: class extends Error {
    status = 0;
  },
}));
vi.mock("@/features/marketing/shared/components/epidom-logo", () => ({
  EpidomWordmark: () => null,
}));

import { PartnerInviteClient } from "../invite/partner-invite-client";

const TOKEN = "b".repeat(64);
const invite = {
  displayName: "Aaron",
  email: "aaron@x.com",
  commissionRate: 30,
  commissionMonths: 3,
  hasReferralLink: false,
  customerDiscountPercent: 0,
  salesPages: ["sales-page-2"],
};

describe("partner invitation page", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockImplementation((endpoint: string) =>
      Promise.resolve(endpoint === "/partner-invite/lookup" ? invite : { partnerId: "p1" })
    );
    state.user = null;
  });
  afterEach(() => cleanup());

  it.each(["en", "fr", "id"] as const)(
    "%s: signed out, shows the deal and keeps the link through sign-up and sign-in",
    async (locale) => {
      state.locale = locale;
      const { container } = render(<PartnerInviteClient token={TOKEN} />);
      await screen.findByText(/aaron@x.com/);
      expect(container.textContent).not.toContain("MISSING");
      const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
      const next = encodeURIComponent(`/partner-invite?token=${TOKEN}`);
      expect(hrefs).toContain(`/register?next=${next}&email=${encodeURIComponent("aaron@x.com")}`);
      expect(hrefs).toContain(`/login?next=${next}`);
      expect(post).toHaveBeenCalledTimes(1);
    }
  );

  it("signed in as the invited, verified address: accepts at once", async () => {
    state.locale = "en";
    state.user = { email: "Aaron@x.com", emailVerified: true };
    render(<PartnerInviteClient token={TOKEN} />);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/partner-invite/accept", { token: TOKEN })
    );
  });

  it("signed in as someone else: never accepts, offers to switch", async () => {
    state.locale = "en";
    state.user = { email: "other@x.com", emailVerified: true };
    render(<PartnerInviteClient token={TOKEN} />);
    await screen.findByText(/other@x.com/);
    expect(post).not.toHaveBeenCalledWith("/partner-invite/accept", expect.anything());
    expect(screen.getByRole("button", { name: "Use another account" })).toBeTruthy();
  });
});
