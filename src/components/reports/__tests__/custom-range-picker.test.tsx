import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ locale: "en", t: (key: string) => key }),
}));

import { CustomRangePicker, customRangeHref } from "../custom-range-picker";

/** A day of the month shown (October 2026: the picked range's month). */
const day = (n: string) =>
  screen
    .getAllByRole("button")
    .find((b) => b.textContent === n && b.closest("[role='gridcell'], td"))!;

describe("CustomRangePicker", () => {
  beforeEach(() => push.mockReset());
  afterEach(() => cleanup());

  const shown = { from: "2026-10-01", to: "2026-10-03" };

  it("opens the report once, after the first and the last day are tapped", () => {
    render(
      <CustomRangePicker
        value={shown}
        label="Custom"
        path="/admin/sales-pages"
        keep={{ lang: "en" }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Oct 2026/ }));
    fireEvent.click(day("10"));
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(day("12"));
    expect(push.mock.calls).toEqual([
      ["/admin/sales-pages?lang=en&range=custom&from=2026-10-10&to=2026-10-12"],
    ]);
    // Closed: no calendar left.
    expect(screen.queryAllByRole("grid")).toHaveLength(0);
  });

  it("takes the days in either order, and the same day twice as one day", () => {
    render(<CustomRangePicker value={shown} label="Custom" path="/admin/pixel" />);
    fireEvent.click(screen.getByRole("button", { name: /Oct 2026/ }));
    fireEvent.click(day("20"));
    fireEvent.click(day("5"));
    expect(push).toHaveBeenLastCalledWith(
      "/admin/pixel?range=custom&from=2026-10-05&to=2026-10-20"
    );

    fireEvent.click(screen.getByRole("button", { name: /Oct 2026/ }));
    fireEvent.click(day("7"));
    fireEvent.click(day("7"));
    expect(push).toHaveBeenLastCalledWith(
      "/admin/pixel?range=custom&from=2026-10-07&to=2026-10-07"
    );
  });

  it("says Custom until a range is picked", () => {
    render(<CustomRangePicker value={null} label="Custom" path="/admin/pixel" />);
    expect(screen.getByRole("button").textContent).toBe("Custom");
  });

  it("keeps the page's other params", () => {
    expect(customRangeHref("/admin/sales-pages", shown, { lang: "fr" })).toBe(
      "/admin/sales-pages?lang=fr&range=custom&from=2026-10-01&to=2026-10-03"
    );
  });
});
