import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({
    t: (k: string) =>
      k === "pages.attendanceDurationHourUnit" ? "h" : k === "pages.attendanceDurationMinuteUnit" ? "m" : k,
    formatDateTime: (d: string) => `DT(${d})`,
    intlLocale: "en-US",
  }),
}));
vi.mock("@/components/ui/date-range-field", () => ({
  DateRangeField: () => <div data-testid="range" />,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } };
});

import { apiClient } from "@/lib/api/client";
const post = vi.mocked(apiClient.post);
import { ScheduleLog } from "../schedule-log";

const get = vi.mocked(apiClient.get);

const STAFF = [{ id: "clstaff000000000000000001", name: "Sam", role: "CASHIER" as const }];

function renderLog(props: { canSeePayroll?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <ScheduleLog storeId="s1" staff={STAFF} {...props} />
    </QueryClientProvider>
  );
}

const openTab = (name: string) => fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 });

beforeEach(() => {
  get.mockReset();
  get.mockImplementation(async (url: string) => {
    if (url.endsWith("/schedule/log")) {
      return {
        records: [
          {
            id: "att-1",
            timestamp: "2026-09-18T09:00:00.000Z",
            staffMemberId: "clstaff000000000000000001",
            staffName: "Sam",
            type: "CLOCK_IN",
            selfieUrl: null,
            locationLabel: "Front door",
          },
        ],
      };
    }
    return { days: [], missingClockOuts: [], standardWorkMinutesPerDay: 480 };
  });
});

describe("ScheduleLog — attendance only", () => {
  it("asks the log for attendance kinds and nothing else, so till cash can't leak back in", async () => {
    renderLog();
    await screen.findByText("Front door");

    const call = get.mock.calls.find(([url]) => String(url).endsWith("/schedule/log"))!;
    // Explicit, not omitted: an omitted type is the route's "every kind".
    expect((call[1] as Record<string, string>).type).toBe("CLOCK_IN,CLOCK_OUT,ABSENCE");
  });

  it("shows the clock events it was given", async () => {
    renderLog();
    expect(await screen.findByText("Sam", { selector: "td" })).toBeInTheDocument();
    expect(screen.getByText("clockInOut.typeClockIn")).toBeInTheDocument();
  });

  it("describes itself as attendance, not 'till cash on one timeline'", async () => {
    renderLog();
    await screen.findByText("Front door");
    expect(screen.getByText("pages.scheduleLogDesc")).toBeInTheDocument();
    // Nothing on the page speaks of till cash any more.
    expect(screen.queryByText("clockInOut.typeCashIn")).toBeNull();
    expect(screen.queryByText("clockInOut.typeCashOut")).toBeNull();
  });
});

describe("ScheduleLog — selfie preview", () => {
  beforeEach(() => {
    get.mockImplementation(async (url: string) => {
      if (url.endsWith("/schedule/log")) {
        return {
          records: [
            {
              id: "att-2",
              timestamp: "2026-09-18T17:00:00.000Z",
              staffMemberId: "clstaff000000000000000001",
              staffName: "Sam",
              type: "CLOCK_OUT",
              selfieUrl: "https://blob.example/out.jpg",
              locationLabel: "Back door",
            },
            {
              id: "att-1",
              timestamp: "2026-09-18T09:00:00.000Z",
              staffMemberId: "clstaff000000000000000001",
              staffName: "Sam",
              type: "CLOCK_IN",
              selfieUrl: "https://blob.example/in.jpg",
              locationLabel: "Front door",
            },
          ],
        };
      }
      return { days: [], missingClockOuts: [], standardWorkMinutesPerDay: 480 };
    });
  });

  it("opens the tapped selfie large, with who, when and where", async () => {
    renderLog();
    const thumbs = await screen.findAllByRole("button", { name: "pages.attendanceSelfieOpen" });
    fireEvent.click(thumbs[1]);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Sam")).toBeInTheDocument();
    expect(within(dialog).getByRole("img")).toHaveAttribute("src", "https://blob.example/in.jpg");
    expect(within(dialog).getByText("Front door")).toBeInTheDocument();
    expect(within(dialog).getByText("pages.attendanceSelfieCount")).toBeInTheDocument();
  });

  it("steps to the other selfies in the list without closing", async () => {
    renderLog();
    const thumbs = await screen.findAllByRole("button", { name: "pages.attendanceSelfieOpen" });
    fireEvent.click(thumbs[0]);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "pages.attendanceSelfiePrev" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "pages.attendanceSelfieNext" }));
    expect(within(dialog).getByRole("img")).toHaveAttribute("src", "https://blob.example/in.jpg");
    expect(within(dialog).getByRole("button", { name: "pages.attendanceSelfieNext" })).toBeDisabled();
  });
});

describe("ScheduleLog — hours against what was expected", () => {
  const day = (over: Record<string, unknown>) => ({
    staffMemberId: "clstaff000000000000000001",
    staff: STAFF[0],
    date: "2026-09-18",
    status: "worked",
    pairs: [
      {
        clockInAt: "2026-09-18T01:00:00.000Z",
        clockOutAt: "2026-09-18T10:02:00.000Z",
        clockInTime: "08:00",
        clockOutTime: "17:02",
        workedMinutes: 542,
      },
    ],
    workedMinutes: 542,
    expectedMinutes: 480,
    expectedSource: "roster",
    expectedWindows: [{ start: "08:00", end: "16:00" }],
    differenceMinutes: 62,
    regularMinutes: 480,
    overtimeMinutes: 62,
    openClockIn: null,
    present: true,
    hasLongPair: false,
    ...over,
  });

  it("shows how far over or under each day ran, instead of a dash", async () => {
    get.mockImplementation(async (url: string) => {
      if (url.endsWith("/schedule/log")) return { records: [] };
      return {
        days: [
          day({}),
          day({
            date: "2026-09-19",
            pairs: [],
            status: "noShow",
            workedMinutes: 0,
            differenceMinutes: -150,
            overtimeMinutes: 0,
            regularMinutes: 0,
            present: false,
          }),
        ],
        missingClockOuts: [],
        standardWorkMinutesPerDay: 480,
      };
    });
    renderLog();
    openTab("pages.attendanceHoursTab");

    expect(await screen.findByText("+1h 2m")).toBeInTheDocument();
    expect(screen.getByText("\u22122h 30m")).toBeInTheDocument();
    expect(screen.getByText("08:00–17:02")).toBeInTheDocument();
    expect(screen.getByText("pages.attendanceStatusNoShow")).toBeInTheDocument();
  });
});

describe("ScheduleLog — Salary tab", () => {
  it("is not there unless the viewer may see salaries", async () => {
    renderLog();
    await screen.findByText("Front door");
    expect(screen.queryByRole("tab", { name: "pages.payrollTab" })).toBeNull();
  });

  it("is there for the owner", async () => {
    renderLog({ canSeePayroll: true });
    expect(await screen.findByRole("tab", { name: "pages.payrollTab" })).toBeInTheDocument();
  });
});

describe("ScheduleLog — closing a forgotten clock-in", () => {
  it("records the clock-out at the end of the expected hours, not at the moment of the correction", async () => {
    post.mockResolvedValue({});
    get.mockImplementation(async (url: string) => {
      if (url.endsWith("/schedule/log")) return { records: [] };
      return {
        days: [],
        missingClockOuts: [
          {
            attendanceId: "att-open",
            staffMemberId: "clstaff000000000000000001",
            staff: STAFF[0],
            clockInAt: "2026-09-18T01:00:00.000Z",
            isOpen: false,
          },
        ],
        standardWorkMinutesPerDay: 480,
      };
    });
    renderLog();
    openTab("pages.attendanceHoursTab");
    fireEvent.click(await screen.findByRole("button", { name: "pages.attendanceManuallyClose" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Forgot to clock out" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "common.actions.save" }));

    await vi.waitFor(() => expect(post).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith("/stores/s1/attendance/att-open/close", {
      notes: "Forgot to clock out",
      timestamp: "2026-09-18T09:00:00.000Z",
    });
  });
});
