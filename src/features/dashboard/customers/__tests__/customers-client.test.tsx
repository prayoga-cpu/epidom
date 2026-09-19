import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { CustomerRowDto } from "@/types/api/cashier";

const STORE = "s1";

const h = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  download: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  loyalty: { current: "on" as "on" | "off" | "forbidden" },
  // Answers GET /customers (the list, never the includeSummary probe).
  list: {
    current: (() => ({ customers: [], nextCursor: null, totalCount: 0 })) as (
      params: Record<string, string> | undefined
    ) => unknown,
  },
}));

vi.mock("@/components/lang/i18n-provider", async () => {
  const { mockUseI18n } = await import("./helpers");
  return { useI18n: mockUseI18n };
});
vi.mock("@/components/providers/currency-provider", async () => {
  const { makeUseCurrency } = await import("./helpers");
  return { useCurrency: makeUseCurrency(() => "EUR") };
});
vi.mock("@/components/ui/phone-input", async () => {
  const { PhoneInputStub } = await import("./helpers");
  return { PhoneInput: PhoneInputStub };
});
vi.mock("sonner", () => ({ toast: { success: h.toastSuccess, error: h.toastError } }));
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiClient: { get: h.get, post: h.post, patch: h.patch } };
});
vi.mock("../lib/download-customers-csv", () => ({ downloadCustomersCsv: h.download }));

import { CustomersClient } from "../components/customers-client";
import { apiError, makeCustomer, makeDetail, renderWithQuery } from "./helpers";

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

const SUMMARY = { members: 12, nonMembers: 30, pointsRedeemedTotal: 3456 };

function listOf(customers: CustomerRowDto[], nextCursor: string | null = null) {
  return { customers, nextCursor, totalCount: customers.length };
}

/** Calls to the list endpoint only (not the summary probe, not detail). */
function listCalls() {
  return h.get.mock.calls.filter(
    ([path, params]) => path === `/stores/${STORE}/customers` && params?.includeSummary !== "1"
  );
}

function renderClient(canManage = true) {
  return renderWithQuery(<CustomersClient storeId={STORE} canManage={canManage} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  h.loyalty.current = "on";
  h.list.current = () => listOf([marie, budi]);
  h.download.mockResolvedValue(undefined);
  h.post.mockResolvedValue(makeCustomer({ id: "c3", name: "New Person" }));

  h.get.mockImplementation(async (path: string, params?: Record<string, string>) => {
    if (path === `/stores/${STORE}/loyalty-settings`) {
      if (h.loyalty.current === "forbidden") throw apiError(403, "Feature locked");
      return {
        enabled: h.loyalty.current === "on",
        spendPerPoint: 10,
        pointValue: 1,
        minRedeemPoints: 10,
      };
    }
    if (path === `/stores/${STORE}/customers`) {
      if (params?.includeSummary === "1") {
        return { customers: [], nextCursor: null, totalCount: 42, summary: SUMMARY };
      }
      return h.list.current(params);
    }
    if (path.startsWith(`/stores/${STORE}/customers/`)) return makeDetail();
    throw new Error(`unexpected GET ${path}`);
  });
});

describe("CustomersClient — page", () => {
  it("renders the title, subtitle, store-wide loyalty tiles and the customers", async () => {
    renderClient();

    expect(screen.getByText("customers.page.title")).toBeInTheDocument();
    expect(screen.getByText("customers.page.description")).toBeInTheDocument();

    expect(await screen.findByText("Marie Dupont")).toBeInTheDocument();
    expect(screen.getByText("Budi Santoso")).toBeInTheDocument();

    expect(screen.getByText("customers.summary.members")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("customers.summary.nonMembers")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("customers.summary.pointsRedeemed")).toBeInTheDocument();
    expect(screen.getByText("3,456")).toBeInTheDocument();
    expect(screen.queryByText("customers.summary.total")).toBeNull();

    // Loyalty columns are present.
    expect(
      screen.getByRole("columnheader", { name: "customers.table.points" })
    ).toBeInTheDocument();
    expect(screen.getByText("Showing 2 of 2")).toBeInTheDocument();
  });

  it("asks for the first page and the unfiltered summary as two separate requests", async () => {
    renderClient();
    await screen.findByText("Marie Dupont");

    expect(h.get).toHaveBeenCalledWith(`/stores/${STORE}/customers`, { limit: "25", sort: "name" });
    expect(h.get).toHaveBeenCalledWith(`/stores/${STORE}/customers`, {
      limit: "1",
      includeSummary: "1",
    });
  });

  it("treats a 403 from loyalty-settings as 'loyalty off': no loyalty tiles or columns", async () => {
    h.loyalty.current = "forbidden";
    renderClient();
    await screen.findByText("Marie Dupont");

    // One plain tile with the store-wide count instead of the three loyalty ones.
    expect(screen.getByText("customers.summary.total")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.queryByText("customers.summary.members")).toBeNull();
    expect(screen.queryByText("customers.summary.nonMembers")).toBeNull();
    expect(screen.queryByText("customers.summary.pointsRedeemed")).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "customers.table.points" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "customers.table.memberSince" })).toBeNull();
  });

  it("also hides loyalty when the program exists but is switched off", async () => {
    h.loyalty.current = "off";
    renderClient();
    await screen.findByText("Marie Dupont");
    expect(screen.queryByText("customers.summary.members")).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "customers.table.points" })).toBeNull();
  });

  it("shows a skeleton, not loyalty columns that would then vanish, until the setting is known", async () => {
    let release: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    const original = h.get.getMockImplementation()!;
    h.get.mockImplementation(async (path: string, params?: Record<string, string>) => {
      if (path === `/stores/${STORE}/loyalty-settings`) return pending;
      return original(path, params);
    });

    renderClient();
    // The list has long since resolved, but the table waits for the loyalty answer.
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(0));
    expect(screen.queryByText("Marie Dupont")).toBeNull();
    expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true");

    release({ enabled: true, spendPerPoint: 10, pointValue: 1, minRedeemPoints: 10 });
    expect(await screen.findByText("Marie Dupont")).toBeInTheDocument();
  });
});

describe("CustomersClient — search", () => {
  it("debounces the search, restarts from the first page, and leaves the tiles alone", async () => {
    renderClient();
    await screen.findByText("Marie Dupont");
    const callsBefore = h.get.mock.calls.length;

    fireEvent.change(screen.getByLabelText("customers.toolbar.searchLabel"), {
      target: { value: "mar" },
    });
    // Nothing yet: still inside the 300ms debounce window.
    expect(h.get.mock.calls.length).toBe(callsBefore);

    await waitFor(() =>
      expect(h.get).toHaveBeenCalledWith(`/stores/${STORE}/customers`, {
        limit: "25",
        sort: "name",
        q: "mar",
      })
    );
    // A fresh search never carries a cursor from the previous result set...
    expect(listCalls().every(([, params]) => !(params?.q && params?.cursor))).toBe(true);
    // ...and the store-wide summary is not re-requested with the search text.
    const summaryCalls = h.get.mock.calls.filter(([, params]) => params?.includeSummary === "1");
    expect(summaryCalls.every(([, params]) => params?.q === undefined)).toBe(true);
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("clears the search from the always-visible clear button", async () => {
    renderClient();
    await screen.findByText("Marie Dupont");
    const input = screen.getByLabelText("customers.toolbar.searchLabel") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "mar" } });
    fireEvent.click(screen.getByRole("button", { name: "customers.toolbar.clearSearch" }));

    expect(input.value).toBe("");
    expect(screen.queryByRole("button", { name: "customers.toolbar.clearSearch" })).toBeNull();
  });

  it("explains an empty result and offers to clear the search", async () => {
    h.list.current = (params) => (params?.q ? listOf([]) : listOf([marie, budi]));
    renderClient();
    await screen.findByText("Marie Dupont");

    fireEvent.change(screen.getByLabelText("customers.toolbar.searchLabel"), {
      target: { value: "zzz" },
    });

    expect(await screen.findByText("customers.states.noResultsTitle")).toBeInTheDocument();
    expect(screen.getByText("Nothing matches “zzz”")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "customers.states.clearSearch" }));
    expect(await screen.findByText("Marie Dupont")).toBeInTheDocument();
  });
});

describe("CustomersClient — paging", () => {
  it("loads the next page with the cursor and appends it, then stops offering more", async () => {
    h.list.current = (params) =>
      params?.cursor === "cur_1"
        ? { customers: [budi], nextCursor: null, totalCount: 2 }
        : { customers: [marie], nextCursor: "cur_1", totalCount: 2 };
    renderClient();
    await screen.findByText("Marie Dupont");
    expect(screen.queryByText("Budi Santoso")).toBeNull();
    expect(screen.getByText("Showing 1 of 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "customers.table.loadMore" }));

    expect(await screen.findByText("Budi Santoso")).toBeInTheDocument();
    expect(screen.getByText("Marie Dupont")).toBeInTheDocument();
    expect(h.get).toHaveBeenCalledWith(`/stores/${STORE}/customers`, {
      limit: "25",
      sort: "name",
      cursor: "cur_1",
    });
    expect(screen.getByText("Showing 2 of 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "customers.table.loadMore" })).toBeNull();
  });

  it("offers no Load more when the first page is the only page", async () => {
    renderClient();
    await screen.findByText("Marie Dupont");
    expect(screen.queryByRole("button", { name: "customers.table.loadMore" })).toBeNull();
  });
});

describe("CustomersClient — states", () => {
  it("shows the empty state, with an Add button, for a store with no customers", async () => {
    h.list.current = () => listOf([]);
    renderClient();

    expect(await screen.findByText("customers.states.emptyTitle")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "customers.toolbar.add" })).toHaveLength(2);
  });

  it("shows an error with a retry that recovers", async () => {
    let failures = 1;
    h.list.current = () => {
      if (failures-- > 0) throw apiError(500, "boom");
      return listOf([marie]);
    };
    renderClient();

    expect(await screen.findByText("customers.states.errorTitle")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "customers.states.retry" }));
    expect(await screen.findByText("Marie Dupont")).toBeInTheDocument();
  });
});

describe("CustomersClient — permissions", () => {
  it("canManage: offers Export CSV, which downloads what the search currently shows", async () => {
    renderClient(true);
    await screen.findByText("Marie Dupont");

    fireEvent.click(screen.getByRole("button", { name: "customers.toolbar.exportCsv" }));
    await waitFor(() => expect(h.download).toHaveBeenCalledWith(STORE, ""));
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("customers.export.success"));

    fireEvent.change(screen.getByLabelText("customers.toolbar.searchLabel"), {
      target: { value: "mar" },
    });
    await waitFor(() => expect(listCalls().some(([, p]) => p?.q === "mar")).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "customers.toolbar.exportCsv" }));
    await waitFor(() => expect(h.download).toHaveBeenLastCalledWith(STORE, "mar"));
  });

  it("reports an export failure with the server's message", async () => {
    h.download.mockRejectedValue(new Error("Managers only"));
    renderClient(true);
    await screen.findByText("Marie Dupont");

    fireEvent.click(screen.getByRole("button", { name: "customers.toolbar.exportCsv" }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Managers only"));
  });

  it("read-only persona: no Export, but can still browse and add customers", async () => {
    renderClient(false);
    await screen.findByText("Marie Dupont");

    expect(screen.queryByRole("button", { name: "customers.toolbar.exportCsv" })).toBeNull();
    expect(screen.getByRole("button", { name: "customers.toolbar.add" })).toBeInTheDocument();
  });

  it("read-only persona: the drawer has no Edit and no Adjust points", async () => {
    renderClient(false);
    fireEvent.click(await screen.findByRole("button", { name: /Marie Dupont/ }));

    expect(await screen.findByText("customers.detail.recentOrders")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "customers.detail.edit" })).toBeNull();
    expect(screen.queryByText("customers.adjust.title")).toBeNull();
  });
});

describe("CustomersClient — drawer and dialogs", () => {
  it("opens the detail drawer from a row and loads that customer's detail", async () => {
    renderClient();
    fireEvent.click(await screen.findByRole("button", { name: /Marie Dupont/ }));

    expect(await screen.findByText("ORD-0001")).toBeInTheDocument();
    expect(h.get).toHaveBeenCalledWith(`/stores/${STORE}/customers/c1`);
    // Name now appears in the row AND the drawer title.
    expect(screen.getAllByText("Marie Dupont").length).toBeGreaterThanOrEqual(2);
  });

  it("swaps the drawer for the edit form instead of stacking them, and brings it back after", async () => {
    renderClient();
    fireEvent.click(await screen.findByRole("button", { name: /Marie Dupont/ }));
    await screen.findByText("ORD-0001");

    fireEvent.click(screen.getByRole("button", { name: "customers.detail.edit" }));

    expect(await screen.findByText("customers.form.editTitle")).toBeInTheDocument();
    // One modal on screen: the drawer's content is gone while the form is up.
    expect(screen.queryByText("customers.detail.recentOrders")).toBeNull();
    expect((screen.getByLabelText("customers.form.name") as HTMLInputElement).value).toBe(
      "Marie Dupont"
    );

    fireEvent.click(screen.getByRole("button", { name: "customers.form.cancel" }));
    expect(await screen.findByText("customers.detail.recentOrders")).toBeInTheDocument();
    expect(screen.queryByText("customers.form.editTitle")).toBeNull();
  });

  it("adds a customer from the toolbar and refreshes the list afterwards", async () => {
    renderClient();
    await screen.findByText("Marie Dupont");
    const listCallsBefore = listCalls().length;

    fireEvent.click(screen.getByRole("button", { name: "customers.toolbar.add" }));
    expect(await screen.findByText("customers.form.addTitle")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("customers.form.name"), {
      target: { value: "New Person" },
    });
    fireEvent.click(screen.getByRole("button", { name: "customers.form.add" }));

    await waitFor(() =>
      expect(h.post).toHaveBeenCalledWith(`/stores/${STORE}/customers`, { name: "New Person" })
    );
    // Dialog closed, and the ["customers", storeId] prefix was invalidated: the list refetched.
    await waitFor(() => expect(screen.queryByText("customers.form.addTitle")).toBeNull());
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(listCallsBefore));
  });

  it("keeps the add dialog open with the phone error when the number is a duplicate", async () => {
    const duplicate = "A customer with this phone number already exists (Marie Dupont)";
    h.post.mockRejectedValue(apiError(409, "Conflict", [{ field: "phone", message: duplicate }]));
    renderClient();
    await screen.findByText("Marie Dupont");

    fireEvent.click(screen.getByRole("button", { name: "customers.toolbar.add" }));
    fireEvent.change(await screen.findByLabelText("customers.form.name"), {
      target: { value: "Marie Again" },
    });
    fireEvent.change(document.querySelector('input[type="tel"]')!, {
      target: { value: "+33612345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: "customers.form.add" }));

    const message = await screen.findByText(duplicate);
    const dialog = message.closest("[role=dialog]") as HTMLElement;
    expect(within(dialog).getByText("customers.form.addTitle")).toBeInTheDocument();
  });
});
