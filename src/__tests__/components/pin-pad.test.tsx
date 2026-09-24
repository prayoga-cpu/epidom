/**
 * The PIN pad shared by staff login (POS + Back Office), the PIN re-check,
 * owner PIN and clock-in.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PinPad } from "@/components/ui/pin-pad";

const dots = (container: HTMLElement) =>
  Array.from(container.querySelectorAll(".rounded-full.border-2"));

describe("PinPad", () => {
  it("sends each key, delete included", () => {
    const onKey = vi.fn();
    render(<PinPad value="" onKey={onKey} />);
    fireEvent.click(screen.getByRole("button", { name: "4" }));
    fireEvent.click(screen.getAllByRole("button").at(-1)!);
    expect(onKey.mock.calls).toEqual([["4"], ["del"]]);
  });

  it("pops each dot as it fills, and only the filled ones", () => {
    const { container, rerender } = render(<PinPad value="" onKey={() => {}} />);
    expect(dots(container).filter((d) => d.classList.contains("pin-dot-filled"))).toHaveLength(0);

    rerender(<PinPad value="12" onKey={() => {}} />);
    const filled = dots(container).map((d) => d.classList.contains("pin-dot-filled"));
    expect(filled).toEqual([true, true, false, false]);
  });

  it("keys can hold the press ripple", () => {
    render(<PinPad value="" onKey={() => {}} />);
    const seven = screen.getByRole("button", { name: "7" });
    expect(seven.className).toMatch(/\brelative\b/);
    expect(seven.className).toMatch(/\boverflow-hidden\b/);
    // Pressing in jsdom (no Web Animations API) is harmless.
    expect(() => fireEvent.pointerDown(seven)).not.toThrow();
  });

  it("takes a class for its layout, so the login gates can centre it full-width", () => {
    const { container } = render(<PinPad value="" onKey={() => {}} className="mt-6 w-full" />);
    expect(container.firstElementChild?.className).toBe("mt-6 w-full");
  });
});
