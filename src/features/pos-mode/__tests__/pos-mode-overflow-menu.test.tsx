import { describe, it, expect, vi } from "vitest";
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
    <PosModeOverflowMenu storeId="store-1" open={true} onOpenChange={() => {}} />
  );
}

describe("PosModeOverflowMenu — account switcher (distinct from Clock In/Out)", () => {
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

  it("Dashboard link only shows for OWNER/MANAGER, not Cashier/Kitchen", () => {
    mockSwitcher.mockReturnValue(
      baseSwitcher({ posSession: { staffName: "Cashier Test", staffRole: "CASHIER" } })
    );
    renderMenu();
    expect(screen.queryByText("nav.dashboard")).toBeNull();
  });

  it("Dashboard link shows for MANAGER", () => {
    mockSwitcher.mockReturnValue(
      baseSwitcher({ posSession: { staffName: "Manager Test", staffRole: "MANAGER" } })
    );
    renderMenu();
    expect(screen.getByText("nav.dashboard")).toBeInTheDocument();
  });
});
