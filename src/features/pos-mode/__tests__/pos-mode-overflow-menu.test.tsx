import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

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
    handleSwitchAccount: vi.fn(),
    handleReturnToPicker: vi.fn(),
    handleOwnerAccountLogout: vi.fn(),
  };
}

function renderMenu(props: { linkedStaff?: boolean } = {}) {
  return render(
    <PosModeOverflowMenu storeId="store-001" open={true} onOpenChange={() => {}} {...props} />
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

  it("acting as staff: shows 'Switch Account' and 'Log out of staff session' — no direct-to-owner shortcut", () => {
    mockSwitcher.mockReturnValue(baseSwitcher({ actingAsStaff: true, hasSwitchableStaff: true }));
    renderMenu();
    expect(screen.getByText("nav.switchAccount")).toBeInTheDocument();
    expect(screen.getByText("nav.logoutStaffSession")).toBeInTheDocument();
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

  describe("which action each button runs", () => {
    it("'Switch Account' only opens the picker — it never logs the current persona out", () => {
      const switcher = baseSwitcher({ actingAsStaff: true });
      mockSwitcher.mockReturnValue(switcher);
      const onOpenChange = vi.fn();
      render(<PosModeOverflowMenu storeId="store-001" open={true} onOpenChange={onOpenChange} />);

      fireEvent.click(screen.getByText("nav.switchAccount"));

      expect(switcher.handleSwitchAccount).toHaveBeenCalledTimes(1);
      expect(switcher.handleReturnToPicker).not.toHaveBeenCalled();
      expect(switcher.handleOwnerAccountLogout).not.toHaveBeenCalled();
      // The menu closes first so the picker isn't rendered behind a dialog.
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("'Log Out of Staff Session' is the destructive one", () => {
      const switcher = baseSwitcher({ actingAsStaff: true });
      mockSwitcher.mockReturnValue(switcher);
      renderMenu();

      fireEvent.click(screen.getByText("nav.logoutStaffSession"));

      expect(switcher.handleReturnToPicker).toHaveBeenCalledTimes(1);
      expect(switcher.handleSwitchAccount).not.toHaveBeenCalled();
    });

    it("an owner with other staff to pick from gets the same non-destructive Switch Account", () => {
      const switcher = baseSwitcher({ actingAsStaff: false, hasSwitchableStaff: true });
      mockSwitcher.mockReturnValue(switcher);
      renderMenu();

      fireEvent.click(screen.getByText("nav.switchAccount"));

      expect(switcher.handleSwitchAccount).toHaveBeenCalledTimes(1);
      expect(switcher.handleReturnToPicker).not.toHaveBeenCalled();
    });

    it("no 'switch straight to Owner' shortcut exists any more", () => {
      mockSwitcher.mockReturnValue(baseSwitcher({ actingAsStaff: true, hasSwitchableStaff: true }));
      renderMenu();
      expect(screen.queryByText(/pages\.staffRoleOwner/)).toBeNull();
      expect(screen.getAllByText("nav.switchAccount")).toHaveLength(1);
    });
  });
});

describe("PosModeOverflowMenu — a linked staff account (signed in as themselves)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("hides Back Office even for a Manager: staff logins are POS Mode only, it would just bounce them back", () => {
    mockSwitcher.mockReturnValue(
      baseSwitcher({ posSession: { staffName: "Mia", staffRole: "MANAGER" } })
    );
    renderMenu({ linkedStaff: true });
    expect(screen.queryByText("nav.backOffice")).toBeNull();
  });

  it("the same Manager on the owner's device (PIN persona, not linked) still gets Back Office", () => {
    mockSwitcher.mockReturnValue(
      baseSwitcher({ posSession: { staffName: "Mia", staffRole: "MANAGER" } })
    );
    renderMenu({ linkedStaff: false });
    expect(screen.getByText("nav.backOffice")).toBeInTheDocument();
  });

  it("offers no 'Switch Account' — a linked account can only ever be itself", () => {
    mockSwitcher.mockReturnValue(baseSwitcher({ actingAsStaff: true, hasSwitchableStaff: true }));
    renderMenu({ linkedStaff: true });
    expect(screen.queryByText("nav.switchAccount")).toBeNull();
    // ...but locking the till back to the PIN screen is still theirs to do.
    expect(screen.getByText("nav.logoutStaffSession")).toBeInTheDocument();
  });

  it("keeps 'Back to Stores' even while a PIN persona is active (it's their own account's store list)", () => {
    mockSwitcher.mockReturnValue(baseSwitcher({ actingAsStaff: true }));
    renderMenu({ linkedStaff: true });
    expect(screen.getByText("nav.backToStores")).toBeInTheDocument();
  });

  it("calls the account logout 'Log Out', not 'Log Out of Owner Account'", () => {
    mockSwitcher.mockReturnValue(baseSwitcher());
    renderMenu({ linkedStaff: true });
    expect(screen.getByText("nav.logoutAccount")).toBeInTheDocument();
    expect(screen.queryByText("nav.logoutOwnerAccount")).toBeNull();
  });
});
