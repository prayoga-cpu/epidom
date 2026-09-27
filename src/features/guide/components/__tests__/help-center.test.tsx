import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type React from "react";
import type { ReleaseDTO } from "@/lib/services/changelog.service";
import { getDocsGuides } from "@/features/marketing/docs/content";

const i18n = vi.hoisted(() => ({ locale: "en" as "en" | "fr" | "id" }));
vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key, locale: i18n.locale, intlLocale: "en-US" }),
}));

const nav = vi.hoisted(() => ({ push: vi.fn(), pathname: "/store/s1/help" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push }),
  usePathname: () => nav.pathname,
}));

const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

vi.mock("@/features/dashboard/feedback/components/feedback-dialog", () => ({
  FeedbackDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="feedback-dialog" /> : null,
}));

const guide = vi.hoisted(() => ({
  dismissedTips: [] as string[],
  dismissedChecklists: [] as string[],
  restoreTips: vi.fn(),
  restoreChecklist: vi.fn(),
}));
vi.mock("../../hooks/use-guide-state", () => ({
  useGuideState: () => ({
    state: {
      tourSeenAt: null,
      dismissedTips: guide.dismissedTips,
      dismissedChecklists: guide.dismissedChecklists,
    },
    isChecklistDismissed: (storeId: string) => guide.dismissedChecklists.includes(storeId),
    restoreTips: guide.restoreTips,
    restoreChecklist: guide.restoreChecklist,
  }),
}));

import { HelpCenter, type HelpCenterProps } from "../help-center";

const RELEASES: ReleaseDTO[] = [
  {
    version: "3.3.0",
    releasedAt: "2026-09-27T00:00:00.000Z",
    tag: "feat",
    items: ["Help centre", "Page tips", "Guides"],
  },
  { version: "3.2.0", releasedAt: "2026-09-26T00:00:00.000Z", tag: "fix", items: ["A fix"] },
  { version: "3.1.1", releasedAt: "2026-09-25T00:00:00.000Z", tag: "ux", items: ["Polish"] },
];

function renderHelp(props: Partial<HelpCenterProps> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui: React.ReactElement = (
    <QueryClientProvider client={client}>
      <HelpCenter context="backoffice" storeId="s1" canManage releases={RELEASES} {...props} />
    </QueryClientProvider>
  );
  return render(ui);
}

const section = (name: string) => screen.getByRole("region", { name }) as HTMLElement;

let replaceState: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  i18n.locale = "en";
  nav.push.mockReset();
  nav.pathname = "/store/s1/help";
  toast.success.mockReset();
  guide.dismissedTips = [];
  guide.dismissedChecklists = [];
  guide.restoreTips.mockReset();
  guide.restoreChecklist.mockReset();
  replaceState = vi.spyOn(window.history, "replaceState");
});

afterEach(() => {
  replaceState.mockRestore();
  vi.unstubAllGlobals();
});

describe("HelpCenter — Back Office page", () => {
  it("has the four sections", () => {
    renderHelp();
    expect(screen.getByRole("heading", { level: 1, name: "helpCenter.title" })).toBeInTheDocument();
    for (const name of [
      "helpCenter.gettingStarted.title",
      "helpCenter.guides.title",
      "helpCenter.whatsNew.title",
      "helpCenter.contact.title",
    ]) {
      expect(section(name)).toBeInTheDocument();
    }
  });

  it("What's new: the latest releases from the server, and a link to the changelog", () => {
    renderHelp();
    const whatsNew = section("helpCenter.whatsNew.title");
    expect(within(whatsNew).getByText("3.3.0")).toBeInTheDocument();
    expect(within(whatsNew).getByText("3.1.1")).toBeInTheDocument();
    // Two bullets per release, then "+N more".
    expect(within(whatsNew).queryByText("Guides")).toBeNull();
    expect(within(whatsNew).getByText("helpCenter.whatsNew.moreItems")).toBeInTheDocument();
    expect(within(whatsNew).getByRole("link", { name: /seeAll/ })).toHaveAttribute(
      "href",
      "/store/s1/changelog"
    );
  });

  it("Contact: WhatsApp for the market and the feedback form", () => {
    i18n.locale = "fr";
    renderHelp();
    const contact = section("helpCenter.contact.title");
    const whatsapp = within(contact).getAllByRole("link");
    expect(whatsapp).toHaveLength(1);
    expect(whatsapp[0].getAttribute("href")).toMatch(/^https:\/\/wa\.me\/33781732386\?text=/);
    expect(whatsapp[0]).toHaveAttribute("target", "_blank");

    fireEvent.click(within(contact).getByRole("button", { name: /helpCenter\.contact\.feedback/ }));
    expect(screen.getByTestId("feedback-dialog")).toBeInTheDocument();
  });

  it("Contact in English offers both markets' numbers", () => {
    renderHelp();
    const hrefs = within(section("helpCenter.contact.title"))
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs.some((h) => h?.includes("33781732386"))).toBe(true);
    expect(hrefs.some((h) => h?.includes("6285156329091"))).toBe(true);
  });
});

describe("HelpCenter — guide reader", () => {
  const guides = getDocsGuides("en");

  it("list → article → back, keeping ?guide= in the URL in step", () => {
    renderHelp();
    const target = guides.find((g) => g.slug === "stock-and-supplier-orders")!;

    fireEvent.click(screen.getByRole("button", { name: new RegExp(target.title) }));

    const article = screen.getByRole("article", { name: target.title });
    // The body comes from the shared docs renderer.
    expect(
      within(article).getByText(target.blocks[0].type === "p" ? target.blocks[0].text : "")
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "helpCenter.guides.title" })).toBeNull();
    expect(replaceState).toHaveBeenLastCalledWith(
      null,
      "",
      expect.stringContaining("guide=stock-and-supplier-orders")
    );

    fireEvent.click(screen.getAllByRole("button", { name: /helpCenter\.guides\.back/ })[0]);

    expect(screen.queryByRole("article")).toBeNull();
    expect(section("helpCenter.guides.title")).toBeInTheDocument();
    expect(replaceState).toHaveBeenLastCalledWith(null, "", expect.not.stringContaining("guide="));
  });

  it("opens straight on a deep-linked guide", () => {
    renderHelp({ initialGuideSlug: "hardware-printers-and-scanner" });
    const target = guides.find((g) => g.slug === "hardware-printers-and-scanner")!;
    expect(screen.getByRole("article", { name: target.title })).toBeInTheDocument();
  });

  it("a link made in another language opens the viewer's version", () => {
    renderHelp({ initialGuideSlug: "materiel-imprimantes-et-scanner" });
    const target = guides.find((g) => g.slug === "hardware-printers-and-scanner")!;
    expect(screen.getByRole("article", { name: target.title })).toBeInTheDocument();
  });

  it("an unknown ?guide= says so and shows the list", () => {
    renderHelp({ initialGuideSlug: "no-such-guide" });
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("helpCenter.guides.notFound");
    expect(
      screen.getAllByRole("button", { name: new RegExp(guides[0].title) }).length
    ).toBeGreaterThan(0);
  });

  it("lists every guide once in the Back Office", () => {
    renderHelp();
    const list = within(section("helpCenter.guides.title"));
    for (const g of guides)
      expect(list.getByRole("button", { name: new RegExp(g.title) })).toBeInTheDocument();
  });
});

describe("HelpCenter — getting started", () => {
  it("Replay the tour: navigates to the dashboard asking for the tour", () => {
    renderHelp();
    fireEvent.click(screen.getByRole("button", { name: /replayTour/ }));
    expect(nav.push).toHaveBeenCalledWith("/store/s1/dashboard?tour=1");
  });

  it("Replay the tour where a tour is mounted: it claims the event and opens in place, no navigation", () => {
    nav.pathname = "/store/s1/dashboard";
    // What the dashboard's WelcomeTourAutoOpen does with the event.
    const listener = vi.fn((event: Event) => event.preventDefault());
    window.addEventListener("epidom:open-tour", listener);
    renderHelp();
    fireEvent.click(screen.getByRole("button", { name: /replayTour/ }));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(nav.push).not.toHaveBeenCalled();
    window.removeEventListener("epidom:open-tour", listener);
  });

  it("Replay the tour on the dashboard while no tour is mounted: falls back to ?tour=1", () => {
    nav.pathname = "/store/s1/dashboard";
    renderHelp();
    fireEvent.click(screen.getByRole("button", { name: /replayTour/ }));
    expect(nav.push).toHaveBeenCalledWith("/store/s1/dashboard?tour=1");
  });

  it("Show page tips again: restores the tips and says so", () => {
    guide.dismissedTips = ["stock", "finance"];
    renderHelp();
    const row = screen.getByRole("button", { name: /showTips/ });
    expect(row).toBeEnabled();
    fireEvent.click(row);
    expect(guide.restoreTips).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("helpCenter.gettingStarted.tipsRestored");
  });

  it("Show page tips again is disabled while no tip is hidden", () => {
    renderHelp();
    expect(screen.getByRole("button", { name: /showTips/ })).toBeDisabled();
    expect(screen.getByText("helpCenter.gettingStarted.noTipsHidden")).toBeInTheDocument();
  });

  it("the setup checklist: owner/manager only, and a hidden one is brought back", () => {
    guide.dismissedChecklists = ["s1"];
    renderHelp();
    const link = screen.getByRole("link", { name: /openChecklist/ });
    expect(link).toHaveAttribute("href", "/store/s1/dashboard?checklist=1");
    link.addEventListener("click", (e) => e.preventDefault(), { once: true });
    fireEvent.click(link);
    expect(guide.restoreChecklist).toHaveBeenCalledWith("s1");
  });

  it("a Cashier persona gets no checklist, and no tour where the dashboard is closed to them", () => {
    renderHelp({ canManage: false, canOpenDashboard: false });
    expect(screen.queryByRole("link", { name: /openChecklist/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /replayTour/ })).toBeNull();
    // Tips are the viewer's own — always offered.
    expect(screen.getByRole("button", { name: /showTips/ })).toBeInTheDocument();
  });
});

describe("HelpCenter — POS Mode sheet", () => {
  function stubChangelog(releases: ReleaseDTO[] = RELEASES) {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { releases } }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("lists the till's guides first", () => {
    stubChangelog();
    renderHelp({ context: "pos", releases: undefined, canManage: false });
    const tillGroup = screen.getByRole("list", { name: "helpCenter.guides.forTheTill" });
    const first = within(tillGroup).getAllByRole("button")[0];
    expect(first).toHaveTextContent("POS Mode: the POS System and the Operational page");
    expect(screen.getByRole("list", { name: "helpCenter.guides.moreGuides" })).toBeInTheDocument();
  });

  it("reads What's new from the public changelog, with no changelog link for a cashier", async () => {
    const fetchMock = stubChangelog();
    renderHelp({ context: "pos", releases: undefined, canManage: false });
    expect(await screen.findByText("3.3.0")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/public/changelog");
    expect(screen.queryByRole("link", { name: /seeAll/ })).toBeNull();
  });

  it("a cashier gets neither the tour nor the checklist (both live in Back Office)", () => {
    stubChangelog();
    renderHelp({ context: "pos", releases: undefined, canManage: false });
    expect(screen.queryByRole("button", { name: /replayTour/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /openChecklist/ })).toBeNull();
  });

  it("an owner/manager replays the tour on the dashboard and the sheet closes", async () => {
    stubChangelog();
    const onNavigate = vi.fn();
    renderHelp({ context: "pos", releases: undefined, canManage: true, onNavigate });
    fireEvent.click(screen.getByRole("button", { name: /replayTour/ }));
    expect(onNavigate).toHaveBeenCalled();
    expect(nav.push).toHaveBeenCalledWith("/store/s1/dashboard?tour=1");
    await waitFor(() => expect(screen.getByRole("link", { name: /seeAll/ })).toBeInTheDocument());
  });

  it("never touches the URL of the till page underneath", () => {
    stubChangelog();
    renderHelp({ context: "pos", releases: undefined });
    const target = getDocsGuides("en")[0];
    fireEvent.click(screen.getAllByRole("button", { name: new RegExp(target.title) })[0]);
    expect(screen.getByRole("article", { name: target.title })).toBeInTheDocument();
    expect(replaceState).not.toHaveBeenCalled();
  });
});
