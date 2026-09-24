import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { StoreOverview } from "@/types/api/store-overview";
import { LAST_VISITED_BACK_OFFICE_COOKIE, LAST_VISITED_POS_COOKIE } from "@/lib/last-visited";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, intlLocale: "en-US" }),
}));
const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));
const defaultLanding = vi.hoisted(() => ({ current: "dashboard" }));
vi.mock("@/features/dashboard/profile/hooks/use-default-landing", () => ({
  useDefaultLanding: () => defaultLanding.current,
}));
vi.mock("../edit-store-dialog", () => ({
  EditStoreDialog: () => null,
}));
vi.mock("../delete-store-dialog", () => ({
  DeleteStoreDialog: () => null,
}));

import { StoreCard } from "../store-card";

const store = {
  id: "store-001",
  businessId: "biz-1",
  name: "Test Store",
  address: null,
  city: "Paris",
  country: "FR",
  phone: null,
  email: null,
  image: null as string | null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function overview(o: Partial<StoreOverview> = {}): StoreOverview {
  return {
    storeId: "store-001",
    tagline: null,
    logoUrl: null,
    coverUrl: null,
    themeColor: null,
    currency: "EUR",
    market: "FRANCE",
    stats: { revenue: 1234.5, customerCount: 12, staffCount: 2 },
    ...o,
  };
}

const card = () => screen.getByRole("link", { name: "Test Store" });

beforeEach(() => {
  localStorage.clear();
  defaultLanding.current = "dashboard";
  routerPush.mockClear();
});

describe("StoreCard — the old POS Cashier chip is gone", () => {
  it.each([
    ["an owner on POS", { currentPlan: "POS" as const }],
    ["an owner on FREE", { currentPlan: "FREE" as const }],
    ["a blocked store", { currentPlan: "ENTERPRISE" as const, isBlocked: true }],
  ])("renders no nav.pos link for %s", (_, props) => {
    render(<StoreCard store={store} {...props} />);
    expect(screen.queryByRole("link", { name: /nav\.pos$/ })).toBeNull();
    expect(screen.queryByText("nav.pos")).toBeNull();
  });

  it("renders no nav.pos link for a staff store", () => {
    render(
      <StoreCard
        store={{ ...store, accessRole: "staff", staffHomePath: "/store/store-001/pos" }}
        currentPlan="ENTERPRISE"
      />
    );
    expect(screen.queryByText("nav.pos")).toBeNull();
  });
});

describe("StoreCard — launch chooser (owner)", () => {
  it("clicking the card opens a dialog named after the store with POS System and Back Office", async () => {
    render(<StoreCard store={store} currentPlan="POS" />);
    // Held on to: once the modal is open, the rest of the page is aria-hidden.
    const link = card();
    expect(link).toHaveAttribute("aria-haspopup", "dialog");
    expect(link).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(link);

    const dialog = await screen.findByRole("dialog", { name: "Test Store" });
    expect(within(dialog).getByRole("link", { name: "nav.posSystem" })).toHaveAttribute(
      "href",
      "/store/store-001/pos"
    );
    expect(within(dialog).getByRole("link", { name: "nav.backOffice" })).toHaveAttribute(
      "href",
      "/store/store-001/dashboard"
    );
    expect(within(dialog).getByText("stores.launch.posDesc")).toBeInTheDocument();
    expect(within(dialog).getByText("stores.launch.backOfficeDesc")).toBeInTheDocument();
    expect(within(dialog).getByText("stores.launch.subtitle")).toBeInTheDocument();
    expect(link).toHaveAttribute("aria-expanded", "true");
  });

  it("the options resume the last POS and Back Office pages of THIS store", async () => {
    localStorage.setItem(LAST_VISITED_POS_COOKIE, "/store/store-001/pos/orders");
    localStorage.setItem(LAST_VISITED_BACK_OFFICE_COOKIE, "/store/store-001/finance");
    render(<StoreCard store={store} currentPlan="POS" />);
    fireEvent.click(card());

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("link", { name: "nav.posSystem" })).toHaveAttribute(
      "href",
      "/store/store-001/pos/orders"
    );
    expect(within(dialog).getByRole("link", { name: "nav.backOffice" })).toHaveAttribute(
      "href",
      "/store/store-001/finance"
    );
  });

  it("ignores resume paths saved for another store", async () => {
    localStorage.setItem(LAST_VISITED_POS_COOKIE, "/store/some-other-store/pos/kds");
    localStorage.setItem(LAST_VISITED_BACK_OFFICE_COOKIE, "/store/some-other-store/finance");
    render(<StoreCard store={store} currentPlan="POS" />);
    fireEvent.click(card());

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("link", { name: "nav.posSystem" })).toHaveAttribute(
      "href",
      "/store/store-001/pos"
    );
    expect(within(dialog).getByRole("link", { name: "nav.backOffice" })).toHaveAttribute(
      "href",
      "/store/store-001/dashboard"
    );
  });

  it("on FREE the POS option is a locked upsell and Back Office gets the focus", async () => {
    render(<StoreCard store={store} currentPlan="FREE" />);
    fireEvent.click(card());

    const dialog = await screen.findByRole("dialog");
    const pos = within(dialog).getByRole("link", { name: "nav.posSystem" });
    expect(pos).toHaveAttribute("href", "/pricing?trial=true#plans");
    expect(pos).toHaveAttribute("data-locked", "true");
    expect(within(pos).getByText("POS")).toBeInTheDocument();
    expect(within(dialog).getByText("stores.launch.posLocked")).toBeInTheDocument();
    expect(within(dialog).queryByText("stores.launch.posDesc")).toBeNull();

    const backOffice = within(dialog).getByRole("link", { name: "nav.backOffice" });
    expect(backOffice).toHaveAttribute("href", "/store/store-001/dashboard");
    await waitFor(() => expect(document.activeElement).toBe(backOffice));
  });

  it.each([
    ["ctrlKey", { ctrlKey: true }],
    ["metaKey", { metaKey: true }],
    ["shiftKey", { shiftKey: true }],
    ["middle button", { button: 1 }],
  ])("a %s click is left to the browser (new tab) and opens no dialog", (_, init) => {
    render(<StoreCard store={store} currentPlan="POS" />);
    // fireEvent returns false when a handler called preventDefault.
    expect(fireEvent.click(card(), init)).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("a plain click is taken over: the browser's navigation is cancelled", () => {
    render(<StoreCard store={store} currentPlan="POS" />);
    expect(fireEvent.click(card())).toBe(false);
  });

  it("the portalled dialog carries the store's brand custom properties itself", async () => {
    render(
      <StoreCard store={store} currentPlan="POS" overview={overview({ themeColor: "#2255AA" })} />
    );
    fireEvent.click(card());

    const dialog = await screen.findByRole("dialog");
    expect(dialog.style.getPropertyValue("--store-brand")).toMatch(/^#[0-9A-F]{6}$/);
    expect(dialog.style.getPropertyValue("--store-brand-ink")).toMatch(/^#(FFFFFF|141210)$/);
  });

  it.each(["nav.posSystem", "nav.backOffice"])(
    "a click on the %s option is not cancelled by the card",
    async (name) => {
      render(<StoreCard store={store} currentPlan="POS" />);
      fireEvent.click(card());

      const dialog = await screen.findByRole("dialog");
      // Without an app router, next/link leaves the event alone, so only a
      // bubbled card handler could cancel it.
      expect(fireEvent.click(within(dialog).getByRole("link", { name }))).toBe(true);
    }
  );

  it.each([
    ["Escape", (dialog: HTMLElement) => fireEvent.keyDown(dialog, { key: "Escape" })],
    [
      "the close button",
      (dialog: HTMLElement) =>
        fireEvent.click(within(dialog).getByRole("button", { name: "Close" })),
    ],
  ])("closing the chooser with %s puts the focus back on the card", async (_, close) => {
    render(<StoreCard store={store} currentPlan="POS" />);
    // Held on to: once the modal is open, the rest of the page is aria-hidden.
    const link = card();
    link.focus();
    fireEvent.click(link);

    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));

    close(dialog);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(link));
    expect(link).toHaveAttribute("aria-expanded", "false");
  });

  it("with default landing 'pos', the card's own href is the POS and the POS option gets the focus", async () => {
    defaultLanding.current = "pos";
    render(<StoreCard store={store} currentPlan="POS" />);
    expect(card()).toHaveAttribute("href", "/store/store-001/pos");

    fireEvent.click(card());
    const dialog = await screen.findByRole("dialog");
    const pos = within(dialog).getByRole("link", { name: "nav.posSystem" });
    await waitFor(() => expect(document.activeElement).toBe(pos));
    // "pos" is not a Back Office page, so Back Office falls back to the dashboard.
    expect(within(dialog).getByRole("link", { name: "nav.backOffice" })).toHaveAttribute(
      "href",
      "/store/store-001/dashboard"
    );
  });

  it("with default landing 'pos' on FREE, the card's href falls back to Back Office", () => {
    defaultLanding.current = "pos";
    render(<StoreCard store={store} currentPlan="FREE" />);
    expect(card()).toHaveAttribute("href", "/store/store-001/dashboard");
  });

  it("with default landing 'storefront', Back Office opens the storefront", async () => {
    defaultLanding.current = "storefront";
    render(<StoreCard store={store} currentPlan="POS" />);
    expect(card()).toHaveAttribute("href", "/store/store-001/storefront");
  });
});

describe("StoreCard — blocked (subscription not active)", () => {
  it("the whole card links to pricing, opens no dialog, and has no owner menu", () => {
    render(<StoreCard store={store} isBlocked currentPlan="ENTERPRISE" />);
    expect(card()).toHaveAttribute("href", "/pricing?reason=subscription_required");
    expect(card()).not.toHaveAttribute("aria-haspopup");

    fireEvent.click(card());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Open menu")).toBeNull();
    expect(screen.getByText("stores.clickToSubscribe")).toBeInTheDocument();
  });

  it("never renders the summary, even with totals in the overview", () => {
    render(
      <StoreCard
        store={store}
        isBlocked
        currentPlan="ENTERPRISE"
        overview={overview({ tagline: "Hidden slogan" })}
      />
    );
    expect(screen.queryByText("stores.summary.revenue")).toBeNull();
    expect(screen.queryByText("€1,234.50")).toBeNull();
    expect(screen.queryByText("stores.summary.market")).toBeNull();
    expect(screen.queryByText("Hidden slogan")).toBeNull();
  });
});

describe("StoreCard — a store the account works at as linked staff", () => {
  const staffStore = {
    ...store,
    accessRole: "staff" as const,
    staffHomePath: "/store/store-001/pos/orders",
  };

  it("is badged as staff and opens the POS page they can reach — no chooser", () => {
    render(<StoreCard store={staffStore} isBlocked={false} currentPlan="ENTERPRISE" />);

    expect(screen.getByText("stores.staffBadge")).toBeInTheDocument();
    expect(card()).toHaveAttribute("href", "/store/store-001/pos/orders");
    expect(card()).not.toHaveAttribute("aria-haspopup");
    fireEvent.click(card());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("offers no owner actions (edit/delete menu)", () => {
    render(<StoreCard store={staffStore} isBlocked={false} currentPlan="ENTERPRISE" />);
    expect(screen.queryByText("Open menu")).toBeNull();
  });

  it("shows the branding and the slogan, market and currency — but never the totals", () => {
    render(
      <StoreCard
        store={staffStore}
        currentPlan="ENTERPRISE"
        overview={overview({ tagline: "Best kopi", logoUrl: "https://img.test/logo.png" })}
      />
    );
    expect(screen.getByTestId("store-avatar-logo")).toHaveAttribute(
      "src",
      "https://img.test/logo.png"
    );
    expect(screen.getByText("Best kopi")).toBeInTheDocument();
    expect(screen.getByText("stores.summary.market")).toBeInTheDocument();
    expect(screen.getByText("EUR")).toBeInTheDocument();
    expect(screen.queryByText("stores.summary.revenue")).toBeNull();
    expect(screen.queryByText("€1,234.50")).toBeNull();
    expect(screen.queryByText("stores.summary.customers")).toBeNull();
  });

  it("an owner's card: no staff badge, edit/delete menu present, Back Office landing", () => {
    render(
      <StoreCard store={{ ...store, accessRole: "owner" }} isBlocked={false} currentPlan="POS" />
    );

    expect(screen.queryByText("stores.staffBadge")).toBeNull();
    expect(screen.getByText("Open menu")).toBeInTheDocument();
    expect(card().getAttribute("href")).toBe("/store/store-001/dashboard");
  });

  it("a role with no POS page: the card says so, links nowhere, and never sends them to pricing", () => {
    render(
      <StoreCard
        store={{ ...staffStore, staffHomePath: null }}
        isBlocked={false}
        currentPlan="ENTERPRISE"
      />
    );

    expect(screen.getByText("stores.staffNoAccessTitle")).toBeInTheDocument();
    expect(screen.getByText("stores.staffNoAccessDesc")).toBeInTheDocument();
    expect(screen.queryByText("stores.clickToSubscribe")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();

    fireEvent.click(screen.getByText("Test Store"));
    expect(routerPush).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("StoreCard — branding and summary", () => {
  it("the cover is the storefront cover when there is one", () => {
    render(
      <StoreCard
        store={{ ...store, image: "https://img.test/store.jpg" }}
        currentPlan="POS"
        overview={overview({ coverUrl: "https://img.test/cover.jpg" })}
      />
    );
    expect(screen.getByTestId("store-cover")).toHaveAttribute("src", "https://img.test/cover.jpg");
  });

  it("the cover falls back to the Store Image, then to the tinted placeholder", () => {
    const { rerender } = render(
      <StoreCard
        store={{ ...store, image: "https://img.test/store.jpg" }}
        currentPlan="POS"
        overview={overview()}
      />
    );
    expect(screen.getByTestId("store-cover")).toHaveAttribute("src", "https://img.test/store.jpg");

    rerender(<StoreCard store={store} currentPlan="POS" overview={overview()} />);
    expect(screen.queryByTestId("store-cover")).toBeNull();
    expect(screen.getByTestId("store-cover-placeholder")).toBeInTheDocument();
  });

  it("before the overview arrives the card still renders from the store row, with a summary skeleton", () => {
    render(
      <StoreCard
        store={{ ...store, image: "https://img.test/store.jpg" }}
        currentPlan="POS"
        overview={null}
        overviewLoading
      />
    );
    expect(screen.getByTestId("store-cover")).toHaveAttribute("src", "https://img.test/store.jpg");
    expect(screen.getByTestId("store-avatar-initial")).toHaveTextContent("T");
    expect(screen.getByTestId("store-card-summary-skeleton")).toBeInTheDocument();
  });

  it("an overview error just leaves the summary out", () => {
    render(<StoreCard store={store} currentPlan="POS" overview={null} overviewLoading={false} />);
    expect(screen.queryByTestId("store-card-summary-skeleton")).toBeNull();
    expect(screen.queryByText("stores.summary.market")).toBeNull();
    expect(card()).toBeInTheDocument();
  });

  it("shows the logo when set, and the initial when it is null or ''", () => {
    const { rerender } = render(
      <StoreCard
        store={store}
        currentPlan="POS"
        overview={overview({ logoUrl: "https://img.test/logo.png" })}
      />
    );
    expect(screen.getByTestId("store-avatar-logo")).toHaveAttribute(
      "src",
      "https://img.test/logo.png"
    );
    expect(screen.queryByTestId("store-avatar-initial")).toBeNull();

    rerender(<StoreCard store={store} currentPlan="POS" overview={overview({ logoUrl: "" })} />);
    expect(screen.queryByTestId("store-avatar-logo")).toBeNull();
    expect(screen.getByTestId("store-avatar-initial")).toHaveTextContent("T");
  });

  it("an owner's card shows the revenue in the store's own currency", () => {
    render(<StoreCard store={store} currentPlan="POS" overview={overview({ tagline: "Hello" })} />);
    expect(screen.getByText("stores.summary.revenue")).toBeInTheDocument();
    expect(screen.getByText("€1,234.50")).toBeInTheDocument();
    expect(screen.getByText("stores.summary.staff")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("the card link is named by the store name alone, not by its figures", () => {
    render(<StoreCard store={store} currentPlan="POS" overview={overview({ tagline: "Hello" })} />);
    expect(screen.getByRole("link", { name: "Test Store" })).toBeInTheDocument();
  });

  it("sets exactly the two brand custom properties on the card root", () => {
    const { container } = render(
      <StoreCard store={store} currentPlan="POS" overview={overview({ themeColor: "#2255AA" })} />
    );
    const root = container.querySelector<HTMLElement>("[data-slot=card]")!;
    expect(root.style.getPropertyValue("--store-brand")).toMatch(/^#[0-9A-F]{6}$/);
    expect(root.style.getPropertyValue("--store-brand-ink")).toMatch(/^#(FFFFFF|141210)$/);
  });
});
