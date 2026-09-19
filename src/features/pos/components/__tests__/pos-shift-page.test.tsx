import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, formatDateTime: (d: string) => `DT(${d})` }),
}));
vi.mock("@/components/providers/currency-provider", () => ({
  useCurrency: () => ({
    currency: "IDR",
    formatPrice: (v: number, c?: string) => `${c} ${v}`,
  }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const mockMyShift = vi.fn();
const mockOpen = vi.fn();
vi.mock("@/features/pos/hooks/use-my-shift", () => ({
  useMyShift: () => mockMyShift(),
  useOpenShift: () => mockOpen(),
}));

let sessionReady = true;
vi.mock("@/features/pos/hooks/use-pos-session", () => ({
  usePosSession: (selector: (s: unknown) => unknown) =>
    selector({ isActive: sessionReady, storeId: "s1" }),
}));

// The page's wiring is under test here, not the screens it hosts.
vi.mock("../shift/finish-shift-screen", () => ({
  FinishShiftScreen: ({
    onBack,
    onEnded,
  }: {
    onBack: () => void;
    onEnded: (e: unknown) => void;
  }) => (
    <div>
      <p>FINISH SCREEN</p>
      <button onClick={onBack}>stub-back</button>
      <button onClick={() => onEnded({ shiftId: "shift-1", staffName: "Sam" })}>stub-ended</button>
    </div>
  ),
}));
vi.mock("../shift/shift-closed-dialog", () => ({
  ShiftClosedDialog: ({ ended, onDone }: { ended: { shiftId: string }; onDone: () => void }) => (
    <div>
      <p>CLOSED DIALOG {ended.shiftId}</p>
      <button onClick={onDone}>stub-done</button>
    </div>
  ),
}));
vi.mock("../shift/cash-movement-dialog", () => ({
  CashMovementDialog: ({ open, shiftId }: { open: boolean; shiftId: string | null }) =>
    open ? <p>MOVEMENT DIALOG {String(shiftId)}</p> : null,
}));

import { toast } from "sonner";
import { ShiftPage } from "../shift/shift-page";
import { ShiftStatusCard } from "../shift/shift-status-card";
import { OpenShiftCard } from "../shift/open-shift-card";

const shift = {
  id: "clshift000000000000000001",
  openedAt: "2026-08-08T11:00:00.000Z",
  closedAt: null,
  openingCash: "50000",
  closingCash: null,
  staffMember: { id: "clstaff000000000000000001", name: "Sam", role: "CASHIER" },
};

function shiftState(overrides: Record<string, unknown> = {}) {
  return {
    shift: null,
    allowed: true,
    known: true,
    staffMemberId: "clstaff000000000000000001",
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  sessionReady = true;
  mockMyShift.mockReset();
  mockOpen.mockReset();
  vi.mocked(toast.error).mockReset();
  vi.mocked(toast.success).mockReset();
  mockOpen.mockReturnValue({ mutate: vi.fn(), isPending: false });
  vi.spyOn(window, "open").mockImplementation(() => null);
});

describe("ShiftStatusCard", () => {
  function renderCard() {
    const handlers = { onFinish: vi.fn(), onCashMovement: vi.fn(), onViewReport: vi.fn() };
    render(<ShiftStatusCard shift={shift} {...handlers} />);
    return handlers;
  }

  it("shows who is on charge, when it started and the float it started with", () => {
    renderCard();
    expect(screen.getByText("pos.shift.activeBadge", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Sam")).toBeInTheDocument();
    expect(screen.getByText(`DT(${shift.openedAt})`)).toBeInTheDocument();
    // Literal in the store's own currency: the provider's currency passed through.
    expect(screen.getByText("IDR 50000")).toBeInTheDocument();
  });

  it("Finish shift is the one big destructive action", () => {
    const { onFinish } = renderCard();
    const finish = screen.getByRole("button", { name: "pos.shift.finish" });
    expect(finish.className).toContain("h-12");
    fireEvent.click(finish);
    expect(onFinish).toHaveBeenCalled();
  });

  it("cash in/out and the live report sit beside each other with flex-1, never w-full", () => {
    const { onCashMovement, onViewReport } = renderCard();
    const movement = screen.getByRole("button", { name: /pages\.cashMovementTitle/ });
    const report = screen.getByRole("button", { name: /pages\.shiftViewReport/ });
    for (const button of [movement, report]) {
      expect(button.className).toContain("flex-1");
      expect(button.className).not.toContain("w-full");
      expect(button.className).toContain("h-11");
    }
    fireEvent.click(movement);
    fireEvent.click(report);
    expect(onCashMovement).toHaveBeenCalled();
    expect(onViewReport).toHaveBeenCalled();
  });
});

describe("OpenShiftCard", () => {
  it("opens a shift for the persona with the counted float — no PIN prompt", async () => {
    const mutate = vi.fn();
    mockOpen.mockReturnValue({ mutate, isPending: false });
    render(
      <OpenShiftCard storeId="s1" staffMemberId={shift.staffMember.id} onCashMovement={() => {}} />
    );

    fireEvent.change(screen.getByLabelText("pages.openingCash"), { target: { value: "150000" } });
    fireEvent.click(screen.getByRole("button", { name: "pos.shift.open" }));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0]).toEqual({
      staffId: shift.staffMember.id,
      pin: "",
      openingCash: 150_000,
    });
  });

  it("reports the outcome of opening", async () => {
    const mutate = vi.fn((_body, opts) => opts.onError());
    mockOpen.mockReturnValue({ mutate, isPending: false });
    render(
      <OpenShiftCard storeId="s1" staffMemberId={shift.staffMember.id} onCashMovement={() => {}} />
    );

    fireEvent.click(screen.getByRole("button", { name: "pos.shift.open" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("pos.shift.openFailed"));
  });

  it("cash can move before the first shift — the movement action is offered", () => {
    const onCashMovement = vi.fn();
    render(
      <OpenShiftCard
        storeId="s1"
        staffMemberId={shift.staffMember.id}
        onCashMovement={onCashMovement}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /pages\.cashMovementTitle/ }));
    expect(onCashMovement).toHaveBeenCalled();
  });
});

describe("ShiftPage", () => {
  it("waits for the persona instead of claiming the role can't hold a shift", () => {
    sessionReady = false;
    mockMyShift.mockReturnValue(shiftState({ allowed: false }));
    render(<ShiftPage storeId="s1" />);
    expect(screen.queryByText("pos.shift.unavailableRole")).toBeNull();
  });

  it("a role that runs no register is told so", () => {
    mockMyShift.mockReturnValue(shiftState({ allowed: false }));
    render(<ShiftPage storeId="s1" />);
    expect(screen.getByText("pos.shift.unavailableRole")).toBeInTheDocument();
  });

  it("an owner with no staff profile to attach a shift to is told so", () => {
    mockMyShift.mockReturnValue(shiftState({ staffMemberId: null }));
    render(<ShiftPage storeId="s1" />);
    expect(screen.getByText("pos.shift.unavailableNoStaff")).toBeInTheDocument();
  });

  it("a failed read offers a retry", () => {
    const refetch = vi.fn();
    mockMyShift.mockReturnValue(shiftState({ isError: true, refetch }));
    render(<ShiftPage storeId="s1" />);
    fireEvent.click(screen.getByRole("button", { name: "common.actions.retry" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("no open shift: the open-shift card", () => {
    mockMyShift.mockReturnValue(shiftState());
    render(<ShiftPage storeId="s1" />);
    expect(screen.getByRole("button", { name: "pos.shift.open" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "pos.shift.finish" })).toBeNull();
  });

  it("an open shift: the status card, whose live report opens in a new tab without printing", () => {
    mockMyShift.mockReturnValue(shiftState({ shift }));
    render(<ShiftPage storeId="s1" />);
    fireEvent.click(screen.getByRole("button", { name: /pages\.shiftViewReport/ }));
    expect(window.open).toHaveBeenCalledWith(
      `/store/s1/pos/orders/daily-report?shiftId=${shift.id}&print=0`,
      "_blank"
    );
  });

  it("Finish opens the finish screen, Back returns to the shift", () => {
    mockMyShift.mockReturnValue(shiftState({ shift }));
    render(<ShiftPage storeId="s1" />);

    fireEvent.click(screen.getByRole("button", { name: "pos.shift.finish" }));
    expect(screen.getByText("FINISH SCREEN")).toBeInTheDocument();

    fireEvent.click(screen.getByText("stub-back"));
    expect(screen.queryByText("FINISH SCREEN")).toBeNull();
    expect(screen.getByRole("button", { name: "pos.shift.finish" })).toBeInTheDocument();
  });

  it("ending the shift leaves the finish screen and shows the report dialog until Done", () => {
    mockMyShift.mockReturnValue(shiftState({ shift }));
    render(<ShiftPage storeId="s1" />);

    fireEvent.click(screen.getByRole("button", { name: "pos.shift.finish" }));
    fireEvent.click(screen.getByText("stub-ended"));

    expect(screen.queryByText("FINISH SCREEN")).toBeNull();
    expect(screen.getByText("CLOSED DIALOG shift-1")).toBeInTheDocument();

    fireEvent.click(screen.getByText("stub-done"));
    expect(screen.queryByText(/CLOSED DIALOG/)).toBeNull();
  });

  it("cash in/out attaches to the open shift; with none open it attaches to none", () => {
    mockMyShift.mockReturnValue(shiftState({ shift }));
    const { unmount } = render(<ShiftPage storeId="s1" />);
    fireEvent.click(screen.getByRole("button", { name: /pages\.cashMovementTitle/ }));
    expect(screen.getByText(`MOVEMENT DIALOG ${shift.id}`)).toBeInTheDocument();
    unmount();

    mockMyShift.mockReturnValue(shiftState());
    render(<ShiftPage storeId="s1" />);
    fireEvent.click(screen.getByRole("button", { name: /pages\.cashMovementTitle/ }));
    expect(screen.getByText("MOVEMENT DIALOG null")).toBeInTheDocument();
  });
});
