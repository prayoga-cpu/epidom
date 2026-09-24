/**
 * Who gets which tab of the POS Operational page. Each tab keeps the grant its
 * old page (or drawer row) had, so the table below is "what could this persona
 * open before", not a new permission model.
 */
import { describe, it, expect } from "vitest";
import {
  isOperationalTab,
  resolveOperationalTabs,
  type OperationalAccess,
} from "../operational-tabs";

const persona = (role: string, allowedPages: string[]) => ({ role, allowedPages });

const tabsFor = (over: Partial<OperationalAccess>) =>
  resolveOperationalTabs({
    viewer: "owner",
    session: null,
    hasClockableStaff: true,
    staffOperations: true,
    ...over,
  });

describe("resolveOperationalTabs", () => {
  it.each([
    ["the owner, no persona", { session: null }, ["shift", "roster", "clock"]],
    [
      "the owner's own OWNER staff row",
      { session: persona("OWNER", []) },
      ["shift", "schedule", "roster", "clock"],
    ],
    [
      "a cashier (till + schedule)",
      { session: persona("CASHIER", ["/pos", "/pos/orders", "/tables", "/pos/schedule"]) },
      ["shift", "schedule", "clock"],
    ],
    [
      "a manager",
      { session: persona("MANAGER", ["/pos", "/pos/schedule", "/dashboard"]) },
      ["shift", "schedule", "clock"],
    ],
    [
      "kitchen (no till)",
      { session: persona("KITCHEN", ["/pos/kds", "/pos/schedule"]) },
      ["schedule", "clock"],
    ],
    [
      "a cashier on the floor only (no /pos, so no till)",
      { session: persona("CASHIER", ["/tables", "/pos/schedule"]) },
      ["schedule", "clock"],
    ],
    [
      "a cashier whose owner removed My Schedule",
      { session: persona("CASHIER", ["/pos", "/pos/orders"]) },
      ["shift", "clock"],
    ],
    ["kitchen with the KDS only", { session: persona("KITCHEN", ["/pos/kds"]) }, ["clock"]],
  ] as const)("owner's device — %s", (_label, over, expected) => {
    expect(tabsFor(over as Partial<OperationalAccess>)).toEqual(expected);
  });

  it("the owner never gets My Schedule without a staff session — there is no roster of theirs", () => {
    expect(tabsFor({ session: null })).not.toContain("schedule");
  });

  it("a linked staff account needs the schedule grant to clock in (the attendance APIs refuse it otherwise)", () => {
    expect(tabsFor({ viewer: "staff", session: persona("KITCHEN", ["/pos/kds"]) })).toEqual([]);
    expect(
      tabsFor({ viewer: "staff", session: persona("KITCHEN", ["/pos/kds", "/pos/schedule"]) })
    ).toEqual(["schedule", "clock"]);
    expect(tabsFor({ viewer: "staff", session: persona("CASHIER", ["/pos"]) })).toEqual(["shift"]);
  });

  it("a linked OWNER-role account is never treated as the unrestricted owner", () => {
    expect(tabsFor({ viewer: "staff", session: persona("OWNER", ["/pos/kds"]) })).toEqual([]);
  });

  it("no Clock tab when there is nobody to clock in", () => {
    expect(tabsFor({ session: null, hasClockableStaff: false })).toEqual(["shift", "roster"]);
    expect(
      tabsFor({
        session: persona("KITCHEN", ["/pos/kds", "/pos/schedule"]),
        hasClockableStaff: false,
      })
    ).toEqual(["schedule"]);
  });
});

describe("isOperationalTab", () => {
  it("accepts the three tabs and nothing else", () => {
    expect(["shift", "schedule", "clock"].every(isOperationalTab)).toBe(true);
    expect(isOperationalTab("orders")).toBe(false);
    expect(isOperationalTab(null)).toBe(false);
    expect(isOperationalTab(undefined)).toBe(false);
  });
});

describe("resolveOperationalTabs — Team Schedule (the roster published in Back Office)", () => {
  it("a manager who has Back Office Schedule sees the team's roster here too", () => {
    expect(
      tabsFor({ session: persona("MANAGER", ["/pos", "/pos/schedule", "/schedule"]) })
    ).toEqual(["shift", "schedule", "roster", "clock"]);
  });

  it("a manager without Back Office Schedule (the finance template) doesn't", () => {
    expect(
      tabsFor({ session: persona("MANAGER", ["/dashboard", "/finance", "/data", "/pos/schedule"]) })
    ).not.toContain("roster");
  });

  it("cashiers and kitchen don't, even if handed /schedule — the roster API gives them only their own rows", () => {
    expect(
      tabsFor({ session: persona("CASHIER", ["/pos", "/pos/schedule", "/schedule"]) })
    ).not.toContain("roster");
    expect(
      tabsFor({ session: persona("KITCHEN", ["/pos/kds", "/pos/schedule", "/schedule"]) })
    ).not.toContain("roster");
  });

  it("never a linked account, whatever its role — the API refuses it the team's rows", () => {
    expect(
      tabsFor({
        viewer: "staff",
        session: persona("MANAGER", ["/pos", "/pos/schedule", "/schedule"]),
      })
    ).not.toContain("roster");
  });

  it("not on a plan without rosters (Back Office /schedule is locked there too)", () => {
    expect(tabsFor({ session: null, staffOperations: false })).toEqual(["shift", "clock"]);
  });
});
