import { describe, expect, it } from "vitest";
import {
  DATA_SETUP_DEFAULTS,
  guidedSteps,
  isDataEmpty,
  resolveDataSetupCard,
  resolveDataSetupView,
  sanitizeDataSetupState,
  type DataSetupCounts,
  type DataSetupState,
} from "../data-setup";

const empty: DataSetupCounts = { products: 0, materials: 0, recipes: 0 };
const state = (overrides: Partial<DataSetupState> = {}): DataSetupState => ({
  ...DATA_SETUP_DEFAULTS,
  ...overrides,
});

describe("isDataEmpty", () => {
  it("is empty only with nothing in any of the three lists", () => {
    expect(isDataEmpty(empty)).toBe(true);
    expect(isDataEmpty({ ...empty, products: 1 })).toBe(false);
    expect(isDataEmpty({ ...empty, materials: 1 })).toBe(false);
    expect(isDataEmpty({ ...empty, recipes: 1 })).toBe(false);
  });
});

describe("resolveDataSetupView", () => {
  it("an empty store that hasn't picked sees the choice, not the lists", () => {
    expect(resolveDataSetupView(state(), empty, false)).toBe("choose");
  });

  it("picking the menu import shows its steps on their own", () => {
    expect(resolveDataSetupView(state({ path: "import" }), empty, false)).toBe("import");
  });

  it("picking the guided way goes straight to the lists (the guide card leads)", () => {
    expect(resolveDataSetupView(state({ path: "guided" }), empty, false)).toBe("lists");
  });

  it("skipping shows the lists for this visit, whatever was picked", () => {
    expect(resolveDataSetupView(state(), empty, true)).toBe("lists");
    expect(resolveDataSetupView(state({ path: "import" }), empty, true)).toBe("lists");
  });

  it("anything in a list ends the first run: the import moves on by itself", () => {
    expect(resolveDataSetupView(state(), { ...empty, materials: 2 }, false)).toBe("lists");
    expect(resolveDataSetupView(state({ path: "import" }), { ...empty, products: 12 }, false)).toBe(
      "lists"
    );
  });
});

describe("resolveDataSetupCard", () => {
  it("the guided way keeps its card until hidden, including once everything is done", () => {
    expect(resolveDataSetupCard(state({ path: "guided" }), empty)).toBe("guide");
    expect(
      resolveDataSetupCard(state({ path: "guided" }), { products: 3, materials: 5, recipes: 2 })
    ).toBe("guide");
    expect(resolveDataSetupCard(state({ path: "guided", cardHidden: true }), empty)).toBeNull();
  });

  it("the import shows what's next once the menu is in, not before", () => {
    expect(resolveDataSetupCard(state({ path: "import" }), empty)).toBeNull();
    expect(resolveDataSetupCard(state({ path: "import" }), { ...empty, materials: 4 })).toBeNull();
    expect(resolveDataSetupCard(state({ path: "import" }), { ...empty, products: 8 })).toBe(
      "menuReady"
    );
    expect(
      resolveDataSetupCard(state({ path: "import", cardHidden: true }), { ...empty, products: 8 })
    ).toBeNull();
  });

  it("no pick, no card", () => {
    expect(resolveDataSetupCard(state(), { ...empty, products: 8 })).toBeNull();
  });
});

describe("guidedSteps", () => {
  it("raw materials, recipes, then the menu (on the Products tab)", () => {
    expect(guidedSteps(empty).map((step) => [step.id, step.tab])).toEqual([
      ["materials", "materials"],
      ["recipes", "recipes"],
      ["menu", "products"],
    ]);
  });

  it("the first step not done is the current one, whatever order the lists were filled in", () => {
    const fresh = guidedSteps(empty);
    expect(fresh.map((step) => step.current)).toEqual([true, false, false]);

    const menuFirst = guidedSteps({ products: 5, materials: 0, recipes: 0 });
    expect(menuFirst.map((step) => step.done)).toEqual([false, false, true]);
    expect(menuFirst.find((step) => step.current)?.id).toBe("materials");

    const twoDone = guidedSteps({ products: 0, materials: 4, recipes: 1 });
    expect(twoDone.find((step) => step.current)?.id).toBe("menu");
    expect(twoDone[0].count).toBe(4);
  });

  it("all done: no current step", () => {
    const steps = guidedSteps({ products: 1, materials: 1, recipes: 1 });
    expect(steps.every((step) => step.done && !step.current)).toBe(true);
  });
});

describe("sanitizeDataSetupState", () => {
  it("keeps known values and drops anything else", () => {
    expect(
      sanitizeDataSetupState({ path: "guided", cardHidden: true }, DATA_SETUP_DEFAULTS)
    ).toEqual({ path: "guided", cardHidden: true });
    expect(
      sanitizeDataSetupState({ path: "magic", cardHidden: "yes" }, DATA_SETUP_DEFAULTS)
    ).toEqual(DATA_SETUP_DEFAULTS);
    expect(sanitizeDataSetupState(null, DATA_SETUP_DEFAULTS)).toEqual(DATA_SETUP_DEFAULTS);
  });
});
