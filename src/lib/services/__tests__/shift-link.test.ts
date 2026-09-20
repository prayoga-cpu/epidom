import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({ shift: { findMany: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { resolveSaleShiftId } from "../shift-link";

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
