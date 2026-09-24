import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    dateLocale: undefined,
    formatDate: (value: string | Date) => String(value),
  }),
}));
vi.mock("@/components/providers/currency-provider", () => ({
  useCurrency: () => ({ formatPrice: (value: number) => `€${value.toFixed(2)}` }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/features/dashboard/shared/hooks/use-feature-access", () => ({
  useFeatureAccess: () => ({ advancedReportsAccess: true }),
}));
vi.mock("@/components/ui/export-button", () => ({ ExportButton: () => <button>export</button> }));

vi.mock("@/features/dashboard/data/materials/hooks/use-materials", () => ({
  useMaterials: () => ({
    isLoading: false,
    data: {
      materials: [
        {
          id: "m1",
          name: "Farine T55",
          sku: "MAT-1",
          category: "Flour",
          currentStock: 500,
          minStock: 100,
          maxStock: 1000,
          unit: "g",
          unitCost: 0.01,
          expirationDate: null,
        },
        {
          id: "m2",
          name: "Beurre",
          sku: "MAT-2",
          category: null,
          currentStock: -3,
          minStock: 0,
          maxStock: 10,
          unit: "kg",
          unitCost: 8,
          expirationDate: null,
        },
      ],
    },
  }),
  useUpdateMaterial: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/features/dashboard/data/products/hooks/use-products", () => ({
  useProducts: () => ({
    isLoading: false,
    data: {
      products: [
        {
          id: "p1",
          name: "Baguette",
          sku: "BAG-1",
          category: null,
          currentStock: 0,
          minStock: 0,
          maxStock: 1000,
          unit: "pcs",
          costPrice: 0.3,
          stockMode: "BATCH_PRODUCED",
        },
        // Made to order: no counted balance, so it never gets a tile.
        {
          id: "p2",
          name: "Café",
          sku: "CAF-1",
          category: null,
          currentStock: 0,
          minStock: 0,
          maxStock: 0,
          unit: "cup",
          costPrice: 0.5,
          stockMode: "MADE_TO_ORDER",
        },
      ],
    },
  }),
}));
vi.mock("../hooks/use-stock-adjustment", () => ({
  useStockAdjustment: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// The layers the details dialog swaps to. Stubbed so the test sees exactly
// which layer is open and for which item.
type LayerProps = { open: boolean; onOpenChange: (open: boolean) => void };
vi.mock("../stock-adjustment-dialog", () => ({
  StockAdjustmentDialog: ({ open, itemId }: LayerProps & { itemId?: string }) =>
    open ? <div data-testid="adjust-layer">adjust:{itemId}</div> : null,
}));
vi.mock("../adjustment-history-dialog", () => ({
  AdjustmentHistoryDialog: ({
    open,
    onOpenChange,
    itemId,
  }: LayerProps & { itemId: string | null }) =>
    open ? (
      <div data-testid="history-layer">
        history:{itemId}
        <button onClick={() => onOpenChange(false)}>close history</button>
      </div>
    ) : null,
}));
vi.mock("../bulk-adjustment-dialog", () => ({
  BulkAdjustmentDialog: ({
    open,
    onOpenChange,
    selectedItems,
  }: LayerProps & { selectedItems: { id: string }[] }) =>
    open ? (
      <div data-testid="bulk-layer">
        bulk:{selectedItems.map((i) => i.id).join(",")}
        <button onClick={() => onOpenChange(false)}>close bulk</button>
      </div>
    ) : null,
}));
vi.mock("../../waste/waste-form-dialog", () => ({
  WasteFormDialog: ({ open, onOpenChange, itemId }: LayerProps & { itemId?: string }) =>
    open ? (
      <div data-testid="waste-layer">
        waste:{itemId ?? "none"}
        <button onClick={() => onOpenChange(false)}>close waste</button>
      </div>
    ) : null,
}));
vi.mock("../csv-import-dialog", () => ({ CSVImportDialog: () => null }));

import { EditStockCard } from "../edit-stock";

function openTile(name: string) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(name) }));
  return screen.findByRole("dialog", { name });
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("EditStockCard — item cards + details dialog", () => {
  it("renders one card per counted stock item, sized to its content", () => {
    render(<EditStockCard />);

    const tiles = screen.getAllByTestId("stock-tile");
    expect(tiles).toHaveLength(3);
    tiles.forEach((tile) => expect(tile).not.toHaveClass("aspect-square"));
    expect(screen.queryByText("Café")).not.toBeInTheDocument();

    const beurre = tiles.find((tile) => within(tile).queryByText("Beurre"))!;
    expect(within(beurre).getByText("Oversold")).toBeInTheDocument();
  });

  it("opens the item's details in a dialog when its tile is clicked", async () => {
    render(<EditStockCard />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const dialog = await openTile("Farine T55");
    expect(within(dialog).getByText("SKU: MAT-1")).toBeInTheDocument();
    expect(within(dialog).getByText("management.editStock.stockInfo")).toBeInTheDocument();
    expect(within(dialog).getByText("€5.00")).toBeInTheDocument();
  });

  it("ticks the tile's checkbox without opening the dialog", () => {
    render(<EditStockCard />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Farine T55" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "management.editStock.bulkAdjust (1)" })
    ).toBeInTheDocument();
  });

  it("swaps the details dialog out for View History and brings it back after", async () => {
    render(<EditStockCard />);
    const dialog = await openTile("Farine T55");

    fireEvent.click(
      within(dialog).getByRole("button", { name: "management.editStock.viewHistory" })
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByTestId("history-layer")).toHaveTextContent("history:m1");

    fireEvent.click(screen.getByRole("button", { name: "close history" }));

    expect(await screen.findByRole("dialog", { name: "Farine T55" })).toBeInTheDocument();
    expect(screen.queryByTestId("history-layer")).not.toBeInTheDocument();
  });

  it("adjusts a material through the single-item dialog", async () => {
    render(<EditStockCard />);
    const dialog = await openTile("Farine T55");

    fireEvent.click(
      within(dialog).getByRole("button", { name: "management.editStock.adjustStock" })
    );

    expect(await screen.findByTestId("adjust-layer")).toHaveTextContent("adjust:m1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("adjusts a product through the bulk dialog, seeded with just that product", async () => {
    render(<EditStockCard />);
    const dialog = await openTile("Baguette");

    fireEvent.click(
      within(dialog).getByRole("button", { name: "management.editStock.adjustStock" })
    );

    expect(await screen.findByTestId("bulk-layer")).toHaveTextContent("bulk:p1");

    fireEvent.click(screen.getByRole("button", { name: "close bulk" }));

    expect(await screen.findByRole("dialog", { name: "Baguette" })).toBeInTheDocument();
  });

  it("records waste from the toolbar without an item and without reopening details", async () => {
    render(<EditStockCard />);

    fireEvent.click(screen.getByRole("button", { name: "waste.recordWaste" }));
    expect(screen.getByTestId("waste-layer")).toHaveTextContent("waste:none");

    fireEvent.click(screen.getByRole("button", { name: "close waste" }));

    await waitFor(() => expect(screen.queryByTestId("waste-layer")).not.toBeInTheDocument());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("records waste for the open item from the details dialog", async () => {
    render(<EditStockCard />);
    const dialog = await openTile("Beurre");

    fireEvent.click(within(dialog).getByRole("button", { name: "waste.recordWaste" }));

    expect(await screen.findByTestId("waste-layer")).toHaveTextContent("waste:m2");
  });
});

describe("EditStockCard — Grid / Columns / List layouts", () => {
  function layoutButton(mode: "grid" | "columns" | "list") {
    return screen.getByRole("button", { name: `management.editStock.view.${mode}` });
  }

  it("opens on Grid, with the switch showing it", () => {
    render(<EditStockCard />);

    expect(layoutButton("grid")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByTestId("stock-tile")[0].parentElement).toHaveAttribute(
      "data-view-mode",
      "grid"
    );
  });

  it.each(["columns", "list"] as const)(
    "switches to %s and keeps every item, checkbox and details dialog working",
    async (mode) => {
      render(<EditStockCard />);

      fireEvent.click(layoutButton(mode));

      expect(layoutButton(mode)).toHaveAttribute("aria-pressed", "true");
      const tiles = screen.getAllByTestId("stock-tile");
      expect(tiles).toHaveLength(3);
      expect(tiles[0].parentElement).toHaveAttribute("data-view-mode", mode);

      fireEvent.click(screen.getByRole("checkbox", { name: "Farine T55" }));
      expect(
        screen.getByRole("button", { name: "management.editStock.bulkAdjust (1)" })
      ).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      const dialog = await openTile("Farine T55");
      expect(within(dialog).getByText("SKU: MAT-1")).toBeInTheDocument();
    }
  );

  it("remembers the layout for the store", async () => {
    const { unmount } = render(<EditStockCard />);
    fireEvent.click(layoutButton("list"));
    unmount();

    render(<EditStockCard />);

    await waitFor(() => expect(layoutButton("list")).toHaveAttribute("aria-pressed", "true"));
  });
});
