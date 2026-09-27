import { describe, it, expect, vi, beforeEach } from "vitest";

// Collect deferred work instead of running it, so a test can assert the backup
// was scheduled without the response having waited on it.
const deferred: Array<() => unknown> = [];
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => unknown) => {
    deferred.push(fn);
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const getActingAdmin = vi.fn();
vi.mock("@/lib/auth/require-admin-api", () => ({
  getActingAdmin: (...a: unknown[]) => getActingAdmin(...a),
}));

const captureRequestActivity = vi.fn();
vi.mock("@/lib/audit/activity", () => ({
  captureRequestActivity: (...a: unknown[]) => captureRequestActivity(...a),
}));

const isR2Configured = vi.fn();
vi.mock("@/lib/backup/r2-client", () => ({
  isR2Configured: (...a: unknown[]) => isR2Configured(...a),
}));

const claimBackupRun = vi.fn();
const executeBackupRun = vi.fn();
vi.mock("@/lib/backup/run-backup", async (importOriginal) => ({
  manualBackupFolder: (await importOriginal<typeof import("@/lib/backup/run-backup")>())
    .manualBackupFolder,
  claimBackupRun: (...a: unknown[]) => claimBackupRun(...a),
  executeBackupRun: (...a: unknown[]) => executeBackupRun(...a),
}));

import { POST } from "../route";

const ADMIN = { id: "admin_1", email: "a@example.com", name: "Admin", grantSource: "DB_FLAG" };
const post = () => POST(new Request("http://localhost/api/admin/backups", { method: "POST" }));

beforeEach(() => {
  vi.clearAllMocks();
  deferred.length = 0;
  getActingAdmin.mockResolvedValue(ADMIN);
  isR2Configured.mockReturnValue(true);
  claimBackupRun.mockResolvedValue({ id: "run_1", startedAt: new Date("2026-09-26T14:03:27Z") });
});

describe("POST /api/admin/backups (Run backup now)", () => {
  it("refuses a non-admin before touching the backup", async () => {
    getActingAdmin.mockResolvedValue(null);

    const res = await post();

    expect(res.status).toBe(403);
    expect(claimBackupRun).not.toHaveBeenCalled();
  });

  it("says so when R2 isn't configured, instead of recording a doomed run", async () => {
    isR2Configured.mockReturnValue(false);

    const res = await post();

    expect(res.status).toBe(503);
    expect(claimBackupRun).not.toHaveBeenCalled();
  });

  it("answers 409 and schedules nothing while another run is in flight", async () => {
    claimBackupRun.mockResolvedValue(null);

    const res = await post();

    expect(res.status).toBe(409);
    expect(deferred).toHaveLength(0);
  });

  it("answers 202 with the run and its own folder, and exports after the response", async () => {
    const res = await post();

    expect(res.status).toBe(202);
    expect((await res.json()).data).toEqual({ runId: "run_1", folder: "2026-09-26-manual-140327" });
    expect(claimBackupRun).toHaveBeenCalledWith({ exclusive: true });
    expect(executeBackupRun).not.toHaveBeenCalled();

    expect(deferred).toHaveLength(1);
    await deferred[0]();
    expect(executeBackupRun).toHaveBeenCalledWith("run_1", "2026-09-26-manual-140327");
  });

  it("records the click in the audit trail", async () => {
    await post();

    expect(captureRequestActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 202,
        actor: expect.objectContaining({ refId: "admin_1" }),
      })
    );
  });
});
