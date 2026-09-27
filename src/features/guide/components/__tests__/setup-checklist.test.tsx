import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { en } from "@/locales/en";
import type { SetupItem, SetupItemId, SetupProgress, SetupSection } from "@/lib/guide/contracts";

// ── Mocks ────────────────────────────────────────────────────────────────────

const lookup = (key: string): string => {
  const value = key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined,
      en
    );
  return typeof value === "string" ? value : key;
};
vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: lookup }),
}));

const trackEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics", () => ({ trackEvent }));

const toast = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast }));

const nav = vi.hoisted(() => ({ search: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/store/store-1/dashboard",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const guide = vi.hoisted(() => ({
  dismissed: new Set<string>(),
  ready: true,
  loading: false,
  dismissChecklist: vi.fn(),
  restoreChecklist: vi.fn(),
}));
vi.mock("@/features/guide/hooks/use-guide-state", () => ({
  useGuideState: () => ({
    state: { tourSeenAt: null, dismissedTips: [], dismissedChecklists: [...guide.dismissed] },
    isLoading: guide.loading,
    isReady: guide.ready,
    isAvailable: true,
    tourSeen: false,
    isTipDismissed: () => false,
    isChecklistDismissed: (storeId: string) => guide.dismissed.has(storeId),
    dismissTip: vi.fn(),
    markTourSeen: vi.fn(),
    resetTour: vi.fn(),
    restoreTips: vi.fn(),
    dismissChecklist: guide.dismissChecklist,
    restoreChecklist: guide.restoreChecklist,
  }),
}));

const progressQuery = vi.hoisted(() => ({
  result: { data: undefined, isPending: true } as { data: unknown; isPending: boolean },
  calls: [] as { storeId: unknown; enabled: unknown }[],
}));
vi.mock("@/features/guide/hooks/use-setup-progress", () => ({
  useSetupProgress: (storeId: unknown, opts?: { enabled?: boolean }) => {
    progressQuery.calls.push({ storeId, enabled: opts?.enabled });
    return progressQuery.result;
  },
}));

import { SetupChecklist } from "../setup-checklist";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const STORE = "store-1";
const POS_UPGRADE = "/pricing?trial=true#plans";
const OPS_UPGRADE = "/pricing?upgrade=true&required=OPERATIONS#plans";

const SECTION_OF: Record<SetupItemId, SetupSection> = {
  publishStorefront: "storefront",
  addMenuItems: "storefront",
  addItemPhotos: "storefront",
  addBranding: "storefront",
  addWhatsapp: "storefront",
  firstVisit: "storefront",
  firstSale: "counter",
  openShift: "counter",
  addTables: "counter",
  addStockItems: "operations",
  addSupplier: "operations",
  addStaff: "operations",
  publishSchedule: "operations",
};

function item(id: SetupItemId, overrides: Partial<SetupItem> = {}): SetupItem {
  const section = SECTION_OF[id];
  return {
    id,
    section,
    done: false,
    locked: false,
    requiredPlan: section === "storefront" ? "FREE" : section === "counter" ? "POS" : "OPERATIONS",
    href: `/store/${STORE}/${id}`,
    ...overrides,
  };
}

/** Build a SetupProgress the way the service does: items grouped in section order, counts over unlocked items. */
function progress(
  plan: SetupProgress["plan"],
  opts: {
    sections?: SetupSection[];
    done?: SetupItemId[];
    isNewStore?: boolean;
    menuItems?: number;
  } = {}
): SetupProgress {
  const sections = opts.sections ?? ["storefront", "counter", "operations"];
  const counter = plan !== "FREE";
  const operations = plan === "OPERATIONS" || plan === "ENTERPRISE";
  const done = new Set(opts.done ?? []);
  const items = sections.flatMap((section) =>
    (Object.keys(SECTION_OF) as SetupItemId[])
      .filter((id) => SECTION_OF[id] === section)
      .map((id) => {
        const locked =
          (section === "counter" && !counter) || (section === "operations" && !operations);
        const base = item(id, {
          locked,
          done: !locked && done.has(id),
          href: locked
            ? section === "counter"
              ? POS_UPGRADE
              : OPS_UPGRADE
            : `/store/${STORE}/${id}`,
        });
        if (id === "addMenuItems" && !locked) {
          base.progress = { current: opts.menuItems ?? 2, target: 5 };
        }
        return base;
      })
  );
  const unlocked = items.filter((i) => !i.locked);
  const completed = unlocked.filter((i) => i.done).length;
  return {
    storeId: STORE,
    items,
    sections,
    completed,
    total: unlocked.length,
    allDone: unlocked.length > 0 && completed === unlocked.length,
    isNewStore: opts.isNewStore ?? true,
    plan,
    goals: [],
  };
}

function loaded(data: SetupProgress | null) {
  progressQuery.result = { data, isPending: false };
}

function renderChecklist(props: Partial<{ canView: boolean; isNewStore: boolean }> = {}) {
  return render(
    <SetupChecklist
      storeId={STORE}
      canView={props.canView ?? true}
      isNewStore={props.isNewStore ?? true}
    />
  );
}

const card = () => screen.queryByTestId("setup-checklist");
const sectionHeadings = () =>
  within(card()!)
    .getAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent);

beforeEach(() => {
  nav.search = "";
  guide.dismissed = new Set();
  guide.ready = true;
  guide.loading = false;
  progressQuery.calls = [];
  progressQuery.result = { data: undefined, isPending: true };
  try {
    window.localStorage.clear();
  } catch {
    // jsdom always has storage; nothing to clear otherwise.
  }
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("SetupChecklist — per plan", () => {
  it("FREE: the storefront steps, and one upsell row each for the counter and operations", () => {
    loaded(progress("FREE", { done: ["publishStorefront", "addBranding", "addWhatsapp"] }));
    renderChecklist();

    expect(screen.getByRole("heading", { name: "Get your store ready" })).toBeInTheDocument();
    expect(screen.getByText("3 of 6 done")).toBeInTheDocument();

    const counter = card()!.querySelector('[data-section="counter"]') as HTMLElement;
    const operations = card()!.querySelector('[data-section="operations"]') as HTMLElement;
    // Never the locked items one by one.
    expect(within(counter).queryAllByRole("listitem")).toHaveLength(0);
    expect(within(operations).queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.queryByText("Ring up your first sale")).toBeNull();
    expect(screen.queryByText("Add a supplier")).toBeNull();

    expect(card()!.querySelectorAll("[data-upsell]")).toHaveLength(2);
    expect(within(counter).getByText(/Taking orders at the counter\?/)).toBeInTheDocument();
    expect(within(counter).getByRole("link", { name: "Start free trial" })).toHaveAttribute(
      "href",
      POS_UPGRADE
    );
    expect(within(operations).getByText(/Running stock or a team\?/)).toBeInTheDocument();
    expect(within(operations).getByRole("link", { name: "See Operations" })).toHaveAttribute(
      "href",
      OPS_UPGRADE
    );
    // The locked sections carry their plan.
    expect(within(counter).getByText("POS")).toBeInTheDocument();
    expect(within(operations).getByText("Operations")).toBeInTheDocument();
  });

  it("POS: the counter steps show, only operations is an upsell", () => {
    loaded(progress("POS"));
    renderChecklist();

    expect(screen.getByText("0 of 9 done")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ring up your first sale/ })).toHaveAttribute(
      "href",
      `/store/${STORE}/firstSale`
    );
    const upsells = card()!.querySelectorAll("[data-upsell]");
    expect(upsells).toHaveLength(1);
    expect(upsells[0]).toHaveAttribute("data-upsell", "operations");
  });

  it("OPERATIONS: every step, no upsell", () => {
    loaded(progress("OPERATIONS"));
    renderChecklist();

    expect(screen.getByText("0 of 13 done")).toBeInTheDocument();
    expect(card()!.querySelectorAll("[data-upsell]")).toHaveLength(0);
    expect(screen.getByRole("link", { name: /Publish a schedule/ })).toBeInTheDocument();
  });
});

describe("SetupChecklist — layout", () => {
  it("shows the sections in the order the server sent (goals first)", () => {
    loaded(progress("OPERATIONS", { sections: ["operations", "storefront", "counter"] }));
    renderChecklist();
    expect(sectionHeadings()).toEqual(["Stock & team", "Storefront", "At the counter"]);
  });

  it("shows a counted step's progress", () => {
    loaded(progress("FREE", { menuItems: 2 }));
    renderChecklist();
    const row = screen.getByRole("link", { name: /Add menu items/ });
    expect(row).toHaveTextContent("2 of 5");
  });

  it("folds done steps after the pending ones behind 'Show N done'", () => {
    loaded(progress("FREE", { done: ["publishStorefront", "addBranding", "addWhatsapp"] }));
    renderChecklist();

    expect(screen.queryByRole("link", { name: /Publish your storefront/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show 3 done" }));

    const storefront = card()!.querySelector('[data-section="storefront"]') as HTMLElement;
    const order = within(storefront)
      .getAllByRole("listitem")
      .map((li) => [li.getAttribute("data-item"), li.getAttribute("data-done")]);
    expect(order).toEqual([
      ["addMenuItems", "false"],
      ["addItemPhotos", "false"],
      ["firstVisit", "false"],
      ["publishStorefront", "true"],
      ["addBranding", "true"],
      ["addWhatsapp", "true"],
    ]);
    expect(screen.getByRole("button", { name: "Hide done steps" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });

  it("tracks a step click with its id", () => {
    loaded(progress("FREE"));
    renderChecklist();
    fireEvent.click(screen.getByRole("link", { name: /Add your WhatsApp number/ }));
    expect(trackEvent).toHaveBeenCalledWith("checklist_item_clicked", { item_id: "addWhatsapp" });
  });

  it("collapses to its header and remembers that per store", () => {
    loaded(progress("FREE"));
    const { unmount } = renderChecklist();

    fireEvent.click(screen.getByRole("button", { name: "Collapse checklist" }));
    expect(screen.queryByRole("link", { name: /Add menu items/ })).toBeNull();
    expect(screen.getByText("0 of 6 done")).toBeInTheDocument();
    expect(window.localStorage.getItem(`epidom.setupChecklist.collapsed.${STORE}`)).toBe("1");

    unmount();
    renderChecklist();
    expect(screen.getByRole("button", { name: "Expand checklist" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    fireEvent.click(screen.getByRole("button", { name: "Expand checklist" }));
    expect(screen.getByRole("link", { name: /Add menu items/ })).toBeInTheDocument();
  });

  it("holds its place with a skeleton while loading", () => {
    renderChecklist();
    expect(screen.getByTestId("setup-checklist-loading")).toBeInTheDocument();

    progressQuery.result = { data: undefined, isPending: true };
    guide.ready = false;
    guide.loading = true;
    renderChecklist();
    expect(screen.getAllByTestId("setup-checklist-loading")).toHaveLength(2);
  });
});

describe("SetupChecklist — hide and all set", () => {
  it("Hide checklist dismisses it for this store, with an Undo toast that restores it", () => {
    loaded(progress("FREE"));
    renderChecklist();

    fireEvent.keyDown(screen.getByRole("button", { name: "Checklist options" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Hide checklist" }));

    expect(guide.dismissChecklist).toHaveBeenCalledWith(STORE);
    expect(trackEvent).toHaveBeenCalledWith("checklist_dismissed");
    expect(card()).toBeNull();

    expect(toast).toHaveBeenCalledTimes(1);
    const [message, options] = toast.mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    expect(message).toBe("Checklist hidden");
    expect(options.action.label).toBe("Undo");

    act(() => options.action.onClick());
    expect(guide.restoreChecklist).toHaveBeenCalledWith(STORE);
    expect(card()).toBeInTheDocument();
  });

  it("all done: a compact 'All set' row whose Dismiss hides it", () => {
    loaded(
      progress("FREE", {
        done: [
          "publishStorefront",
          "addMenuItems",
          "addItemPhotos",
          "addBranding",
          "addWhatsapp",
          "firstVisit",
        ],
      })
    );
    renderChecklist();

    expect(card()).toBeNull();
    const allSet = screen.getByTestId("setup-checklist-all-set");
    expect(within(allSet).getByRole("heading", { name: "All set" })).toBeInTheDocument();

    fireEvent.click(within(allSet).getByRole("button", { name: "Dismiss" }));
    expect(guide.dismissChecklist).toHaveBeenCalledWith(STORE);
    expect(screen.queryByTestId("setup-checklist-all-set")).toBeNull();
  });
});

describe("SetupChecklist — visibility", () => {
  it("renders nothing for a viewer who may not see it, and doesn't ask", () => {
    loaded(progress("FREE"));
    const { container } = renderChecklist({ canView: false });
    expect(container).toBeEmptyDOMElement();
    expect(progressQuery.calls).toHaveLength(0);
  });

  it("is hidden on an established store, and doesn't ask", () => {
    loaded(progress("FREE", { isNewStore: false }));
    const { container } = renderChecklist({ isNewStore: false });
    expect(container).toBeEmptyDOMElement();
    expect(progressQuery.calls).toHaveLength(0);
  });

  it("shows on an established store opened with ?checklist=1 (from Help)", () => {
    nav.search = "checklist=1";
    loaded(progress("FREE", { isNewStore: false }));
    renderChecklist({ isNewStore: false });
    expect(card()).toBeInTheDocument();
  });

  it("defers to the server's own isNewStore once loaded", () => {
    loaded(progress("FREE", { isNewStore: false }));
    const { container } = renderChecklist({ isNewStore: true });
    expect(container).toBeEmptyDOMElement();
  });

  it("is hidden once dismissed for this store — unless ?checklist=1", () => {
    guide.dismissed = new Set([STORE]);
    loaded(progress("FREE"));
    const { container, unmount } = renderChecklist();
    expect(container).toBeEmptyDOMElement();
    expect(progressQuery.calls.at(-1)?.enabled).toBe(false);
    unmount();

    nav.search = "checklist=1";
    renderChecklist();
    expect(card()).toBeInTheDocument();
  });

  it("?checklist=1 is removed from the URL once read, keeping the other params", () => {
    nav.search = "checklist=1&range=7d";
    loaded(progress("FREE", { isNewStore: false }));
    renderChecklist({ isNewStore: false });
    expect(card()).toBeInTheDocument();
    expect(nav.replace).toHaveBeenCalledWith("/store/store-1/dashboard?range=7d", {
      scroll: false,
    });
  });

  it("?checklist=1 holds for the visit after the param is gone (established store, dismissed)", () => {
    guide.dismissed = new Set([STORE]);
    nav.search = "checklist=1";
    loaded(progress("FREE", { isNewStore: false }));
    const { rerender } = renderChecklist({ isNewStore: false });
    expect(card()).toBeInTheDocument();

    // router.replace landed: the page stays mounted, the card stays.
    nav.search = "";
    nav.replace.mockClear();
    rerender(<SetupChecklist storeId={STORE} canView isNewStore={false} />);
    expect(card()).toBeInTheDocument();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("a checklist hidden after opening it from Help stays hidden on Back or a reload", () => {
    nav.search = "checklist=1";
    loaded(progress("FREE"));
    const { unmount } = renderChecklist();
    fireEvent.keyDown(screen.getByRole("button", { name: "Checklist options" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Hide checklist" }));
    expect(guide.dismissChecklist).toHaveBeenCalledWith(STORE);
    expect(card()).toBeNull();
    unmount();

    // The param was replaced away, so Back / reload mount the plain dashboard.
    guide.dismissed = new Set([STORE]);
    nav.search = "";
    const { container } = renderChecklist();
    expect(container).toBeEmptyDOMElement();
  });

  it("opening it from Help again while the dashboard is mounted re-shows a card hidden in this visit", () => {
    nav.search = "checklist=1";
    loaded(progress("FREE"));
    const { rerender } = renderChecklist();
    fireEvent.keyDown(screen.getByRole("button", { name: "Checklist options" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Hide checklist" }));
    expect(card()).toBeNull();

    // The param went, and Help restored the dismissal and asked again.
    nav.search = "";
    rerender(<SetupChecklist storeId={STORE} canView isNewStore />);
    expect(card()).toBeNull();
    nav.search = "checklist=1";
    rerender(<SetupChecklist storeId={STORE} canView isNewStore />);
    expect(card()).toBeInTheDocument();
  });

  it("still shows when only another store's checklist was dismissed", () => {
    guide.dismissed = new Set(["another-store"]);
    loaded(progress("FREE"));
    renderChecklist();
    expect(card()).toBeInTheDocument();
  });

  it("renders nothing when the server refuses (403 → null) or the read fails", () => {
    loaded(null);
    const { container, unmount } = renderChecklist();
    expect(container).toBeEmptyDOMElement();
    unmount();

    progressQuery.result = { data: undefined, isPending: false };
    const second = renderChecklist();
    expect(second.container).toBeEmptyDOMElement();
  });

  it("renders nothing when the server left this viewer no step to open (a manager persona)", () => {
    // FREE plan, and the persona can't open /storefront: only locked upsell rows remain.
    const base = progress("FREE");
    const items = base.items.filter((i) => i.locked);
    loaded({ ...base, items, sections: ["counter", "operations"], completed: 0, total: 0, allDone: false });
    const { container } = renderChecklist();
    expect(container).toBeEmptyDOMElement();
  });
});
