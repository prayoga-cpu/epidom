import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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
      onSelectCategory={() => {}}
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
        onSelectCategory={() => {}}
        searchQuery=""
        onItemClick={() => {}}
        viewMode="columns"
        customDepartmentLabel="Hair Salon"
      />
    );
    // The category cards: the custom line's own under its own heading.
    const block = screen.getByText("Hair Salon").closest("section")!;
    expect(within(block).getByRole("button", { name: /Hair/ })).toBeInTheDocument();
    expect(within(block).queryByRole("button", { name: /Mains/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Mains/ })).toBeInTheDocument();
  });
});

describe("PosItemGrid — category cards, then the category's items", () => {
  const menu: PosMenuCategory[] = [
    {
      name: "Coffee",
      items: [
        {
          id: "c1",
          name: "Cafe Latte",
          price: 26,
          imageUrl: "/latte.png",
          isAvailable: true,
          department: "BAR",
        },
        { id: "c2", name: "Cappuccino", price: 26, isAvailable: true, department: "BAR" },
      ],
    },
    {
      name: "Pastry",
      items: [
        { id: "p1", name: "Croissant", price: 3, isAvailable: true, department: "KITCHEN" },
        { id: "p2", name: "Iced Tea", price: 4, isAvailable: true, department: "BAR" },
      ],
    },
    {
      name: "Sets",
      items: [{ id: "s1", name: "Brunch Set", price: 15, isAvailable: true, department: "BOTH" }],
    },
  ];

  /** The grid with its category state held the way PosShell holds it. */
  function Harness(props: {
    department?: "KITCHEN" | "BAR" | "CUSTOM" | null;
    searchQuery?: string;
    viewMode?: "grid" | "columns" | "list";
    onItemClick?: () => void;
  }) {
    const [category, setCategory] = useState<string | null>(null);
    return (
      <PosItemGrid
        categories={menu}
        selectedCategory={category}
        onSelectCategory={setCategory}
        selectedDepartment={props.department ?? null}
        searchQuery={props.searchQuery ?? ""}
        onItemClick={props.onItemClick ?? (() => {})}
        viewMode={props.viewMode}
      />
    );
  }

  const card = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });

  it("opens on one card per category, with its item count, and no items yet", () => {
    render(<Harness />);
    expect(screen.getByRole("heading", { level: 2, name: "pos.menu.categories" })).toBeVisible();
    expect(card("Coffee")).toHaveTextContent("pos.menu.itemCount");
    expect(card("Pastry")).toBeInTheDocument();
    expect(card("Sets")).toBeInTheDocument();
    expect(screen.queryByText("Cafe Latte")).toBeNull();
  });

  it.each(["grid", "columns", "list"] as const)(
    "%s: a card opens its items with price and image, the Back card first; Back returns to the cards",
    (viewMode) => {
      const onItemClick = vi.fn();
      const { container } = render(<Harness viewMode={viewMode} onItemClick={onItemClick} />);
      fireEvent.click(card("Coffee"));

      expect(screen.getByRole("heading", { level: 2, name: "Coffee" })).toBeInTheDocument();
      expect(screen.getByText("Cafe Latte")).toBeInTheDocument();
      expect(screen.getAllByText("EUR 26.00")).toHaveLength(2);
      if (viewMode !== "columns")
        expect(container.querySelector('img[src="/latte.png"]')).not.toBeNull();
      expect(screen.queryByText("Croissant")).toBeNull();

      // The Back card is the first tile of the items.
      const back = screen.getByRole("button", { name: /common\.actions\.back/ });
      expect(back.parentElement!.firstElementChild).toBe(back);
      expect(back).toHaveTextContent("Coffee");

      fireEvent.click(screen.getByText("Cappuccino"));
      expect(onItemClick).toHaveBeenCalledWith(expect.objectContaining({ id: "c2" }));

      fireEvent.click(back);
      expect(card("Pastry")).toBeInTheDocument();
      expect(screen.queryByText("Cafe Latte")).toBeNull();
    }
  );

  it("the Categories crumb also goes back to the cards", () => {
    render(<Harness />);
    fireEvent.click(card("Pastry"));
    fireEvent.click(screen.getByRole("button", { name: "pos.menu.categories" }));
    expect(card("Coffee")).toBeInTheDocument();
  });

  it("the Drink tab lists only categories with drinks, and only their drinks", () => {
    render(<Harness department="BAR" />);
    expect(screen.getByText("pos.menu.drink")).toBeInTheDocument();
    fireEvent.click(card("Pastry"));
    expect(screen.getByText("Iced Tea")).toBeInTheDocument();
    expect(screen.queryByText("Croissant")).toBeNull();
  });

  it("an item made in both the kitchen and the bar is under Food and under Drink", () => {
    const { unmount } = render(<Harness department="KITCHEN" />);
    expect(card("Sets")).toBeInTheDocument();
    unmount();
    render(<Harness department="BAR" />);
    expect(card("Sets")).toBeInTheDocument();
  });

  it("the Food tab keeps the cards while it has more than one category", () => {
    render(
      <PosItemGrid
        categories={menu}
        selectedCategory={null}
        onSelectCategory={() => {}}
        selectedDepartment="KITCHEN"
        searchQuery=""
        onItemClick={() => {}}
      />
    );
    // Pastry (Croissant) and Sets (BOTH) — two cards; Coffee is all drinks.
    expect(card("Pastry")).toBeInTheDocument();
    expect(card("Sets")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Coffee/ })).toBeNull();
  });

  it("with only one category there is no card to tap and no Back card", () => {
    render(
      <PosItemGrid
        categories={[menu[0]]}
        selectedCategory={null}
        onSelectCategory={() => {}}
        searchQuery=""
        onItemClick={() => {}}
      />
    );
    expect(screen.getByRole("heading", { level: 2, name: "Coffee" })).toBeInTheDocument();
    expect(screen.getByText("Cafe Latte")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /common\.actions\.back/ })).toBeNull();
    // The Categories crumb is plain text: there are no cards to go back to.
    expect(screen.queryByRole("button", { name: "pos.menu.categories" })).toBeNull();
  });

  it("an empty Food or Drink tab says where the department is set", () => {
    const drinksOnly = [menu[0]];
    render(
      <PosItemGrid
        categories={drinksOnly}
        selectedCategory={null}
        onSelectCategory={() => {}}
        selectedDepartment="KITCHEN"
        searchQuery=""
        onItemClick={() => {}}
      />
    );
    expect(screen.getByText("pos.menu.noFoodItems")).toBeInTheDocument();
  });

  it("a search skips the cards and looks through every category at once", () => {
    render(<Harness searchQuery="c" />);
    expect(screen.getByText("Cafe Latte")).toBeInTheDocument();
    expect(screen.getByText("Croissant")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Pastry" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /common\.actions\.back/ })).toBeNull();
  });
});

describe("PosItemGrid — floating toolbar", () => {
  it("floats the toolbar over the menu in a zero-height sticky strip — no row of its own", () => {
    const { container } = renderGrid("grid", {
      toolbar: <div data-testid="view-switch">switch</div>,
    });
    const scroller = container.querySelector("[data-view-mode]") as HTMLElement;
    const strip = screen.getByTestId("view-switch").closest(".sticky") as HTMLElement;
    expect(scroller).toContainElement(strip);

    // Pinned to the top of the scroller (top-0 is measured from inside its padding,
    // so it lands level with the first heading), above the tiles, right-aligned.
    for (const cls of ["sticky", "top-0", "z-10", "h-0", "items-start", "justify-end"]) {
      expect(strip.className).toContain(cls);
    }
    // Nothing reserves space for it: no height and no margin — the first category
    // starts right at the top instead of below an empty band.
    expect(strip.className).not.toMatch(/\bh-(?!0\b)\d/);
    expect(strip.className).not.toMatch(/\bm[bt]-/);
    // It still comes before the first category, so it is first in tab order too.
    const firstHeading = screen.getByRole("heading", { name: "Mains" });
    expect(
      strip.compareDocumentPosition(firstHeading) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("renders no strip without a toolbar", () => {
    const { container } = renderGrid("grid");
    expect(container.querySelector(".sticky")).toBeNull();
  });
});
