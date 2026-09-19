import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { DraftTender } from "../../types/pos.types";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));

import {
  PosTenderList,
  equalSplitTenders,
  makeDraftTender,
  resolveTenderMethods,
  tendersRemaining,
} from "../pos-tender-list";
import type { TenderMethod } from "@/lib/finance/order-payments";

const fmt = (v: number) => `€${v.toFixed(2)}`;

const row = (over: Partial<DraftTender> = {}): DraftTender => ({
  id: over.id ?? `t-${Math.random().toString(36).slice(2, 8)}`,
  method: "CASH",
  amount: null,
  amountTendered: null,
  note: "",
  ...over,
});

/** Stateful host so the list behaves as it does inside checkout, and the latest rows are inspectable. */
function Harness({
  total,
  initial,
  decimals = 2,
  methods = ["CASH", "STRIPE_CARD", "QRIS"],
  onRows,
}: {
  total: number;
  initial: DraftTender[];
  decimals?: number;
  methods?: TenderMethod[];
  onRows?: (rows: DraftTender[]) => void;
}) {
  const [rows, setRows] = useState(initial);
  onRows?.(rows);
  return (
    <PosTenderList
      total={total}
      tenders={rows}
      onChange={setRows}
      methods={methods}
      currency="EUR"
      decimals={decimals}
      formatPrice={fmt}
    />
  );
}

describe("tendersRemaining", () => {
  it("is what is left after the rows entered so far, ignoring blank rows", () => {
    expect(tendersRemaining(100, [{ amount: 60 }, { amount: null }])).toBe(40);
    expect(tendersRemaining(100, [{ amount: 60 }, { amount: 40 }])).toBe(0);
    expect(tendersRemaining(100, [{ amount: 70 }, { amount: 40 }])).toBe(-10);
  });

  it("does not drift on cents", () => {
    expect(tendersRemaining(0.3, [{ amount: 0.1 }, { amount: 0.2 }])).toBe(0);
  });
});

describe("equalSplitTenders", () => {
  it("the last share absorbs the rounding, and shares sum to the total", () => {
    const rows = equalSplitTenders({
      total: 10,
      parts: 3,
      decimals: 2,
      existing: [],
      defaultMethod: "CASH",
    });
    expect(rows.map((r) => r.amount)).toEqual([3.33, 3.33, 3.34]);
    expect(tendersRemaining(10, rows)).toBe(0);
  });

  it("IDR (0 decimals) deals whole rupiah", () => {
    const rows = equalSplitTenders({
      total: 100000,
      parts: 3,
      decimals: 0,
      existing: [],
      defaultMethod: "CASH",
    });
    expect(rows.map((r) => r.amount)).toEqual([33333, 33333, 33334]);
  });

  it("keeps each existing row's method and label by position and clears stale cash hand-over", () => {
    const existing = [
      row({ id: "a", method: "QRIS", amountTendered: 50 }),
      row({ id: "b", method: "OTHER", note: "Voucher" }),
    ];
    const rows = equalSplitTenders({
      total: 90,
      parts: 3,
      decimals: 2,
      existing,
      defaultMethod: "CASH",
    });
    expect(rows.map((r) => r.method)).toEqual(["QRIS", "OTHER", "CASH"]);
    expect(rows[1].note).toBe("Voucher");
    expect(rows[0].id).toBe("a");
    expect(rows.every((r) => r.amountTendered === null)).toBe(true);
  });
});

describe("resolveTenderMethods", () => {
  it("lists only what the store accepts, market of the UI language first", () => {
    expect(resolveTenderMethods(["QRIS", "CASH", "CHEQUE"], "fr")).toEqual([
      "CASH",
      "CHEQUE",
      "QRIS",
    ]);
    expect(resolveTenderMethods(["QRIS", "CASH", "CHEQUE"], "id")).toEqual([
      "CASH",
      "QRIS",
      "CHEQUE",
    ]);
  });

  it("never returns an empty list (settings not loaded yet)", () => {
    expect(resolveTenderMethods(undefined, "en")).toEqual(["CASH"]);
    expect(resolveTenderMethods([], "en")).toEqual(["CASH"]);
  });
});

describe("PosTenderList", () => {
  it("shows the live Remaining figure and marks it settled at zero", () => {
    const { rerender } = render(
      <PosTenderList
        total={100}
        tenders={[row({ amount: 60 }), row({ amount: null })]}
        onChange={() => {}}
        methods={["CASH", "QRIS"]}
        currency="EUR"
        decimals={2}
        formatPrice={fmt}
      />
    );
    expect(screen.getByText("cashierCheckout.tender.remaining")).toBeInTheDocument();
    expect(screen.getByText("€40.00")).toBeInTheDocument();

    rerender(
      <PosTenderList
        total={100}
        tenders={[row({ amount: 60 }), row({ amount: 40 })]}
        onChange={() => {}}
        methods={["CASH", "QRIS"]}
        currency="EUR"
        decimals={2}
        formatPrice={fmt}
      />
    );
    expect(screen.getByText("€0.00")).toBeInTheDocument();

    rerender(
      <PosTenderList
        total={100}
        tenders={[row({ amount: 70 }), row({ amount: 40 })]}
        onChange={() => {}}
        methods={["CASH", "QRIS"]}
        currency="EUR"
        decimals={2}
        formatPrice={fmt}
      />
    );
    expect(screen.getByText("cashierCheckout.tender.over")).toBeInTheDocument();
    expect(screen.getByText("€10.00")).toBeInTheDocument();
  });

  it("Add payment appends a row prefilled with what is remaining, on a method not yet used", () => {
    let rows: DraftTender[] = [];
    render(
      <Harness
        total={100}
        initial={[row({ id: "a", method: "CASH", amount: 60 })]}
        onRows={(r) => (rows = r)}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "cashierCheckout.tender.add" }));
    expect(rows).toHaveLength(2);
    expect(rows[1].amount).toBe(40);
    expect(rows[1].method).toBe("STRIPE_CARD");
  });

  it("caps at 10 payments", () => {
    const many = Array.from({ length: 10 }, (_, i) => row({ id: `r${i}`, amount: 10 }));
    render(<Harness total={100} initial={many} />);
    expect(screen.getByRole("button", { name: "cashierCheckout.tender.add" })).toBeDisabled();
  });

  it("removes a row, but never the last one", () => {
    let rows: DraftTender[] = [];
    render(
      <Harness
        total={100}
        initial={[row({ id: "a", amount: 50 }), row({ id: "b", amount: 50 })]}
        onRows={(r) => (rows = r)}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "cashierCheckout.tender.remove 1" }));
    expect(rows.map((r) => r.id)).toEqual(["b"]);
    expect(screen.getByRole("button", { name: "cashierCheckout.tender.remove 1" })).toBeDisabled();
  });

  it("typing an amount updates that row", () => {
    let rows: DraftTender[] = [];
    render(
      <Harness
        total={100}
        initial={[row({ id: "a" }), row({ id: "b" })]}
        onRows={(r) => (rows = r)}
      />
    );
    fireEvent.change(screen.getByLabelText("cashierCheckout.tender.amount 2"), {
      target: { value: "25.5" },
    });
    expect(rows[1].amount).toBe(25.5);
    expect(screen.getByText("€74.50")).toBeInTheDocument();
  });

  it("only cash rows take a hand-over, and show the change it makes", () => {
    render(
      <Harness
        total={100}
        initial={[
          row({ id: "a", method: "CASH", amount: 20 }),
          row({ id: "b", method: "QRIS", amount: 80 }),
        ]}
      />
    );
    expect(screen.getAllByLabelText(/cashierCheckout\.tender\.cashReceived/)).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("cashierCheckout.tender.cashReceived 1"), {
      target: { value: "50" },
    });
    // Change = 50 − 20
    expect(screen.getByText("€30.00")).toBeInTheDocument();
  });

  it("flags a hand-over smaller than the cash amount", () => {
    render(
      <Harness
        total={100}
        initial={[row({ id: "a", method: "CASH", amount: 20, amountTendered: 10 })]}
      />
    );
    expect(screen.getByText("cashierCheckout.tender.cashShort")).toBeInTheDocument();
  });

  it("changing a row away from Cash clears its hand-over; choosing Other shows a label field", () => {
    let rows: DraftTender[] = [];
    render(
      <Harness
        total={100}
        initial={[row({ id: "a", method: "CASH", amount: 100, amountTendered: 120 })]}
        onRows={(r) => (rows = r)}
      />
    );
    fireEvent.change(screen.getByLabelText("cashierCheckout.tender.method 1"), {
      target: { value: "OTHER" },
    });
    expect(rows[0].method).toBe("OTHER");
    expect(rows[0].amountTendered).toBeNull();
    expect(screen.getByLabelText("cashierCheckout.tender.otherLabel 1")).toBeInTheDocument();
    expect(screen.queryByLabelText(/cashierCheckout\.tender\.cashReceived/)).toBeNull();
  });

  it("Split equally between N fills N rows and reaches zero remaining", () => {
    let rows: DraftTender[] = [];
    render(
      <Harness
        total={10}
        initial={[row({ id: "a" }), row({ id: "b" })]}
        onRows={(r) => (rows = r)}
      />
    );

    // Two people by default (the list has two rows); go to three.
    fireEvent.click(screen.getByRole("button", { name: "cashierCheckout.tender.morePeople" }));
    expect(screen.getByTestId("equal-split-parts")).toHaveTextContent("3");
    // The preview names the rounding: 3.33 each, the last one 3.34.
    expect(screen.getByText(/cashierCheckout\.tender\.eachShare/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "cashierCheckout.tender.splitEqually" }));
    expect(rows.map((r) => r.amount)).toEqual([3.33, 3.33, 3.34]);
    expect(
      within(screen.getByText("cashierCheckout.tender.remaining").parentElement!).getByText("€0.00")
    ).toBeTruthy();
  });

  it("the people stepper stays within 2–10", () => {
    render(<Harness total={100} initial={[row({ id: "a" }), row({ id: "b" })]} />);
    const fewer = screen.getByRole("button", { name: "cashierCheckout.tender.fewerPeople" });
    const more = screen.getByRole("button", { name: "cashierCheckout.tender.morePeople" });
    expect(fewer).toBeDisabled();
    for (let i = 0; i < 12; i++) fireEvent.click(more);
    expect(screen.getByTestId("equal-split-parts")).toHaveTextContent("10");
    expect(more).toBeDisabled();
  });

  it("IDR: equal shares are whole rupiah (decimals 0)", () => {
    let rows: DraftTender[] = [];
    render(
      <Harness
        total={100000}
        decimals={0}
        initial={[row({ id: "a" }), row({ id: "b" })]}
        onRows={(r) => (rows = r)}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "cashierCheckout.tender.morePeople" }));
    fireEvent.click(screen.getByRole("button", { name: "cashierCheckout.tender.splitEqually" }));
    expect(rows.map((r) => r.amount)).toEqual([33333, 33333, 33334]);
  });

  it("every control is at least 44px (h-11)", () => {
    render(
      <Harness total={100} initial={[row({ id: "a", amount: 50 }), row({ id: "b", amount: 50 })]} />
    );
    for (const name of [
      "cashierCheckout.tender.add",
      "cashierCheckout.tender.remove 1",
      "cashierCheckout.tender.fewerPeople",
      "cashierCheckout.tender.morePeople",
      "cashierCheckout.tender.splitEqually",
    ]) {
      expect(screen.getByRole("button", { name }).className).toMatch(/h-11/);
    }
    expect(screen.getByLabelText("cashierCheckout.tender.method 1").className).toMatch(/h-11/);
    expect(screen.getByLabelText("cashierCheckout.tender.amount 1").className).toMatch(/h-11/);
  });

  it("makeDraftTender starts blank", () => {
    expect(makeDraftTender("QRIS")).toMatchObject({
      method: "QRIS",
      amount: null,
      amountTendered: null,
      note: "",
    });
    expect(makeDraftTender("CASH", 5).amount).toBe(5);
  });
});
