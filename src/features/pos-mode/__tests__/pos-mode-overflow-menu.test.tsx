import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

vi.mock("@/features/pos/hooks/use-customer-display-settings", () => ({
  useCustomerDisplaySettings: (selector: (s: any) => any) =>
    selector({ enabled: false, setEnabled: vi.fn() }),
}));
vi.mock("@/features/pos/lib/open-customer-display", () => ({
  openCustomerDisplay: vi.fn(),
}));
vi.mock("@/features/dashboard/shared/clock-in-out-dialog", () => ({
  ClockInOutDialog: () => null,
}));
vi.mock("@/features/dashboard/shared/verify-owner-pin-dialog", () => ({
  VerifyOwnerPinDialog: () => null,
}));
vi.mock("@/features/dashboard/shared/set-owner-pin-dialog", () => ({
  SetOwnerPinDialog: () => null,
}));

const mockSwitcher = vi.fn();
vi.mock("@/features/dashboard/shared/hooks/use-account-switcher", () => ({
  useAccountSwitcher: () => mockSwitcher(),
}));

import { PosModeOverflowMenu } from "../pos-mode-overflow-menu";

function baseSwitcher(overrides: Partial<ReturnType<typeof defaultSwitcher>> = {}) {
  return { ...defaultSwitcher(), ...overrides };
}
function defaultSwitcher() {
  return {
    posSession: { staffName: "Test Acc", staffRole: "CASHIER" },
    actingAsStaff: true,
    hasSwitchableStaff: false,
    verifyOwnerOpen: false,
    setVerifyOwnerOpen: vi.fn(),
    setOwnerPinOpen: false,
    setSetOwnerPinOpen: vi.fn(),
    handleBackToOwnerClick: vi.fn(),
    handleSwitchedBackToOwner: vi.fn(),
    handleReturnToPicker: vi.fn(),
    handleOwnerAccountLogout: vi.fn(),
  };
}

function renderMenu() {
  return render(
    <PosModeOverflowMenu storeId="store-001" open={true} onOpenChange={() => {}} />
  );
}

describe("PosModeOverflowMenu — account switcher (distinct from Clock In/Out)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("Clock In/Out is always present, regardless of persona", () => {
    mockSwitcher.mockReturnValue(baseSwitcher());
    renderMenu();
    expect(screen.getByText("clockInOut.dialogTitle")).toBeInTheDocument();
  });

  it("acting as staff: shows 'Back to Owner' and 'Log out of staff session', not 'Switch Account'", () => {
    mockSwitcher.mockReturnValue(baseSwitcher({ actingAsStaff: true, hasSwitchableStaff: true }));
    renderMenu();
    expect(screen.getByText(/nav\.switchAccount \(pages\.staffRoleOwner\)/)).toBeInTheDocument();
    expect(screen.getByText("nav.logoutStaffSession")).toBeInTheDocument();
    // The bare "Switch Account" (owner picking a different staffer) is a
    // different button, only shown when NOT acting as staff.
    expect(screen.queryByText(/^nav\.switchAccount$/)).toBeNull();
  });

  it("owner active, other staff exist: shows the bare 'Switch Account' option", () => {
    mockSwitcher.mockReturnValue(
      baseSwitcher({ actingAsStaff: false, hasSwitchableStaff: true })
    );
    renderMenu();
    expect(screen.getByText("nav.switchAccount")).toBeInTheDocument();
    expect(screen.queryByText("nav.logoutStaffSession")).toBeNull();
  });

  it("owner active, no other staff: no switch option, still shows full logout", () => {
    mockSwitcher.mockReturnValue(
      baseSwitcher({ actingAsStaff: false, hasSwitchableStaff: false })
    );
    renderMenu();
    expect(screen.queryByText("nav.switchAccount")).toBeNull();
    expect(screen.getByText("nav.logoutOwnerAccount")).toBeInTheDocument();
  });

  it("full account logout is always present", () => {
    mockSwitcher.mockReturnValue(baseSwitcher());
    renderMenu();
    expect(screen.getByText("nav.logoutOwnerAccount")).toBeInTheDocument();
  });

  it("Back Office link only shows for OWNER/MANAGER, not Cashier/Kitchen", () => {
    mockSwitcher.mockReturnValue(
      baseSwitcher({ posSession: { staffName: "Cashier Test", staffRole: "CASHIER" } })
    );
    renderMenu();
    expect(screen.queryByText("nav.backOffice")).toBeNull();
  });

  it("Back Office link shows for MANAGER", () => {
    mockSwitcher.mockReturnValue(
      baseSwitcher({ posSession: { staffName: "Manager Test", staffRole: "MANAGER" } })
    );
    renderMenu();
    expect(screen.getByText("nav.backOffice")).toBeInTheDocument();
  });

  it("Back Office link defaults to /dashboard with no resume history", () => {
    mockSwitcher.mockReturnValue(
      baseSwitcher({ posSession: { staffName: "Owner Test", staffRole: "OWNER" } })
    );
    renderMenu();
    const link = screen.getByText("nav.backOffice").closest("a");
    expect(link?.getAttribute("href")).toBe("/store/store-001/dashboard");
  });

  it("Back Office link resumes the last Back Office section visited in this store", async () => {
    localStorage.setItem("epidom:lastVisitedBackOffice", "/store/store-001/finance");
    mockSwitcher.mockReturnValue(
      baseSwitcher({ posSession: { staffName: "Owner Test", staffRole: "OWNER" } })
    );
    renderMenu();
    const link = await screen.findByText("nav.backOffice");
    expect(link.closest("a")?.getAttribute("href")).toBe("/store/store-001/finance");
  });

  it("Back Office link ignores resume history saved for a different store", async () => {
    localStorage.setItem("epidom:lastVisitedBackOffice", "/store/some-other-store/finance");
    mockSwitcher.mockReturnValue(
      baseSwitcher({ posSession: { staffName: "Owner Test", staffRole: "OWNER" } })
    );
    renderMenu();
    const link = await screen.findByText("nav.backOffice");
    expect(link.closest("a")?.getAttribute("href")).toBe("/store/store-001/dashboard");
  });

  it("Back to Stores shows when not acting as staff (real owner session)", () => {
    mockSwitcher.mockReturnValue(baseSwitcher({ actingAsStaff: false, hasSwitchableStaff: false }));
    renderMenu();
    expect(screen.getByText("nav.backToStores")).toBeInTheDocument();
  });

  it("Back to Stores is hidden while acting as a staff PIN persona", () => {
    mockSwitcher.mockReturnValue(baseSwitcher({ actingAsStaff: true }));
    renderMenu();
    expect(screen.queryByText("nav.backToStores")).toBeNull();
  });
});
