import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, intlLocale: "en", dateLocale: undefined }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, apiClient: { get: vi.fn() } };
});

import { apiClient } from "@/lib/api/client";
import { PublishedRoster } from "../published-roster";
import type { ScheduleWeekGridEntry } from "../schedule-week-grid";

const get = vi.mocked(apiClient.get);

const STAFF = [
  { id: "st-amy", name: "Amy", role: "CASHIER" as const },
  { id: "st-bob", name: "Bob", role: "KITCHEN" as const },
  { id: "st-cat", name: "Cat", role: "MANAGER" as const },
];

function entry(
  over: Partial<ScheduleWeekGridEntry> & { id: string; staffId: string; name: string; date: string }
): ScheduleWeekGridEntry {
  const { staffId, name, ...rest } = over;
  return {
    scheduleShiftId: null,
    customStartTime: null,
    customEndTime: null,
    isDayOff: false,
    department: null,
    notes: null,
    status: "PUBLISHED",
    scheduleShift: null,
    staffMember: { id: staffId, name },
    ...rest,
  };
}

const AMY_MORNING = entry({
  id: "e-amy",
  staffId: "st-amy",
  name: "Amy",
  date: "2026-09-23T00:00:00.000Z",
  scheduleShiftId: "blk-am",
  scheduleShift: { name: "Morning", startTime: "08:00", endTime: "14:00", color: "#ff0000" },
  notes: "Manager-only note",
});
// A draft the server should never have sent — must not show anyway.
const BOB_DRAFT = entry({
  id: "e-bob",
  staffId: "st-bob",
  name: "Bob",
  date: "2026-09-24T00:00:00.000Z",
  scheduleShift: { name: "Secret draft", startTime: "10:00", endTime: "18:00", color: null },
  status: "DRAFT",
});
// Someone who has left: not in the active staff list.
const GONE = entry({
  id: "e-gone",
  staffId: "st-gone",
  name: "Gone",
  date: "2026-09-22T00:00:00.000Z",
  customStartTime: "09:00",
  customEndTime: "17:00",
});

const IMAGE = {
  id: "climage000000000000000001",
  imageUrl: "https://abc123.public.blob.vercel-storage.com/schedule/week-39.png",
  startDate: "2026-09-21",
  endDate: "2026-09-27",
  note: null,
};

function setup({
  schedules = [] as ScheduleWeekGridEntry[],
  images = [] as unknown[],
  backOfficeHref = "/store/s1/schedule" as string | null,
  viewerKey = "owner",
  // Stand-ins for the network: a read that fails, or one that never answers.
  imagesRead,
  rosterRead,
  seed,
}: {
  schedules?: ScheduleWeekGridEntry[];
  images?: unknown[];
  backOfficeHref?: string | null;
  viewerKey?: string;
  imagesRead?: () => Promise<unknown>;
  rosterRead?: () => Promise<unknown>;
  seed?: (client: QueryClient) => void;
} = {}) {
  get.mockImplementation(async (url: string) => {
    if (url.endsWith("/schedule-images")) return imagesRead ? imagesRead() : { images };
    if (url.endsWith("/staff-schedules")) return rosterRead ? rosterRead() : { schedules };
    throw new Error(`unexpected ${url}`);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  seed?.(client);
  const ui = (key: string) => (
    <QueryClientProvider client={client}>
      <PublishedRoster
        storeId="s1"
        staff={STAFF}
        viewerKey={key}
        backOfficeHref={backOfficeHref ?? undefined}
      />
    </QueryClientProvider>
  );
  const view = render(ui(viewerKey));
  return { ...view, client, rerenderAs: (key: string) => view.rerender(ui(key)) };
}

const never = () => new Promise<never>(() => {});
const fail = () => Promise.reject(new Error("network down"));

const rosterCalls = () =>
  get.mock.calls.filter(([url]) => String(url).endsWith("/staff-schedules")).map((c) => c[1]);
const imageCalls = () =>
  get.mock.calls.filter(([url]) => String(url).endsWith("/schedule-images")).map((c) => c[1]);
const bodyRows = () => screen.getAllByRole("row").slice(1);
const rowNames = () => bodyRows().map((r) => within(r).getAllByRole("cell")[0].textContent);
const todayButton = () => screen.getByRole("button", { name: "pages.scheduleToday" });

beforeEach(() => {
  get.mockReset();
  // Friday 25 Sep 2026, local noon: the week is Mon 21 – Sun 27. Only Date is
  // faked, so react-query's own timers still run.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 25, 12, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PublishedRoster — what it asks for", () => {
  it("asks for this Monday..Sunday, PUBLISHED only, and the same week's images", async () => {
    setup({ schedules: [AMY_MORNING] });
    await screen.findByText("Morning");

    expect(rosterCalls()).toEqual([{ from: "2026-09-21", to: "2026-09-27", status: "PUBLISHED" }]);
    expect(imageCalls()).toEqual([{ from: "2026-09-21", to: "2026-09-27" }]);
    expect(screen.getByText("21 Sep 2026 – 27 Sep 2026")).toBeInTheDocument();
  });

  it("another persona on the same device reads its own copy, not the previous one's cache", async () => {
    const { rerenderAs } = setup({ schedules: [AMY_MORNING], viewerKey: "owner" });
    await screen.findByText("Morning");
    expect(rosterCalls()).toHaveLength(1);

    rerenderAs("clstaffmanager0000000001");
    await vi.waitFor(() => expect(rosterCalls()).toHaveLength(2));
  });

  it("reads the images from Back Office's ScheduleImagePanel cache — the very same key", async () => {
    // Seeded under ScheduleImagePanel's key, with the network never answering:
    // the image can only show if this view reads that exact cache entry.
    setup({
      imagesRead: never,
      seed: (client) =>
        client.setQueryData(["schedule-images", "s1", "2026-09-21", "2026-09-27"], {
          images: [IMAGE],
        }),
    });
    const img = await screen.findByRole("img", { name: "pages.scheduleImageAlt" });
    expect(img).toHaveAttribute("src", IMAGE.imageUrl);
    expect(screen.queryByText("common.loading")).toBeNull();
  });

  it("Back Office's roster invalidation (the [staff-schedules, store] prefix) re-reads it", async () => {
    const { client } = setup({ schedules: [AMY_MORNING] });
    await screen.findByText("Morning");
    expect(rosterCalls()).toHaveLength(1);

    await act(() => client.invalidateQueries({ queryKey: ["staff-schedules", "s1"] }));
    await vi.waitFor(() => expect(rosterCalls()).toHaveLength(2));
  });
});

describe("PublishedRoster — only what was published, read only", () => {
  it("a DRAFT row that slips into the response is not shown", async () => {
    setup({ schedules: [AMY_MORNING, BOB_DRAFT] });
    await screen.findByText("Morning");

    expect(screen.queryByText("Secret draft")).toBeNull();
    // Bob's only entry was the draft, so Bob has no row at all.
    expect(rowNames()).toEqual(["Amy"]);
  });

  it("only staff with something published this week get a row; former staff are dropped", async () => {
    setup({ schedules: [AMY_MORNING, GONE] });
    await screen.findByText("Morning");

    expect(rowNames()).toEqual(["Amy"]);
    expect(screen.queryByText("Gone")).toBeNull();
    expect(screen.queryByText("09:00–17:00")).toBeNull();
  });

  it("a former staff member's entry is not in the day's detail either", async () => {
    setup({ schedules: [AMY_MORNING, GONE] });
    await screen.findByText("Morning");

    const headers = within(screen.getAllByRole("row")[0]).getAllByRole("button");
    fireEvent.click(headers[1]); // Tuesday 22nd — GONE's day

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Tuesday 22 Sep 2026")).toBeInTheDocument();
    expect(within(dialog).queryByText("Gone")).toBeNull();
    expect(within(dialog).queryByText("09:00–17:00")).toBeNull();
    expect(within(dialog).getByText("pages.noData")).toBeInTheDocument();
  });

  it("has nothing to edit with: no add cells, chips are not buttons, no Draft/Published badges", async () => {
    setup({ schedules: [AMY_MORNING] });
    await screen.findByText("Morning");

    expect(screen.queryByRole("button", { name: "pages.scheduleAddShift" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Morning/ })).toBeNull();
    expect(screen.getByTestId("schedule-chip")).toHaveTextContent("Morning");
    expect(screen.queryByText("pages.schedulePublishedBadge")).toBeNull();
    expect(screen.getByText("pos.operational.rosterReadOnly")).toBeInTheDocument();
  });

  it("a day opens its detail without the manager's notes or status", async () => {
    setup({ schedules: [AMY_MORNING] });
    await screen.findByText("Morning");

    const headers = within(screen.getAllByRole("row")[0]).getAllByRole("button");
    expect(headers).toHaveLength(7);
    fireEvent.click(headers[2]); // Wednesday 23rd

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Wednesday 23 Sep 2026")).toBeInTheDocument();
    expect(within(dialog).getByText("Amy")).toBeInTheDocument();
    expect(within(dialog).queryByText("Manager-only note")).toBeNull();
    expect(within(dialog).queryByText("pages.schedulePublishedBadge")).toBeNull();
  });

  it("links to Back Office to make changes, when given where", async () => {
    setup({ schedules: [AMY_MORNING] });
    await screen.findByText("Morning");
    expect(
      screen.getByRole("link", { name: "pos.operational.rosterEditInBackOffice" })
    ).toHaveAttribute("href", "/store/s1/schedule");
  });

  it("no Back Office link without an href", async () => {
    setup({ schedules: [AMY_MORNING], backOfficeHref: null });
    await screen.findByText("Morning");
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("PublishedRoster — moving between weeks", () => {
  it("next and previous move a week at a time; Today comes back and is off on this week", async () => {
    setup({ schedules: [AMY_MORNING] });
    await screen.findByText("Morning");
    expect(todayButton()).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "pos.operational.rosterNextWeek" }));
    expect(await screen.findByText("28 Sep 2026 – 4 Oct 2026")).toBeInTheDocument();
    await vi.waitFor(() =>
      expect(rosterCalls()).toContainEqual({
        from: "2026-09-28",
        to: "2026-10-04",
        status: "PUBLISHED",
      })
    );
    await vi.waitFor(() =>
      expect(imageCalls()).toContainEqual({ from: "2026-09-28", to: "2026-10-04" })
    );
    expect(todayButton()).toBeEnabled();

    fireEvent.click(todayButton());
    expect(await screen.findByText("21 Sep 2026 – 27 Sep 2026")).toBeInTheDocument();
    expect(todayButton()).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "pos.operational.rosterPrevWeek" }));
    expect(await screen.findByText("14 Sep 2026 – 20 Sep 2026")).toBeInTheDocument();
    await vi.waitFor(() =>
      expect(rosterCalls()).toContainEqual({
        from: "2026-09-14",
        to: "2026-09-20",
        status: "PUBLISHED",
      })
    );
  });

  it("left on this week past Sunday midnight, it moves into the new week by itself", async () => {
    vi.setSystemTime(new Date(2026, 8, 27, 23, 0, 0)); // Sunday 27th, 23:00
    setup({ schedules: [AMY_MORNING] });
    expect(await screen.findByText("21 Sep 2026 – 27 Sep 2026")).toBeInTheDocument();

    // The tablet slept through midnight; it wakes on Monday morning.
    vi.setSystemTime(new Date(2026, 8, 28, 8, 0, 0));
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(await screen.findByText("28 Sep 2026 – 4 Oct 2026")).toBeInTheDocument();
    expect(todayButton()).toBeDisabled();
    await vi.waitFor(() =>
      expect(rosterCalls()).toContainEqual({
        from: "2026-09-28",
        to: "2026-10-04",
        status: "PUBLISHED",
      })
    );
  });

  it("a week the viewer moved to stays put when the calendar turns over", async () => {
    vi.setSystemTime(new Date(2026, 8, 27, 23, 0, 0));
    setup({ schedules: [AMY_MORNING] });
    await screen.findByText("21 Sep 2026 – 27 Sep 2026");
    fireEvent.click(screen.getByRole("button", { name: "pos.operational.rosterPrevWeek" }));
    expect(await screen.findByText("14 Sep 2026 – 20 Sep 2026")).toBeInTheDocument();

    vi.setSystemTime(new Date(2026, 8, 28, 8, 0, 0));
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(screen.getByText("14 Sep 2026 – 20 Sep 2026")).toBeInTheDocument();
    expect(todayButton()).toBeEnabled();
    fireEvent.click(todayButton());
    expect(await screen.findByText("28 Sep 2026 – 4 Oct 2026")).toBeInTheDocument();
  });
});

describe("PublishedRoster — nothing published", () => {
  it("neither roster rows nor an image: says nothing is published this week", async () => {
    setup();
    expect(await screen.findByText("pos.operational.rosterEmpty")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("only drafts this week still counts as empty", async () => {
    setup({ schedules: [BOB_DRAFT] });
    expect(await screen.findByText("pos.operational.rosterEmpty")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("an image alone is a published schedule, not 'empty'", async () => {
    setup({ images: [IMAGE] });
    const img = await screen.findByRole("img", { name: "pages.scheduleImageAlt" });
    expect(img).toHaveAttribute("src", IMAGE.imageUrl);
    expect(screen.queryByText("pos.operational.rosterEmpty")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows loading until both reads are back", () => {
    get.mockImplementation(() => new Promise(() => {}));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <PublishedRoster storeId="s1" staff={STAFF} viewerKey="owner" />
      </QueryClientProvider>
    );
    expect(screen.getByText("common.loading")).toBeInTheDocument();
    expect(screen.queryByText("pos.operational.rosterEmpty")).toBeNull();
  });
});

describe("PublishedRoster — a read that didn't answer is never 'nothing published'", () => {
  it("the roster read fails: an error, not 'empty'", async () => {
    setup({ rosterRead: fail });
    expect(await screen.findByText("common.error")).toBeInTheDocument();
    expect(screen.queryByText("pos.operational.rosterEmpty")).toBeNull();
  });

  it("only the images read fails, with no rows: says the images didn't load, not 'empty'", async () => {
    setup({ imagesRead: fail });
    expect(await screen.findByText("pages.scheduleImageLoadFailed")).toBeInTheDocument();
    expect(screen.queryByText("pos.operational.rosterEmpty")).toBeNull();
  });

  it("only the images read fails, with rows: the roster still shows, and the failure is said", async () => {
    setup({ schedules: [AMY_MORNING], imagesRead: fail });
    await screen.findByText("Morning");
    expect(rowNames()).toEqual(["Amy"]);
    expect(screen.getByText("pages.scheduleImageLoadFailed")).toBeInTheDocument();
  });

  it("offline with nothing cached: says so, sends nothing, and never claims 'empty'", async () => {
    onlineManager.setOnline(false);
    try {
      const { unmount } = setup({ schedules: [AMY_MORNING] });
      expect(await screen.findByText("common.pwa.connectionOffline")).toBeInTheDocument();
      expect(screen.queryByText("pos.operational.rosterEmpty")).toBeNull();
      expect(get).not.toHaveBeenCalled();
      unmount();
    } finally {
      onlineManager.setOnline(true);
    }
  });
});
