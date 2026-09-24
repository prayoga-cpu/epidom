import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { format } from "date-fns";
import { todayLocalISO, parseLocalISO } from "@/lib/utils/date-range";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({
    t: (k: string) => k,
    formatDateTime: (d: string) => `DT(${d})`,
    dateLocale: undefined,
  }),
}));
vi.mock("@/components/providers/currency-provider", () => ({
  useCurrency: () => ({ currency: "IDR", formatPrice: (v: number, c?: string) => `${c} ${v}` }),
}));
vi.mock("@/components/ui/date-range-field", () => ({ DateRangeField: () => <div /> }));
vi.mock("@/features/dashboard/shared/clock-in-out-dialog", () => ({
  ClockInOutDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="clock-dialog" /> : null,
}));
vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, apiClient: { get: vi.fn() } };
});

import { apiClient } from "@/lib/api/client";
import { MyScheduleList } from "../my-schedule-list";

const get = vi.mocked(apiClient.get);

const image = {
  id: "climage000000000000000001",
  imageUrl: "https://abc123.public.blob.vercel-storage.com/schedule/week-38.png",
  startDate: "2026-09-14",
  endDate: "2026-09-20",
  note: "Updated Tuesday",
};

function setup({
  images = [] as unknown[],
  schedules = [] as unknown[],
  embedded,
  onClockInOut,
}: {
  images?: unknown[];
  schedules?: unknown[];
  embedded?: boolean;
  onClockInOut?: () => void;
} = {}) {
  get.mockImplementation(async (url: string) => {
    if (url.endsWith("/schedule-images")) return { images };
    if (url.endsWith("/staff-schedules")) return { schedules };
    return { records: [] };
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MyScheduleList
        storeId="s1"
        staffMemberId="clstaff000000000000000001"
        embedded={embedded}
        onClockInOut={onClockInOut}
      />
    </QueryClientProvider>
  );
}

// Braces matter: a beforeEach that RETURNS a function is treated as its cleanup and
// called after the test — here that would call the mock itself with no arguments.
beforeEach(() => {
  get.mockReset();
});

describe("MyScheduleList — a roster image from the manager", () => {
  it("shows the image, its dates and the manager's note, full size on tap", async () => {
    setup({ images: [image] });
    const img = await screen.findByRole("img", { name: "pages.scheduleImageAlt" });

    expect(img).toHaveAttribute("src", image.imageUrl);
    expect(img.closest("a")).toHaveAttribute("href", image.imageUrl);
    expect(img.closest("a")).toHaveAttribute("target", "_blank");
    expect(img.closest("a")).toHaveAttribute("rel", expect.stringContaining("noopener"));
    // Formatted for people, not the raw 2026-09-14 keys the API speaks.
    expect(screen.getByText("14 Sep 2026 – 20 Sep 2026")).toBeInTheDocument();
    expect(screen.queryByText(/2026-09-14/)).toBeNull();
    expect(screen.getByText("Updated Tuesday")).toBeInTheDocument();
  });

  it("asks for images from today on, with no staff filter — it is the same for the whole team", async () => {
    setup({ images: [image] });
    await screen.findByRole("img", { name: "pages.scheduleImageAlt" });

    const call = get.mock.calls.find(([url]) => String(url).endsWith("/schedule-images"))!;
    expect(call[1]).toEqual({ from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
  });

  it("an image alone counts as a published schedule — no 'no schedule' message", async () => {
    setup({ images: [image] });
    await screen.findByRole("img", { name: "pages.scheduleImageAlt" });
    expect(screen.queryByText("pages.scheduleNoPublishedSchedule")).toBeNull();
  });

  it("shows several images, soonest first as the server sent them", async () => {
    setup({
      images: [
        image,
        {
          ...image,
          id: "climage000000000000000002",
          startDate: "2026-09-21",
          endDate: "2026-09-27",
          note: null,
        },
      ],
    });
    await screen.findAllByRole("img", { name: "pages.scheduleImageAlt" });

    const dates = screen.getAllByText(/^\d+ Sep 2026 – \d+ Sep 2026$/).map((el) => el.textContent);
    expect(dates).toEqual(["14 Sep 2026 – 20 Sep 2026", "21 Sep 2026 – 27 Sep 2026"]);
  });

  it("neither blocks nor an image: the usual 'no published schedule'", async () => {
    setup();
    expect(await screen.findByText("pages.scheduleNoPublishedSchedule")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("MyScheduleList — own roster", () => {
  it("asks for PUBLISHED rows only — a draft must never reach staff", async () => {
    setup();
    await screen.findByText("pages.scheduleNoPublishedSchedule");

    const call = get.mock.calls.find(([url]) => String(url).endsWith("/staff-schedules"))!;
    expect(call[1]).toEqual({
      staffId: "clstaff000000000000000001",
      from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      status: "PUBLISHED",
    });
  });

  it("today's shift, as the API sends it (a full ISO timestamp), is dated for people and marked Today", async () => {
    const today = todayLocalISO();
    setup({
      schedules: [
        {
          id: "e-today",
          // A @db.Date column serialises as its UTC-midnight timestamp.
          date: `${today}T00:00:00.000Z`,
          isDayOff: false,
          scheduleShiftId: null,
          customStartTime: "09:00",
          customEndTime: "17:00",
          department: null,
          notes: null,
          status: "PUBLISHED",
          scheduleShift: null,
        },
      ],
    });

    expect(
      await screen.findByText(format(parseLocalISO(today), "EEE d MMM yyyy"))
    ).toBeInTheDocument();
    expect(screen.getByText("pages.scheduleToday")).toBeInTheDocument();
    expect(screen.queryByText(/T00:00:00/)).toBeNull();
    expect(screen.getByText("09:00–17:00")).toBeInTheDocument();
  });
});

describe("MyScheduleList — on its own page vs inside POS Mode's Operational page", () => {
  const clockButton = () => screen.queryByRole("button", { name: /pages\.scheduleClockInOut/ });

  it("in Back Office it has its heading and opens its own clock dialog", () => {
    setup();
    expect(
      screen.getByRole("heading", { name: "pages.scheduleMyScheduleTitle" })
    ).toBeInTheDocument();
    fireEvent.click(clockButton()!);
    expect(screen.getByTestId("clock-dialog")).toBeInTheDocument();
  });

  it("embedded, the tab names it: no heading of its own", () => {
    setup({ embedded: true, onClockInOut: vi.fn() });
    expect(screen.queryByRole("heading", { name: "pages.scheduleMyScheduleTitle" })).toBeNull();
  });

  it("embedded with a Clock tab, the button hands over to it instead of opening a second clock", () => {
    const onClockInOut = vi.fn();
    setup({ embedded: true, onClockInOut });
    fireEvent.click(clockButton()!);
    expect(onClockInOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("clock-dialog")).toBeNull();
  });

  it("embedded with no clock to offer, there is no button at all", () => {
    setup({ embedded: true });
    expect(clockButton()).toBeNull();
  });
});
