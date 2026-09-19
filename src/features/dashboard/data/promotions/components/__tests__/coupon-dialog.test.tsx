import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { configure, fireEvent, screen, waitFor } from "@testing-library/react";
import { ApiErrorCode } from "@/types/api/responses";
import type { CouponDto } from "@/types/api/cashier";

const h = vi.hoisted(() => ({
  currency: "EUR",
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/lang/i18n-provider", async () =>
  (await import("../../__tests__/test-utils")).i18nMock()
);
vi.mock("@/components/providers/currency-provider", async () =>
  (await import("../../__tests__/test-utils")).currencyMock(() => h.currency)
);
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiClient: h.api,
}));
vi.mock("sonner", () => ({ toast: h.toast }));

import { ApiClientError } from "@/lib/api/client";
import { renderWithQuery, stubResizeObserver } from "../../__tests__/test-utils";
import { CouponDialog } from "../coupon-dialog";

// See promotions-section.test.tsx: parallel runs can outlast the 1s default.
configure({ asyncUtilTimeout: 8000 });
// getByRole walks the whole accessibility tree, which is very slow in jsdom, so these
// suites query by text / label instead. They still render Radix dialogs and a form
// library, and a parallel run on a busy machine can outlast the repo's 20s default.
vi.setConfig({ testTimeout: 90_000 });

const D = "promotions.coupons.dialog";

function renderDialog(coupon?: CouponDto | null) {
  const onOpenChange = vi.fn();
  renderWithQuery(
    <CouponDialog open onOpenChange={onOpenChange} storeId="store_1" coupon={coupon} />
  );
  return { onOpenChange };
}

const field = (key: string) => screen.getByLabelText(`${D}.${key}`) as HTMLInputElement;
const submit = (key: "submitAdd" | "submitSave" = "submitAdd") =>
  fireEvent.click(screen.getByText(`${D}.${key}`));
const typeFixed = () => fireEvent.click(screen.getByText("promotions.type.fixed"));
const change = (input: HTMLElement, value: string) =>
  fireEvent.change(input, { target: { value } });

// Set with seconds on purpose: a datetime-local input only carries minutes.
const COUPON: CouponDto = {
  id: "c1",
  code: "SUMMER10",
  name: "Summer promo",
  type: "PERCENT",
  value: 10,
  minSubtotal: 20,
  maxUses: 100,
  usedCount: 3,
  validFrom: "2026-06-01T08:00:00.000Z",
  validUntil: "2026-08-31T21:59:59.000Z",
  isActive: true,
};

beforeAll(stubResizeObserver);

beforeEach(() => {
  h.currency = "EUR";
  h.api.post.mockResolvedValue(COUPON);
  h.api.patch.mockResolvedValue(COUPON);
});

describe("CouponDialog — code", () => {
  it("uppercases the code as it is typed and drops whitespace", () => {
    renderDialog();
    change(field("code"), "summer 10");
    expect(field("code").value).toBe("SUMMER10");
    change(field("code"), "vip-2_x");
    expect(field("code").value).toBe("VIP-2_X");
  });

  it("rejects a code the server would reject, before any request", async () => {
    renderDialog();
    change(field("code"), "a");
    change(field("value"), "10");
    submit();

    expect(await screen.findByText("promotions.validation.codeInvalid")).toBeInTheDocument();
    expect(h.api.post).not.toHaveBeenCalled();
  });

  it("shows a duplicate-code 409 under the code input and stays open", async () => {
    h.api.post.mockRejectedValue(
      new ApiClientError(
        {
          success: false,
          error: {
            code: ApiErrorCode.CONFLICT,
            message: "Conflict",
            details: [{ field: "code", message: "A coupon with this code already exists" }],
          },
        },
        409
      )
    );
    const { onOpenChange } = renderDialog();
    change(field("code"), "summer10");
    change(field("value"), "10");
    submit();

    expect(await screen.findByText("A coupon with this code already exists")).toBeInTheDocument();
    expect(field("code")).toHaveAttribute("aria-invalid", "true");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe("CouponDialog — creating", () => {
  it("turns every empty optional field into null, and omits an empty label", async () => {
    const { onOpenChange } = renderDialog();
    change(field("code"), "spring5");
    change(field("value"), "10");
    submit();

    await waitFor(() =>
      expect(h.api.post).toHaveBeenCalledWith("/stores/store_1/coupons", {
        code: "SPRING5",
        type: "PERCENT",
        value: 10,
        minSubtotal: null,
        maxUses: null,
        validFrom: null,
        validUntil: null,
        isActive: true,
      })
    );
    const body = h.api.post.mock.calls[0][1];
    expect(body).not.toHaveProperty("name");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("sends EUR amounts exactly as typed — literal, never IDR-converted", async () => {
    renderDialog();
    typeFixed();
    change(field("code"), "TENOFF");
    change(field("name"), "  Ten off  ");
    change(field("value"), "3,75");
    change(field("minSubtotal"), "12,5");
    change(field("maxUses"), "50");
    submit();

    await waitFor(() =>
      expect(h.api.post).toHaveBeenCalledWith("/stores/store_1/coupons", {
        code: "TENOFF",
        name: "Ten off",
        type: "FIXED",
        value: 3.75,
        minSubtotal: 12.5,
        maxUses: 50,
        validFrom: null,
        validUntil: null,
        isActive: true,
      })
    );
  });

  it("shows the store currency symbol on the fixed value and the minimum spend", () => {
    renderDialog();
    typeFixed();
    // The value cap and the minimum-spend cap.
    expect(screen.getAllByText("€")).toHaveLength(2);
  });

  it("converts the local date-times to ISO instants", async () => {
    renderDialog();
    change(field("code"), "WINDOW");
    change(field("value"), "10");
    change(field("validFrom"), "2026-10-01T09:00");
    change(field("validUntil"), "2026-10-31T18:30");
    submit();

    await waitFor(() =>
      expect(h.api.post).toHaveBeenCalledWith(
        "/stores/store_1/coupons",
        expect.objectContaining({
          validFrom: new Date(2026, 9, 1, 9, 0).toISOString(),
          validUntil: new Date(2026, 9, 31, 18, 30).toISOString(),
        })
      )
    );
  });

  it("rejects an end date that is not after the start date", async () => {
    renderDialog();
    change(field("code"), "BACKWARDS");
    change(field("value"), "10");
    change(field("validFrom"), "2026-10-05T09:00");
    change(field("validUntil"), "2026-10-01T09:00");
    submit();

    expect(await screen.findByText("promotions.validation.untilAfterFrom")).toBeInTheDocument();
    expect(field("validUntil")).toHaveAttribute("aria-invalid", "true");
    expect(h.api.post).not.toHaveBeenCalled();
  });

  it("rejects an end date equal to the start date", async () => {
    renderDialog();
    change(field("code"), "SAMETIME");
    change(field("value"), "10");
    change(field("validFrom"), "2026-10-05T09:00");
    change(field("validUntil"), "2026-10-05T09:00");
    submit();

    expect(await screen.findByText("promotions.validation.untilAfterFrom")).toBeInTheDocument();
    expect(h.api.post).not.toHaveBeenCalled();
  });

  it("rejects a percentage above 100 and a max-uses of 0", async () => {
    renderDialog();
    change(field("code"), "TOOMUCH");
    change(field("value"), "101");
    change(field("maxUses"), "0");
    submit();

    expect(await screen.findByText("promotions.validation.percentMax")).toBeInTheDocument();
    expect(screen.getByText("promotions.validation.maxUsesMin")).toBeInTheDocument();
    expect(h.api.post).not.toHaveBeenCalled();
  });

  it("only lets digits into max uses", () => {
    renderDialog();
    change(field("maxUses"), "1a2.5");
    expect(field("maxUses").value).toBe("125");
  });
});

describe("CouponDialog — editing", () => {
  it("shows the code read-only and never sends it in the PATCH", async () => {
    const { onOpenChange } = renderDialog(COUPON);

    expect(field("code").value).toBe("SUMMER10");
    expect(field("code")).toHaveAttribute("readonly");
    expect(screen.getByText(`${D}.codeLockedHint`)).toBeInTheDocument();

    change(field("value"), "15");
    submit("submitSave");

    await waitFor(() => expect(h.api.patch).toHaveBeenCalled());
    const [url, body] = h.api.patch.mock.calls[0];
    expect(url).toBe("/stores/store_1/coupons/c1");
    expect(body).not.toHaveProperty("code");
    expect(body).toEqual({
      name: "Summer promo",
      type: "PERCENT",
      value: 15,
      minSubtotal: 20,
      maxUses: 100,
      // Untouched dates go back byte-for-byte — including the :59 seconds the
      // minute-precision input cannot represent.
      validFrom: COUPON.validFrom,
      validUntil: COUPON.validUntil,
      isActive: true,
    });
    expect(h.api.post).not.toHaveBeenCalled();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("clears an optional field to null when the owner empties it", async () => {
    renderDialog(COUPON);
    change(field("minSubtotal"), "");
    change(field("maxUses"), "");
    fireEvent.click(screen.getAllByText(`${D}.clearDate`)[1]);
    submit("submitSave");

    await waitFor(() => expect(h.api.patch).toHaveBeenCalled());
    expect(h.api.patch.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        minSubtotal: null,
        maxUses: null,
        validFrom: COUPON.validFrom,
        validUntil: null,
      })
    );
  });

  it("re-derives a date the owner did change", async () => {
    renderDialog(COUPON);
    change(field("validUntil"), "2026-12-24T20:00");
    submit("submitSave");

    await waitFor(() => expect(h.api.patch).toHaveBeenCalled());
    expect(h.api.patch.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        validFrom: COUPON.validFrom,
        validUntil: new Date(2026, 11, 24, 20, 0).toISOString(),
      })
    );
  });

  it("tells the owner how many times the coupon has already been used", () => {
    renderDialog(COUPON);
    expect(screen.getByText("Already used 3 times.")).toBeInTheDocument();
  });

  it("does not re-validate a stored code the owner cannot edit", async () => {
    renderDialog({ ...COUPON, code: "X" });
    change(field("value"), "12");
    submit("submitSave");

    await waitFor(() => expect(h.api.patch).toHaveBeenCalled());
    expect(screen.queryByText("promotions.validation.codeInvalid")).toBeNull();
  });
});
