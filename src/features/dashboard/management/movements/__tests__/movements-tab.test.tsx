import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({
    t: (key: string) => (key === "management.movementLog.balanceAfter" ? "Balance {balance}" : key),
    formatDateTime: () => "24 Sep 14:05",
  }),
}));
vi.mock("@/hooks/use-realtime-channel", () => ({ useRealtimeChannel: vi.fn() }));

import { MovementsTab } from "../movements-tab";

const STORE = "s1";
const fetchMock = vi.fn();

const movement = (over: Record<string, unknown>) => ({
  id: "m",
  type: "SALE",
  quantity: "-1",
  balanceAfter: "0",
  unit: "pcs",
  notes: null,
  reason: null,
  createdAt: "2026-09-24T07:05:00.000Z",
  material: null,
  product: null,
  order: null,
  productionBatch: null,
  ...over,
});

const page = (movements: unknown[], nextCursor: string | null = null) => ({
  ok: true,
  json: async () => ({ success: true, data: { movements, total: movements.length, nextCursor } }),
});

function renderLog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MovementsTab storeId={STORE} />
    </QueryClientProvider>
  );
}

/** The query string of the nth fetch call. */
const paramsOf = (n: number) => new URL(fetchMock.mock.calls[n][0], "http://x").searchParams;

beforeEach(() => {
  window.localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("MovementsTab — the Stock page's Log", () => {
  it("shows production use as a reduction, with its label, reason and balance", async () => {
    fetchMock.mockResolvedValueOnce(
      page([
        movement({
          id: "a",
          type: "PRODUCTION_OUT",
          quantity: "3", // stored positive by the production service
          balanceAfter: "7",
          unit: "kg",
          material: { name: "Farine T55", sku: null },
          productionBatch: { batchNumber: "B-12" },
        }),
        movement({
          id: "b",
          type: "ADJUSTMENT",
          quantity: "-4",
          balanceAfter: "0",
          reason: "Reset to 0",
          product: { name: "Baguette", sku: null },
        }),
        movement({
          id: "c",
          type: "PURCHASE",
          quantity: "5",
          balanceAfter: "12",
          unit: "kg",
          notes: "Supplier order SO-1 received",
          material: { name: "Beurre", sku: null },
        }),
      ])
    );

    renderLog();

    const rows = await screen.findAllByTestId("movement-row");
    expect(rows).toHaveLength(3);

    expect(within(rows[0]).getByText("-3 kg")).toBeInTheDocument();
    expect(
      within(rows[0]).getByText("management.movementLog.types.PRODUCTION_OUT")
    ).toBeInTheDocument();
    expect(within(rows[0]).getByText("Batch #B-12 · 24 Sep 14:05")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Balance 7 kg")).toBeInTheDocument();

    expect(within(rows[1]).getByText("Reset to 0 · 24 Sep 14:05")).toBeInTheDocument();

    expect(within(rows[2]).getByText("+5 kg")).toBeInTheDocument();
    expect(within(rows[2]).getByText("management.movementLog.types.PURCHASE")).toBeInTheDocument();
  });

  it("pages through the whole history with Load more", async () => {
    fetchMock
      .mockResolvedValueOnce(
        page([movement({ id: "a", product: { name: "First", sku: null } })], "a")
      )
      .mockResolvedValueOnce(page([movement({ id: "b", product: { name: "Second", sku: null } })]));

    renderLog();
    await screen.findByText("First");

    fireEvent.click(screen.getByRole("button", { name: "management.movementLog.loadMore" }));

    expect(await screen.findByText("Second")).toBeInTheDocument();
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(paramsOf(0).get("cursor")).toBeNull();
    expect(paramsOf(1).get("cursor")).toBe("a");
    expect(
      screen.queryByRole("button", { name: "management.movementLog.loadMore" })
    ).not.toBeInTheDocument();
  });

  it("searches on the server rather than only in the loaded rows", async () => {
    fetchMock.mockResolvedValue(page([]));

    renderLog();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText("tracking.movements.searchPlaceholder"), {
      target: { value: "farine" },
    });

    await waitFor(() => expect(paramsOf(fetchMock.mock.calls.length - 1).get("q")).toBe("farine"));
  });
});
