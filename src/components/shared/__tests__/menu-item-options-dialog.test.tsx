import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { MergedOptionGroup } from "@/lib/utils/menu-item-options";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));

import { MenuItemOptionsDialog } from "../menu-item-options-dialog";

// jsdom has no layout; the dialog scrolls a skipped step into view.
Element.prototype.scrollIntoView = vi.fn();

const groups: MergedOptionGroup[] = [
  {
    name: "Base",
    isRequired: true,
    maxSelections: 1,
    options: [
      { name: "Rice", priceAdjustment: 0 },
      { name: "Quinoa", priceAdjustment: 5 },
    ],
  },
  {
    name: "Toppings",
    isRequired: false,
    maxSelections: 2,
    options: [
      { name: "Egg", priceAdjustment: 4 },
      { name: "Corn", priceAdjustment: 2 },
      { name: "Nori", priceAdjustment: 1 },
    ],
  },
];

const renderDialog = (buildYourOwn: boolean) => {
  const onConfirm = vi.fn();
  render(
    <MenuItemOptionsDialog
      open
      onOpenChange={() => {}}
      itemName="Poke Bowl"
      groups={groups}
      basePrice={30}
      buildYourOwn={buildYourOwn}
      formatPrice={(n) => `€${n.toFixed(2)}`}
      onConfirm={onConfirm}
    />
  );
  return { onConfirm };
};

const option = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });

describe("MenuItemOptionsDialog — Build Your Own", () => {
  it("numbers the steps and shows each step's pick limit", () => {
    renderDialog(true);
    expect(screen.getByText("pos.options.byoHint")).toBeInTheDocument();
    expect(screen.getByText("pos.options.pickOne")).toBeInTheDocument();
    expect(screen.getByText("pos.options.pickUpTo")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("blocks a third topping once the step is full, and frees it on unpick", () => {
    renderDialog(true);
    fireEvent.click(option("Egg"));
    fireEvent.click(option("Corn"));
    expect(option("Nori")).toBeDisabled();
    fireEvent.click(option("Egg"));
    expect(option("Nori")).not.toBeDisabled();
  });

  it("keeps a running total of the base price and the picks", () => {
    renderDialog(true);
    expect(screen.getByText("€30.00")).toBeInTheDocument();
    fireEvent.click(option("Quinoa"));
    fireEvent.click(option("Egg"));
    expect(screen.getByText("€39.00")).toBeInTheDocument();
  });

  it("will not add the item with the required base skipped", () => {
    const { onConfirm } = renderDialog(true);
    fireEvent.click(option("Egg"));
    fireEvent.click(screen.getByRole("button", { name: "pos.options.addToCart" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/publicOrder.itemDetail.selectOptionAlert "Base"/)).toBeInTheDocument();
  });

  it("adds the build once every required step is picked", () => {
    const { onConfirm } = renderDialog(true);
    fireEvent.click(option("Rice"));
    fireEvent.click(option("Egg"));
    fireEvent.click(screen.getByRole("button", { name: "pos.options.addToCart" }));
    expect(onConfirm).toHaveBeenCalledWith({
      selectedOptions: [
        expect.objectContaining({ groupName: "Base", optionName: "Rice" }),
        expect.objectContaining({ groupName: "Toppings", optionName: "Egg" }),
      ],
      notes: "",
    });
  });
});

describe("MenuItemOptionsDialog — regular options (Build Your Own off)", () => {
  it("keeps the old behaviour: a full group swaps out the oldest pick", () => {
    renderDialog(false);
    expect(screen.queryByText("pos.options.byoHint")).not.toBeInTheDocument();
    fireEvent.click(option("Egg"));
    fireEvent.click(option("Corn"));
    expect(option("Nori")).not.toBeDisabled();
    fireEvent.click(option("Nori"));
    // Egg dropped, Corn + Nori kept: 30 + 2 + 1.
    expect(screen.getByText("€33.00")).toBeInTheDocument();
  });
});
