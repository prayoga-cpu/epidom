import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { en } from "@/locales/en";

// ── Mocks ────────────────────────────────────────────────────────────────────

// Real English strings, so the tests read the copy a user reads.
const lookup = (key: string): string => {
  const value = key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined,
      en
    );
  return typeof value === "string" ? value : key;
};
vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: lookup }),
}));

const trackEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics", () => ({ trackEvent }));

const nav = vi.hoisted(() => ({
  search: "",
  pathname: "/store/store-1/dashboard",
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: nav.replace,
    push: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const guide = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("@/features/guide/hooks/use-guide-state", () => ({
  useGuideState: () => guide.current,
}));

import {
  OPEN_TOUR_EVENT,
  WelcomeTour,
  WelcomeTourAutoOpen,
  openWelcomeTour,
} from "../welcome-tour";

// ── Fixtures ─────────────────────────────────────────────────────────────────

function guideState(overrides: Record<string, unknown> = {}) {
  return {
    state: { tourSeenAt: null, dismissedTips: [], dismissedChecklists: [] },
    isLoading: false,
    isReady: true,
    isAvailable: true,
    tourSeen: false,
    isTipDismissed: () => false,
    isChecklistDismissed: () => false,
    dismissTip: vi.fn(),
    markTourSeen: vi.fn(),
    resetTour: vi.fn(),
    restoreTips: vi.fn(),
    dismissChecklist: vi.fn(),
    restoreChecklist: vi.fn(),
    ...overrides,
  };
}

const title = () => screen.getByRole("heading", { level: 2 });
const button = (name: string) => screen.getByRole("button", { name });
const queryDialog = () => screen.queryByRole("dialog");

beforeEach(() => {
  guide.current = guideState();
  nav.search = "";
  nav.pathname = "/store/store-1/dashboard";
});

// ── WelcomeTour ──────────────────────────────────────────────────────────────

describe("WelcomeTour", () => {
  it("walks the four cards with Next and Back, then Done marks it seen as completed", () => {
    const onOpenChange = vi.fn();
    render(<WelcomeTour open onOpenChange={onOpenChange} />);

    expect(title()).toHaveTextContent("Epidom has three spaces");
    expect(screen.getByText("1 of 4")).toBeInTheDocument();
    expect(button("Back")).toBeDisabled();

    fireEvent.click(button("Next"));
    expect(title()).toHaveTextContent("Storefront");
    fireEvent.click(button("Back"));
    expect(title()).toHaveTextContent("Epidom has three spaces");

    fireEvent.click(button("Next"));
    fireEvent.click(button("Next"));
    expect(title()).toHaveTextContent("POS Mode");
    fireEvent.click(button("Next"));
    expect(title()).toHaveTextContent("Back Office");
    expect(screen.getByText("4 of 4")).toBeInTheDocument();
    // Last card: Done replaces Next, and Skip steps aside.
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();

    fireEvent.click(button("Done"));
    const { markTourSeen } = guide.current as { markTourSeen: ReturnType<typeof vi.fn> };
    expect(markTourSeen).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith("tour_completed", { step: 4 });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Skip marks the tour seen and reports the card it was skipped on", () => {
    const onOpenChange = vi.fn();
    render(<WelcomeTour open onOpenChange={onOpenChange} />);

    fireEvent.click(button("Next"));
    fireEvent.click(button("Skip"));

    const { markTourSeen } = guide.current as { markTourSeen: ReturnType<typeof vi.fn> };
    expect(markTourSeen).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith("tour_skipped", { step: 2 });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Escape counts as skipping", () => {
    const onOpenChange = vi.fn();
    render(<WelcomeTour open onOpenChange={onOpenChange} />);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    const { markTourSeen } = guide.current as { markTourSeen: ReturnType<typeof vi.fn> };
    expect(markTourSeen).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith("tour_skipped", { step: 1 });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("pages with the arrow keys and stops at both ends", () => {
    render(<WelcomeTour open onOpenChange={vi.fn()} />);
    const dialog = screen.getByRole("dialog");

    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(title()).toHaveTextContent("Epidom has three spaces");
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(title()).toHaveTextContent("Storefront");
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(title()).toHaveTextContent("Back Office");
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(title()).toHaveTextContent("POS Mode");
    // Arrows never finish the tour.
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("jumps to a card from its dot, which reports the current step", () => {
    render(<WelcomeTour open onOpenChange={vi.fn()} />);

    fireEvent.click(button("Go to step 3"));
    expect(title()).toHaveTextContent("POS Mode");
    expect(button("Go to step 3")).toHaveAttribute("aria-current", "step");
    expect(button("Go to step 1")).not.toHaveAttribute("aria-current");
  });

  it("names each space's plan the way the entitlements gate it", () => {
    render(<WelcomeTour open onOpenChange={vi.fn()} />);

    fireEvent.click(button("Go to step 2"));
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(
      screen.getByText(/Online orders from the page come with the POS plan/)
    ).toBeInTheDocument();

    fireEvent.click(button("Go to step 3"));
    expect(screen.getByText("POS · 14-day free trial")).toBeInTheDocument();
    for (const tab of ["POS Cashier", "Order Queue", "Kitchen & Bar", "Tables"]) {
      expect(screen.getByText(tab)).toBeInTheDocument();
    }
    for (const tab of ["Shift", "My Schedule", "Team Schedule", "Clock In / Out"]) {
      expect(screen.getByText(tab)).toBeInTheDocument();
    }

    fireEvent.click(button("Go to step 4"));
    const row = (label: string) => screen.getByText(label).closest("li")!;
    expect(row("Menu — in Storefront")).toHaveTextContent("Free");
    expect(row("Stock & supplier orders")).toHaveTextContent("Operations");
    expect(row("Staff & schedules")).toHaveTextContent("Operations");
    // Finance moved to Operations.
    expect(row("Shifts & finance reports")).toHaveTextContent("Operations");
    // Never promises the checklist: the tour also opens where it isn't shown
    // (an established store, a hidden checklist, a cashier persona).
    expect(
      screen.getByText(
        "Help, at the bottom of the sidebar, has guides and brings this tour back any time."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/checklist/i)).toBeNull();
  });

  it("starts again on the first card every time it opens", () => {
    const { rerender } = render(<WelcomeTour open onOpenChange={vi.fn()} />);
    fireEvent.click(button("Next"));
    fireEvent.click(button("Next"));
    expect(title()).toHaveTextContent("POS Mode");

    rerender(<WelcomeTour open={false} onOpenChange={vi.fn()} />);
    rerender(<WelcomeTour open onOpenChange={vi.fn()} />);
    expect(title()).toHaveTextContent("Epidom has three spaces");
  });
});

// ── WelcomeTourAutoOpen ──────────────────────────────────────────────────────

describe("WelcomeTourAutoOpen", () => {
  it("opens for the owner of a new store who hasn't seen the tour", () => {
    render(<WelcomeTourAutoOpen isOwner isNewStore />);
    expect(queryDialog()).toBeInTheDocument();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("stays closed once the tour was seen", () => {
    guide.current = guideState({ tourSeen: true });
    render(<WelcomeTourAutoOpen isOwner isNewStore />);
    expect(queryDialog()).toBeNull();
  });

  it("stays closed for a staff persona", () => {
    render(<WelcomeTourAutoOpen isOwner={false} isNewStore />);
    expect(queryDialog()).toBeNull();
  });

  it("stays closed on an established store without ?tour=1", () => {
    render(<WelcomeTourAutoOpen isOwner isNewStore={false} />);
    expect(queryDialog()).toBeNull();
  });

  it("waits for the guide state, and never opens when it was refused", () => {
    guide.current = guideState({ isReady: false, isLoading: true });
    const { rerender } = render(<WelcomeTourAutoOpen isOwner isNewStore />);
    expect(queryDialog()).toBeNull();

    guide.current = guideState({ isAvailable: false });
    rerender(<WelcomeTourAutoOpen isOwner isNewStore />);
    expect(queryDialog()).toBeNull();

    guide.current = guideState();
    rerender(<WelcomeTourAutoOpen isOwner isNewStore />);
    expect(queryDialog()).toBeInTheDocument();
  });

  it("opens on ?tour=1 and removes only that param", () => {
    nav.search = "tour=1&range=7d";
    render(<WelcomeTourAutoOpen isOwner isNewStore={false} />);
    expect(queryDialog()).toBeInTheDocument();
    expect(nav.replace).toHaveBeenCalledWith("/store/store-1/dashboard?range=7d", {
      scroll: false,
    });
  });

  it("opens once: finishing it doesn't bring it back in the same visit", () => {
    render(<WelcomeTourAutoOpen isOwner isNewStore />);
    fireEvent.click(button("Skip"));
    expect(queryDialog()).toBeNull();
  });

  // Help → Replay the welcome tour lands here with ?tour=1 — someone asking for
  // a replay has, by definition, already seen it.
  it("?tour=1 replays a tour the owner has already seen, and removes the param", () => {
    guide.current = guideState({ tourSeen: true });
    nav.search = "tour=1";
    render(<WelcomeTourAutoOpen isOwner isNewStore={false} />);
    expect(queryDialog()).toBeInTheDocument();
    expect(title()).toHaveTextContent("Epidom has three spaces");
    expect(nav.replace).toHaveBeenCalledWith("/store/store-1/dashboard", { scroll: false });
  });

  it("?tour=1 opens for a staff persona who reached the dashboard (Manager, Cashier)", () => {
    guide.current = guideState({ tourSeen: true });
    nav.search = "tour=1";
    render(<WelcomeTourAutoOpen isOwner={false} isNewStore={false} />);
    expect(queryDialog()).toBeInTheDocument();
    expect(nav.replace).toHaveBeenCalledWith("/store/store-1/dashboard", { scroll: false });
  });

  it("?tour=1 doesn't wait for, or depend on, the guide state", () => {
    guide.current = guideState({ isReady: false, isLoading: true });
    nav.search = "tour=1";
    const { unmount } = render(<WelcomeTourAutoOpen isOwner isNewStore={false} />);
    expect(queryDialog()).toBeInTheDocument();
    unmount();

    guide.current = guideState({ isAvailable: false });
    render(<WelcomeTourAutoOpen isOwner={false} isNewStore={false} />);
    expect(queryDialog()).toBeInTheDocument();
  });

  it("?tour=1 opens once per ask: closing it before the URL catches up doesn't reopen it", () => {
    nav.search = "tour=1";
    const { rerender } = render(<WelcomeTourAutoOpen isOwner={false} isNewStore={false} />);
    fireEvent.click(button("Skip"));
    // The param is still in the (mocked) URL.
    rerender(<WelcomeTourAutoOpen isOwner={false} isNewStore={false} />);
    expect(queryDialog()).toBeNull();

    // The param went, then a new ask arrived on the same mounted page.
    nav.search = "";
    rerender(<WelcomeTourAutoOpen isOwner={false} isNewStore={false} />);
    expect(queryDialog()).toBeNull();
    nav.search = "tour=1";
    rerender(<WelcomeTourAutoOpen isOwner={false} isNewStore={false} />);
    expect(queryDialog()).toBeInTheDocument();
  });

  it("a replayed tour doesn't open again by itself once closed (new store)", () => {
    nav.search = "tour=1";
    const { rerender } = render(<WelcomeTourAutoOpen isOwner isNewStore />);
    fireEvent.click(button("Skip"));
    nav.search = "";
    rerender(<WelcomeTourAutoOpen isOwner isNewStore />);
    expect(queryDialog()).toBeNull();
  });

  it("opens on the epidom:open-tour event, for anyone, even after it was seen", () => {
    guide.current = guideState({ tourSeen: true });
    render(<WelcomeTourAutoOpen isOwner={false} isNewStore={false} />);
    expect(queryDialog()).toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent("epidom:open-tour"));
    });
    expect(queryDialog()).toBeInTheDocument();
    expect(title()).toHaveTextContent("Epidom has three spaces");
  });

  it("claims the event, so Help knows the tour opened in place", () => {
    render(<WelcomeTourAutoOpen isOwner={false} isNewStore={false} />);
    let notCanceled = true;
    act(() => {
      notCanceled = window.dispatchEvent(new CustomEvent(OPEN_TOUR_EVENT, { cancelable: true }));
    });
    expect(notCanceled).toBe(false);
    expect(queryDialog()).toBeInTheDocument();
  });

  it("openWelcomeTour() dispatches the same event, and says whether a tour took it", () => {
    expect(OPEN_TOUR_EVENT).toBe("epidom:open-tour");
    // No tour mounted: nobody claims it.
    expect(openWelcomeTour()).toBe(false);

    render(<WelcomeTourAutoOpen isOwner={false} isNewStore={false} />);
    let claimed = false;
    act(() => {
      claimed = openWelcomeTour();
    });
    expect(claimed).toBe(true);
    expect(queryDialog()).toBeInTheDocument();
  });
});
