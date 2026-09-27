/**
 * How long a RUNNING backup row counts as in flight: it keeps the admin page
 * polling, and (for manual runs) blocks another manual run. Past this, the row
 * is treated as abandoned — a process killed mid-run never records its own
 * outcome — and the next claim marks it FAILED.
 *
 * A manual run has a 270s budget inside a 300s function, so 15 minutes is
 * generous. The nightly is a durable Inngest function: one step per table,
 * each retried with backoff and no overall time limit, so a slow night is not
 * a dead one. It gets hours, not minutes.
 */
export const ACTIVE_RUN_WINDOW_MINUTES = 15;
export const NIGHTLY_ACTIVE_RUN_WINDOW_MINUTES = 6 * 60;

/** Nightly rows are keyed `nightly-<inngest run id>` (see claimBackupRun). */
export const NIGHTLY_RUN_ID_PREFIX = "nightly-";

export function activeRunWindowMs(runId: string): number {
  const minutes = runId.startsWith(NIGHTLY_RUN_ID_PREFIX)
    ? NIGHTLY_ACTIVE_RUN_WINDOW_MINUTES
    : ACTIVE_RUN_WINDOW_MINUTES;
  return minutes * 60 * 1000;
}
