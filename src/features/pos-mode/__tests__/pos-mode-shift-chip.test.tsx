import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({
    t: (k: string) => k,
    formatTimeOnly: (d: string) => `T(${d})`,
  }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockUseMyShift = vi.fn();
vi.mock("@/features/pos/hooks/use-my-shift", () => ({
  useMyShift: () => mockUseMyShift(),
}));

import { PosModeShiftChip } from "../pos-mode-shift-chip";

const openShift = {
  id: "shift-1",
  openedAt: "2026-09-11T11:00:00.000Z",
  closedAt: null,
  openingCash: "0",
  closingCash: null,
  staffMember: { id: "staff-1", name: "Sam", role: "CASHIER" },
};

beforeEach(() => mockUseMyShift.mockReset());

describe("PosModeShiftChip", () => {
  it("open shift: shows the label and start time, and links to the Shift page", () => {
    mockUseMyShift.mockReturnValue({ shift: openShift, allowed: true, known: true });
    render(<PosModeShiftChip storeId="store-1" />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/store/store-1/pos/shift");
    expect(link).toHaveTextContent("pos.shift.chipLabel");
    expect(link).toHaveTextContent("T(2026-09-11T11:00:00.000Z)");
    expect(link.className).toContain("emerald");
  });

  it("names who is on charge in the tooltip", () => {
    mockUseMyShift.mockReturnValue({ shift: openShift, allowed: true, known: true });
    render(<PosModeShiftChip storeId="store-1" />);
    // The i18n mock returns the key, so the replace() placeholders are absent — but
    // the accessible name must be set and non-empty.
    expect(screen.getByRole("link")).toHaveAttribute("aria-label", "pos.shift.chipOpenTitle");
  });

  it("no open shift: an amber 'No shift' that still leads to the Shift page", () => {
    mockUseMyShift.mockReturnValue({ shift: null, allowed: true, known: true });
    render(<PosModeShiftChip storeId="store-1" />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/store/store-1/pos/shift");
    expect(link).toHaveTextContent("pos.shift.chipNone");
    expect(link.className).toContain("amber");
  });

  it("is as compact as the Connected pill but keeps a tap target of at least 40px", () => {
    mockUseMyShift.mockReturnValue({ shift: null, allowed: true, known: true });
    render(<PosModeShiftChip storeId="store-1" />);
    const { className } = screen.getByRole("link");
    // Visible size: the same px-2 py-0.5 the status bar's Connected pill uses.
    expect(className).toContain("px-2 ");
    expect(className).toContain("py-0.5");
    // Hit area: ~20px pill + 2 × 10px from the invisible ::before.
    expect(className).toContain("before:-inset-y-2.5");
  });

  it("renders nothing for a persona that holds no till (kitchen)", () => {
    mockUseMyShift.mockReturnValue({ shift: null, allowed: false, known: false });
    const { container } = render(<PosModeShiftChip storeId="store-1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while the answer is unknown — never claims 'No shift' about a shift it hasn't loaded", () => {
    mockUseMyShift.mockReturnValue({ shift: null, allowed: true, known: false });
    const { container } = render(<PosModeShiftChip storeId="store-1" />);
    expect(container).toBeEmptyDOMElement();
  });
});
