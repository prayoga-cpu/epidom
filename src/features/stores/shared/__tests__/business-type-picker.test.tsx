import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { BUSINESS_TYPES, type BusinessType } from "@/lib/onboarding/markets";
import { BusinessTypePicker } from "../business-type-picker";
import { RENDER_TEST_TIMEOUT, renderIn } from "./helpers";

function Controlled({ onChange }: { onChange: (value: BusinessType | undefined) => void }) {
  const [value, setValue] = useState<BusinessType | undefined>();
  return (
    <BusinessTypePicker
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe("<BusinessTypePicker>", { timeout: RENDER_TEST_TIMEOUT }, () => {
  it("offers every business type as a toggle chip", () => {
    renderIn("en", <BusinessTypePicker onChange={vi.fn()} />);
    const chips = screen.getAllByRole("button");
    expect(chips).toHaveLength(BUSINESS_TYPES.length);
    chips.forEach((chip) => expect(chip).toHaveAttribute("aria-pressed", "false"));
    expect(screen.getByRole("button", { name: "Home kitchen" })).toBeInTheDocument();
  });

  it("uses the French labels", () => {
    renderIn("fr", <BusinessTypePicker onChange={vi.fn()} />);
    for (const label of [
      "Café",
      "Boulangerie-pâtisserie",
      "Restauration rapide",
      "Cuisine à domicile",
      "Traiteur",
      "Autre",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("uses the Indonesian labels", () => {
    renderIn("id", <BusinessTypePicker onChange={vi.fn()} />);
    for (const label of ["Kafe", "Toko roti", "Makanan cepat saji", "Dapur rumahan", "Lainnya"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("selects one type at a time and clears it when tapped again", () => {
    const onChange = vi.fn();
    renderIn("en", <Controlled onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Bakery" }));
    expect(onChange).toHaveBeenLastCalledWith("bakery");
    expect(screen.getByRole("button", { name: "Bakery" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Café" }));
    expect(onChange).toHaveBeenLastCalledWith("cafe");
    expect(screen.getByRole("button", { name: "Bakery" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Café" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Café" }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
    screen
      .getAllByRole("button")
      .forEach((chip) => expect(chip).toHaveAttribute("aria-pressed", "false"));
  });

  it("does nothing when disabled", () => {
    const onChange = vi.fn();
    renderIn("en", <BusinessTypePicker onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole("button", { name: "Bar" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
