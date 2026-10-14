import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EagerI18nProvider } from "@/components/lang/i18n-provider-eager";
import { RecipeCostCalculator } from "../components/recipe-cost-calculator";

const plain = (s: string | null | undefined) => (s ?? "").replace(/[  ]/g, " ");

function renderIn(locale: "fr" | "id" | "en") {
  return render(
    <EagerI18nProvider initialLocale={locale}>
      <RecipeCostCalculator />
    </EagerI18nProvider>
  );
}

describe("RecipeCostCalculator", () => {
  it("opens on an example in the page's language and currency", () => {
    renderIn("fr");
    expect(screen.getByDisplayValue("Farine T45")).toBeInTheDocument();
    expect(plain(document.body.textContent)).toMatch(/€/);
  });

  it("recomputes the cost per portion as the visitor types", () => {
    const { container } = renderIn("en");
    const portions = screen.getByLabelText("Portions the recipe makes");
    const before = plain(container.querySelector(".epi-display")?.textContent);
    fireEvent.change(portions, { target: { value: "6" } });
    const after = plain(container.querySelector(".epi-display")?.textContent);
    expect(after).not.toBe(before);
    expect(after).toMatch(/^\$\d/);
  });

  it("shows food cost and margin only once a selling price is given, and warns on a loss", () => {
    renderIn("en");
    expect(screen.queryByText("Food cost at your price")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Your selling price (optional)"), {
      target: { value: "0.05" },
    });
    expect(screen.getByText("Food cost at your price")).toBeInTheDocument();
    expect(
      screen.getByText("At this price, each portion costs more in ingredients than it sells for.")
    ).toBeInTheDocument();
  });

  it("keeps at least one ingredient line", () => {
    renderIn("id");
    const removes = () => screen.getAllByRole("button", { name: /Hapus bahan/ });
    fireEvent.click(removes()[0]);
    fireEvent.click(removes()[0]);
    expect(removes()).toHaveLength(1);
    expect(removes()[0]).toBeDisabled();
  });
});
