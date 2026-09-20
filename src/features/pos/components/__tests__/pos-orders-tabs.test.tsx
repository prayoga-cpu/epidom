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

import { PosOrdersTabs } from "../pos-orders-tabs";

describe("PosOrdersTabs — Active Queue toggle", () => {
  it("sits inset from the screen edge, lined up with the p-6 content below it", () => {
    render(<PosOrdersTabs storeId="store-1" canManageSettings />);
    const group = screen.getByText("pos.queue.activeQueueLabel").parentElement as HTMLElement;
    // Flush against the edge when it wraps onto its own line on a narrow screen was the bug.
    expect(group.className.split(/\s+/)).toContain("ml-6");
    expect(group).toContainElement(screen.getByRole("switch"));
  });

  it("is not shown to a session that may not change the setting", () => {
    render(<PosOrdersTabs storeId="store-1" canManageSettings={false} />);
    expect(screen.queryByText("pos.queue.activeQueueLabel")).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
  });
});
