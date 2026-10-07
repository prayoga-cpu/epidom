import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({ shift: { findMany: vi.fn(), findFirst: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { resolveReplayShiftId, resolveSaleShiftId } from "../shift-link";

const STORE = "store_1";
const open = (id: string) => ({ id, closedAt: null });
const closed = (id: string) => ({ id, closedAt: new Date("2026-09-20T10:00:00Z") });

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.shift.findMany.mockResolvedValue([]);
});

describe("resolveSaleShiftId", () => {
  it("nothing named: undefined, and the database is not even asked", async () => {
    expect(await resolveSaleShiftId(STORE, undefined)).toBeUndefined();
    expect(await resolveSaleShiftId(STORE, null)).toBeUndefined();
    expect(await resolveSaleShiftId(STORE, "")).toBeUndefined();
    expect(prismaMock.shift.findMany).not.toHaveBeenCalled();
  });

  it("the named shift is open in this store: that shift", async () => {
    prismaMock.shift.findMany.mockResolvedValue([open("S2"), open("S1")]);
    expect(await resolveSaleShiftId(STORE, "S1")).toBe("S1");
  });

  // The scenario a shared till creates: tablet B still believes S1 is open, tablet A has
  // finished it and opened S2. B's sale must not land on the closed S1.
  it("the named shift was finished and another opened: the CURRENT open one", async () => {
    prismaMock.shift.findMany.mockResolvedValue([open("S2"), closed("S1")]);
    expect(await resolveSaleShiftId(STORE, "S1")).toBe("S2");
  });

  it("the named shift was finished and none is open: null — unlinked, never the closed shift", async () => {
    prismaMock.shift.findMany.mockResolvedValue([closed("S1")]);
    expect(await resolveSaleShiftId(STORE, "S1")).toBeNull();
  });

  it("the named shift belongs to another store (or doesn't exist): it never matches, this store's open shift is used", async () => {
    // The query is scoped to the store, so a foreign id simply isn't in the result.
    prismaMock.shift.findMany.mockResolvedValue([open("S9")]);
    expect(await resolveSaleShiftId(STORE, "FOREIGN")).toBe("S9");
    prismaMock.shift.findMany.mockResolvedValue([]);
    expect(await resolveSaleShiftId(STORE, "FOREIGN")).toBeNull();
  });

  it("scopes the lookup to the store and takes newest first", async () => {
    await resolveSaleShiftId(STORE, "S1");
    expect(prismaMock.shift.findMany).toHaveBeenCalledWith({
      where: { storeId: STORE, OR: [{ id: "S1" }, { closedAt: null }] },
      orderBy: { openedAt: "desc" },
      select: { id: true, closedAt: true },
    });
  });

  it("with several open shifts (legacy), an unnamed-but-invalid request gets the newest", async () => {
    prismaMock.shift.findMany.mockResolvedValue([open("NEWEST"), open("OLDER"), closed("S1")]);
    expect(await resolveSaleShiftId(STORE, "S1")).toBe("NEWEST");
  });
});

describe("resolveReplayShiftId — a sale replayed from the offline queue", () => {
  const SOLD_AT = new Date("2026-10-05T12:00:00Z");
  const shift = (openedAt: string, closedAt: string | null = null) => ({
    id: "S1",
    openedAt: new Date(openedAt),
    closedAt: closedAt ? new Date(closedAt) : null,
  });

  it("nothing named: undefined, and the database is not asked", async () => {
    expect(await resolveReplayShiftId(STORE, undefined, SOLD_AT)).toBeUndefined();
    expect(prismaMock.shift.findFirst).not.toHaveBeenCalled();
  });

  it("the named shift is still open and was open when the sale was rung up: linked", async () => {
    prismaMock.shift.findFirst.mockResolvedValue(shift("2026-10-05T08:00:00Z"));
    expect(await resolveReplayShiftId(STORE, "S1", SOLD_AT)).toBe("S1");
    expect(prismaMock.shift.findFirst).toHaveBeenCalledWith({
      where: { id: "S1", storeId: STORE },
      select: { id: true, openedAt: true, closedAt: true },
    });
  });

  // Its expected cash is frozen at close; a late sale must not contradict the count.
  it("the named shift has closed since: null, never the shift open now", async () => {
    prismaMock.shift.findFirst.mockResolvedValue(
      shift("2026-10-05T08:00:00Z", "2026-10-05T18:00:00Z")
    );
    expect(await resolveReplayShiftId(STORE, "S1", SOLD_AT)).toBeNull();
    expect(prismaMock.shift.findMany).not.toHaveBeenCalled();
  });

  it("the named shift opened well after the sale: null", async () => {
    prismaMock.shift.findFirst.mockResolvedValue(shift("2026-10-05T13:00:00Z"));
    expect(await resolveReplayShiftId(STORE, "S1", SOLD_AT)).toBeNull();
  });

  it("tolerates a few minutes of clock drift between till and server", async () => {
    prismaMock.shift.findFirst.mockResolvedValue(shift("2026-10-05T12:03:00Z"));
    expect(await resolveReplayShiftId(STORE, "S1", SOLD_AT)).toBe("S1");
  });

  it("another store's shift (or none): null", async () => {
    prismaMock.shift.findFirst.mockResolvedValue(null);
    expect(await resolveReplayShiftId(STORE, "FOREIGN", SOLD_AT)).toBeNull();
  });

  it("an untrusted sale time links nothing", async () => {
    expect(await resolveReplayShiftId(STORE, "S1", null)).toBeNull();
    expect(prismaMock.shift.findFirst).not.toHaveBeenCalled();
  });
});
