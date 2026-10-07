/**
 * The till with no menu at all: it can sell nothing, so it says where the menu
 * comes from — with a button for a viewer who can add it, and who to ask for
 * anyone else (/pos redirects the first kind before this renders; this covers
 * the second, and a menu emptied while the till is open).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PosMenuCategory } from "../../types/pos.types";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));
vi.mock("@/components/providers/currency-provider", () => ({
  useCurrency: () => ({ currency: "EUR", formatPrice: (v: number) => String(v) }),
}));
vi.mock("@/hooks/use-network-status", () => ({ useOnlineStatus: () => true }));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import { PosItemGrid } from "../pos-item-grid";

const renderGrid = (
  categories: PosMenuCategory[],
  props: Partial<Parameters<typeof PosItemGrid>[0]> = {}
) =>
  render(
    <PosItemGrid
      categories={categories}
      selectedCategory={null}
      onSelectCategory={() => {}}
      searchQuery=""
      onItemClick={() => {}}
      {...props}
    />
  );

describe("PosItemGrid with no menu", () => {
  it("a viewer who can add the menu gets a button to where it's added", () => {
    renderGrid([], { menuSetupHref: "/store/s1/data?from=pos" });
    expect(screen.getByRole("heading", { name: "pos.menu.emptyMenuTitle" })).toBeInTheDocument();
    expect(screen.getByText("pos.menu.emptyMenuBody")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "pos.menu.emptyMenuCta" })).toHaveAttribute(
      "href",
      "/store/s1/data?from=pos"
    );
  });

  it("anyone else is told who can fill it, with no dead-end button", () => {
    renderGrid([]);
    expect(screen.getByText("pos.menu.emptyMenuAskBody")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("a search or a Food tab on an empty menu still says the menu is empty", () => {
    renderGrid([{ name: "Mains", items: [] }], {
      searchQuery: "tea",
      selectedDepartment: "KITCHEN",
    });
    expect(screen.getByText("pos.menu.emptyMenuTitle")).toBeInTheDocument();
    expect(screen.queryByText("pos.menu.noItems")).toBeNull();
    expect(screen.queryByText("pos.menu.noFoodItems")).toBeNull();
  });

  it("a menu with items keeps the usual empty-tab message", () => {
    renderGrid(
      [
        {
          name: "Drinks",
          items: [{ id: "1", name: "Tea", price: 3, isAvailable: true, department: "BAR" }],
        },
      ],
      { selectedDepartment: "KITCHEN", menuSetupHref: "/store/s1/data?from=pos" }
    );
    expect(screen.getByText("pos.menu.noFoodItems")).toBeInTheDocument();
    expect(screen.queryByText("pos.menu.emptyMenuTitle")).toBeNull();
  });
});
