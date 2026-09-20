import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, formatDateTime: (d: string) => `DT(${d})` }),
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
import { ScheduleLog } from "../schedule-log";

const get = vi.mocked(apiClient.get);

const STAFF = [{ id: "clstaff000000000000000001", name: "Sam", role: "CASHIER" as const }];

function renderLog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <ScheduleLog storeId="s1" staff={STAFF} />
    </QueryClientProvider>
  );
}

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
    return { dailyRows: [], missingClockOuts: [], standardWorkMinutesPerDay: 480 };
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
