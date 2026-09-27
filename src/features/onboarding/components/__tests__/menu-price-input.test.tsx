import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MenuPriceInput, parseWholeAmount } from "../menu-price-input";

function Controlled({
  decimals,
  initial,
  onValue,
}: {
  decimals: number;
  initial?: number;
  onValue: (value: number | undefined) => void;
}) {
  const [value, setValue] = React.useState<number | undefined>(initial);
  return (
    <MenuPriceInput
      aria-label="Price"
      decimals={decimals}
      min={0}
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
    />
  );
}

describe("parseWholeAmount", () => {
  it("reads every separator as thousands grouping", () => {
    expect(parseWholeAmount("25.000")).toBe(25000);
    expect(parseWholeAmount("25,000")).toBe(25000);
    expect(parseWholeAmount("2 500")).toBe(2500);
    expect(parseWholeAmount("1.250.000")).toBe(1250000);
    expect(parseWholeAmount("")).toBeUndefined();
    expect(parseWholeAmount(".")).toBeUndefined();
  });
});

describe("<MenuPriceInput>", () => {
  it("zero-decimal currency: '25.000' is 25000, as typed, not 25", () => {
    const onValue = vi.fn();
    render(<Controlled decimals={0} onValue={onValue} />);
    const input = screen.getByRole("textbox", { name: "Price" });

    // Typed key by key, the way an Indonesian owner writes a price.
    for (const text of ["2", "25", "25.", "25.0", "25.00", "25.000"]) {
      fireEvent.change(input, { target: { value: text } });
    }

    expect(onValue).toHaveBeenLastCalledWith(25000);
    expect(input).toHaveValue("25.000");
    expect(input).toHaveAttribute("inputmode", "numeric");

    fireEvent.blur(input);
    expect(input).toHaveValue("25.000");
  });

  it("zero-decimal currency: a pasted '25,000' or French '2 500' works too, letters are dropped", () => {
    const onValue = vi.fn();
    render(<Controlled decimals={0} onValue={onValue} />);
    const input = screen.getByRole("textbox", { name: "Price" });

    fireEvent.change(input, { target: { value: "25,000" } });
    expect(onValue).toHaveBeenLastCalledWith(25000);

    fireEvent.change(input, { target: { value: "2 500 F" } });
    expect(onValue).toHaveBeenLastCalledWith(2500);

    fireEvent.change(input, { target: { value: "" } });
    expect(onValue).toHaveBeenLastCalledWith(undefined);
  });

  it("shows a saved amount", () => {
    render(<Controlled decimals={0} initial={18000} onValue={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: "Price" })).toHaveValue("18000");
  });

  it("a currency with decimals keeps the shared decimal input ('4,5' is 4.5)", () => {
    const onValue = vi.fn();
    render(<Controlled decimals={2} onValue={onValue} />);
    const input = screen.getByRole("textbox", { name: "Price" });
    fireEvent.change(input, { target: { value: "4,5" } });
    expect(onValue).toHaveBeenLastCalledWith(4.5);
    expect(input).toHaveAttribute("inputmode", "decimal");
  });
});
