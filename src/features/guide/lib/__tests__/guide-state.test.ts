import { describe, it, expect } from "vitest";
import { EMPTY_GUIDE_STATE, PAGE_INTRO_IDS, type GuideState } from "@/lib/guide/contracts";
import {
  applyPatchToState,
  emptyGuideState,
  GUIDE_STATE_LIST_CAP,
  parseGuideState,
} from "../guide-state";

const NOW = new Date("2026-09-26T10:00:00.000Z");

const state = (over: Partial<GuideState> = {}): GuideState => ({
  tourSeenAt: null,
  dismissedTips: [],
  dismissedChecklists: [],
  ...over,
});

describe("parseGuideState", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "tour seen"],
    ["a number", 42],
    ["an array", ["storefront"]],
    ["a boolean", true],
  ])("reads %s as the empty state", (_label, value) => {
    expect(parseGuideState(value)).toEqual(EMPTY_GUIDE_STATE);
  });

  it("never hands out EMPTY_GUIDE_STATE's own arrays", () => {
    const parsed = parseGuideState(null);
    parsed.dismissedTips.push("storefront");
    parsed.dismissedChecklists.push("store_1");
    expect(EMPTY_GUIDE_STATE.dismissedTips).toEqual([]);
    expect(EMPTY_GUIDE_STATE.dismissedChecklists).toEqual([]);
    expect(emptyGuideState()).toEqual(EMPTY_GUIDE_STATE);
  });

  it("keeps a valid stored state as it is", () => {
    const stored = {
      tourSeenAt: "2026-09-01T08:00:00.000Z",
      dismissedTips: ["storefront", "finance"],
      dismissedChecklists: ["store_a", "store_b"],
    };
    expect(parseGuideState(stored)).toEqual(stored);
  });

  it("drops keys it doesn't know", () => {
    const parsed = parseGuideState({ tourSeenAt: null, legacyFlag: true, admin: "yes" });
    expect(Object.keys(parsed).sort()).toEqual(
      ["dismissedChecklists", "dismissedTips", "tourSeenAt"].sort()
    );
  });

  it("reads a non-date or non-string tourSeenAt as not seen, and normalizes a real date to ISO", () => {
    expect(parseGuideState({ tourSeenAt: "not a date" }).tourSeenAt).toBeNull();
    expect(parseGuideState({ tourSeenAt: 1727000000000 }).tourSeenAt).toBeNull();
    expect(parseGuideState({ tourSeenAt: "" }).tourSeenAt).toBeNull();
    expect(parseGuideState({ tourSeenAt: "2026-09-01" }).tourSeenAt).toBe(
      "2026-09-01T00:00:00.000Z"
    );
  });

  it("filters tips down to real page intro ids", () => {
    const parsed = parseGuideState({
      dismissedTips: ["storefront", "nope", 3, null, { id: "finance" }, "finance"],
    });
    expect(parsed.dismissedTips).toEqual(["storefront", "finance"]);
  });

  it("filters checklist ids down to non-empty strings of at most 64 chars", () => {
    const parsed = parseGuideState({
      dismissedChecklists: ["store_a", "", 12, null, "x".repeat(65), "x".repeat(64)],
    });
    expect(parsed.dismissedChecklists).toEqual(["store_a", "x".repeat(64)]);
  });

  it("reads a list that isn't an array as empty", () => {
    const parsed = parseGuideState({ dismissedTips: "storefront", dismissedChecklists: {} });
    expect(parsed.dismissedTips).toEqual([]);
    expect(parsed.dismissedChecklists).toEqual([]);
  });

  it("dedupes, keeping first-seen order", () => {
    const parsed = parseGuideState({
      dismissedTips: ["finance", "storefront", "finance"],
      dismissedChecklists: ["b", "a", "b", "a"],
    });
    expect(parsed.dismissedTips).toEqual(["finance", "storefront"]);
    expect(parsed.dismissedChecklists).toEqual(["b", "a"]);
  });

  it(`caps a list at ${GUIDE_STATE_LIST_CAP}, keeping the newest (last) entries`, () => {
    const ids = Array.from({ length: 150 }, (_, i) => `store_${i}`);
    const parsed = parseGuideState({ dismissedChecklists: ids });
    expect(parsed.dismissedChecklists).toHaveLength(GUIDE_STATE_LIST_CAP);
    expect(parsed.dismissedChecklists[0]).toBe("store_50");
    expect(parsed.dismissedChecklists.at(-1)).toBe("store_149");
  });
});

describe("applyPatchToState", () => {
  it("tourSeen stamps now; resetTour clears it", () => {
    expect(applyPatchToState(state(), { tourSeen: true }, NOW).tourSeenAt).toBe(NOW.toISOString());
    expect(
      applyPatchToState(state({ tourSeenAt: "2026-01-01T00:00:00.000Z" }), { resetTour: true }, NOW)
        .tourSeenAt
    ).toBeNull();
  });

  it("resetTour + tourSeen together ends seen", () => {
    const next = applyPatchToState(state(), { resetTour: true, tourSeen: true }, NOW);
    expect(next.tourSeenAt).toBe(NOW.toISOString());
  });

  it("dismissTip adds once; restoreTips clears every tip", () => {
    const once = applyPatchToState(state(), { dismissTip: "stock" });
    const twice = applyPatchToState(once, { dismissTip: "stock" });
    expect(twice.dismissedTips).toEqual(["stock"]);
    expect(applyPatchToState(twice, { restoreTips: true }).dismissedTips).toEqual([]);
  });

  it("restoreTips + dismissTip together ends with just that tip", () => {
    const next = applyPatchToState(state({ dismissedTips: ["stock", "finance"] }), {
      restoreTips: true,
      dismissTip: "tables",
    });
    expect(next.dismissedTips).toEqual(["tables"]);
  });

  it("every page intro id can be dismissed", () => {
    let current = state();
    for (const id of PAGE_INTRO_IDS) current = applyPatchToState(current, { dismissTip: id });
    expect(current.dismissedTips).toEqual([...PAGE_INTRO_IDS]);
  });

  it("dismissChecklist adds (moving a repeat to the end); restoreChecklist removes only that store", () => {
    const start = state({ dismissedChecklists: ["a", "b"] });
    expect(applyPatchToState(start, { dismissChecklist: "c" }).dismissedChecklists).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(applyPatchToState(start, { dismissChecklist: "a" }).dismissedChecklists).toEqual([
      "b",
      "a",
    ]);
    expect(applyPatchToState(start, { restoreChecklist: "a" }).dismissedChecklists).toEqual(["b"]);
    expect(applyPatchToState(start, { restoreChecklist: "zzz" }).dismissedChecklists).toEqual([
      "a",
      "b",
    ]);
  });

  it("a new checklist dismissal on a full list drops the oldest, never the new one", () => {
    const full = Array.from({ length: GUIDE_STATE_LIST_CAP }, (_, i) => `s${i}`);
    const next = applyPatchToState(state({ dismissedChecklists: full }), {
      dismissChecklist: "new",
    });
    expect(next.dismissedChecklists).toHaveLength(GUIDE_STATE_LIST_CAP);
    expect(next.dismissedChecklists).not.toContain("s0");
    expect(next.dismissedChecklists.at(-1)).toBe("new");
  });

  it("never mutates its input", () => {
    const start = state({ dismissedTips: ["stock"], dismissedChecklists: ["a"] });
    const snapshot = JSON.parse(JSON.stringify(start));
    const next = applyPatchToState(start, {
      tourSeen: true,
      dismissTip: "finance",
      dismissChecklist: "b",
    });
    expect(start).toEqual(snapshot);
    expect(next.dismissedTips).not.toBe(start.dismissedTips);
    expect(next.dismissedChecklists).not.toBe(start.dismissedChecklists);
  });

  it("leaves untouched fields as they were", () => {
    const start = state({
      tourSeenAt: "2026-09-01T00:00:00.000Z",
      dismissedTips: ["stock"],
      dismissedChecklists: ["a"],
    });
    expect(applyPatchToState(start, { dismissChecklist: "b" })).toEqual({
      tourSeenAt: "2026-09-01T00:00:00.000Z",
      dismissedTips: ["stock"],
      dismissedChecklists: ["a", "b"],
    });
  });
});
