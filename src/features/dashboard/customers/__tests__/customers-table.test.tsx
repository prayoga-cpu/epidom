import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

const h = vi.hoisted(() => ({ currency: { current: "EUR" } }));

vi.mock("@/components/lang/i18n-provider", async () => {
  const { mockUseI18n } = await import("./helpers");
  return { useI18n: mockUseI18n };
});
vi.mock("@/components/providers/currency-provider", async () => {
  const { makeUseCurrency } = await import("./helpers");
  return { useCurrency: makeUseCurrency(() => h.currency.current) };
});

import { CustomersTable } from "../components/customers-table";
import { makeCustomer } from "./helpers";

const marie = makeCustomer();
const budi = makeCustomer({
  id: "c2",
  name: "Budi Santoso",
  phone: null,
  email: null,
  points: 0,
  memberSince: null,
  lifetimeSpend: 0,
  orderCount: 0,
  lastOrderAt: null,
});

interface RenderOptions {
  loyaltyEnabled?: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onSelect?: (c: unknown) => void;
  onLoadMore?: () => void;
}

function renderTable({
  loyaltyEnabled = true,
  hasMore = false,
  isLoadingMore = false,
  onSelect = vi.fn(),
  onLoadMore = vi.fn(),
}: RenderOptions = {}) {
  render(
    <CustomersTable
      customers={[marie, budi]}
      loyaltyEnabled={loyaltyEnabled}
      onSelect={onSelect}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      onLoadMore={onLoadMore}
    />
  );
  return { onSelect, onLoadMore };
}

beforeEach(() => {
  h.currency.current = "EUR";
});

describe("CustomersTable — rows", () => {
  it("renders one row per customer with the phone and email as a muted second line", () => {
    renderTable();
    // 1 header row + 2 customers
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("Marie Dupont")).toBeInTheDocument();
    expect(screen.getByText("+33612345678 · marie@example.com")).toBeInTheDocument();
    expect(screen.getByText("Budi Santoso")).toBeInTheDocument();
  });

  it("shows a dash for dates that don't exist yet, and real dates for those that do", () => {
    renderTable();
    const budiRow = screen.getByText("Budi Santoso").closest("tr")!;
    // Member since and Last visit are both null for Budi.
    expect(within(budiRow).getAllByText("—")).toHaveLength(2);

    const marieRow = screen.getByText("Marie Dupont").closest("tr")!;
    expect(within(marieRow).getByText("Sep 10, 2026")).toBeInTheDocument();
    expect(within(marieRow).getByText("7")).toBeInTheDocument();
  });

  it("opens the customer from the always-visible name button", () => {
    const { onSelect } = renderTable();
    fireEvent.click(screen.getByRole("button", { name: /Marie Dupont/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(marie);
  });

  it("opens the customer from a click anywhere on the row", () => {
    const { onSelect } = renderTable();
    fireEvent.click(
      within(screen.getByText("Budi Santoso").closest("tr")!).getAllByRole("cell")[1]
    );
    expect(onSelect).toHaveBeenCalledWith(budi);
  });
});

describe("CustomersTable — loyalty columns", () => {
  it("hides Member since and Points when the store has no loyalty program", () => {
    renderTable({ loyaltyEnabled: false });
    expect(screen.queryByRole("columnheader", { name: "customers.table.memberSince" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "customers.table.points" })).toBeNull();
    // The columns that always exist are still there.
    for (const key of ["name", "customerSince", "lifetimeSpend", "orders", "lastVisit"]) {
      expect(
        screen.getByRole("columnheader", { name: `customers.table.${key}` })
      ).toBeInTheDocument();
    }
    // 5 cells per row without the two loyalty columns.
    expect(within(screen.getAllByRole("row")[1]).getAllByRole("cell")).toHaveLength(5);
  });

  it("shows Member since and Points when loyalty is on", () => {
    renderTable({ loyaltyEnabled: true });
    expect(
      screen.getByRole("columnheader", { name: "customers.table.memberSince" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "customers.table.points" })
    ).toBeInTheDocument();
    const marieRow = screen.getByText("Marie Dupont").closest("tr")!;
    expect(within(marieRow).getAllByRole("cell")).toHaveLength(7);
    expect(within(marieRow).getByText("100")).toBeInTheDocument();
    expect(within(marieRow).getByText("Mar 1, 2026")).toBeInTheDocument();
  });
});

describe("CustomersTable — money", () => {
  it("formats Life spending in the store's own currency without IDR conversion", () => {
    renderTable();
    const marieRow = screen.getByText("Marie Dupont").closest("tr")!;
    // 1234.5 is already euros. If the component dropped the `currency` argument the
    // provider would treat it as IDR and show ~€0.07 instead.
    expect(within(marieRow).getByText("€1,234.50")).toBeInTheDocument();
    expect(within(marieRow).queryByText("€0.07")).toBeNull();
    expect(
      within(screen.getByText("Budi Santoso").closest("tr")!).getByText("€0.00")
    ).toBeInTheDocument();
  });

  it("does not touch the amount for an IDR store either", () => {
    h.currency.current = "IDR";
    renderTable();
    const marieRow = screen.getByText("Marie Dupont").closest("tr")!;
    expect(within(marieRow).getByText(/1,235/)).toBeInTheDocument();
  });
});

describe("CustomersTable — load more", () => {
  it("offers Load more only while the API has a next cursor", () => {
    const { onLoadMore } = renderTable({ hasMore: true });
    const button = screen.getByRole("button", { name: "customers.table.loadMore" });
    fireEvent.click(button);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("has no Load more button on the last page", () => {
    renderTable({ hasMore: false });
    expect(screen.queryByRole("button", { name: "customers.table.loadMore" })).toBeNull();
  });

  it("disables the button and says so while the next page loads", () => {
    renderTable({ hasMore: true, isLoadingMore: true });
    const button = screen.getByRole("button", { name: "customers.table.loadingMore" });
    expect(button).toBeDisabled();
  });
});

describe("CustomersTable — layout", () => {
  it("scrolls sideways on a phone instead of squeezing seven columns", () => {
    render(
      <CustomersTable
        customers={[marie]}
        loyaltyEnabled
        onSelect={vi.fn()}
        hasMore={false}
        isLoadingMore={false}
        onLoadMore={vi.fn()}
      />
    );
    const frame = screen.getByRole("table").closest("[data-slot=table-container]")!.parentElement!
      .parentElement!;
    expect(frame.className).toContain("-mx-4");
    expect(frame.className).toContain("overflow-x-auto");
    expect(frame.className).toContain("sm:mx-0");
    expect(frame.firstElementChild!.className).toContain("min-w-[720px]");
  });
});
