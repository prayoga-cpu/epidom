import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfirmationDialog } from "../confirmation-dialog";

describe("ConfirmationDialog", () => {
  // A confirm opened from inside a Sheet (z-[70]) must sit above it, or its
  // backdrop and buttons end up under the sheet and nothing can be tapped.
  it("puts layerClassName on both the dialog and its backdrop", () => {
    render(
      <ConfirmationDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        title="Switch store?"
        description="The cart will be cleared."
        layerClassName="z-[80]"
      />
    );

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveClass("z-[80]");
    expect(dialog).not.toHaveClass("z-50");
    expect(document.querySelector('[data-slot="alert-dialog-overlay"]')).toHaveClass("z-[80]");
  });
});
