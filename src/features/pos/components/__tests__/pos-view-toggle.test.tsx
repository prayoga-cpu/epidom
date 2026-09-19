import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));

import { PosViewToggle } from "../pos-view-toggle";
import { usePosViewMode } from "../../hooks/use-pos-view-mode";

beforeEach(() => {
  localStorage.clear();
  usePosViewMode.setState({ viewMode: "grid" });
});

describe("PosViewToggle", () => {
  it("offers grid, columns and list, with the current one pressed", () => {
    render(<PosViewToggle />);
    const grid = screen.getByRole("button", { name: "cashierCheckout.view.grid" });
    expect(grid).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "cashierCheckout.view.columns" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByRole("button", { name: "cashierCheckout.view.list" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("switching updates the shared store", () => {
    render(<PosViewToggle />);
    fireEvent.click(screen.getByRole("button", { name: "cashierCheckout.view.list" }));
    expect(usePosViewMode.getState().viewMode).toBe("list");
    expect(screen.getByRole("button", { name: "cashierCheckout.view.list" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("each button is a 40px target", () => {
    render(<PosViewToggle />);
    for (const b of screen.getAllByRole("button")) {
      expect(b.className).toContain("h-10");
      expect(b.className).toContain("w-10");
    }
  });
});
