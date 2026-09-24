import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

const mockPathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

const mockStaff = vi.fn<() => unknown[]>(() => []);
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { staff: mockStaff() }, isLoading: false }),
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
vi.mock("../verify-owner-pin-dialog", () => ({
  VerifyOwnerPinDialog: ({ open }: { open: boolean }) =>
    open ? <div>verify-owner-pin</div> : null,
}));
vi.mock("../set-owner-pin-dialog", () => ({ SetOwnerPinDialog: () => null }));

import { StoreAccessGate } from "../store-access-gate";

const STORE_ID = "store-abc12345";

function session(overrides: Record<string, unknown> = {}) {
  return {
    isActive: true,
    storeId: STORE_ID,
    staffId: null,
    staffRole: null,
    pickerOpen: false,
    closePicker: vi.fn(),
    login: vi.fn(),
    ...overrides,
  };
}

function member(id: string, name: string) {
  return { id, name, role: "CASHIER", isActive: true, hasPin: true, allowedPages: null };
}

function renderGate(props: { forcePicker?: boolean } = {}) {
  return render(
    <StoreAccessGate storeId={STORE_ID} {...props}>
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
    `/store/${STORE_ID}/pos/operational`,
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

describe("StoreAccessGate — the already-logged-in persona's own card", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    mockPathname.mockReturnValue(`/store/${STORE_ID}/dashboard`);
    mockStaff.mockReturnValue([member("staff-1", "Test Acc"), member("staff-2", "Testing")]);
    // No PIN entered + a non-ok reply is what a PIN-protected staffer looks like.
    fetchMock.mockReset().mockResolvedValue({ ok: false, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockStaff.mockReturnValue([]);
  });

  const cardFor = (name: string) => screen.getByText(name).closest("button") as HTMLButtonElement;

  it("marks only the active staffer's card as current", () => {
    mockSession.mockReturnValue(
      session({ pickerOpen: true, staffId: "staff-1", staffRole: "CASHIER" })
    );
    renderGate();
    expect(cardFor("Test Acc").getAttribute("aria-current")).toBe("true");
    expect(cardFor("Testing").getAttribute("aria-current")).toBeNull();
  });

  it("clicking your own card resumes the session — no PIN step, no re-login", () => {
    const s = session({ pickerOpen: true, staffId: "staff-1", staffRole: "CASHIER" });
    mockSession.mockReturnValue(s);
    renderGate();
    fireEvent.click(cardFor("Test Acc"));
    expect(s.closePicker).toHaveBeenCalledTimes(1);
    expect(s.login).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText("pages.staffAuthEnterPin")).toBeNull();
  });

  it("clicking someone ELSE's card still goes through PIN entry", async () => {
    const s = session({ pickerOpen: true, staffId: "staff-1", staffRole: "CASHIER" });
    mockSession.mockReturnValue(s);
    renderGate();
    fireEvent.click(cardFor("Testing"));
    expect(await screen.findByText("pages.staffAuthEnterPin")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(s.closePicker).not.toHaveBeenCalled();
  });

  it("owner active: 'Continue as Owner' is the current card and resumes without the Owner PIN", () => {
    const s = session({ pickerOpen: true, staffId: "owner", staffRole: "OWNER" });
    mockSession.mockReturnValue(s);
    renderGate();
    const btn = screen.getByText("pages.storeAccessGateContinueAsOwner").closest("button")!;
    expect(btn.getAttribute("aria-current")).toBe("true");
    // Nobody in the staff grid is marked when the owner is the one logged in.
    expect(cardFor("Test Acc").getAttribute("aria-current")).toBeNull();
    fireEvent.click(btn);
    expect(s.closePicker).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("verify-owner-pin")).toBeNull();
  });

  it("staffer active: 'Continue as Owner' is not marked and still asks for the Owner PIN", () => {
    const s = session({ pickerOpen: true, staffId: "staff-1", staffRole: "CASHIER" });
    mockSession.mockReturnValue(s);
    renderGate();
    const btn = screen.getByText("pages.storeAccessGateContinueAsOwner").closest("button")!;
    expect(btn.getAttribute("aria-current")).toBeNull();
    fireEvent.click(btn);
    expect(screen.getByText("verify-owner-pin")).toBeInTheDocument();
    expect(s.closePicker).not.toHaveBeenCalled();
  });

  it("forcePicker (server no longer agrees with the local persona): nothing is marked or resumable", () => {
    const s = session({ pickerOpen: true, staffId: "staff-1", staffRole: "CASHIER" });
    mockSession.mockReturnValue(s);
    renderGate({ forcePicker: true });
    expect(cardFor("Test Acc").getAttribute("aria-current")).toBeNull();
    fireEvent.click(cardFor("Test Acc"));
    expect(s.closePicker).not.toHaveBeenCalled();
  });
});
