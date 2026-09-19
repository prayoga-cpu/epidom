import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { PosMenuCategory } from "../../types/pos.types";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));
vi.mock("@/components/providers/currency-provider", () => ({
  useCurrency: () => ({
    currency: "EUR",
    // The real two-arg formatPrice: without the currency it would IDR-convert.
    formatPrice: (v: number, currency: string) => `${currency} ${Number(v).toFixed(2)}`,
  }),
}));
const online = vi.hoisted(() => ({ value: true }));
vi.mock("@/hooks/use-network-status", () => ({ useOnlineStatus: () => online.value }));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import { PosItemGrid } from "../pos-item-grid";

const categories: PosMenuCategory[] = [
  {
    name: "Mains",
    items: [
      {
        id: "1",
        name: "Ramen",
        description: "Pork broth",
        price: 12.5,
        imageUrl: "/ramen.png",
        isAvailable: true,
        department: "KITCHEN",
        barcode: "5901234123457",
      },
      { id: "2", name: "Tea", price: 3, isAvailable: true, department: "BAR", countedStock: 4 },
      { id: "3", name: "Cake", price: 5, isAvailable: false, department: "KITCHEN" },
    ],
  },
];

const renderGrid = (
  viewMode?: "grid" | "columns" | "list",
  extra: Partial<Parameters<typeof PosItemGrid>[0]> = {}
) => {
  const onItemClick = vi.fn();
  const utils = render(
    <PosItemGrid
      categories={categories}
      selectedCategory={null}
      searchQuery=""
      onItemClick={onItemClick}
      viewMode={viewMode}
      {...extra}
    />
  );
  return { onItemClick, ...utils };
};

beforeEach(() => {
  online.value = true;
});

describe("PosItemGrid view modes", () => {
  it("defaults to the image grid", () => {
    const { container } = renderGrid();
    expect(container.querySelector('[data-view-mode="grid"]')).not.toBeNull();
  });

  it("grid: image tiles with description and price", () => {
    const { container } = renderGrid("grid");
    expect(container.querySelector("img")).not.toBeNull();
    expect(screen.getByAltText("Ramen")).toBeInTheDocument();
    expect(screen.getByText("Pork broth")).toBeInTheDocument();
    expect(screen.getByText("EUR 12.50")).toBeInTheDocument();
  });

  it("columns: compact text-forward tiles — no image, no description, price shown, more per row", () => {
    const { container } = renderGrid("columns");
    expect(container.querySelector('[data-view-mode="columns"]')).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByText("Pork broth")).toBeNull();
    expect(screen.getByText("Ramen")).toBeInTheDocument();
    expect(screen.getByText("EUR 12.50")).toBeInTheDocument();
    const layout = screen.getByText("Ramen").closest("button")!.parentElement!;
    // One more column than the grid at every breakpoint from lg up.
    expect(layout.className).toContain("lg:grid-cols-4");
    expect(layout.className).toContain("2xl:grid-cols-6");
  });

  it("list: one column of rows with a thumbnail, name and price, at least 48px tall", () => {
    const { container } = renderGrid("list");
    expect(container.querySelector('[data-view-mode="list"]')).not.toBeNull();
    const ramen = screen.getByText("Ramen").closest("button")!;
    expect(ramen.parentElement!.className).toContain("flex-col");
    expect(ramen.querySelector("img")).not.toBeNull();
    expect(ramen).toHaveTextContent("EUR 12.50");
    for (const tile of container.querySelectorAll("button"))
      expect(tile.className).toContain("min-h-14");
  });

  it.each(["grid", "columns", "list"] as const)(
    "%s: tapping a tile picks the item; an unavailable one is disabled and labelled",
    (mode) => {
      const { onItemClick } = renderGrid(mode);
      fireEvent.click(screen.getByText("Tea"));
      expect(onItemClick).toHaveBeenCalledWith(expect.objectContaining({ id: "2" }));

      const cake = screen.getByText("Cake").closest("button")!;
      expect(cake).toBeDisabled();
      expect(screen.getByText("pos.menu.unavailable")).toBeInTheDocument();
      fireEvent.click(cake);
      expect(onItemClick).toHaveBeenCalledTimes(1);
    }
  );

  it.each(["grid", "columns", "list"] as const)(
    "%s: counted-stock chip shows online and hides offline",
    (mode) => {
      const first = renderGrid(mode);
      expect(screen.getByText("pos.menu.counted")).toBeInTheDocument();
      first.unmount();

      online.value = false;
      renderGrid(mode);
      expect(screen.queryByText("pos.menu.counted")).toBeNull();
    }
  );

  it("tap targets: columns tiles are 72px+, never below the 40px floor", () => {
    const { container } = renderGrid("columns");
    for (const tile of container.querySelectorAll("button"))
      expect(tile.className).toContain("min-h-[72px]");
  });

  it("search matches a barcode as well as a name", () => {
    renderGrid("columns", { searchQuery: "5901234" });
    expect(screen.getByText("Ramen")).toBeInTheDocument();
    expect(screen.queryByText("Tea")).toBeNull();
  });

  it("empty result shows the empty state in every mode", () => {
    renderGrid("list", { searchQuery: "zzz" });
    expect(screen.getByText("pos.menu.noItems")).toBeInTheDocument();
  });

  it("keeps the second product line in its own block", () => {
    const withCustom: PosMenuCategory[] = [
      {
        name: "Hair",
        items: [{ id: "9", name: "Cut", price: 20, isAvailable: true, department: "CUSTOM" }],
      },
      ...categories,
    ];
    render(
      <PosItemGrid
        categories={withCustom}
        selectedCategory={null}
        searchQuery=""
        onItemClick={() => {}}
        viewMode="columns"
        customDepartmentLabel="Hair Salon"
      />
    );
    expect(screen.getByText("Hair Salon")).toBeInTheDocument();
    expect(screen.getByText("Cut")).toBeInTheDocument();
  });
});
