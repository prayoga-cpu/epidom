import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/components/lang/i18n-provider";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockMutate = vi.fn();
const mockInvalidate = vi.fn();
const mockRefetch = vi.fn();
const mockQueryData = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryFn }: any) => ({
    data: mockQueryData(),
    isLoading: false,
    refetch: mockRefetch,
  }),
  useMutation: ({ mutationFn, onSuccess, onError }: any) => ({
    mutate: (vars: any) => {
      mockMutate(vars);
      mutationFn(vars)
        .then(() => onSuccess?.({}, vars))
        .catch(() => onError?.());
    },
    isPending: false,
  }),
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ reservations: [] }),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ReservationList } from "@/features/pos/components/tables/reservation-list";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const makeReservation = (overrides = {}) => ({
  id: "r1",
  guestName: "Alice",
  guestPhone: "0812345",
  guestEmail: "alice@example.com",
  partySize: 2,
  scheduledAt: new Date(Date.now() + 86400000).toISOString(),
  notes: "Window seat please",
  status: "PENDING" as const,
  createdAt: new Date().toISOString(),
  table: { id: "t1", label: "Table 1", capacity: 4 },
  ...overrides,
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderList(storeId = "store-1") {
  return render(
    <I18nProvider>
      <ReservationList storeId={storeId} />
    </I18nProvider>
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("ReservationList", () => {
  beforeEach(() => {
    mockQueryData.mockReturnValue({ reservations: [makeReservation()] });
  });

  it("renders empty state when data is undefined", () => {
    mockQueryData.mockReturnValue(undefined);
    renderList();
    // With undefined data, reservations defaults to [] → empty state shown
    expect(screen.getByText("No reservations found.")).toBeTruthy();
  });

  it("renders empty state when no reservations", () => {
    mockQueryData.mockReturnValue({ reservations: [] });
    renderList();
    expect(screen.getByText("No reservations found.")).toBeTruthy();
  });

  it("renders guest name and status badge", () => {
    renderList();
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Pending")).toBeTruthy();
  });

  it("shows pending count badge in header", () => {
    mockQueryData.mockReturnValue({
      reservations: [
        makeReservation({ id: "r1", status: "PENDING" }),
        makeReservation({ id: "r2", status: "PENDING" }),
      ],
    });
    renderList();
    expect(screen.getByText("2 pending")).toBeTruthy();
  });

  it("status chip shows correct counts per status", () => {
    mockQueryData.mockReturnValue({
      reservations: [
        makeReservation({ id: "r1", status: "PENDING" }),
        makeReservation({ id: "r2", guestName: "Bob", status: "CONFIRMED" }),
      ],
    });
    renderList();
    // Each chip shows the count from the full dataset
    expect(screen.getByText("Pending (1)")).toBeTruthy();
    expect(screen.getByText("Confirmed (1)")).toBeTruthy();
  });

  it("filters by guest name search", () => {
    mockQueryData.mockReturnValue({
      reservations: [
        makeReservation({ id: "r1", guestName: "Alice" }),
        makeReservation({ id: "r2", guestName: "Bob" }),
      ],
    });
    renderList();
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: "bob" } });
    expect(screen.queryByText("Alice")).toBeNull();
    expect(screen.getByText("Bob")).toBeTruthy();
  });

  it("filters by table label search", () => {
    mockQueryData.mockReturnValue({
      reservations: [
        makeReservation({
          id: "r1",
          guestName: "Alice",
          table: { id: "t1", label: "Table A", capacity: 4 },
        }),
        makeReservation({
          id: "r2",
          guestName: "Bob",
          table: { id: "t2", label: "Table B", capacity: 2 },
        }),
      ],
    });
    renderList();
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: "Table B" } });
    expect(screen.queryByText("Alice")).toBeNull();
    expect(screen.getByText("Bob")).toBeTruthy();
  });

  it("opens delete dialog and calls delete on confirm", async () => {
    const { apiClient } = await import("@/lib/api/client");
    renderList();
    const deleteBtn = screen.getByRole("button", { name: "" }); // trash icon btn
    fireEvent.click(deleteBtn);
    const confirmBtn = await screen.findByRole("button", { name: /delete/i });
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(apiClient.delete).toHaveBeenCalledWith("/stores/store-1/reservations/r1");
    });
  });

  it("refresh button calls refetch", () => {
    renderList();
    fireEvent.click(screen.getByTitle("Refresh"));
    expect(mockRefetch).toHaveBeenCalled();
  });
});
