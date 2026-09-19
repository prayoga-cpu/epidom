import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { stubBrowserApis } from "./cart-test-utils";

vi.mock("@/components/lang/i18n-provider", async () => {
  const { translate } = await import("./cart-test-utils");
  return { useI18n: () => ({ t: translate, locale: "en" }) };
});

vi.mock("@/components/providers/currency-provider", async () => {
  const { makeCurrencyMock } = await import("./cart-test-utils");
  return { useCurrency: () => makeCurrencyMock("EUR") };
});

import { PosCustomItemDialog } from "../pos-custom-item-dialog";
import { usePosCart } from "../../hooks/use-pos-cart";

const cart = () => usePosCart.getState();

function renderDialog() {
  const onOpenChange = vi.fn();
  render(<PosCustomItemDialog open onOpenChange={onOpenChange} />);
  return { onOpenChange };
}

const description = () =>
  screen.getByLabelText("cashierCart.customItem.description") as HTMLInputElement;
const price = () => screen.getByLabelText("cashierCart.customItem.price") as HTMLInputElement;
const add = () =>
  fireEvent.click(screen.getByRole("button", { name: "cashierCart.customItem.add" }));

beforeEach(() => {
  stubBrowserApis();
  localStorage.clear();
  cart().clearCart();
});

describe("PosCustomItemDialog", () => {
  it("is named 'Custom Item' (never 'custom product')", () => {
    renderDialog();
    expect(screen.getByRole("heading", { name: "cashierCart.customItem.title" })).toBeTruthy();
  });

  it("adds a custom line to the cart with no menu item behind it", async () => {
    const { onOpenChange } = renderDialog();
    fireEvent.change(description(), { target: { value: "Delivery fee" } });
    fireEvent.change(price(), { target: { value: "4.5" } });
    add();

    await waitFor(() => expect(cart().items).toHaveLength(1));
    expect(cart().items[0]).toMatchObject({
      menuItemId: null,
      isCustom: true,
      name: "Delivery fee",
      unitPrice: 4.5,
      quantity: 1,
      department: null,
      lineTotal: 4.5,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("carries quantity, printer area and note", async () => {
    renderDialog();
    fireEvent.change(description(), { target: { value: "Gift wrap" } });
    fireEvent.change(price(), { target: { value: "2.5" } });
    fireEvent.click(screen.getByRole("button", { name: "cashierCart.item.increase" }));
    fireEvent.click(screen.getByRole("button", { name: "cashierCart.item.increase" }));
    fireEvent.click(screen.getByRole("radio", { name: "cashierCart.customItem.bar" }));
    fireEvent.change(screen.getByLabelText("cashierCart.customItem.note"), {
      target: { value: "blue paper" },
    });
    add();

    await waitFor(() => expect(cart().items).toHaveLength(1));
    expect(cart().items[0]).toMatchObject({
      quantity: 3,
      department: "BAR",
      notes: "blue paper",
      lineTotal: 7.5,
    });
  });

  it("offers Kitchen, Bar and None as the printer area, defaulting to None", () => {
    renderDialog();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual([
      "cashierCart.customItem.kitchen",
      "cashierCart.customItem.bar",
      "cashierCart.customItem.none",
    ]);
    expect(
      screen
        .getByRole("radio", { name: "cashierCart.customItem.none" })
        .getAttribute("aria-checked")
    ).toBe("true");
    for (const radio of radios) expect(radio.className).toContain("h-11");
  });

  it("Kitchen routes the line to the kitchen", async () => {
    renderDialog();
    fireEvent.change(description(), { target: { value: "Extra plate" } });
    fireEvent.change(price(), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("radio", { name: "cashierCart.customItem.kitchen" }));
    add();
    await waitFor(() => expect(cart().items[0]?.department).toBe("KITCHEN"));
  });

  it("requires a description and a positive price", async () => {
    renderDialog();
    add();
    expect(await screen.findByText("cashierCart.customItem.nameRequired")).toBeTruthy();
    expect(screen.getByText("cashierCart.customItem.priceRequired")).toBeTruthy();
    expect(cart().items).toHaveLength(0);

    fireEvent.change(description(), { target: { value: "Thing" } });
    fireEvent.change(price(), { target: { value: "0" } });
    add();
    await waitFor(() =>
      expect(screen.getByText("cashierCart.customItem.priceRequired")).toBeTruthy()
    );
    expect(cart().items).toHaveLength(0);
  });

  it("rejects a price the server would (over 100,000,000)", async () => {
    renderDialog();
    fireEvent.change(description(), { target: { value: "Yacht" } });
    fireEvent.change(price(), { target: { value: "100000001" } });
    add();
    expect(await screen.findByText("cashierCart.customItem.priceTooHigh")).toBeTruthy();
    expect(cart().items).toHaveLength(0);
  });

  it("caps the description at the server's 80 characters", () => {
    renderDialog();
    expect(description().maxLength).toBe(80);
  });

  it("shows the store's currency symbol on the price, not a hardcoded one", () => {
    renderDialog();
    expect(screen.getByText("€")).toBeTruthy();
  });

  it("doesn't let the quantity go below 1", () => {
    renderDialog();
    const decrease = screen.getByRole("button", {
      name: "cashierCart.item.decrease",
    }) as HTMLButtonElement;
    expect(decrease.disabled).toBe(true);
  });

  it("gives the stepper buttons a >=44px target", () => {
    renderDialog();
    for (const name of ["cashierCart.item.decrease", "cashierCart.item.increase"]) {
      const button = screen.getByRole("button", { name });
      expect(button.className).toContain("h-11");
      expect(button.className).toContain("w-11");
    }
  });
});
