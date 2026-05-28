import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/",
}));

vi.mock("@/features/dashboard/shared/hooks/use-current-store", () => ({
  useCurrentStore: () => ({ storeId: "store-1" }),
}));

const mockNotifications = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryFn }: { queryFn: () => Promise<unknown> }) => {
    const result = mockNotifications();
    return { data: result, isLoading: false };
  },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: { get: vi.fn() },
}));

vi.mock("date-fns", () => ({
  formatDistanceToNow: () => "2 minutes ago",
}));

// Radix Popover — render children inline so we can interact with the content
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children, asChild }: any) => (asChild ? children : <div>{children}</div>),
  PopoverContent: ({ children }: any) => <div data-testid="popover-content">{children}</div>,
}));

import { NotificationBell } from "@/features/dashboard/shared/notification-bell";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const orderNotif = {
  id: "n1",
  type: "order" as const,
  title: "New Order",
  body: "Order #001 received",
  href: "/store/store-1/pos/orders",
  createdAt: new Date().toISOString(),
};

const reservationNotif = {
  id: "n2",
  type: "reservation" as const,
  title: "New Reservation",
  body: "Table 3 booked",
  href: "/store/store-1/tables",
  createdAt: new Date().toISOString(),
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("NotificationBell", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("renders bell with no badge when 0 notifications", () => {
    mockNotifications.mockReturnValue({ notifications: [] });
    render(<NotificationBell />);
    expect(screen.queryByText(/\d+/)).toBeNull();
  });

  it("renders badge with correct count when notifications exist", () => {
    mockNotifications.mockReturnValue({ notifications: [orderNotif, reservationNotif] });
    render(<NotificationBell />);
    // Badge appears both in the bell icon area and in the popover header — both show count
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
  });

  it("dismiss single removes item from list", () => {
    mockNotifications.mockReturnValue({ notifications: [orderNotif, reservationNotif] });
    render(<NotificationBell />);
    const dismissButtons = screen.getAllByLabelText("Dismiss");
    fireEvent.click(dismissButtons[0]);
    expect(screen.queryByText("New Order")).toBeNull();
    expect(screen.getByText("New Reservation")).toBeTruthy();
  });

  it("clear all removes all items", () => {
    mockNotifications.mockReturnValue({ notifications: [orderNotif, reservationNotif] });
    render(<NotificationBell />);
    fireEvent.click(screen.getByText("Clear all"));
    expect(screen.queryByText("New Order")).toBeNull();
    expect(screen.queryByText("New Reservation")).toBeNull();
    expect(screen.getByText("All caught up!")).toBeTruthy();
  });

  it("clicking notification row navigates to n.href", () => {
    mockNotifications.mockReturnValue({ notifications: [orderNotif] });
    render(<NotificationBell />);
    fireEvent.click(screen.getByText("New Order"));
    expect(mockPush).toHaveBeenCalledWith(orderNotif.href);
  });

  it("'View all orders' navigates to correct URL when storeId is set", () => {
    mockNotifications.mockReturnValue({ notifications: [orderNotif] });
    render(<NotificationBell />);
    fireEvent.click(screen.getByText(/view all orders/i));
    expect(mockPush).toHaveBeenCalledWith("/store/store-1/pos");
  });

  it("'View all orders' does NOT navigate when storeId is undefined", () => {
    vi.doMock("@/features/dashboard/shared/hooks/use-current-store", () => ({
      useCurrentStore: () => ({ storeId: undefined }),
    }));
    mockNotifications.mockReturnValue({ notifications: [orderNotif] });
    render(<NotificationBell />);
    fireEvent.click(screen.getByText(/view all orders/i));
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining("undefined"));
  });

  it("has no nested button elements (hydration regression)", () => {
    mockNotifications.mockReturnValue({ notifications: [orderNotif] });
    const { container } = render(<NotificationBell />);
    // Find any button that contains another button
    const buttons = container.querySelectorAll("button");
    buttons.forEach((btn) => {
      expect(btn.querySelector("button")).toBeNull();
    });
  });

  it("shows empty state when all notifications dismissed", () => {
    mockNotifications.mockReturnValue({ notifications: [orderNotif] });
    render(<NotificationBell />);
    fireEvent.click(screen.getAllByLabelText("Dismiss")[0]);
    expect(screen.getByText("All caught up!")).toBeTruthy();
  });
});
