import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  onOpenChange: vi.fn(),
}));

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/features/dashboard/data/materials/hooks/use-materials", () => ({
  useMaterials: () => ({
    data: { materials: [{ id: "m1", name: "Farine T55", currentStock: 500, unit: "g" }] },
  }),
}));
vi.mock("../hooks/use-stock-adjustment", () => ({
  useStockAdjustment: () => ({ mutateAsync: h.mutateAsync, isPending: false }),
}));

import { StockAdjustmentDialog } from "../stock-adjustment-dialog";

beforeEach(() => {
  h.mutateAsync.mockResolvedValue({});
});

describe("StockAdjustmentDialog — reason is optional", () => {
  it("labels Reason without the required marker", () => {
    render(
      <StockAdjustmentDialog open onOpenChange={h.onOpenChange} itemId="m1" itemType="material" />
    );

    expect(screen.getByText("management.editStock.reason")).toBeInTheDocument();
    expect(screen.queryByText("management.editStock.reason *")).not.toBeInTheDocument();
  });

  it("records an adjustment when no reason is picked", async () => {
    render(
      <StockAdjustmentDialog open onOpenChange={h.onOpenChange} itemId="m1" itemType="material" />
    );

    fireEvent.change(screen.getByPlaceholderText("0.000"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "management.editStock.recordAdjustment" }));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    const [input] = h.mutateAsync.mock.calls[0];
    expect(input).toMatchObject({ materialId: "m1", adjustmentType: "IN", quantity: 5 });
    expect(input.reason).toBeUndefined();
    await waitFor(() => expect(h.onOpenChange).toHaveBeenCalledWith(false));
  });
});
