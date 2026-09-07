import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Prisma mock ───────────────────────────────────────────────────────────────
// var (not const/let) avoids TDZ when the vi.mock factory is hoisted above the
// declaration. This fully replaces the shared mock in src/test/setup.ts for
// this file, which carries no activityEvent model and no groupBy anywhere.

var prismaMock: any;

vi.mock("@/lib/prisma", () => {
  prismaMock = {
    activityEvent: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    actionLog: { count: vi.fn() },
    staffMember: { findMany: vi.fn() },
    store: { findMany: vi.fn() },
  };
  return { prisma: prismaMock };
});

import {
  queryActorSummary,
  queryStats,
  resolveActivityQuery,
} from "@/lib/services/audit-query.service";
import type { ActivityQuery } from "@/lib/validation/audit.schemas";

const baseQuery: ActivityQuery = {
  limit: 50,
  sortBy: "occurredAt",
  sortDir: "desc",
};

/** The four calls queryActorSummary makes after its first groupBy, in order. */
function primeActorQueries(opts: {
  grouped: any[];
  destructive?: any[];
  denied?: any[];
  identities?: any[];
  storeFacets?: any[];
  staff?: any[];
  stores?: any[];
}) {
  prismaMock.activityEvent.groupBy
    .mockResolvedValueOnce(opts.grouped) // grouped
    .mockResolvedValueOnce(opts.destructive ?? []) // destructive
    .mockResolvedValueOnce(opts.denied ?? []) // denied
    .mockResolvedValueOnce(opts.storeFacets ?? []); // store facets
  prismaMock.activityEvent.findMany.mockResolvedValue(opts.identities ?? []);
  prismaMock.staffMember.findMany.mockResolvedValue(opts.staff ?? []);
  prismaMock.store.findMany.mockResolvedValue(opts.stores ?? []);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("queryActorSummary — restaurant and email attribution", () => {
  it("names the restaurants an actor acted in, busiest first", async () => {
    primeActorQueries({
      grouped: [
        {
          actorRefId: "user-1",
          actorKind: "USER",
          _count: { _all: 12 },
          _max: { occurredAt: new Date("2026-09-07T08:00:00Z") },
        },
      ],
      identities: [
        {
          actorRefId: "user-1",
          actorKind: "USER",
          actorName: "Evan CAO",
          actorEmail: "evan@example.com",
        },
      ],
      storeFacets: [
        { actorRefId: "user-1", actorKind: "USER", storeId: "s-quiet", _count: { _all: 2 } },
        { actorRefId: "user-1", actorKind: "USER", storeId: "s-busy", _count: { _all: 9 } },
      ],
      stores: [
        { id: "s-busy", name: "TAHOMA Coffee & Eatery" },
        { id: "s-quiet", name: "LinguaPods store" },
      ],
    });

    const [actor] = await queryActorSummary(baseQuery);

    expect(actor.actorEmail).toBe("evan@example.com");
    expect(actor.stores.map((s) => s.name)).toEqual(["TAHOMA Coffee & Eatery", "LinguaPods store"]);
  });

  it("resolves a STAFF actor's email and job title from StaffMember, which the event never carries", async () => {
    primeActorQueries({
      grouped: [
        {
          actorRefId: "staff-1",
          actorKind: "STAFF",
          _count: { _all: 18 },
          _max: { occurredAt: new Date("2026-09-07T08:07:00Z") },
        },
      ],
      // resolveActor sets email to null for every STAFF event.
      identities: [
        { actorRefId: "staff-1", actorKind: "STAFF", actorName: "Shinta", actorEmail: null },
      ],
      storeFacets: [],
      staff: [
        {
          id: "staff-1",
          email: "shinta@tahoma.example",
          role: "CASHIER",
          customRoleLabel: "Assistant Manager",
          storeId: "s-busy",
        },
      ],
      stores: [{ id: "s-busy", name: "TAHOMA Coffee & Eatery" }],
    });

    const [actor] = await queryActorSummary(baseQuery);

    expect(actor.actorEmail).toBe("shinta@tahoma.example");
    expect(actor.staffRole).toBe("Assistant Manager");
    // No store-scoped events, but a staff persona lives in exactly one store.
    expect(actor.stores).toEqual([{ id: "s-busy", name: "TAHOMA Coffee & Eatery", events: 0 }]);
  });

  it("names a deleted restaurant by its id stub rather than inventing one", async () => {
    primeActorQueries({
      grouped: [
        {
          actorRefId: "user-1",
          actorKind: "USER",
          _count: { _all: 1 },
          _max: { occurredAt: new Date("2026-09-07T08:00:00Z") },
        },
      ],
      storeFacets: [
        { actorRefId: "user-1", actorKind: "USER", storeId: "gone123456", _count: { _all: 1 } },
      ],
      stores: [], // the Store row no longer exists
    });

    const [actor] = await queryActorSummary(baseQuery);
    expect(actor.stores[0]!.name).toBe("Deleted store gone12");
  });

  it("does not merge two actors that share a ref id across kinds", async () => {
    // SYSTEM uses a job name as its ref and WEBHOOK uses a provider name, so
    // "stripe" can legitimately name both.
    primeActorQueries({
      grouped: [
        {
          actorRefId: "stripe",
          actorKind: "SYSTEM",
          _count: { _all: 4 },
          _max: { occurredAt: new Date("2026-09-07T01:00:00Z") },
        },
        {
          actorRefId: "stripe",
          actorKind: "WEBHOOK",
          _count: { _all: 7 },
          _max: { occurredAt: new Date("2026-09-07T02:00:00Z") },
        },
      ],
      denied: [{ actorRefId: "stripe", actorKind: "WEBHOOK", _count: { _all: 7 } }],
    });

    const [system, webhook] = await queryActorSummary(baseQuery);

    expect(system.actorKind).toBe("SYSTEM");
    expect(system.denied).toBe(0);
    expect(webhook.actorKind).toBe("WEBHOOK");
    expect(webhook.denied).toBe(7);
  });

  it("intersects the destructive count with the admin's own severity filter instead of replacing it", async () => {
    primeActorQueries({
      grouped: [
        {
          actorRefId: "user-1",
          actorKind: "USER",
          _count: { _all: 3 },
          _max: { occurredAt: new Date("2026-09-07T08:00:00Z") },
        },
      ],
    });

    await queryActorSummary({ ...baseQuery, severity: "INFO" });

    // Second groupBy call is the destructive count. A `{ ...where, severity }`
    // spread would have overwritten INFO with CRITICAL and reported a count
    // drawn from a wider population than the total beside it.
    const destructiveArgs = prismaMock.activityEvent.groupBy.mock.calls[1]![0];
    expect(destructiveArgs.where).toEqual({
      AND: [{ severity: "INFO" }, { severity: "CRITICAL" }],
    });
  });
});

describe("resolveActivityQuery — searching by restaurant name", () => {
  it("resolves matching store ids so a name search can reach a bare storeId column", async () => {
    prismaMock.store.findMany.mockResolvedValue([{ id: "s-1" }, { id: "s-2" }]);

    const resolved = await resolveActivityQuery({ ...baseQuery, search: "tahoma" });

    expect(resolved.searchStoreIds).toEqual(["s-1", "s-2"]);
  });

  it("costs nothing when there is no search term", async () => {
    const resolved = await resolveActivityQuery(baseQuery);

    expect(prismaMock.store.findMany).not.toHaveBeenCalled();
    expect(resolved.searchStoreIds).toBeUndefined();
  });

  it("leaves the query untouched when no restaurant matches", async () => {
    prismaMock.store.findMany.mockResolvedValue([]);

    const resolved = await resolveActivityQuery({ ...baseQuery, search: "nothing" });

    expect(resolved.searchStoreIds).toBeUndefined();
  });
});

describe("queryStats", () => {
  it("intersects the critical and denied counts with the active filter", async () => {
    prismaMock.activityEvent.count.mockResolvedValue(0);
    prismaMock.actionLog.count.mockResolvedValue(0);
    prismaMock.activityEvent.findFirst.mockResolvedValue(null);

    await queryStats({ ...baseQuery, outcome: "SUCCESS" });

    const [, criticalCall, deniedCall] = prismaMock.activityEvent.count.mock.calls;
    expect(criticalCall![0].where).toEqual({
      AND: [{ outcome: "SUCCESS" }, { severity: "CRITICAL" }],
    });
    expect(deniedCall![0].where).toEqual({
      AND: [{ outcome: "SUCCESS" }, { outcome: "DENIED" }],
    });
  });
});
