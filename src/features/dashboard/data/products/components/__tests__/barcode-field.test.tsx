import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

import { BarcodeField } from "../barcode-field";
import { applyServerFieldErrors } from "@/lib/utils/form-server-errors";

type Values = { barcode?: string };

function Harness({
  onSubmit,
  capture,
  initial = "",
}: {
  onSubmit: (v: Values) => void;
  capture?: (form: ReturnType<typeof useForm<Values>>) => void;
  initial?: string;
}) {
  const form = useForm<Values>({ defaultValues: { barcode: initial } });
  capture?.(form);
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <BarcodeField control={form.control} />
        <button type="submit">save</button>
      </form>
    </Form>
  );
}

describe("BarcodeField", () => {
  it("shows the label, placeholder and the helper text under the input", () => {
    render(<Harness onSubmit={vi.fn()} />);

    expect(screen.getByText("promotions.product.barcode")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("promotions.product.barcodePlaceholder")
    ).toBeInTheDocument();
    expect(screen.getByText("promotions.product.barcodeHint")).toBeInTheDocument();
  });

  it("caps the length at the schema's limit", () => {
    render(<Harness onSubmit={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveAttribute("maxlength", "64");
  });

  it("shows an existing barcode", () => {
    render(<Harness onSubmit={vi.fn()} initial="8991234567890" />);
    expect(screen.getByRole("textbox")).toHaveValue("8991234567890");
  });

  // A keyboard-wedge scanner types the code, then presses Enter. Without the guard
  // that Enter submits the whole product form the moment the merchant scans.
  it("does not submit the form when a scanner presses Enter after the code", () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: "8991234567890" } });
    const notPrevented = fireEvent.keyDown(input, { key: "Enter" });

    expect(notPrevented).toBe(false); // default prevented
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input).toHaveValue("8991234567890");
  });

  it("still submits through the button, carrying what was typed", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "ABC-1" } });
    await act(async () => {
      fireEvent.click(screen.getByText("save"));
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({ barcode: "ABC-1" });
  });

  it("surfaces a server 409 UNDER the field via applyServerFieldErrors", async () => {
    let form!: ReturnType<typeof useForm<Values>>;
    render(<Harness onSubmit={vi.fn()} capture={(f) => (form = f)} />);

    await act(async () => {
      const summary = applyServerFieldErrors(form as never, {
        details: [
          {
            field: "barcode",
            message: 'Barcode "123" is already used by another product in this store',
          },
        ],
      });
      expect(summary).toContain("already used");
    });

    expect(
      await screen.findByText('Barcode "123" is already used by another product in this store')
    ).toBeInTheDocument();
  });
});
