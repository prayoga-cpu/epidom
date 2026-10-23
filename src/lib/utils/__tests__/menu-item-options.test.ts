import { describe, it, expect } from "vitest";
import {
  firstMissingRequiredGroup,
  hasBuildStep,
  hasLinkedMaterial,
  isBuildYourOwnItem,
  resolveSelectedOptions,
  toggleOptionSelection,
  type MergedOptionGroup,
} from "../menu-item-options";

const same = (a: string, b: string) => a === b;

describe("isBuildYourOwnItem", () => {
  it("is off unless the item or its product turns it on", () => {
    expect(isBuildYourOwnItem({ buildYourOwn: false }, { buildYourOwn: false })).toBe(false);
    expect(isBuildYourOwnItem(null, null)).toBe(false);
    expect(isBuildYourOwnItem({ buildYourOwn: true }, null)).toBe(true);
    expect(isBuildYourOwnItem({ buildYourOwn: false }, { buildYourOwn: true })).toBe(true);
  });
});

describe("toggleOptionSelection", () => {
  it("treats a pick-1 group like radio buttons", () => {
    expect(toggleOptionSelection([], "rice", same, 1)).toEqual(["rice"]);
    expect(toggleOptionSelection(["rice"], "quinoa", same, 1)).toEqual(["quinoa"]);
    expect(toggleOptionSelection(["rice"], "rice", same, 1)).toEqual([]);
  });

  it("toggles within a pick-N group", () => {
    expect(toggleOptionSelection(["a"], "b", same, 3)).toEqual(["a", "b"]);
    expect(toggleOptionSelection(["a", "b"], "a", same, 3)).toEqual(["b"]);
  });

  it("drops the oldest pick when a regular group is full", () => {
    expect(toggleOptionSelection(["a", "b"], "c", same, 2)).toEqual(["b", "c"]);
  });

  it("refuses an extra pick when a Build Your Own step is full", () => {
    expect(toggleOptionSelection(["a", "b"], "c", same, 2, { capAtMax: true })).toEqual(["a", "b"]);
    // Unpicking still works, which frees a slot.
    expect(toggleOptionSelection(["a", "b"], "a", same, 2, { capAtMax: true })).toEqual(["b"]);
  });
});

describe("firstMissingRequiredGroup", () => {
  const groups = [
    { name: "Base", isRequired: true },
    { name: "Sauce", isRequired: false },
    { name: "Protein", isRequired: true },
  ];

  it("names the first required group with nothing picked", () => {
    expect(firstMissingRequiredGroup(groups, { Base: ["rice"] })).toBe("Protein");
    expect(firstMissingRequiredGroup(groups, {})).toBe("Base");
  });

  it("is null once every required group has a pick", () => {
    expect(firstMissingRequiredGroup(groups, { Base: ["rice"], Protein: ["tofu"] })).toBeNull();
  });
});

describe("resolveSelectedOptions", () => {
  const groups: MergedOptionGroup[] = [
    {
      name: "Base",
      isRequired: true,
      maxSelections: 1,
      options: [
        { name: "Rice", priceAdjustment: 0, materialId: "mat_rice", materialQty: 150 },
        { name: "Quinoa", priceAdjustment: 5000, materialId: "mat_quinoa", materialQty: 120 },
      ],
    },
    {
      name: "Toppings",
      isRequired: false,
      maxSelections: 2,
      options: [
        { name: "Egg", priceAdjustment: 4000, materialId: "mat_egg", materialQty: 1 },
        { name: "Corn", priceAdjustment: 2000 },
        { name: "Nori", priceAdjustment: 1000 },
      ],
    },
  ];

  it("takes each option's price and stock link from the menu, not the request", () => {
    const { options, problem } = resolveSelectedOptions(
      groups,
      [
        // A tampered request: negative price, another store's material.
        {
          groupName: "Base",
          optionName: "Quinoa",
          priceAdjustment: -99999,
          materialId: "mat_foreign",
          materialQty: 9999,
        },
        { groupName: "Toppings", optionName: "Corn", priceAdjustment: 0 },
      ],
      "strict"
    );
    expect(problem).toBeNull();
    expect(options).toEqual([
      {
        groupName: "Base",
        optionName: "Quinoa",
        priceAdjustment: 5000,
        materialId: "mat_quinoa",
        materialQty: 120,
      },
      { groupName: "Toppings", optionName: "Corn", priceAdjustment: 2000 },
    ]);
  });

  it("counts a repeated option once", () => {
    const { options } = resolveSelectedOptions(
      groups,
      [
        { groupName: "Base", optionName: "Rice", priceAdjustment: 0 },
        { groupName: "Toppings", optionName: "Egg", priceAdjustment: 4000 },
        { groupName: "Toppings", optionName: "Egg", priceAdjustment: 4000 },
      ],
      "strict"
    );
    expect(options).toHaveLength(2);
  });

  it("treats a product group and a menu-item group with the same name as one", () => {
    const shared: MergedOptionGroup[] = [
      {
        name: "Extras",
        isRequired: false,
        maxSelections: 1,
        options: [{ name: "Egg", priceAdjustment: 4000 }],
      },
      {
        name: "Extras",
        isRequired: false,
        maxSelections: 2,
        options: [{ name: "Corn", priceAdjustment: 2000 }],
      },
    ];
    const { options, problem } = resolveSelectedOptions(
      shared,
      [
        { groupName: "Extras", optionName: "Egg", priceAdjustment: 0 },
        { groupName: "Extras", optionName: "Corn", priceAdjustment: 0 },
      ],
      "strict"
    );
    expect(problem).toBeNull();
    expect(options.map((o) => o.priceAdjustment)).toEqual([4000, 2000]);
  });

  describe("strict (storefront)", () => {
    it("rejects an option the item does not have", () => {
      const result = resolveSelectedOptions(
        groups,
        [
          { groupName: "Base", optionName: "Rice", priceAdjustment: 0 },
          { groupName: "Toppings", optionName: "Gold leaf", priceAdjustment: 0 },
        ],
        "strict"
      );
      expect(result.problem).toBe("UNKNOWN_OPTION");
    });

    it("rejects more picks than a group allows", () => {
      const result = resolveSelectedOptions(
        groups,
        [
          { groupName: "Base", optionName: "Rice", priceAdjustment: 0 },
          { groupName: "Toppings", optionName: "Egg", priceAdjustment: 0 },
          { groupName: "Toppings", optionName: "Corn", priceAdjustment: 0 },
          { groupName: "Toppings", optionName: "Nori", priceAdjustment: 0 },
        ],
        "strict"
      );
      expect(result.problem).toBe("TOO_MANY");
    });

    it("rejects a skipped required group", () => {
      const result = resolveSelectedOptions(
        groups,
        [{ groupName: "Toppings", optionName: "Corn", priceAdjustment: 0 }],
        "strict"
      );
      expect(result.problem).toBe("MISSING_REQUIRED");
    });
  });

  describe("lenient (till)", () => {
    it("keeps an option the menu no longer has, at the price charged, with no stock link", () => {
      const { options, problem } = resolveSelectedOptions(
        groups,
        [
          {
            groupName: "Toppings",
            optionName: "Old topping",
            priceAdjustment: 3000,
            materialId: "mat_x",
            materialQty: 5,
          },
        ],
        "lenient"
      );
      expect(problem).toBeNull();
      expect(options).toEqual([
        { groupName: "Toppings", optionName: "Old topping", priceAdjustment: 3000 },
      ]);
    });

    it("still reprices the options it can match, and skips the limit checks", () => {
      const { options, problem } = resolveSelectedOptions(
        groups,
        [{ groupName: "Toppings", optionName: "Egg", priceAdjustment: 1 }],
        "lenient"
      );
      expect(problem).toBeNull();
      expect(options[0]).toMatchObject({ priceAdjustment: 4000, materialId: "mat_egg" });
    });
  });
});

describe("hasBuildStep / hasLinkedMaterial", () => {
  it("needs a named step with a named choice", () => {
    expect(hasBuildStep([])).toBe(false);
    expect(
      hasBuildStep([
        {
          name: " ",
          isRequired: true,
          maxSelections: 1,
          options: [{ name: "Rice", priceAdjustment: 0 }],
        },
      ])
    ).toBe(false);
    expect(
      hasBuildStep([
        {
          name: "Base",
          isRequired: true,
          maxSelections: 1,
          options: [{ name: "Rice", priceAdjustment: 0 }],
        },
      ])
    ).toBe(true);
  });

  it("spots a choice that takes stock", () => {
    const group = { name: "Base", isRequired: true, maxSelections: 1 };
    expect(hasLinkedMaterial([{ ...group, options: [{ name: "Rice", priceAdjustment: 0 }] }])).toBe(
      false
    );
    expect(
      hasLinkedMaterial([
        {
          ...group,
          options: [{ name: "Rice", priceAdjustment: 0, materialId: "m1", materialQty: 150 }],
        },
      ])
    ).toBe(true);
  });
});
