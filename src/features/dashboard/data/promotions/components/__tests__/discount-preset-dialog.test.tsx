import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { configure, fireEvent, screen, waitFor } from "@testing-library/react";
import { ApiErrorCode } from "@/types/api/responses";
import type { DiscountPresetDto } from "@/types/api/cashier";

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
import { DiscountPresetDialog } from "../discount-preset-dialog";

// See promotions-section.test.tsx: parallel runs can outlast the 1s default.
configure({ asyncUtilTimeout: 8000 });
// getByRole walks the whole accessibility tree, which is very slow in jsdom, so these
// suites query by text / label instead. They still render Radix dialogs and a form
// library, and a parallel run on a busy machine can outlast the repo's 20s default.
vi.setConfig({ testTimeout: 90_000 });

const LABEL = {
  name: "promotions.presets.dialog.name",
  value: "promotions.presets.dialog.value",
  submitAdd: "promotions.presets.dialog.submitAdd",
  submitSave: "promotions.presets.dialog.submitSave",
};

function renderDialog(props: { preset?: DiscountPresetDto | null } = {}) {
  const onOpenChange = vi.fn();
  renderWithQuery(
    <DiscountPresetDialog
      open
      onOpenChange={onOpenChange}
      storeId="store_1"
      preset={props.preset}
    />
  );
  return { onOpenChange };
}

const nameInput = () => screen.getByLabelText(LABEL.name) as HTMLInputElement;
const valueInput = () => screen.getByLabelText(LABEL.value) as HTMLInputElement;
// The segment's text IS the radio button; the submit label is the footer button's own text.
const typeRadio = (kind: "percent" | "fixed") => screen.getByText(`promotions.type.${kind}`);
const submit = (label = LABEL.submitAdd) => fireEvent.click(screen.getByText(label));

function fill(name: string, value: string) {
  fireEvent.change(nameInput(), { target: { value: name } });
  fireEvent.change(valueInput(), { target: { value } });
}

const PRESET: DiscountPresetDto = {
  id: "p1",
  name: "Staff 20%",
  type: "PERCENT",
  value: 20,
  isActive: true,
  sortOrder: 0,
};

beforeAll(stubResizeObserver);

beforeEach(() => {
  h.currency = "EUR";
  h.api.post.mockResolvedValue({ ...PRESET, id: "new" });
  h.api.patch.mockResolvedValue(PRESET);
});

describe("DiscountPresetDialog — value rules", () => {
  it("rejects a percentage above 100 and sends nothing", async () => {
    renderDialog();
    fill("Everything off", "150");
    submit();

    expect(await screen.findByText("promotions.validation.percentMax")).toBeInTheDocument();
    expect(h.api.post).not.toHaveBeenCalled();
  });

  it("accepts exactly 100%", async () => {
    const { onOpenChange } = renderDialog();
    fill("Free", "100");
    submit();

    await waitFor(() => expect(h.api.post).toHaveBeenCalled());
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("requires a name and a positive value", async () => {
    renderDialog();
    fill("", "0");
    submit();

    expect(await screen.findByText("promotions.validation.nameRequired")).toBeInTheDocument();
    expect(screen.getByText("promotions.validation.valuePositive")).toBeInTheDocument();
    expect(h.api.post).not.toHaveBeenCalled();
  });

  it("re-checks the value when the type flips from FIXED to PERCENT", async () => {
    renderDialog();
    fireEvent.click(typeRadio("fixed"));
    fill("Big off", "150");
    submit();
    await waitFor(() => expect(h.api.post).toHaveBeenCalled());
    h.api.post.mockClear();

    fireEvent.click(typeRadio("percent"));
    expect(await screen.findByText("promotions.validation.percentMax")).toBeInTheDocument();
  });
});

describe("DiscountPresetDialog — currency", () => {
  it("shows % for a percentage and the store's symbol for a fixed amount", () => {
    renderDialog();
    expect(screen.getByText("%")).toBeInTheDocument();
    expect(screen.queryByText("€")).toBeNull();

    fireEvent.click(typeRadio("fixed"));
    expect(screen.getByText("€")).toBeInTheDocument();
    expect(screen.queryByText("%")).toBeNull();
  });

  it("uses the store's own currency symbol, not a hardcoded one", () => {
    h.currency = "IDR";
    renderDialog();
    fireEvent.click(typeRadio("fixed"));
    expect(screen.getByText("Rp")).toBeInTheDocument();
  });

  it("submits a EUR amount exactly as typed — literal, never IDR-converted", async () => {
    renderDialog();
    fireEvent.click(typeRadio("fixed"));
    fill("Happy hour", "2,50");
    submit();

    await waitFor(() =>
      expect(h.api.post).toHaveBeenCalledWith("/stores/store_1/discount-presets", {
        name: "Happy hour",
        type: "FIXED",
        value: 2.5,
        isActive: true,
      })
    );
  });

  it("submits a percentage as typed", async () => {
    renderDialog();
    fill("  Staff 20%  ", "20");
    submit();

    await waitFor(() =>
      expect(h.api.post).toHaveBeenCalledWith("/stores/store_1/discount-presets", {
        name: "Staff 20%",
        type: "PERCENT",
        value: 20,
        isActive: true,
      })
    );
  });

  it("sends isActive:false when the switch is off", async () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText("promotions.presets.dialog.active"));
    fill("Dormant", "5");
    submit();

    await waitFor(() =>
      expect(h.api.post).toHaveBeenCalledWith(
        "/stores/store_1/discount-presets",
        expect.objectContaining({ isActive: false })
      )
    );
  });
});

describe("DiscountPresetDialog — server errors", () => {
  it("puts the server's field error under the input and stays open", async () => {
    h.api.post.mockRejectedValue(
      new ApiClientError(
        {
          success: false,
          error: {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: "Validation failed",
            details: [{ field: "value", message: "A percentage can't exceed 100" }],
          },
        },
        400
      )
    );
    const { onOpenChange } = renderDialog();
    fill("Odd", "50");
    submit();

    // The message is the server's own, and it sits in the value field's slot.
    const message = await screen.findByText("A percentage can't exceed 100");
    expect(message).toHaveAttribute("id", expect.stringContaining("form-item-message"));
    expect(valueInput()).toHaveAttribute("aria-invalid", "true");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(h.toast.error).toHaveBeenCalled();
    expect(h.toast.success).not.toHaveBeenCalled();
  });

  it("falls back to a toast for an error with no field details", async () => {
    h.api.post.mockRejectedValue(new Error("Network error occurred"));
    const { onOpenChange } = renderDialog();
    fill("Odd", "50");
    submit();

    await waitFor(() =>
      expect(h.toast.error).toHaveBeenCalledWith("common.error", {
        description: "Network error occurred",
      })
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe("DiscountPresetDialog — editing", () => {
  it("prefills from the preset and PATCHes that preset", async () => {
    const { onOpenChange } = renderDialog({ preset: PRESET });

    expect(screen.getByText("promotions.presets.dialog.editTitle")).toBeInTheDocument();
    expect(nameInput().value).toBe("Staff 20%");
    expect(valueInput().value).toBe("20");

    fireEvent.change(valueInput(), { target: { value: "25" } });
    submit(LABEL.submitSave);

    await waitFor(() =>
      expect(h.api.patch).toHaveBeenCalledWith("/stores/store_1/discount-presets/p1", {
        name: "Staff 20%",
        type: "PERCENT",
        value: 25,
        isActive: true,
      })
    );
    expect(h.api.post).not.toHaveBeenCalled();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
