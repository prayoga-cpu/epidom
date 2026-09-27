import { describe, it, expect, vi, beforeEach } from "vitest";

// createFunction hands back the handler so it can be driven with a fake `step`.
vi.mock("../../client", () => ({
  inngest: {
    createFunction: (config: unknown, handler: unknown) => ({ config, handler }),
  },
}));

const isR2Configured = vi.fn();
vi.mock("@/lib/backup/r2-client", () => ({
  isR2Configured: (...a: unknown[]) => isR2Configured(...a),
}));

const listBackupTables = vi.fn();
const exportOneTable = vi.fn();
const pruneOldBackups = vi.fn();
vi.mock("@/lib/backup/export-tables", () => ({
  listBackupTables: (...a: unknown[]) => listBackupTables(...a),
  exportOneTable: (...a: unknown[]) => exportOneTable(...a),
  pruneOldBackups: (...a: unknown[]) => pruneOldBackups(...a),
  todayPrefix: () => "2026-09-27",
}));

const claimBackupRun = vi.fn();
const finishBackupRun = vi.fn();
const failBackupRun = vi.fn();
vi.mock("@/lib/backup/run-backup", () => ({
  claimBackupRun: (...a: unknown[]) => claimBackupRun(...a),
  finishBackupRun: (...a: unknown[]) => finishBackupRun(...a),
  failBackupRun: (...a: unknown[]) => failBackupRun(...a),
}));

import { nightlyDatabaseBackup } from "../nightly-database-backup";

type Handler = (ctx: { step: unknown; runId: string }) => Promise<Record<string, unknown>>;
const handler = (nightlyDatabaseBackup as unknown as { handler: Handler }).handler;

/** Runs every step inline; a step named in `failing` throws like an exhausted step. */
function fakeStep(failing: string[] = []) {
  const names: string[] = [];
  return {
    names,
    step: {
      run: async (name: string, fn: () => unknown) => {
        names.push(name);
        if (failing.includes(name)) throw new Error(`${name} failed`);
        return fn();
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  isR2Configured.mockReturnValue(true);
  claimBackupRun.mockResolvedValue({ id: "nightly-run_abc", startedAt: new Date() });
  listBackupTables.mockResolvedValue([{ name: "orders", rowEstimate: 7 }]);
  exportOneTable.mockResolvedValue(64);
  pruneOldBackups.mockResolvedValue({ deletedObjects: 2 });
});

describe("nightly-database-backup", () => {
  it("claims idempotently on the Inngest run id, never exclusively, and writes the date folder", async () => {
    const { step } = fakeStep();

    const result = await handler({ step, runId: "run_abc" });

    expect(claimBackupRun).toHaveBeenCalledWith({ id: "nightly-run_abc", exclusive: false });
    expect(exportOneTable).toHaveBeenCalledWith("orders", "2026-09-27");
    expect(finishBackupRun).toHaveBeenCalledWith("nightly-run_abc", {
      tableCount: 1,
      totalRows: 7,
      totalBytes: 64,
    });
    expect(result).toEqual(expect.objectContaining({ runId: "nightly-run_abc", deletedObjects: 2 }));
  });

  it("marks the run FAILED and rethrows when an export fails for good", async () => {
    const { step } = fakeStep(["export-orders"]);

    await expect(handler({ step, runId: "run_abc" })).rejects.toThrow("export-orders failed");

    expect(failBackupRun).toHaveBeenCalledWith("nightly-run_abc", expect.any(Error));
    expect(finishBackupRun).not.toHaveBeenCalled();
  });

  it("leaves a finished backup SUCCESS when only the retention prune fails", async () => {
    const { step } = fakeStep(["prune-old-backups"]);

    const result = await handler({ step, runId: "run_abc" });

    expect(finishBackupRun).toHaveBeenCalled();
    expect(failBackupRun).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ deletedObjects: 0 }));
  });

  it("does nothing without R2", async () => {
    isR2Configured.mockReturnValue(false);
    const { step, names } = fakeStep();

    await expect(handler({ step, runId: "run_abc" })).resolves.toEqual(
      expect.objectContaining({ skipped: true })
    );
    expect(names).toEqual([]);
  });
});
