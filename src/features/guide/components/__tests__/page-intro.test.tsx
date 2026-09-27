import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type React from "react";
import type { PageIntroId } from "@/lib/guide/contracts";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key, locale: "fr" }),
}));

const guide = vi.hoisted(() => ({
  isReady: true,
  isAvailable: true,
  dismissed: [] as string[],
  dismissTip: vi.fn(),
}));
vi.mock("../../hooks/use-guide-state", () => ({
  useGuideState: () => ({
    isReady: guide.isReady,
    isAvailable: guide.isAvailable,
    isTipDismissed: (id: PageIntroId) => guide.dismissed.includes(id),
    dismissTip: guide.dismissTip,
  }),
}));

// The sheet has its own suite (help-center); here only that Learn more opens it on the right guide.
vi.mock("../help-sheet", () => ({
  HelpSheet: ({ open, initialGuideSlug }: { open: boolean; initialGuideSlug?: string | null }) =>
    open ? <div data-testid="help-sheet" data-guide={initialGuideSlug ?? ""} /> : null,
}));

import { PageIntro } from "../page-intro";

function withClient(ui: React.ReactElement) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  guide.isReady = true;
  guide.isAvailable = true;
  guide.dismissed = [];
  guide.dismissTip.mockReset();
});

describe("PageIntro — when it shows", () => {
  it("shows the page's own title and body", () => {
    withClient(<PageIntro id="stock" storeId="s1" />);
    expect(
      screen.getByRole("heading", { name: "helpCenter.intros.stock.title" })
    ).toBeInTheDocument();
    expect(screen.getByText("helpCenter.intros.stock.body")).toBeInTheDocument();
  });

  it("stays out until the guide state has loaded — no flash of a dismissed card", () => {
    guide.isReady = false;
    const { container } = withClient(<PageIntro id="stock" storeId="s1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("stays out when the server refused the guide state (nothing could be saved)", () => {
    guide.isAvailable = false;
    const { container } = withClient(<PageIntro id="stock" storeId="s1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("stays out once dismissed", () => {
    guide.dismissed = ["stock"];
    const { container } = withClient(<PageIntro id="stock" storeId="s1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing, without throwing, where no QueryClient is mounted", () => {
    const { container } = render(<PageIntro id="stock" storeId="s1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("applies its spacing only when it shows", () => {
    const { container } = withClient(<PageIntro id="stock" storeId="s1" className="mb-4" />);
    expect(container.querySelector("section")).toHaveClass("mb-4");
  });

  it("takes an explicit title and body over the defaults", () => {
    withClient(<PageIntro id="stock" storeId="s1" title="Custom title" body="Custom body" />);
    expect(screen.getByRole("heading", { name: "Custom title" })).toBeInTheDocument();
    expect(screen.getByText("Custom body")).toBeInTheDocument();
  });
});

describe("PageIntro — Got it", () => {
  it.each(["card", "compact"] as const)(
    "%s: dismisses this page's tip, with a 40px target",
    (variant) => {
      withClient(<PageIntro id="kitchen" variant={variant} storeId="s1" />);
      const button = screen.getByRole("button", { name: "helpCenter.pageIntro.gotIt" });
      expect(button).toHaveClass("h-10");
      fireEvent.click(button);
      expect(guide.dismissTip).toHaveBeenCalledWith("kitchen");
    }
  );
});

describe("PageIntro — Learn more", () => {
  it("card: links to the Help page on the guide, in the viewer's language", () => {
    withClient(<PageIntro id="stock" storeId="s1" />);
    const link = screen.getByRole("link", { name: /helpCenter\.pageIntro\.learnMore/ });
    expect(link).toHaveAttribute("href", "/store/s1/help?guide=stock-et-commandes-fournisseurs");
    expect(link).toHaveClass("h-10");
  });

  it("card: a chosen guide overrides the page's default", () => {
    withClient(<PageIntro id="stock" storeId="s1" learnMoreSlug="getting-started" />);
    expect(screen.getByRole("link", { name: /learnMore/ })).toHaveAttribute(
      "href",
      "/store/s1/help?guide=demarrage"
    );
  });

  it("no link for a page with no guide, with learnMoreSlug={null}, or without a store", () => {
    const { unmount } = withClient(<PageIntro id="customers" storeId="s1" />);
    expect(screen.queryByRole("link", { name: /learnMore/ })).toBeNull();
    unmount();

    const second = withClient(<PageIntro id="stock" storeId="s1" learnMoreSlug={null} />);
    expect(screen.queryByRole("link", { name: /learnMore/ })).toBeNull();
    second.unmount();

    withClient(<PageIntro id="stock" />);
    expect(screen.queryByRole("link", { name: /learnMore/ })).toBeNull();
  });

  it("compact (POS Mode): opens the guide in a sheet instead of leaving the till", async () => {
    withClient(<PageIntro id="hardware" variant="compact" storeId="s1" />);
    expect(screen.queryByRole("link", { name: /learnMore/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "helpCenter.pageIntro.learnMore" }));
    // Loaded on first tap (next/dynamic), so it lands a moment later.
    const sheet = await screen.findByTestId("help-sheet", {}, { timeout: 5000 });
    expect(sheet).toHaveAttribute("data-guide", "hardware-printers-and-scanner");
  });
});
