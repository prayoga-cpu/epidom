import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("../hooks/use-stock-adjustment", () => ({
  useStockAdjustment: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { BulkAdjustmentDialog } from "../bulk-adjustment-dialog";
import { stubResizeObserver } from "@/features/dashboard/data/promotions/__tests__/test-utils";

// Radix Checkbox measures itself; jsdom has no ResizeObserver.
beforeAll(stubResizeObserver);

const baguette = {
  id: "p1",
  name: "Baguette Tradition",
  currentStock: 4,
  unit: "pcs",
  type: "product" as const,
};

describe("BulkAdjustmentDialog", () => {
  // The Stock page mounts it with nothing selected, then selects and opens it.
  it("loads the items selected when it opens, not the ones it mounted with", () => {
    const { rerender } = render(
      <BulkAdjustmentDialog selectedItems={[]} open={false} onOpenChange={vi.fn()} />
    );

    rerender(<BulkAdjustmentDialog selectedItems={[baguette]} open onOpenChange={vi.fn()} />);

    expect(screen.getByText("Baguette Tradition")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "management.editStock.recordAdjustments (1)" })
    ).toBeEnabled();
    expect(screen.queryByText("management.editStock.noItemsSelected")).not.toBeInTheDocument();
  });
});
