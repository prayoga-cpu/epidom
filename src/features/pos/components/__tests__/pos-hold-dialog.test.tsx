import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { stubBrowserApis } from "./cart-test-utils";

vi.mock("@/components/lang/i18n-provider", async () => {
  const { translate } = await import("./cart-test-utils");
  return { useI18n: () => ({ t: translate, locale: "en" }) };
});

import { PosHoldDialog, type HoldDialogDefaults } from "../pos-hold-dialog";

const defaults = (over: Partial<HoldDialogDefaults> = {}): HoldDialogDefaults => ({
  orderType: "DINE_IN",
  onlinePlatform: null,
  guestCount: 3,
  tableNumber: "A1",
  customerName: null,
  ...over,
});

function renderDialog(over: Partial<React.ComponentProps<typeof PosHoldDialog>> = {}) {
  const onSubmit = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <PosHoldDialog
      open
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      defaults={defaults()}
      {...over}
    />
  );
  return { onSubmit, onOpenChange };
}

const save = () =>
  fireEvent.click(screen.getByRole("button", { name: "cashierCart.saveBill.submit" }));

beforeEach(() => stubBrowserApis());

describe("PosHoldDialog — Save Bill", () => {
  it("is titled 'Save Bill', not 'Hold order'", () => {
    renderDialog();
    expect(screen.getByRole("heading", { name: "cashierCart.saveBill.title" })).toBeTruthy();
  });

  it("arrives prefilled from the cart: order type, pax and table", () => {
    renderDialog();
    expect(screen.getByTestId("hold-summary").textContent).toBe("Dine In · 3 pax");
    expect((screen.getByLabelText("pos.checkout.tableOptional") as HTMLInputElement).value).toBe(
      "A1"
    );
  });

  it("no longer asks for order type or guest count — they live on the cart panel", () => {
    renderDialog();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByText("pos.checkout.guestCount")).toBeNull();
  });

  it("shows the attached customer in the summary and hides the walk-in label field", () => {
    renderDialog({ defaults: defaults({ customerName: "Alice" }) });
    expect(screen.getByTestId("hold-summary").textContent).toBe("Dine In · 3 pax · Alice");
    expect(screen.queryByLabelText("pos.hold.label")).toBeNull();
  });

  it("offers an optional label for a walk-in", () => {
    renderDialog();
    expect(screen.getByLabelText("pos.hold.label")).toBeTruthy();
  });

  it("takeaway shows no pax", () => {
    renderDialog({ defaults: defaults({ orderType: "TAKEAWAY" }) });
    expect(screen.getByTestId("hold-summary").textContent).toBe("Take Away");
  });

  it("an online-platform bill names the platform, with no pax", () => {
    renderDialog({ defaults: defaults({ orderType: "DELIVERY", onlinePlatform: "GOFOOD" }) });
    expect(screen.getByTestId("hold-summary").textContent).toBe("GoFood");
  });

  it("saves with nothing typed — everything is optional and inherited from the cart", async () => {
    const { onSubmit } = renderDialog();
    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      orderType: "DINE_IN",
      guestCount: 3,
      tableNumber: "A1",
    });
  });

  it("passes the edited table, notes and label through", async () => {
    const { onSubmit } = renderDialog();
    fireEvent.change(screen.getByLabelText("pos.checkout.tableOptional"), {
      target: { value: "B2" },
    });
    fireEvent.change(screen.getByLabelText("pos.checkout.notes"), {
      target: { value: "no onions" },
    });
    fireEvent.change(screen.getByLabelText("pos.hold.label"), { target: { value: "Budi" } });
    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      tableNumber: "B2",
      notes: "no onions",
      customerName: "Budi",
    });
  });

  it("uses the attached customer's name, whatever is typed", async () => {
    const { onSubmit } = renderDialog({ defaults: defaults({ customerName: "Alice" }) });
    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].customerName).toBe("Alice");
  });

  it("takeaway submits no guest count", async () => {
    const { onSubmit } = renderDialog({
      defaults: defaults({ orderType: "TAKEAWAY", tableNumber: "" }),
    });
    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      orderType: "TAKEAWAY",
      guestCount: undefined,
    });
  });

  it("warns that a coupon or redeemed points won't be saved with the bill", () => {
    renderDialog({ dropsPromotions: true });
    expect(screen.getByText("cashierCart.saveBill.dropsPromotions")).toBeTruthy();
  });

  it("stays quiet about it when there is no coupon or points", () => {
    renderDialog();
    expect(screen.queryByText("cashierCart.saveBill.dropsPromotions")).toBeNull();
  });

  it("re-seeds from the cart each time it opens", () => {
    const { rerender } = render(
      <PosHoldDialog open onOpenChange={vi.fn()} onSubmit={vi.fn()} defaults={defaults()} />
    );
    fireEvent.change(screen.getByLabelText("pos.checkout.tableOptional"), {
      target: { value: "ZZ" },
    });
    rerender(
      <PosHoldDialog open={false} onOpenChange={vi.fn()} onSubmit={vi.fn()} defaults={defaults()} />
    );
    rerender(
      <PosHoldDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        defaults={defaults({ tableNumber: "C3" })}
      />
    );
    expect((screen.getByLabelText("pos.checkout.tableOptional") as HTMLInputElement).value).toBe(
      "C3"
    );
  });

  it("gives Cancel and Save a >=44px target", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: "common.actions.cancel" }).className).toContain(
      "h-11"
    );
    expect(screen.getByRole("button", { name: "cashierCart.saveBill.submit" }).className).toContain(
      "h-11"
    );
  });
});
