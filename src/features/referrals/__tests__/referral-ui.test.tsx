import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";

const state = vi.hoisted(() => ({ locale: "en" as "en" | "fr" | "id" }));
vi.mock("@/components/lang/i18n-provider", async () => {
  const { makeT } = await import("@/features/marketing/legal/__tests__/i18n-helper");
  // strict: a key missing from fr or id shows as MISSING(key).
  return { useI18n: () => ({ locale: state.locale, t: makeT(state.locale, true) }) };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ReferralBanner } from "../components/referral-banner";
import { MyReferrals } from "../portal/my-referrals";

const LOCALES = ["en", "fr", "id"] as const;

function setUrl(search: string) {
  window.history.replaceState({}, "", `/register${search}`);
}

describe("ReferralBanner", () => {
  beforeEach(() => {
    sessionStorage.clear();
    document.cookie = "epidom_source=; Max-Age=0; Path=/";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { displayName: "Bob", discountPercent: 10 } }),
      })
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.each(LOCALES)("%s: shows the partner and the discount for a ?ref= visit", async (locale) => {
    state.locale = locale;
    setUrl("?ref=bob");
    render(<ReferralBanner />);
    const banner = await screen.findByRole("status");
    expect(banner.textContent).toContain("Bob");
    expect(banner.textContent).toMatch(/10/);
    expect(banner.textContent).not.toContain("MISSING");
    expect(fetch).toHaveBeenCalledWith("/api/public/referrals/BOB");
  });

  it("reads the code from the cookie on later pages", async () => {
    state.locale = "en";
    setUrl("");
    document.cookie = `epidom_source=${encodeURIComponent("ref.BOB.1792380000")}; Path=/`;
    render(<ReferralBanner />);
    expect(await screen.findByRole("status")).toBeTruthy();
  });

  it("shows nothing for a sales-page visit, an unknown code, or once dismissed", async () => {
    state.locale = "en";
    setUrl("");
    document.cookie = `epidom_source=${encodeURIComponent("page.sales-page-2.fr.1792380000")}; Path=/`;
    const { container, unmount } = render(<ReferralBanner />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container.textContent).toBe("");
    expect(fetch).not.toHaveBeenCalled();
    unmount();

    setUrl("?ref=NOPE");
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({}),
    } as Response);
    const second = render(<ReferralBanner />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(second.container.textContent).toBe("");
    second.unmount();

    setUrl("?ref=bob");
    render(<ReferralBanner />);
    fireEvent.click(await screen.findByRole("button"));
    expect(screen.queryByRole("status")).toBeNull();
    expect(sessionStorage.getItem("epidom-referral-banner-dismissed")).toBe("BOB");
  });
});

const dashboard = {
  partner: {
    displayName: "Aaron",
    status: "ACTIVE" as const,
    referralCode: "AARON",
    referralLanding: "REGISTER" as const,
    commissionRate: "30",
    commissionMonths: 3,
    customerDiscountPercent: "10",
  },
  range: "30" as const,
  salesPages: [
    {
      page: "sales-page-2",
      creditFrom: "2026-10-20T00:00:00.000Z",
      creditedSignups: 3,
      report: {
        page: "sales-page-2" as const,
        views: 150,
        visitors: 120,
        ctaClicks: 20,
        ctaVisitors: 14,
        scrolled50: 60,
        scrolled90: 30,
        signups: 4,
        signupsWithStore: 2,
        clickRate: 14 / 120,
        signupRate: 4 / 120,
        ctas: [],
      },
    },
  ],
  customers: [
    {
      userId: "u1",
      label: null,
      signedUpAt: "2026-10-21T10:00:00.000Z",
      source: "SALES_PAGE" as const,
      salesPage: "sales-page-2",
      utmSource: "facebook",
      utmCampaign: "oct",
      adClick: "meta",
      plan: "POS",
      status: "ACTIVE" as const,
      firstPaidAt: "2026-10-21T10:05:00.000Z",
      windowEnd: "2027-01-21T10:05:00.000Z",
      discountPercent: null,
      discountRedeemed: false,
      selfReferralFlag: false,
      earned: [{ currency: "eur", amount: "4.19" }],
    },
  ],
  ledger: [
    {
      id: "c1",
      kind: "INVOICE",
      status: "PENDING",
      currency: "eur",
      invoiceAmount: "13.99",
      commissionableAmount: "13.99",
      rate: "30",
      amount: "4.19",
      plan: "POS",
      billingInterval: "MONTHLY",
      earnedAt: "2026-10-21T10:05:00.000Z",
      payableAt: "2026-11-20T10:05:00.000Z",
      ready: false,
      customerLabel: "Café Lumière",
      customerDeleted: false,
      note: null,
      payoutId: null,
    },
  ],
  totals: [{ currency: "eur", onHold: "4.19", ready: "0.00", paid: "0.00" }],
  payouts: [],
};

describe("MyReferrals", () => {
  afterEach(() => cleanup());

  it.each(LOCALES)("%s: every string is translated", (locale) => {
    state.locale = locale;
    const { container } = render(<MyReferrals dashboard={dashboard} />);
    expect(container.textContent).not.toContain("MISSING");
    expect(container.textContent).toContain("AARON");
    expect(container.textContent).toContain("120");
    expect(container.textContent).toContain("Café Lumière");
  });

  it("shows the owner's sales-page report and the commission behind each payment", () => {
    state.locale = "en";
    const { container } = render(<MyReferrals dashboard={dashboard} />);
    const text = container.textContent ?? "";
    expect(text).toContain("Your sales pages");
    expect(text).toContain("3.3%"); // sign-up rate 4 / 120
    expect(text).toContain("11.7%"); // button click rate 14 / 120
    expect(text).toContain("Credited to you: 3 sign-ups");
    expect(text).toContain("Commission details");
    expect(text).toContain("Café Lumière");
    expect(text).toMatch(/On hold until/);
    // The range tabs link to the same page.
    expect(container.querySelector('a[href="/admin/my-referrals?range=7"]')).not.toBeNull();
  });

  it.each(LOCALES)("%s: a viewer sees the partner's page read-only", (locale) => {
    state.locale = locale;
    const { container } = render(
      <MyReferrals
        dashboard={dashboard}
        readOnly
        partnerId="aaron"
        choices={[
          { id: "aaron", displayName: "Aaron" },
          { id: "bob", displayName: "Bob" },
        ]}
      />
    );
    const text = container.textContent ?? "";
    expect(text).not.toContain("MISSING");
    expect(text).toMatch(/Aaron/);
    expect(container.querySelector('[role="combobox"]')?.hasAttribute("disabled")).toBe(true);
    // The range links keep the partner being viewed.
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/admin/my-referrals?range=7&partner=aaron");
  });

  it.each(LOCALES)("%s: asks the partner for their bank details, shows them masked once saved", (locale) => {
    state.locale = locale;
    const empty = render(
      <MyReferrals dashboard={dashboard} bankDetails={{ details: null, updatedAt: null, unreadable: false }} />
    );
    expect(empty.container.textContent).not.toContain("MISSING");
    expect(empty.container.querySelector("#bank-accountNumber")).not.toBeNull();
    empty.unmount();

    const saved = render(
      <MyReferrals
        dashboard={dashboard}
        bankDetails={{
          details: { accountHolder: "Aaron Vichard", bankName: "BNP", accountNumber: "FR76 3000 6000 0112 3456 7890 189", swift: "" },
          updatedAt: "2026-10-20T10:00:00.000Z",
          unreadable: false,
        }}
      />
    );
    expect(saved.container.textContent).toContain("•••• 0189");
    expect(saved.container.textContent).not.toContain("FR76 3000");
  });

  it("a read-only viewer never gets the bank details card", () => {
    state.locale = "en";
    const { container } = render(
      <MyReferrals
        dashboard={dashboard}
        readOnly
        bankDetails={{ details: { accountHolder: "A", bankName: "B", accountNumber: "123456", swift: "" }, updatedAt: null, unreadable: false }}
      />
    );
    expect(container.textContent).not.toContain("Payout details");
  });

  it("builds the referral link and one tagged link per channel", () => {
    state.locale = "en";
    const { container } = render(<MyReferrals dashboard={dashboard} />);
    const codes = Array.from(container.querySelectorAll("code")).map((c) => c.textContent);
    expect(codes).toContain(`${window.location.origin}/register?ref=AARON`);
    expect(codes).toContain(
      `${window.location.origin}/register?ref=AARON&utm_source=whatsapp&utm_medium=referral`
    );
    expect(codes).toContain(`${window.location.origin}/en/sales-page-2`);
  });
});
