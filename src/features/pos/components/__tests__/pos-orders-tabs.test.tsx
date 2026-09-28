import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../../hooks/use-kds-settings", () => ({
  useKdsSettings: () => ({ data: { kitchenDisplayEnabled: true } }),
  useUpdateKdsSettings: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
// Each has its own test; this file is only about the header row.
vi.mock("../pos-order-queue", () => ({ PosOrderQueue: () => null }));
vi.mock("../order-history-tab", () => ({ OrderHistoryTab: () => null }));
vi.mock("../../hooks/use-order-queue-state", () => ({
  useOrderQueueState: () => ({
    filters: { sourceFilter: "POS" },
    patchFilters: vi.fn(),
    sourceCounts: { POS: 0, ONLINE: 0 },
  }),
}));

import { PosOrdersTabs } from "../pos-orders-tabs";

describe("PosOrdersTabs — Active Queue toggle", () => {
  it("sits at the right end of the tabs' row, inset like the p-6 content below it", () => {
    render(<PosOrdersTabs storeId="store-1" canManageSettings />);
    const group = screen.getByText("pos.queue.activeQueueLabel").parentElement as HTMLElement;
    expect(group).toContainElement(screen.getByRole("switch"));
    // Same header as the Kitchen & Bar page: one row, toggle pushed right.
    const row = group.parentElement as HTMLElement;
    expect(row).toContainElement(screen.getByRole("tab", { name: /pos.history.logTab/ }));
    // Flush against the edge when it wraps onto its own line on a narrow screen was the bug.
    expect(row.className.split(/\s+/)).toEqual(expect.arrayContaining(["justify-between", "px-6"]));
  });

  it("sizes each tab to its label instead of stretching the bar across the screen", () => {
    render(<PosOrdersTabs storeId="store-1" canManageSettings />);
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab.className.split(/\s+/)).toContain("flex-none");
    }
    expect(
      screen.getByRole("tablist", { name: "pos.queue.sourceTabsLabel" }).className
    ).not.toMatch(/\bgrid\b/);
  });

  it("is not shown to a session that may not change the setting", () => {
    render(<PosOrdersTabs storeId="store-1" canManageSettings={false} />);
    expect(screen.queryByText("pos.queue.activeQueueLabel")).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
  });
});
