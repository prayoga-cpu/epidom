/**
 * Audit capture configuration and kill switch.
 *
 * The audit layer adds writes to hot paths, including POS checkout. A solo
 * operator needs a way to stop those writes without shipping a deploy, so every
 * capture entry point consults {@link isAuditCaptureEnabled} first.
 *
 * `AUDIT_CAPTURE` is read per call rather than cached at module load, so
 * flipping it in Vercel takes effect on the next lambda cold start without a
 * rebuild. It is deliberately fail-open: an unset variable means capture is ON,
 * because a missing env var must never silently disable the audit trail.
 */

/** Values that disable capture. Anything else (including unset) enables it. */
const DISABLED_VALUES = new Set(["off", "false", "0", "disabled"]);

/**
 * Master switch. `AUDIT_CAPTURE=off` disables all audit writes — Layer 1
 * activity events, Layer 2 action logs and Layer 3 snapshots alike.
 */
export function isAuditCaptureEnabled(): boolean {
  const raw = process.env.AUDIT_CAPTURE?.trim().toLowerCase();
  if (!raw) return true;
  return !DISABLED_VALUES.has(raw);
}

/**
 * Layer 3 (entity snapshots) can be disabled independently of the cheap
 * trail. Snapshot capture runs inside a Serializable transaction across up to
 * ~45 models, so it is the part most likely to need turning off under load
 * while the rest of the trail keeps working.
 */
export function isSnapshotCaptureEnabled(): boolean {
  if (!isAuditCaptureEnabled()) return false;
  const raw = process.env.AUDIT_SNAPSHOTS?.trim().toLowerCase();
  if (!raw) return true;
  return !DISABLED_VALUES.has(raw);
}

/**
 * Retention windows, in days.
 *
 * NOTE: these interact with the published Terms. `section11` (en.ts, id.ts)
 * promises account data is "permanently and irreversibly deleted" after 365
 * days, and `fr.ts` carries no retention clause at all. The trail window is
 * therefore capped at 365 to stay inside that promise, and snapshots — which
 * hold real row content — expire far sooner. See docs/AUDIT_LOG_PLAN.md §8;
 * the copy still needs a legal decision before Layer 3 ships.
 */
export const RETENTION = {
  /** Layer 1 ActivityEvent rows. Matches the 365-day Terms commitment. */
  ACTIVITY_EVENT_DAYS: 365,
  /** Layer 2 ActionLog rows. Same window; they carry field-level payloads. */
  ACTION_LOG_DAYS: 365,
  /** Layer 3 EntitySnapshot payloads. Short by design — they hold full PII. */
  SNAPSHOT_DAYS: 90,
} as const;

/**
 * Reversal window. An action older than this is refused by the guard chain
 * regardless of class: the further back a revert reaches, the more downstream
 * state has been derived from the value being overwritten.
 * Individual catalogue entries may specify a shorter `maxReversalAgeDays`.
 */
export const DEFAULT_MAX_REVERSAL_AGE_DAYS = 90;

/**
 * A dry-run plan older than this can no longer be applied. Prevents an
 * operator from previewing, walking away, and applying against state that has
 * since moved. Paired with a status transition on the target row so two admins
 * cannot both hold a valid preview and both apply.
 */
export const PREVIEW_TTL_MINUTES = 15;

/**
 * Above this row count a snapshot is refused rather than truncated. Capturing
 * a larger graph inside a Serializable transaction risks approaching the
 * function timeout while holding locks on the tenant's hottest tables.
 * Refusing is the safe failure: it blocks the delete instead of producing an
 * unrestorable snapshot that looks valid.
 */
export const SNAPSHOT_HARD_LIMIT_ROWS = 50_000;

/**
 * Above this row count a restore runs across Inngest step boundaries and is
 * therefore non-atomic. Such restores insert the tenant with `deactivatedAt`
 * set, cleared only when the run reaches SUCCESS, so a partial restore leaves
 * an invisible tenant rather than a live broken one.
 */
export const RESTORE_ATOMIC_LIMIT_ROWS = 5_000;

/** Payloads above this size spill to blob storage instead of the database. */
export const SNAPSHOT_INLINE_MAX_BYTES = 256 * 1024;
