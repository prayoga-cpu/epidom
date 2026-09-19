import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

const mockPathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { staff: [] }, isLoading: false }),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const mockSession = vi.fn();
vi.mock("@/features/pos/hooks/use-pos-session", () => ({
  usePosSession: () => mockSession(),
  useClearStalePosSession: () => {},
}));

vi.mock("../hooks/use-owner-pin", () => ({
  useOwnerPinStatus: () => ({ data: { hasPin: true } }),
}));
vi.mock("../verify-owner-pin-dialog", () => ({ VerifyOwnerPinDialog: () => null }));
vi.mock("../set-owner-pin-dialog", () => ({ SetOwnerPinDialog: () => null }));

import { StoreAccessGate } from "../store-access-gate";

const STORE_ID = "store-abc12345";

function session(overrides: Record<string, unknown> = {}) {
  return {
    isActive: true,
    storeId: STORE_ID,
    pickerOpen: false,
    closePicker: vi.fn(),
    login: vi.fn(),
    ...overrides,
  };
}

function renderGate() {
  return render(
    <StoreAccessGate storeId={STORE_ID}>
      <div>protected-page</div>
    </StoreAccessGate>
  );
}

describe("StoreAccessGate — Switch Account picker (pickerOpen)", () => {
  beforeEach(() => {
    mockPathname.mockReturnValue(`/store/${STORE_ID}/dashboard`);
  });

  it("renders the page when a session is active and the picker isn't requested", () => {
    mockSession.mockReturnValue(session());
    renderGate();
    expect(screen.getByText("protected-page")).toBeInTheDocument();
  });

  it("shows the picker instead of the page when pickerOpen, without any session being cleared", () => {
    const s = session({ pickerOpen: true });
    mockSession.mockReturnValue(s);
    renderGate();
    expect(screen.queryByText("protected-page")).toBeNull();
    expect(screen.getByText("pages.storeAccessGateTitle")).toBeInTheDocument();
  });

  it("from Back Office: cancel says 'Back Office' and closes the picker without a PIN", () => {
    const s = session({ pickerOpen: true });
    mockSession.mockReturnValue(s);
    renderGate();
    fireEvent.click(screen.getByText("nav.backOffice"));
    expect(s.closePicker).toHaveBeenCalledTimes(1);
    expect(s.login).not.toHaveBeenCalled();
  });

  it.each([
    `/store/${STORE_ID}/pos`,
    `/store/${STORE_ID}/pos/orders`,
    `/store/${STORE_ID}/pos/kds`,
    `/store/${STORE_ID}/pos/schedule`,
    // /tables is a POS Mode route despite not being nested under /pos.
    `/store/${STORE_ID}/tables`,
  ])("from POS Mode (%s): cancel says 'POS', not 'Back Office'", (path) => {
    mockPathname.mockReturnValue(path);
    mockSession.mockReturnValue(session({ pickerOpen: true }));
    renderGate();
    expect(screen.getByText("nav.pos")).toBeInTheDocument();
    expect(screen.queryByText("nav.backOffice")).toBeNull();
  });

  it("with no session at all, the way out is still 'Back to Stores' (nothing to resume)", () => {
    mockSession.mockReturnValue(session({ isActive: false, storeId: null }));
    renderGate();
    const link = screen.getByText("nav.backToStores").closest("a");
    expect(link?.getAttribute("href")).toBe("/stores");
    expect(screen.queryByText("nav.backOffice")).toBeNull();
    expect(screen.queryByText("nav.pos")).toBeNull();
  });

  it("a stale pickerOpen flag with no session here doesn't offer 'resume' (nothing to resume)", () => {
    mockSession.mockReturnValue(session({ isActive: false, storeId: null, pickerOpen: true }));
    renderGate();
    expect(screen.getByText("nav.backToStores")).toBeInTheDocument();
    expect(screen.queryByText("nav.backOffice")).toBeNull();
  });

  it("a session for a DIFFERENT store still gets the gate, not the page", () => {
    mockSession.mockReturnValue(session({ storeId: "some-other-store" }));
    renderGate();
    expect(screen.queryByText("protected-page")).toBeNull();
  });
});
