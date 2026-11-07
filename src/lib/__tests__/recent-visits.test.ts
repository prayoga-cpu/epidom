import { beforeEach, describe, expect, it } from "vitest";
import {
  RECENT_VISITS_MAX,
  readRecentVisits,
  recordRecentVisit,
  storeSectionFromPath,
} from "../recent-visits";

const A = "cljabc12345";
const B = "cljxyz67890";

describe("recent visits", () => {
  beforeEach(() => localStorage.clear());

  it("reduces a URL to its store and section, dropping the query", () => {
    expect(storeSectionFromPath(`/store/${A}/finance?from=2026-01-01`)).toEqual({
      storeId: A,
      section: "/finance",
    });
    expect(storeSectionFromPath("/stores")).toBeNull();
    expect(storeSectionFromPath(`/store/${A}`)).toBeNull();
  });

  it("lists newest first and keeps one card per section", () => {
    recordRecentVisit(`/store/${A}/finance`, 1);
    recordRecentVisit(`/store/${A}/staff`, 2);
    recordRecentVisit(`/store/${A}/finance?tab=cash`, 3);
    expect(readRecentVisits(A)).toEqual([
      { section: "/finance", at: 3 },
      { section: "/staff", at: 2 },
    ]);
  });

  it("never lists Home and keeps stores apart", () => {
    recordRecentVisit(`/store/${A}/home`, 1);
    recordRecentVisit(`/store/${A}/data`, 2);
    expect(readRecentVisits(A)).toHaveLength(1);
    expect(readRecentVisits(B)).toEqual([]);
  });

  it("caps the list and survives junk in storage", () => {
    for (const s of [
      "alerts",
      "billing",
      "customers",
      "data",
      "finance",
      "management",
      "production",
      "profile",
      "schedule",
      "shifts",
    ]) {
      recordRecentVisit(`/store/${A}/${s}`);
    }
    expect(readRecentVisits(A)).toHaveLength(RECENT_VISITS_MAX);
    localStorage.setItem(`epidom:recentVisits:${A}`, "{not json");
    expect(readRecentVisits(A)).toEqual([]);
  });
});
