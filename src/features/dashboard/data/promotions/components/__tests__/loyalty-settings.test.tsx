import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { configure, fireEvent, screen, waitFor } from "@testing-library/react";
import type { UseQueryResult } from "@tanstack/react-query";
import { ApiErrorCode } from "@/types/api/responses";
import type { LoyaltySettingsDto } from "@/types/api/cashier";

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
import { formatCurrency } from "@/lib/utils/formatting";
import { renderWithQuery, stubResizeObserver } from "../../__tests__/test-utils";
import { LoyaltyCard } from "../loyalty-card";
import { LoyaltySettingsDialog } from "../loyalty-settings-dialog";

// See promotions-section.test.tsx: parallel runs can outlast the 1s default.
configure({ asyncUtilTimeout: 8000 });
// getByRole walks the whole accessibility tree, which is very slow in jsdom, so these
// suites query by text / label instead. They still render Radix dialogs and a form
// library, and a parallel run on a busy machine can outlast the repo's 20s default.
vi.setConfig({ testTimeout: 90_000 });

const D = "promotions.loyalty.dialog";

const UNSET: LoyaltySettingsDto = {
  enabled: false,
  spendPerPoint: 0,
  pointValue: 0,
  minRedeemPoints: 0,
};

function renderDialog(settings: LoyaltySettingsDto = UNSET) {
  const onOpenChange = vi.fn();
  renderWithQuery(
    <LoyaltySettingsDialog open onOpenChange={onOpenChange} storeId="store_1" settings={settings} />
  );
  return { onOpenChange };
}

const spend = () => screen.getByLabelText(`${D}.spendPerPoint`) as HTMLInputElement;
const pointValue = () => screen.getByLabelText(`${D}.pointValue`) as HTMLInputElement;
const minRedeem = () => screen.getByLabelText(`${D}.minRedeemPoints`) as HTMLInputElement;
const save = () => fireEvent.click(screen.getByText("common.actions.save"));
const enableSwitch = () => screen.getByLabelText(`${D}.enabled`);
const change = (input: HTMLElement, value: string) =>
  fireEvent.change(input, { target: { value } });

beforeAll(stubResizeObserver);

beforeEach(() => {
  h.currency = "EUR";
  h.api.put.mockImplementation(async (_url: string, body: LoyaltySettingsDto) => body);
});

describe("LoyaltySettingsDialog — enabling", () => {
  it("cannot be enabled while either amount is zero, and sends nothing", async () => {
    renderDialog();
    fireEvent.click(enableSwitch());
    save();

    expect(await screen.findByText("promotions.validation.spendRequired")).toBeInTheDocument();
    expect(screen.getByText("promotions.validation.pointValueRequired")).toBeInTheDocument();
    expect(h.api.put).not.toHaveBeenCalled();
  });

  it("asks only for the amount that is still missing", async () => {
    renderDialog();
    fireEvent.click(enableSwitch());
    change(spend(), "1");
    save();

    expect(await screen.findByText("promotions.validation.pointValueRequired")).toBeInTheDocument();
    expect(screen.queryByText("promotions.validation.spendRequired")).toBeNull();
    expect(h.api.put).not.toHaveBeenCalled();
  });

  it("enables once both amounts are positive", async () => {
    const { onOpenChange } = renderDialog();
    fireEvent.click(enableSwitch());
    change(spend(), "2");
    change(pointValue(), "0,1");
    change(minRedeem(), "20");
    save();

    await waitFor(() =>
      expect(h.api.put).toHaveBeenCalledWith("/stores/store_1/loyalty-settings", {
        enabled: true,
        spendPerPoint: 2,
        pointValue: 0.1,
        minRedeemPoints: 20,
      })
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("puts the server's rejection under the field it names and stays open", async () => {
    h.api.put.mockRejectedValue(
      new ApiClientError(
        {
          success: false,
          error: {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: "Validation failed",
            details: [{ field: "pointValue", message: "Set what 1 point is worth when redeemed" }],
          },
        },
        400
      )
    );
    const { onOpenChange } = renderDialog();
    fireEvent.click(enableSwitch());
    change(spend(), "1");
    change(pointValue(), "0,05");
    save();

    expect(await screen.findByText("Set what 1 point is worth when redeemed")).toBeInTheDocument();
    expect(pointValue()).toHaveAttribute("aria-invalid", "true");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe("LoyaltySettingsDialog — suggested values are placeholders, never saved values", () => {
  it("shows the EUR suggestion only as placeholders, with empty fields", () => {
    renderDialog();
    expect(spend().value).toBe("");
    expect(pointValue().value).toBe("");
    expect(spend()).toHaveAttribute("placeholder", "1");
    expect(pointValue()).toHaveAttribute("placeholder", "0.05");
  });

  it("shows the IDR suggestion as placeholders for an IDR store", () => {
    h.currency = "IDR";
    renderDialog();
    expect(spend().value).toBe("");
    expect(spend()).toHaveAttribute("placeholder", "10000");
    expect(pointValue()).toHaveAttribute("placeholder", "100");
  });

  it("saves zeros — not the placeholders — when the owner never typed an amount", async () => {
    renderDialog();
    save();

    await waitFor(() =>
      expect(h.api.put).toHaveBeenCalledWith("/stores/store_1/loyalty-settings", {
        enabled: false,
        spendPerPoint: 0,
        pointValue: 0,
        minRedeemPoints: 0,
      })
    );
  });

  it("fills the fields only when the owner clicks 'Use suggested values'", async () => {
    renderDialog();
    expect(spend().value).toBe("");

    fireEvent.click(screen.getByText(`${D}.useSuggested`));
    expect(spend().value).toBe("1");
    expect(pointValue().value).toBe("0.05");

    fireEvent.click(enableSwitch());
    save();
    await waitFor(() =>
      expect(h.api.put).toHaveBeenCalledWith("/stores/store_1/loyalty-settings", {
        enabled: true,
        spendPerPoint: 1,
        pointValue: 0.05,
        minRedeemPoints: 0,
      })
    );
  });

  it("uses the IDR suggestion for an IDR store", async () => {
    h.currency = "IDR";
    renderDialog();
    fireEvent.click(screen.getByText(`${D}.useSuggested`));
    expect(spend().value).toBe("10000");
    expect(pointValue().value).toBe("100");
  });

  it("describes the suggestion in the store's currency, next to the button", () => {
    renderDialog();
    expect(
      screen.getByText("Fills in €1.00 to earn a point and €0.05 per point.")
    ).toBeInTheDocument();
  });

  it("hides the button once the fields already hold the suggestion", () => {
    renderDialog({ ...UNSET, spendPerPoint: 1, pointValue: 0.05 });
    expect(screen.queryByText(`${D}.useSuggested`)).toBeNull();
  });
});

describe("LoyaltySettingsDialog — literal amounts", () => {
  it("shows the store currency symbol on both amount inputs", () => {
    renderDialog();
    expect(screen.getAllByText("€")).toHaveLength(2);
  });

  it("submits EUR amounts exactly as typed, up to 4 decimals — never IDR-converted", async () => {
    renderDialog();
    change(spend(), "2,5");
    change(pointValue(), "0,0125");
    save();

    await waitFor(() =>
      expect(h.api.put).toHaveBeenCalledWith(
        "/stores/store_1/loyalty-settings",
        expect.objectContaining({ spendPerPoint: 2.5, pointValue: 0.0125 })
      )
    );
  });

  it("prefills saved amounts, and leaves an unset one empty rather than showing 0", () => {
    renderDialog({ enabled: true, spendPerPoint: 2, pointValue: 0.1, minRedeemPoints: 20 });
    expect(spend().value).toBe("2");
    expect(pointValue().value).toBe("0.1");
    expect(minRedeem().value).toBe("20");
  });
});

// ─── The summary card ────────────────────────────────────────────────────────

function cardQuery(data: LoyaltySettingsDto | undefined, extra: Partial<UseQueryResult> = {}) {
  return {
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...extra,
  } as unknown as UseQueryResult<LoyaltySettingsDto, Error>;
}

describe("LoyaltyCard", () => {
  it("summarizes the rules in the store's currency (EUR)", () => {
    renderWithQuery(
      <LoyaltyCard
        storeId="store_1"
        query={cardQuery({
          enabled: true,
          spendPerPoint: 1,
          pointValue: 0.05,
          minRedeemPoints: 20,
        })}
      />
    );

    expect(
      screen.getByText(
        "Spend €1.00 to earn 1 point · 1 point is worth €0.05 · minimum redeem 20 points"
      )
    ).toBeInTheDocument();
    expect(screen.getByText("promotions.loyalty.enabled")).toBeInTheDocument();
  });

  it("formats IDR with grouping and no decimals", () => {
    h.currency = "IDR";
    renderWithQuery(
      <LoyaltyCard
        storeId="store_1"
        query={cardQuery({
          enabled: true,
          spendPerPoint: 10_000,
          pointValue: 100,
          minRedeemPoints: 0,
        })}
      />
    );

    // Literal 10,000 / 100 in the store's currency — not converted to a few cents.
    // (Intl's no-break space is collapsed in the DOM text, so collapse it in the matcher too.)
    const idr = (value: number) => formatCurrency(value, "IDR", "en-US").replace(/\s/g, " ");
    expect(
      screen.getByText(
        `Spend ${idr(10_000)} to earn 1 point · 1 point is worth ${idr(100)} · no minimum to redeem`
      )
    ).toBeInTheDocument();
  });

  it("does not round a 4-decimal point value into a different number", () => {
    renderWithQuery(
      <LoyaltyCard
        storeId="store_1"
        query={cardQuery({
          enabled: true,
          spendPerPoint: 1,
          pointValue: 0.0125,
          minRedeemPoints: 0,
        })}
      />
    );
    expect(screen.getByText(/1 point is worth €0\.0125/)).toBeInTheDocument();
  });

  it("says it is not set up — and shows no suggested numbers — for an unconfigured store", () => {
    renderWithQuery(<LoyaltyCard storeId="store_1" query={cardQuery(UNSET)} />);

    expect(screen.getByText("promotions.loyalty.notConfigured")).toBeInTheDocument();
    expect(screen.getByText("promotions.loyalty.disabled")).toBeInTheDocument();
    expect(screen.queryByText(/Spend/)).toBeNull();
  });

  it("opens the dialog from the Edit button", () => {
    renderWithQuery(<LoyaltyCard storeId="store_1" query={cardQuery(UNSET)} />);
    expect(screen.queryByText(`${D}.title`)).toBeNull();

    fireEvent.click(screen.getByText("common.actions.edit"));
    expect(screen.getByText(`${D}.title`)).toBeInTheDocument();
  });

  it("offers a retry when the settings fail to load", () => {
    const refetch = vi.fn();
    renderWithQuery(
      <LoyaltyCard
        storeId="store_1"
        query={cardQuery(undefined, { isError: true, error: new Error("Boom"), refetch })}
      />
    );

    expect(screen.getByText("Boom")).toBeInTheDocument();
    fireEvent.click(screen.getByText("common.actions.retry"));
    expect(refetch).toHaveBeenCalled();
  });
});
