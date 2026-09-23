import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));

import { PosOrderStatusRail } from "../pos-order-status-rail";

const counts = { ALL: 9, CONFIRMED: 4, IN_PRODUCTION: 3, READY: 2, HELD: 0 };

describe("PosOrderStatusRail", () => {
  it("lists All plus every queue status with its live count", () => {
    render(<PosOrderStatusRail counts={counts} value="ALL" onChange={vi.fn()} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(5);
    expect(buttons[0]).toHaveTextContent("pos.queue.all");
    expect(buttons[0]).toHaveTextContent("9");
    expect(screen.getByRole("button", { name: /pos\.status\.inProduction/ })).toHaveTextContent(
      "3"
    );
    // A status with nothing in it still shows, as 0, so the rail doesn't jump around.
    expect(screen.getByRole("button", { name: /pos\.status\.held/ })).toHaveTextContent("0");
  });

  it("marks the active status pressed", () => {
    render(<PosOrderStatusRail counts={counts} value="READY" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /pos\.status\.ready/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /pos\.queue\.all/ })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("filters to a status on tap, and clears back to All when the active one is tapped again", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <PosOrderStatusRail counts={counts} value="ALL" onChange={onChange} />
    );
    fireEvent.click(screen.getByRole("button", { name: /pos\.status\.confirmed/ }));
    expect(onChange).toHaveBeenLastCalledWith("CONFIRMED");

    rerender(<PosOrderStatusRail counts={counts} value="CONFIRMED" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /pos\.status\.confirmed/ }));
    expect(onChange).toHaveBeenLastCalledWith("ALL");
  });

  it("keeps every row at the 44px touch target", () => {
    render(<PosOrderStatusRail counts={counts} value="ALL" onChange={vi.fn()} />);
    for (const b of screen.getAllByRole("button")) expect(b.className).toContain("h-11");
  });
});
