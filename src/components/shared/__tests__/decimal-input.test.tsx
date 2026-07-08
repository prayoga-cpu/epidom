/**
 * DecimalInput Tests
 *
 * Locks the typing behavior for comma-decimal entry: while the user is
 * focused and typing, in-progress text like "0," or "0,0" (which parses to 0)
 * must NOT be rewritten when the parent echoes that 0 back through the
 * `value` prop — that echo used to collapse "0,0" into "0" mid-keystroke.
 */

import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DecimalInput } from "../decimal-input";

/** Controlled harness that stores a number and echoes it back — mirrors how
 * react-hook-form + our dialogs drive the component. */
function Harness({ initial, coerce }: { initial?: number; coerce?: boolean }) {
  const [value, setValue] = useState<number | undefined>(initial);
  return (
    <DecimalInput
      aria-label="qty"
      decimals={3}
      min={0}
      value={value}
      onChange={(v) => setValue(coerce ? (v ?? 0) : v)}
    />
  );
}

function type(input: HTMLElement, text: string) {
  fireEvent.change(input, { target: { value: text } });
}

describe("DecimalInput", () => {
  it("keeps in-progress comma text while typing (0, -> 0,0 -> 0,002)", () => {
    render(<Harness initial={0} />);
    const input = screen.getByLabelText("qty") as HTMLInputElement;

    fireEvent.focus(input);
    type(input, "0,");
    expect(input.value).toBe("0,");
    type(input, "0,0");
    expect(input.value).toBe("0,0");
    type(input, "0,00");
    expect(input.value).toBe("0,00");
    type(input, "0,002");
    expect(input.value).toBe("0,002");
  });

  it("survives a parent that coerces undefined to 0 (value echo) while focused", () => {
    render(<Harness initial={0} coerce />);
    const input = screen.getByLabelText("qty") as HTMLInputElement;

    fireEvent.focus(input);
    type(input, "0,");
    // parent state is 0 (coerced), echoed back as value=0 — text must persist
    expect(input.value).toBe("0,");
    type(input, "0,0");
    expect(input.value).toBe("0,0");
  });

  it("accepts period decimals too", () => {
    render(<Harness />);
    const input = screen.getByLabelText("qty") as HTMLInputElement;
    fireEvent.focus(input);
    type(input, "1.5");
    expect(input.value).toBe("1.5");
  });

  it("caps fractional digits to the decimals prop", () => {
    render(<Harness />);
    const input = screen.getByLabelText("qty") as HTMLInputElement;
    fireEvent.focus(input);
    type(input, "0,12345");
    expect(input.value).toBe("0,123");
  });

  it("strips invalid characters and a minus when min >= 0", () => {
    render(<Harness />);
    const input = screen.getByLabelText("qty") as HTMLInputElement;
    fireEvent.focus(input);
    type(input, "-1a,2b");
    expect(input.value).toBe("1,2");
  });

  it("resyncs the display from the external value on blur when drifted", () => {
    render(<Harness initial={0} coerce />);
    const input = screen.getByLabelText("qty") as HTMLInputElement;

    fireEvent.focus(input);
    type(input, ""); // cleared -> onChange(undefined) -> parent coerces to 0
    expect(input.value).toBe("");
    fireEvent.blur(input);
    // text "" no longer represents value 0 -> resync
    expect(input.value).toBe("0");
  });
});
