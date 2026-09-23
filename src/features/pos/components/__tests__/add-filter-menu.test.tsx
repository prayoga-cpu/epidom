import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));

import { AddFilterMenu } from "../add-filter-menu";

const options = [{ key: "department", label: "Department" }];
const trigger = () => screen.getByRole("button", { name: /pos\.filters\.addFilter/ });
/** The trigger's classes as whole tokens, so "border" doesn't match "border-dashed". */
const classes = () => trigger().className.split(/\s+/);

describe("AddFilterMenu", () => {
  it("renders nothing when every filter is already showing", () => {
    const { container } = render(<AddFilterMenu options={[]} onAdd={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is the dashed, rounded chip by default — what the order queue and order history rows show", () => {
    render(<AddFilterMenu options={options} onAdd={vi.fn()} />);
    expect(classes()).toEqual(
      expect.arrayContaining(["border", "border-dashed", "rounded-md", "h-9", "cursor-pointer"])
    );
    expect(classes()).not.toContain("rounded-none");
    expect(classes()).not.toContain("h-full");
  });

  it('the "bar" variant is the flat top-bar block: no border, square corners, full height', () => {
    render(<AddFilterMenu options={options} onAdd={vi.fn()} variant="bar" />);
    expect(classes()).toEqual(expect.arrayContaining(["h-full", "rounded-none", "cursor-pointer"]));
    for (const c of ["border", "border-dashed", "rounded-md", "h-9"]) {
      expect(classes()).not.toContain(c);
    }
  });

  it("a caller's className still overrides the chip (the order queue toolbar's compact one)", () => {
    render(<AddFilterMenu options={options} onAdd={vi.fn()} className="h-8 px-2.5 text-xs" />);
    expect(classes()).toEqual(
      expect.arrayContaining(["h-8", "px-2.5", "text-xs", "border-dashed"])
    );
    expect(classes()).not.toContain("h-9");
    expect(classes()).not.toContain("px-3");
  });
});
