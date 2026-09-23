import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createQueryWrapper, stubBrowserApis } from "./cart-test-utils";

vi.mock("@/components/lang/i18n-provider", async () => {
  const { translate } = await import("./cart-test-utils");
  return { useI18n: () => ({ t: translate, locale: "en" }) };
});

const currencyMock = vi.hoisted(() => ({ value: null as any }));
vi.mock("@/components/providers/currency-provider", async () => {
  const { makeCurrencyMock } = await import("./cart-test-utils");
  currencyMock.value = makeCurrencyMock("EUR");
  return { useCurrency: () => currencyMock.value };
});

vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn() } };
});

import { apiClient, ApiClientError } from "@/lib/api/client";
import { PosCouponDialog, normalizeCouponCode } from "../pos-coupon-dialog";
import { usePosCart } from "../../hooks/use-pos-cart";

const post = vi.mocked(apiClient.post);
const cart = () => usePosCart.getState();

const valid = (over: Record<string, unknown> = {}) => ({
  valid: true,
  coupon: { id: "cp1", code: "SAVE10", name: null, type: "PERCENT", value: 10 },
  discountAmount: 10,
  ...over,
});

function renderDialog() {
  const { Wrapper } = createQueryWrapper();
  const onOpenChange = vi.fn();
  render(
    <Wrapper>
      <PosCouponDialog open onOpenChange={onOpenChange} storeId="s1" />
    </Wrapper>
  );
  return { onOpenChange };
}

const type = (code: string) =>
  fireEvent.change(screen.getByLabelText("cashierCart.couponDialog.code"), {
    target: { value: code },
  });
const apply = () => fireEvent.click(screen.getByRole("button", { name: "common.actions.apply" }));

beforeEach(() => {
  stubBrowserApis();
  localStorage.clear();
  cart().clearCart();
  post.mockReset();
  cart().addItem("m1", "Ramen", 50, 2); // items total 100
});

describe("normalizeCouponCode", () => {
  it("upper-cases and strips everything a stored code can't contain", () => {
    expect(normalizeCouponCode("sa ve-10_x!")).toBe("SAVE-10_X");
    expect(normalizeCouponCode("a".repeat(50))).toHaveLength(32);
  });
});

describe("PosCouponDialog", () => {
  it("won't apply until the code is at least two characters", () => {
    renderDialog();
    const button = screen.getByRole("button", {
      name: "common.actions.apply",
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    type("S");
    expect(button.disabled).toBe(true);
    type("SA");
    expect(button.disabled).toBe(false);
  });

  it("validates against the cart's ITEM total and applies a valid coupon as the discount", async () => {
    post.mockResolvedValue(valid());
    renderDialog();
    type("save10");
    apply();

    await waitFor(() => expect(cart().discountSource?.kind).toBe("coupon"));
    expect(post).toHaveBeenCalledWith("/stores/s1/coupons/validate", {
      code: "SAVE10",
      itemsTotal: 100,
    });
    expect(cart().discountSource).toMatchObject({
      kind: "coupon",
      couponId: "cp1",
      code: "SAVE10",
      type: "PERCENT",
      value: 10,
    });
    expect(cart().discountAmount).toBe(10);
  });

  it("shows the priced discount once applied", async () => {
    post.mockResolvedValue(valid());
    renderDialog();
    type("SAVE10");
    apply();
    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("Coupon SAVE10 applied");
    // -EUR 10.00, in the store's currency (never IDR).
    expect(status.textContent).toContain("-EUR 10.00");
    for (const call of currencyMock.value.formatPrice.mock.calls) expect(call[1]).toBe("EUR");
  });

  it("carries the coupon's minimum spend when the server sends it, so the cart can drop it later", async () => {
    post.mockResolvedValue(
      valid({
        coupon: {
          id: "cp1",
          code: "SAVE10",
          name: null,
          type: "PERCENT",
          value: 10,
          minSubtotal: 80,
        },
      })
    );
    renderDialog();
    type("SAVE10");
    apply();
    await waitFor(() => expect(cart().discountSource?.kind).toBe("coupon"));
    expect((cart().discountSource as any).minSubtotal).toBe(80);
    // The cart shrinks under the minimum → the coupon stops applying.
    cart().updateQuantity(cart().items[0].id, 1);
    expect(cart().discountAmount).toBe(0);
  });

  it("falls back to no minimum when the payload lacks one (the server re-checks at checkout)", async () => {
    post.mockResolvedValue(valid());
    renderDialog();
    type("SAVE10");
    apply();
    await waitFor(() => expect(cart().discountSource?.kind).toBe("coupon"));
    expect((cart().discountSource as any).minSubtotal).toBeNull();
  });

  it.each(["NOT_FOUND", "INACTIVE", "NOT_STARTED", "EXPIRED", "USED_UP", "BELOW_MINIMUM"] as const)(
    "explains a %s rejection in plain language and applies nothing",
    async (reason) => {
      post.mockResolvedValue({ valid: false, reason });
      renderDialog();
      type("NOPE");
      apply();
      expect((await screen.findByRole("alert")).textContent).toBe(
        `cashierCart.couponDialog.reason.${reason}`
      );
      expect(cart().discountSource).toBeNull();
    }
  );

  it("treats a network failure as a retryable error, not a rejection", async () => {
    post.mockRejectedValue(new Error("Network error occurred"));
    renderDialog();
    type("SAVE10");
    apply();
    expect((await screen.findByRole("alert")).textContent).toBe(
      "cashierCart.couponDialog.reason.ERROR"
    );
    expect(cart().discountSource).toBeNull();
  });

  it("says coupons aren't available when the server answers 403 (plan gate)", async () => {
    post.mockRejectedValue(
      new ApiClientError(
        { success: false, error: { code: "FORBIDDEN", message: "plan" } } as any,
        403
      )
    );
    renderDialog();
    type("SAVE10");
    apply();
    expect((await screen.findByRole("alert")).textContent).toBe(
      "cashierCart.couponDialog.reason.FORBIDDEN"
    );
  });

  it("clears the error as soon as the cashier edits the code", async () => {
    post.mockResolvedValue({ valid: false, reason: "EXPIRED" });
    renderDialog();
    type("OLD");
    apply();
    await screen.findByRole("alert");
    type("OLD2");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("warns that a coupon replaces the current discount", () => {
    cart().setDiscount(5, "Manual");
    renderDialog();
    expect(screen.getByText("cashierCart.couponDialog.replaces")).toBeTruthy();
  });

  it("shows an already-applied coupon and can remove it", () => {
    cart().setDiscountSource({
      kind: "coupon",
      couponId: "cp1",
      code: "SAVE10",
      type: "PERCENT",
      value: 10,
      minSubtotal: null,
    });
    renderDialog();
    expect(screen.getByRole("status").textContent).toContain("Coupon SAVE10 applied");
    fireEvent.click(screen.getByRole("button", { name: "common.actions.remove" }));
    expect(cart().discountSource).toBeNull();
  });

  it("sends the pre-discount item total even when a discount is already on the bill", async () => {
    cart().setDiscount(30, "Manual");
    post.mockResolvedValue(valid());
    renderDialog();
    type("SAVE10");
    apply();
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect((post.mock.calls[0][1] as any).itemsTotal).toBe(100);
  });
});
