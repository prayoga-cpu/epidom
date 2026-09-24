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
vi.mock("@/features/dashboard/feedback/components/feedback-dialog", () => ({
  FeedbackDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="feedback-dialog" /> : null,
}));

const mockPathname = vi.fn(() => "/store/store-001/pos");
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: vi.fn() }),
}));
const mockUser = vi.fn(() => ({
  name: "Dara Owner",
  email: "dara@example.com",
  image: null as string | null,
}));
vi.mock("@/lib/auth-client", () => ({
  useUser: () => ({ user: mockUser() }),
}));
vi.mock("@/features/dashboard/shared/hooks/use-current-store", () => ({
  useCurrentStore: () => ({ store: { name: "Tahoma Space" } }),
}));
const mockSync = vi.fn(() => ({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  syncNow: vi.fn(),
}));
vi.mock("@/features/dashboard/shared/offline-sync-provider", () => ({
  useOfflineSyncContext: () => mockSync(),
}));

const mockSwitcher = vi.fn();
vi.mock("@/features/dashboard/shared/hooks/use-account-switcher", () => ({
  useAccountSwitcher: () => mockSwitcher(),
}));

// Both have their own suites; here only WHERE and FOR WHOM the menu mounts them matters.
vi.mock("../pos-mode-preferences", () => ({
  PosModePreferences: () => <div data-testid="preferences" />,
}));
vi.mock("../pos-mode-store-switcher", () => ({
  PosModeStoreSwitcher: ({ storeId, onNavigate }: { storeId: string; onNavigate: () => void }) => (
    <button data-testid="store-switcher" data-store-id={storeId} onClick={onNavigate} />
  ),
}));

import { PosModeOverflowMenu } from "../pos-mode-overflow-menu";

function baseSwitcher(overrides: Partial<ReturnType<typeof defaultSwitcher>> = {}) {
  return { ...defaultSwitcher(), ...overrides };
}
function defaultSwitcher() {
  return {
    posSession: { staffName: "Test Acc", staffRole: "CASHIER" } as {
      staffName: string;
      staffRole: string;
      /** Absent = a session that never carried a page list (unrestricted). */
      allowedPages?: string[] | null;
    },
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

  it("Send feedback closes the menu and opens the feedback dialog", () => {
    mockSwitcher.mockReturnValue(baseSwitcher());
    const onOpenChange = vi.fn();
    render(<PosModeOverflowMenu storeId="store-001" open={true} onOpenChange={onOpenChange} />);
    const row = screen.getByRole("button", { name: /feedback.buttonLabel/ });
    expect(screen.queryByTestId("feedback-dialog")).not.toBeInTheDocument();
    fireEvent.click(row);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByTestId("feedback-dialog")).toBeInTheDocument();
  });

  it("acting as staff: shows 'Switch Account' and 'Log out of staff session' — no direct-to-owner shortcut", () => {
    mockSwitcher.mockReturnValue(baseSwitcher({ actingAsStaff: true, hasSwitchableStaff: true }));
    renderMenu();
    expect(screen.getByText("nav.switchAccount")).toBeInTheDocument();
    expect(screen.getByText("nav.logoutStaffSession")).toBeInTheDocument();
  });

  it("owner active, other staff exist: shows the bare 'Switch Account' option", () => {
    mockSwitcher.mockReturnValue(baseSwitcher({ actingAsStaff: false, hasSwitchableStaff: true }));
    renderMenu();
    expect(screen.getByText("nav.switchAccount")).toBeInTheDocument();
    expect(screen.queryByText("nav.logoutStaffSession")).toBeNull();
  });

  it("owner active, no other staff: no switch option, still shows full logout", () => {
    mockSwitcher.mockReturnValue(baseSwitcher({ actingAsStaff: false, hasSwitchableStaff: false }));
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

describe("PosModeOverflowMenu — Shift link", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("a cashier with the POS page gets a link to the Shift page", () => {
    mockSwitcher.mockReturnValue(
      baseSwitcher({
        posSession: {
          staffName: "Sam",
          staffRole: "CASHIER",
          allowedPages: ["/pos", "/pos/orders"],
        },
      })
    );
    renderMenu();
    const link = screen.getByText("pos.shift.title").closest("a");
    expect(link).toHaveAttribute("href", "/store/store-001/pos/shift");
  });

  it("the owner persona (unrestricted) gets it too", () => {
    mockSwitcher.mockReturnValue(
      baseSwitcher({
        posSession: { staffName: "Owner", staffRole: "OWNER", allowedPages: null },
      })
    );
    renderMenu();
    expect(screen.getByText("pos.shift.title")).toBeInTheDocument();
  });

  it("kitchen holds no till, so no Shift link — but My Schedule stays", () => {
    mockSwitcher.mockReturnValue(
      baseSwitcher({
        posSession: {
          staffName: "Kim",
          staffRole: "KITCHEN",
          allowedPages: ["/pos/kds", "/pos/schedule"],
        },
      })
    );
    renderMenu();
    expect(screen.queryByText("pos.shift.title")).toBeNull();
    expect(screen.getByText("pages.scheduleMyScheduleTitle")).toBeInTheDocument();
  });

  it("a floor-only persona without the POS page has no till either", () => {
    mockSwitcher.mockReturnValue(
      baseSwitcher({
        posSession: {
          staffName: "Hana",
          staffRole: "CASHIER",
          allowedPages: ["/tables", "/pos/schedule"],
        },
      })
    );
    renderMenu();
    expect(screen.queryByText("pos.shift.title")).toBeNull();
  });
});

describe("PosModeOverflowMenu — device preferences and store switching", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("offers language and light/dark to every persona — they belong to the device, not the signed-in role", () => {
    mockSwitcher.mockReturnValue(
      baseSwitcher({ actingAsStaff: true, posSession: { staffName: "Sam", staffRole: "CASHIER" } })
    );
    renderMenu();
    expect(screen.getByTestId("preferences")).toBeInTheDocument();
  });

  it("offers them to a linked staff account too", () => {
    mockSwitcher.mockReturnValue(baseSwitcher({ actingAsStaff: true }));
    renderMenu({ linkedStaff: true });
    expect(screen.getByTestId("preferences")).toBeInTheDocument();
  });

  it("the owner's real session gets the store switcher, for this store", () => {
    mockSwitcher.mockReturnValue(baseSwitcher({ actingAsStaff: false }));
    renderMenu();
    expect(screen.getByTestId("store-switcher")).toHaveAttribute("data-store-id", "store-001");
  });

  it("a staff PIN persona doesn't — it's scoped to the store it logged into, same as Back to Stores", () => {
    mockSwitcher.mockReturnValue(baseSwitcher({ actingAsStaff: true }));
    renderMenu();
    expect(screen.queryByTestId("store-switcher")).toBeNull();
    expect(screen.queryByText("nav.backToStores")).toBeNull();
  });

  it("a linked staff account keeps it even with a persona active — the store list is its own account's", () => {
    mockSwitcher.mockReturnValue(baseSwitcher({ actingAsStaff: true }));
    renderMenu({ linkedStaff: true });
    expect(screen.getByTestId("store-switcher")).toBeInTheDocument();
  });

  it("picking a store closes the menu", () => {
    mockSwitcher.mockReturnValue(baseSwitcher({ actingAsStaff: false }));
    const onOpenChange = vi.fn();
    render(<PosModeOverflowMenu storeId="store-001" open={true} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByTestId("store-switcher"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("PosModeOverflowMenu — the drawer", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("opens as a sheet from the right, named 'More' for screen readers", () => {
    mockSwitcher.mockReturnValue(baseSwitcher());
    renderMenu();
    const sheet = screen.getByRole("dialog", { name: "common.actions.more" });
    expect(sheet).toHaveAttribute("data-slot", "sheet-content");
    expect(sheet.className).toContain("right-0");
  });

  it("heads with the persona's profile: name, translated role, store — not the owner's email", () => {
    mockSwitcher.mockReturnValue(baseSwitcher({ actingAsStaff: true }));
    renderMenu();
    expect(screen.getByText("Test Acc")).toBeInTheDocument();
    expect(screen.getByText("pages.staffRoleCashier")).toBeInTheDocument();
    expect(screen.getByText("Tahoma Space")).toBeInTheDocument();
    expect(screen.queryByText("dara@example.com")).toBeNull();
  });

  it("the owner's own session shows the account email too", () => {
    mockSwitcher.mockReturnValue(
      baseSwitcher({
        actingAsStaff: false,
        posSession: { staffName: "Owner", staffRole: "OWNER" },
      })
    );
    renderMenu();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText("pages.staffRoleOwner")).toBeInTheDocument();
    expect(screen.getByText("dara@example.com")).toBeInTheDocument();
  });

  it("with no persona at all, it falls back to the account's own name", () => {
    mockSwitcher.mockReturnValue(
      baseSwitcher({
        actingAsStaff: false,
        posSession: { staffName: null, staffRole: null } as never,
      })
    );
    renderMenu();
    expect(screen.getByText("Dara Owner")).toBeInTheDocument();
    expect(screen.getByText("pages.staffRoleOwner")).toBeInTheDocument();
  });

  it("'Sync sales' runs a full sync, and can't while offline", () => {
    const syncNow = vi.fn();
    mockSwitcher.mockReturnValue(baseSwitcher());
    mockSync.mockReturnValue({ isOnline: true, isSyncing: false, pendingCount: 0, syncNow });
    const { unmount } = renderMenu();
    fireEvent.click(screen.getByRole("button", { name: /pages\.posSyncSales/ }));
    expect(syncNow).toHaveBeenCalledTimes(1);
    unmount();

    mockSync.mockReturnValue({ isOnline: false, isSyncing: false, pendingCount: 0, syncNow });
    renderMenu();
    expect(screen.getByRole("button", { name: /pages\.posSyncSales/ })).toBeDisabled();
  });

  it("the bottom strip reports the sync state", () => {
    mockSwitcher.mockReturnValue(baseSwitcher());
    mockSync.mockReturnValue({
      isOnline: true,
      isSyncing: false,
      pendingCount: 0,
      syncNow: vi.fn(),
    });
    const { unmount } = renderMenu();
    expect(screen.getByRole("status")).toHaveTextContent("pages.posAllSalesSynced");
    unmount();

    mockSync.mockReturnValue({
      isOnline: true,
      isSyncing: false,
      pendingCount: 3,
      syncNow: vi.fn(),
    });
    const second = renderMenu();
    expect(screen.getByRole("status")).toHaveTextContent("pages.posOfflineSyncPending");
    second.unmount();

    mockSync.mockReturnValue({
      isOnline: false,
      isSyncing: false,
      pendingCount: 0,
      syncNow: vi.fn(),
    });
    renderMenu();
    expect(screen.getByRole("status")).toHaveTextContent("pages.posOfflineMessageNoPending");
  });

  it("marks the row for the page on screen", () => {
    mockSwitcher.mockReturnValue(baseSwitcher());
    mockPathname.mockReturnValue("/store/store-001/pos/schedule");
    renderMenu();
    expect(screen.getByText("pages.scheduleMyScheduleTitle").closest("a")).toHaveAttribute(
      "aria-current",
      "page"
    );
    mockPathname.mockReturnValue("/store/store-001/pos");
  });
});
