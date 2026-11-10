import { describe, it, expect } from "vitest";
import { FEATURE_INDEX } from "../feature-index";

const TABS: Record<string, string[]> = {
  "/storefront": ["settings", "menu", "reviews", "analytics"],
  "/data": ["materials", "recipes", "products", "suppliers", "promotions", "customProducts"],
  "/management": ["item", "delivery", "log"],
  "/finance": [
    "pl",
    "daily",
    "expenses",
    "channels",
    "paymentMethod",
    "patterns",
    "items",
    "margin",
    "category",
    "adjustments",
    "tax",
    "waste",
    "cash",
  ],
};
const fold = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

describe("search feature index", () => {
  it("has unique ids and relative hrefs", () => {
    const ids = FEATURE_INDEX.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of FEATURE_INDEX) expect(f.href.startsWith("/")).toBe(true);
  });

  it("only links to tabs that exist on their page", () => {
    for (const f of FEATURE_INDEX) {
      const [path, query] = f.href.split("?");
      const tab = new URLSearchParams(query).get("tab");
      if (tab && TABS[path]) expect(TABS[path]).toContain(tab);
    }
  });

  it("has a label in every language", () => {
    for (const f of FEATURE_INDEX) {
      expect(f.label.en && f.label.id && f.label.fr).toBeTruthy();
    }
  });

  it("is findable from the words people use, in three languages", () => {
    const find = (q: string) =>
      FEATURE_INDEX.filter((f) =>
        fold(`${f.label.en} ${f.label.id} ${f.label.fr} ${f.keywords}`).includes(fold(q))
      ).map((f) => f.id);
    expect(find("import menu")).toContain("import-menu");
    expect(find("impor menu")).toContain("import-menu");
    expect(find("importer votre menu")).toContain("import-menu");
    expect(find("split bill")).toContain("pos-split");
    expect(find("pisah tagihan")).toContain("pos-split");
    expect(find("addition")).toContain("pos-split");
    expect(find("kitchen display")).toContain("pos-kds");
    expect(find("laba rugi")).toContain("fin-pl");
  });
});
