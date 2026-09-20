import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, intlLocale: "en", dateLocale: undefined }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/components/ui/date-range-field", () => ({ DateRangeField: () => <div /> }));
vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return {
    ...actual,
    apiClient: {
      get: vi.fn(async (url: string) =>
        url.endsWith("/schedule-shifts") ? { scheduleShifts: [] } : { schedules: [] }
      ),
      post: vi.fn(),
    },
  };
});

// The switch is what is under test, not the screens it chooses between.
vi.mock("../schedule-image-panel", () => ({
  ScheduleImagePanel: ({ rangeFrom, rangeTo }: { rangeFrom: string; rangeTo: string }) => (
    <p>
      IMAGE PANEL {rangeFrom} {rangeTo}
    </p>
  ),
}));
vi.mock("../schedule-log", () => ({ ScheduleLog: () => <p>LOG</p> }));
vi.mock("../my-schedule-list", () => ({ MyScheduleList: () => <p>MY SCHEDULE</p> }));
vi.mock("../schedule-grid-filters", () => ({ ScheduleGridFilters: () => <p>GRID FILTERS</p> }));
vi.mock("../schedule-shift-blocks-dialog", () => ({ ScheduleShiftBlocksDialog: () => null }));
vi.mock("../apply-shift-template-dialog", () => ({ ApplyShiftTemplateDialog: () => null }));
vi.mock("../staff-schedule-cell-dialog", () => ({ StaffScheduleCellDialog: () => null }));
vi.mock("../schedule-day-detail-dialog", () => ({ ScheduleDayDetailDialog: () => null }));

import { ScheduleClient } from "../schedule-client";

const STAFF = [{ id: "clstaff000000000000000001", name: "Sam", role: "CASHIER" as const }];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <ScheduleClient storeId="s1" staff={STAFF} canManage viewerStaffMemberId={null} />
    </QueryClientProvider>
  );
}

const pickImageView = () =>
  fireEvent.mouseDown(screen.getByRole("tab", { name: "pages.scheduleViewImage" }), { button: 0 });

beforeEach(() => localStorage.clear());

describe("ScheduleClient — shift blocks or a schedule image", () => {
  it("opens on the shift blocks: the grid and its controls, no image panel", () => {
    renderPage();

    expect(screen.getByRole("button", { name: /pages\.scheduleManageBlocks/ })).toBeInTheDocument();
    expect(screen.getByText("GRID FILTERS")).toBeInTheDocument();
    expect(screen.queryByText(/IMAGE PANEL/)).toBeNull();
  });

  it("choosing the image swaps the grid for the panel — for the range on screen — and hides the blocks-only controls", () => {
    renderPage();
    pickImageView();

    expect(screen.getByText(/IMAGE PANEL \d{4}-\d{2}-\d{2} \d{4}-\d{2}-\d{2}/)).toBeInTheDocument();
    expect(screen.queryByText("GRID FILTERS")).toBeNull();
    // Manage blocks / Apply template / Publish Week mean nothing for an image.
    expect(screen.queryByRole("button", { name: /pages\.scheduleManageBlocks/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /pages\.scheduleApplyTemplate/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /pages\.schedulePublishWeek/ })).toBeNull();
  });

  it("keeps the range navigation and the attendance log in both modes", () => {
    renderPage();
    pickImageView();

    // Same dates either way: this is how the image knows what it covers.
    expect(screen.getByRole("button", { name: "pages.scheduleToday" })).toBeInTheDocument();
    expect(screen.getByText("LOG")).toBeInTheDocument();
  });

  it("can switch back to the blocks", () => {
    renderPage();
    pickImageView();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "pages.scheduleViewBlocks" }), {
      button: 0,
    });

    expect(screen.getByText("GRID FILTERS")).toBeInTheDocument();
    expect(screen.queryByText(/IMAGE PANEL/)).toBeNull();
  });

  it("remembers the choice on this device", async () => {
    const first = renderPage();
    pickImageView();
    expect(localStorage.getItem("epidom-schedule-view")).toBe("image");
    first.unmount();

    renderPage();
    expect(await screen.findByText(/IMAGE PANEL/)).toBeInTheDocument();
  });

  it("blocked storage just means 'blocks' — it never breaks the page", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderPage();

    expect(screen.getByText("GRID FILTERS")).toBeInTheDocument();
    pickImageView();
    expect(screen.getByText(/IMAGE PANEL/)).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
