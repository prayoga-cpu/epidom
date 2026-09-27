import { describe, it, expect, vi, beforeEach } from "vitest";

const { backupRun, executeRaw } = vi.hoisted(() => ({
  backupRun: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  executeRaw: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    backupRun,
    $transaction: (fn: (tx: unknown) => unknown) => fn({ backupRun, $executeRaw: executeRaw }),
  },
}));

const listBackupTables = vi.fn();
const exportOneTable = vi.fn();
const pruneOldBackups = vi.fn();
vi.mock("../export-tables", () => ({
  listBackupTables: (...a: unknown[]) => listBackupTables(...a),
  exportOneTable: (...a: unknown[]) => exportOneTable(...a),
  pruneOldBackups: (...a: unknown[]) => pruneOldBackups(...a),
}));

import { claimBackupRun, executeBackupRun, manualBackupFolder } from "../run-backup";

const STARTED = new Date("2026-09-26T14:03:27.123Z");
const FOLDER = "2026-09-26-manual-140327";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  backupRun.findFirst.mockResolvedValue(null);
  backupRun.findUnique.mockResolvedValue(null);
  backupRun.create.mockResolvedValue({ id: "run_1", startedAt: STARTED });
  backupRun.update.mockResolvedValue({});
  backupRun.updateMany.mockResolvedValue({ count: 0 });
  listBackupTables.mockResolvedValue([
    { name: "orders", rowEstimate: 10 },
    { name: "user", rowEstimate: 3 },
  ]);
  exportOneTable.mockResolvedValueOnce(100).mockResolvedValueOnce(50);
  pruneOldBackups.mockResolvedValue({ deletedObjects: 0 });
});

describe("claimBackupRun", () => {
  it("records a RUNNING row under the advisory lock when nothing is in flight", async () => {
    await expect(claimBackupRun({ exclusive: true })).resolves.toEqual({
      id: "run_1",
      startedAt: STARTED,
    });

    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(backupRun.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "RUNNING" } })
    );
  });

  it("first marks RUNNING rows older than 15 minutes FAILED, as abandoned", async () => {
    await claimBackupRun({ exclusive: true });

    const { where, data } = backupRun.updateMany.mock.calls[0][0];
    expect(where.status).toBe("RUNNING");
    const ageMs = Date.now() - where.startedAt.lt.getTime();
    expect(ageMs).toBeGreaterThanOrEqual(15 * 60 * 1000);
    expect(ageMs).toBeLessThan(15 * 60 * 1000 + 5000);
    expect(data).toEqual(
      expect.objectContaining({ status: "FAILED", errorMessage: expect.stringMatching(/abandoned/i) })
    );
  });

  it("gives nightly rows 6 hours before they count as abandoned, not 15 minutes", async () => {
    await claimBackupRun({ exclusive: true });

    const [manual, nightly] = backupRun.updateMany.mock.calls.map((c) => c[0]);
    expect(manual.where.NOT).toEqual({ id: { startsWith: "nightly-" } });
    expect(nightly.where.id).toEqual({ startsWith: "nightly-" });
    const ageMs = Date.now() - nightly.where.startedAt.lt.getTime();
    expect(ageMs).toBeGreaterThanOrEqual(6 * 60 * 60 * 1000);
    expect(ageMs).toBeLessThan(6 * 60 * 60 * 1000 + 5000);
  });

  it("exclusive: only another manual run blocks, so a stuck nightly can't disable the button", async () => {
    await claimBackupRun({ exclusive: true });

    expect(backupRun.findFirst.mock.calls[0][0].where.NOT).toEqual({
      id: { startsWith: "nightly-" },
    });
  });

  it("exclusive: returns null and records nothing while a recent run is still RUNNING", async () => {
    backupRun.findFirst.mockResolvedValue({ id: "run_0" });

    await expect(claimBackupRun({ exclusive: true })).resolves.toBeNull();
    expect(backupRun.create).not.toHaveBeenCalled();
  });

  it("non-exclusive (the nightly): starts even while another run is active", async () => {
    backupRun.findFirst.mockResolvedValue({ id: "manual_run" });

    await expect(
      claimBackupRun({ id: "nightly-abc", exclusive: false })
    ).resolves.not.toBeNull();
    expect(backupRun.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { id: "nightly-abc", status: "RUNNING" } })
    );
  });

  it("is idempotent for a given id: a re-executed claim gets its own row back", async () => {
    backupRun.findUnique.mockResolvedValue({ id: "nightly-abc", startedAt: STARTED });
    backupRun.findFirst.mockResolvedValue({ id: "nightly-abc" });

    await expect(claimBackupRun({ id: "nightly-abc", exclusive: true })).resolves.toEqual({
      id: "nightly-abc",
      startedAt: STARTED,
    });
    expect(backupRun.create).not.toHaveBeenCalled();
  });
});

describe("manualBackupFolder", () => {
  it("is the UTC date plus start time, a sibling of the nightly's date folder", () => {
    expect(manualBackupFolder(STARTED)).toBe(FOLDER);
    expect(manualBackupFolder(STARTED)).not.toBe("2026-09-26");
  });
});

describe("executeBackupRun", () => {
  it("exports every table into the run's folder and marks it SUCCESS with totals", async () => {
    await executeBackupRun("run_1", FOLDER);

    expect(exportOneTable).toHaveBeenCalledWith("orders", FOLDER);
    expect(exportOneTable).toHaveBeenCalledWith("user", FOLDER);
    expect(backupRun.update).toHaveBeenCalledWith({
      where: { id: "run_1" },
      data: expect.objectContaining({
        status: "SUCCESS",
        tableCount: 2,
        totalRows: 13,
        totalBytes: BigInt(150),
        // Clears an "Abandoned" message left by a sweep on a slow run.
        errorMessage: null,
      }),
    });
    expect(pruneOldBackups).toHaveBeenCalled();
  });

  it("marks the run FAILED with the error and never throws", async () => {
    exportOneTable.mockReset();
    exportOneTable.mockRejectedValue(new Error("R2 upload refused"));

    await expect(executeBackupRun("run_1", FOLDER)).resolves.toBeUndefined();

    expect(backupRun.update).toHaveBeenCalledWith({
      where: { id: "run_1" },
      data: expect.objectContaining({ status: "FAILED", errorMessage: "R2 upload refused" }),
    });
    expect(pruneOldBackups).not.toHaveBeenCalled();
  });

  it("stops and records FAILED itself once its time budget is spent", async () => {
    exportOneTable.mockReset();
    exportOneTable.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return 100;
    });

    await executeBackupRun("run_1", FOLDER, 10);

    expect(exportOneTable).toHaveBeenCalledTimes(1);
    const data = backupRun.update.mock.calls[0][0].data;
    expect(data.status).toBe("FAILED");
    expect(data.errorMessage).toMatch(/1 of 2 tables/);
  });

  it("keeps a good backup SUCCESS when only the retention prune fails", async () => {
    pruneOldBackups.mockRejectedValue(new Error("list failed"));

    await expect(executeBackupRun("run_1", FOLDER)).resolves.toBeUndefined();

    const statuses = backupRun.update.mock.calls.map((c) => c[0].data.status);
    expect(statuses).toEqual(["SUCCESS"]);
  });
});
