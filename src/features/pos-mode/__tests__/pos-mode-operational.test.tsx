/**
 * The POS Operational page's tabs: which one is open (from ?tab=), what a tap
 * does to the URL, and which panels stay mounted while hidden.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

const search = vi.hoisted(() => ({ params: new URLSearchParams() }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => search.params,
  usePathname: () => "/store/s1/pos/operational",
  useRouter: () => router,
}));

vi.mock("@/features/pos/components/shift/shift-page", () => ({
  ShiftPage: () => <div data-testid="shift-panel" />,
}));
vi.mock("@/features/dashboard/schedule/components/published-roster", () => ({
  PublishedRoster: (props: { viewerKey: string; backOfficeHref?: string; staff: unknown[] }) => (
    <div
      data-testid="roster-panel"
      data-viewer={props.viewerKey}
      data-edit-href={props.backOfficeHref}
      data-staff={props.staff.length}
    />
  ),
}));
vi.mock("@/features/dashboard/schedule/components/my-schedule-list", () => ({
  MyScheduleList: (props: { embedded?: boolean; onClockInOut?: () => void }) => (
    <div data-testid="schedule-panel" data-embedded={String(!!props.embedded)}>
      {props.onClockInOut && <button onClick={props.onClockInOut}>schedule-clock</button>}
    </div>
  ),
}));
const clockLifecycle = vi.hoisted(() => ({ mounts: 0, unmounts: 0 }));
vi.mock("@/features/dashboard/shared/clock-in-out-panel", async () => {
  const { useEffect } = await import("react");
  return {
    ClockInOutPanel: () => {
      useEffect(() => {
        clockLifecycle.mounts++;
        return () => {
          clockLifecycle.unmounts++;
        };
      }, []);
      return <div data-testid="clock-panel" />;
    },
  };
});

import { PosModeOperational } from "../pos-mode-operational";
import { usePosSession } from "@/features/pos/hooks/use-pos-session";
import type { OperationalTab } from "../lib/operational-tabs";

const ALL: OperationalTab[] = ["shift", "schedule", "clock"];

function renderPage(tabs: OperationalTab[] = ALL, query = "") {
  search.params = new URLSearchParams(query);
  return render(
    <PosModeOperational
      storeId="s1"
      tabs={tabs}
      scheduleStaffMemberId="staff-1"
      renderedFor="staff-1"
      rosterStaff={[]}
    />
  );
}

/** Radix tabs activate on mousedown. */
const tapTab = (name: string) =>
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 });
const selected = () => screen.getByRole("tab", { selected: true }).textContent;

let replaceState: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  router.refresh.mockReset();
  usePosSession.setState({ staffId: "staff-1" });
  clockLifecycle.mounts = 0;
  clockLifecycle.unmounts = 0;
  replaceState = vi.spyOn(window.history, "replaceState");
});
afterEach(() => {
  replaceState.mockRestore();
});

describe("PosModeOperational — which tab is open", () => {
  it("opens the first tab the persona has, labelled by its feature", () => {
    renderPage();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "pos.shift.title",
      "pages.scheduleMyScheduleTitle",
      "clockInOut.dialogTitle",
    ]);
    expect(selected()).toBe("pos.shift.title");
    expect(screen.getByRole("tablist", { name: "pos.operational.tabsLabel" })).toBeInTheDocument();
  });

  it("opens the tab named in ?tab= — the shift chip and old links land on theirs", () => {
    renderPage(ALL, "tab=clock");
    expect(selected()).toBe("clockInOut.dialogTitle");
  });

  it("falls back to the persona's first tab for one it doesn't have (kitchen following a Shift link)", () => {
    renderPage(["schedule", "clock"], "tab=shift");
    expect(selected()).toBe("pages.scheduleMyScheduleTitle");
    expect(screen.queryByRole("tab", { name: "pos.shift.title" })).toBeNull();
  });

  it("follows the URL on every render, not only the first — a link to another tab of this page still switches it", () => {
    const view = renderPage(ALL, "tab=schedule");
    expect(selected()).toBe("pages.scheduleMyScheduleTitle");
    search.params = new URLSearchParams("tab=shift");
    view.rerender(
      <PosModeOperational
        storeId="s1"
        tabs={ALL}
        scheduleStaffMemberId="staff-1"
        renderedFor="staff-1"
        rosterStaff={[]}
      />
    );
    expect(selected()).toBe("pos.shift.title");
  });

  it("says so when the persona has nothing here", () => {
    renderPage([]);
    expect(screen.getByText("pos.operational.empty")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
  });
});

describe("PosModeOperational — tapping a tab", () => {
  it("rewrites ?tab= in place instead of navigating", () => {
    renderPage();
    tapTab("clockInOut.dialogTitle");
    expect(replaceState).toHaveBeenCalledTimes(1);
    const url = new URL(String(replaceState.mock.calls[0][2]), "http://localhost");
    expect(url.searchParams.get("tab")).toBe("clock");
  });

  it("My Schedule's Clock In / Out button opens the Clock tab, not a second clock", () => {
    renderPage(ALL, "tab=schedule");
    expect(screen.getByTestId("schedule-panel")).toHaveAttribute("data-embedded", "true");
    fireEvent.click(screen.getByText("schedule-clock"));
    const url = new URL(String(replaceState.mock.calls.at(-1)?.[2]), "http://localhost");
    expect(url.searchParams.get("tab")).toBe("clock");
  });

  it("My Schedule offers no clock button when the persona has no Clock tab", () => {
    renderPage(["schedule"], "tab=schedule");
    expect(screen.queryByText("schedule-clock")).toBeNull();
  });
});

describe("PosModeOperational — what stays mounted", () => {
  it("keeps Shift mounted while another tab is open — a half-counted Finish must survive a tab tap", () => {
    renderPage(ALL, "tab=schedule");
    const shift = screen.getByTestId("shift-panel");
    expect(shift).toBeInTheDocument();
    expect(shift.closest('[role="tabpanel"]')).toHaveAttribute("data-state", "inactive");
  });

  it("unmounts Clock In / Out when left, so the camera never keeps running", () => {
    const view = renderPage(ALL, "tab=clock");
    expect(screen.getByTestId("clock-panel")).toBeInTheDocument();
    expect(clockLifecycle.mounts).toBe(1);

    search.params = new URLSearchParams("tab=shift");
    act(() => {
      view.rerender(
        <PosModeOperational
          storeId="s1"
          tabs={ALL}
          scheduleStaffMemberId="staff-1"
          renderedFor="staff-1"
          rosterStaff={[]}
        />
      );
    });
    expect(screen.queryByTestId("clock-panel")).toBeNull();
    expect(clockLifecycle.unmounts).toBe(1);
  });

  it("keeps clear of the home indicator now that the tab bar is gone", () => {
    const { container } = renderPage();
    expect((container.firstElementChild as HTMLElement).className).toContain(
      "pb-[env(safe-area-inset-bottom)]"
    );
  });
});

describe("PosModeOperational — a persona switch the server didn't see", () => {
  const ui = (renderedFor: string) => (
    <PosModeOperational
      storeId="s1"
      tabs={ALL}
      scheduleStaffMemberId="staff-1"
      renderedFor={renderedFor}
      rosterStaff={[]}
    />
  );

  it("asks the server again when the tabs were worked out for someone else", () => {
    // A kitchen persona's tabs, while the device has since switched to the owner.
    usePosSession.setState({ staffId: "owner" });
    search.params = new URLSearchParams();
    render(ui("staff-1"));
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("only once per mismatch — an id the two sides spell differently can't loop", () => {
    usePosSession.setState({ staffId: "owner" });
    search.params = new URLSearchParams();
    const view = render(ui("staff-1"));
    view.rerender(ui("staff-1"));
    view.rerender(ui("staff-1"));
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("leaves it alone when the server rendered for the persona on the device", () => {
    usePosSession.setState({ staffId: "owner" });
    search.params = new URLSearchParams();
    render(ui("owner"));
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

describe("PosModeOperational — the team's published schedule", () => {
  const TEAM = [{ id: "staff-2", name: "Sam", role: "CASHIER" as const }];
  const renderOwner = (query = "", tabs: OperationalTab[] = ["shift", "roster", "clock"]) => {
    search.params = new URLSearchParams(query);
    usePosSession.setState({ staffId: "owner" });
    return render(
      <PosModeOperational
        storeId="s1"
        tabs={tabs}
        scheduleStaffMemberId={null}
        renderedFor="owner"
        rosterStaff={TEAM}
      />
    );
  };

  it("is its own tab, read-only, with a way to edit it in Back Office", () => {
    renderOwner("tab=roster");
    expect(selected()).toBe("pos.operational.rosterTab");
    const panel = screen.getByTestId("roster-panel");
    expect(panel).toHaveAttribute("data-edit-href", "/store/s1/schedule");
    expect(panel).toHaveAttribute("data-staff", "1");
    // Keyed on who is looking, so a persona switch never reads the owner's cached team rows.
    expect(panel).toHaveAttribute("data-viewer", "owner");
  });

  it("an old My Schedule link opens it for the owner, who has no My Schedule", () => {
    renderOwner("tab=schedule");
    expect(selected()).toBe("pos.operational.rosterTab");
  });

  it("but a persona with My Schedule still lands on their own schedule", () => {
    renderOwner("tab=schedule", ["shift", "schedule", "roster", "clock"]);
    expect(selected()).toBe("pages.scheduleMyScheduleTitle");
  });

  it("unmounts when left, so coming back re-reads what was published", () => {
    const view = renderOwner("tab=roster");
    expect(screen.getByTestId("roster-panel")).toBeInTheDocument();
    search.params = new URLSearchParams("tab=shift");
    view.rerender(
      <PosModeOperational
        storeId="s1"
        tabs={["shift", "roster", "clock"]}
        scheduleStaffMemberId={null}
        renderedFor="owner"
        rosterStaff={TEAM}
      />
    );
    expect(screen.queryByTestId("roster-panel")).toBeNull();
  });
});
