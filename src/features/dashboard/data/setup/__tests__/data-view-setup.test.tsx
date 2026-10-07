/**
 * The Data page's first run, end to end through DataViewClient: an empty
 * store sees the two ways in INSTEAD of the page tip, the quick start and the
 * lists; each way leads where it says; and the page moves on by itself once
 * the live totals show something saved.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const nav = vi.hoisted(() => ({ search: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  usePathname: () => "/store/s1/data",
  useRouter: () => ({ replace: nav.replace }),
}));

// Every lazy tab section is the same probe; the page's own chrome is what's tested.
vi.mock("next/dynamic", () => ({
  default: () => () => <div data-testid="tab-section" />,
}));
vi.mock("@/lib/utils/prefetch-helpers", () => ({
  prefetchMaterials: vi.fn(),
  prefetchProducts: vi.fn(),
  prefetchRecipes: vi.fn(),
  prefetchSuppliers: vi.fn(),
}));
vi.mock("../../custom-products/hooks/use-custom-products-settings", () => ({
  useCustomProductsSettings: () => ({ data: undefined }),
}));
vi.mock("@/features/guide/components/page-intro", () => ({
  PageIntro: () => <div data-testid="page-intro" />,
}));
vi.mock("../../import/components/data-quick-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../import/components/data-quick-start")>()),
  DataQuickStart: () => <div data-testid="quick-start" />,
}));
vi.mock("../../import/smart-import-dialog", () => ({
  SmartImportDialog: () => null,
}));
vi.mock("@/features/pos/components/pos-menu-notice", () => ({
  PosMenuNotice: () => null,
}));

import { DataViewClient } from "../../components/data-view-client";

/** Store-wide totals the one-row list reads return. */
const totals = vi.hoisted(() => ({ products: 0, materials: 0, recipes: 0 }));
// jsdom has no scrolling; the guide scrolls the chosen tab into view.
const scrollIntoView = vi.fn();
Element.prototype.scrollIntoView = scrollIntoView;

beforeEach(() => {
  nav.search = "";
  nav.replace.mockReset();
  localStorage.clear();
  scrollIntoView.mockClear();
  totals.products = 0;
  totals.materials = 0;
  totals.recipes = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const list = url.includes("/products")
        ? "products"
        : url.includes("/materials")
          ? "materials"
          : "recipes";
      return new Response(
        JSON.stringify({ success: true, data: { [list]: [], total: totals[list] } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    })
  );
});

function renderPage(initial: { products?: number; materials?: number; recipes?: number } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <DataViewClient
        storeId="s1"
        initialProducts={[]}
        initialProductsTotal={initial.products ?? 0}
        initialMaterials={[]}
        initialMaterialsTotal={initial.materials ?? 0}
        initialRecipes={[]}
        initialRecipesTotal={initial.recipes ?? 0}
        initialSuppliers={[]}
      />
    </QueryClientProvider>
  );
  return { ...utils, client };
}

const lists = () => screen.queryByRole("tablist");

describe("Data page first run", () => {
  it("an empty store sees the choice, without the page tip, the quick start or the lists", async () => {
    renderPage();

    expect(await screen.findByText("import.setup.chooser.title")).toBeInTheDocument();
    expect(screen.queryByTestId("page-intro")).toBeNull();
    expect(screen.queryByTestId("quick-start")).toBeNull();
    expect(lists()).toBeNull();
  });

  it("a store with anything in it opens on the page as usual", async () => {
    renderPage({ materials: 4 });

    expect(screen.getByTestId("page-intro")).toBeInTheDocument();
    expect(screen.getByTestId("quick-start")).toBeInTheDocument();
    expect(lists()).toBeInTheDocument();
    expect(screen.queryByText("import.setup.chooser.title")).toBeNull();
  });

  it("the menu import shows its steps; once products are saved the page moves on to 'your menu is in'", async () => {
    const { client } = renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: /import\.setup\.chooser\.import\.cta/ })
    );

    expect(screen.getByText("import.setup.importView.title")).toBeInTheDocument();
    expect(lists()).toBeNull();
    await waitFor(() =>
      expect(localStorage.getItem("epidom-data-setup-s1")).toBe(
        '{"path":"import","cardHidden":false}'
      )
    );

    // The import saves 12 products and refreshes the product lists, as Smart Import does.
    totals.products = 12;
    await client.refetchQueries({ queryKey: ["products", "s1"] });

    expect(await screen.findByText("import.setup.menuReady.title")).toBeInTheDocument();
    expect(lists()).toBeInTheDocument();
    // One thing at a time: the tip and the quick start wait while the card shows.
    expect(screen.queryByTestId("page-intro")).toBeNull();
    expect(screen.queryByTestId("quick-start")).toBeNull();
  });

  it("the guided way opens the lists on Raw materials, under the step-by-step guide", async () => {
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: /import\.setup\.chooser\.guided\.cta/ })
    );

    expect(await screen.findByText("import.setup.guide.title")).toBeInTheDocument();
    expect(lists()).toBeInTheDocument();
    expect(nav.replace).toHaveBeenCalledWith("/store/s1/data?tab=materials", { scroll: false });
  });

  it("the guide's menu step opens the Products tab", async () => {
    localStorage.setItem("epidom-data-setup-s1", '{"path":"guided","cardHidden":false}');
    totals.materials = 3;
    totals.recipes = 1;
    renderPage({ materials: 3, recipes: 1 });

    fireEvent.click(await screen.findByRole("button", { name: "import.setup.guide.menu.cta" }));
    expect(nav.replace).toHaveBeenLastCalledWith("/store/s1/data?tab=products", { scroll: false });
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("a saved choice is honoured on the next visit, with no flash of the chooser", async () => {
    localStorage.setItem("epidom-data-setup-s1", '{"path":"guided","cardHidden":false}');
    renderPage();

    expect(await screen.findByText("import.setup.guide.title")).toBeInTheDocument();
    expect(screen.queryByText("import.setup.chooser.title")).toBeNull();
  });

  it("skipping shows the lists for this visit, and the chooser comes back next time", async () => {
    const { unmount } = renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "import.setup.chooser.skip" }));

    expect(lists()).toBeInTheDocument();
    expect(screen.getByTestId("quick-start")).toBeInTheDocument();

    unmount();
    renderPage();
    expect(await screen.findByText("import.setup.chooser.title")).toBeInTheDocument();
  });
});
