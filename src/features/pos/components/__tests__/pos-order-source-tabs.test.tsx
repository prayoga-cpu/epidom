import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));

import { PosOrderSourceTabs } from "../pos-order-source-tabs";

describe("PosOrderSourceTabs", () => {
  it("offers exactly two tabs — POS and Online — with their counts, and no All", () => {
    render(<PosOrderSourceTabs value="POS" onChange={vi.fn()} counts={{ POS: 32, ONLINE: 3 }} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveTextContent("pos.queue.tabPos");
    expect(tabs[0]).toHaveTextContent("32");
    expect(tabs[1]).toHaveTextContent("pos.queue.tabOnline");
    expect(tabs[1]).toHaveTextContent("3");
  });

  it("marks the current tab selected", () => {
    render(<PosOrderSourceTabs value="ONLINE" onChange={vi.fn()} counts={{ POS: 0, ONLINE: 0 }} />);
    expect(screen.getByRole("tab", { name: /tabOnline/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /tabPos/ })).toHaveAttribute("aria-selected", "false");
  });

  it("reports the tab that was picked", () => {
    const onChange = vi.fn();
    render(<PosOrderSourceTabs value="POS" onChange={onChange} counts={{ POS: 1, ONLINE: 1 }} />);
    // Radix tabs activate on mouse-down, not click.
    fireEvent.mouseDown(screen.getByRole("tab", { name: /tabOnline/ }), { button: 0 });
    expect(onChange).toHaveBeenCalledWith("ONLINE");
  });

  it("turns the Online badge red while something is waiting there — and only then", () => {
    const { rerender } = render(
      <PosOrderSourceTabs value="POS" onChange={vi.fn()} counts={{ POS: 5, ONLINE: 2 }} />
    );
    const badge = () =>
      screen.getByRole("tab", { name: /tabOnline/ }).querySelector("span:last-child")!;
    expect(badge().className).toContain("bg-destructive");

    rerender(<PosOrderSourceTabs value="POS" onChange={vi.fn()} counts={{ POS: 5, ONLINE: 0 }} />);
    expect(badge().className).not.toContain("bg-destructive");
  });

  it("never reddens the POS badge", () => {
    render(<PosOrderSourceTabs value="ONLINE" onChange={vi.fn()} counts={{ POS: 9, ONLINE: 0 }} />);
    const posBadge = screen.getByRole("tab", { name: /tabPos/ }).querySelector("span:last-child")!;
    expect(posBadge.className).not.toContain("bg-destructive");
  });
});
