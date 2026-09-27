import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key, locale: "fr" }),
}));

// The Help centre has its own suite; here only the sheet around it.
vi.mock("../help-center", () => ({
  HelpCenter: ({ context }: { context: string }) => (
    <div data-testid="help-center" data-context={context} />
  ),
}));

import { HelpSheet } from "../help-sheet";

describe("HelpSheet", () => {
  it("shows the POS Help centre with a 40px close button, not the Sheet's 16px corner X", () => {
    const onOpenChange = vi.fn();
    render(<HelpSheet storeId="s1" open onOpenChange={onOpenChange} />);

    expect(screen.getByTestId("help-center")).toHaveAttribute("data-context", "pos");

    // One close control only: the Sheet's default corner X (named "Close") is gone.
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    const close = screen.getByRole("button", { name: "common.actions.close" });
    expect(close).toHaveClass("size-10");

    fireEvent.click(close);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the title from running under the close button", () => {
    render(<HelpSheet storeId="s1" open onOpenChange={() => {}} />);
    const close = screen.getByRole("button", { name: "common.actions.close" });
    const title = close.parentElement!.querySelector("p")!;
    expect(title).toHaveTextContent("helpCenter.sheetTitle");
    expect(title).toHaveClass("min-w-0", "flex-1", "truncate");
  });
});
