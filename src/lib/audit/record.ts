import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAuditCaptureEnabled } from "./config";
import { getAuditActor, getAuditScope, noteRecordedAction } from "./actor-scope";
import { hashActorIdentity } from "./actor";
import { getActionDefinition } from "./catalog";
import type { ActionType } from "./catalog";

/**
 * Layer 2 recorder.
 *
 * `recordAction` writes the log row inside the caller's transaction, so the row
 * and the mutation it describes commit or roll back together. That atomicity is
 * the whole reason this layer records at the service boundary rather than
 * through a Prisma extension: a query-level interceptor has no handle on the
 * caller's transaction client and can only write after the fact, which makes
 * capture at-most-once — and a gap indistinguishable from "nothing happened".
 */

export interface RecordActionInput<T extends ActionType> {
  actionType: T;
  payload: unknown;
  storeId?: string | null;
  businessId?: string | null;
  targetId?: string | null;
  /** Overrides the catalogue label when the caller has better context. */
  label?: string;
  reason?: string | null;
  snapshotId?: string | null;
}

interface RecordOptions {
  /**
   * Transaction client. Strongly preferred: without it the row is written
   * separately from the mutation and a crash between the two loses the record.
   */
  tx?: Prisma.TransactionClient;
}

function client(options?: RecordOptions): Prisma.TransactionClient | PrismaClient {
  return options?.tx ?? prisma;
}

/**
 * Record a completed action. Returns the new row id, or null when capture is
 * disabled or the write failed.
 *
 * Never throws: a failure to record must not fail the business action. The one
 * exception is a payload that does not match its catalogue schema, which is a
 * programming error and is surfaced loudly in development.
 */
export async function recordAction<T extends ActionType>(
  input: RecordActionInput<T>,
  options?: RecordOptions
): Promise<string | null> {
  if (!isAuditCaptureEnabled()) return null;

  const def = getActionDefinition(input.actionType);
  if (!def) {
    console.error(`[audit] unknown action type: ${input.actionType}`);
    return null;
  }

  const parsed = def.payload.safeParse(input.payload);
  if (!parsed.success) {
    // A malformed payload means the reverse handler would receive data it
    // cannot read, so the row would claim to be revertible when it is not.
    // Recording it anyway would be worse than not recording it.
    console.error(
      `[audit] payload failed validation for ${input.actionType}:`,
      parsed.error.flatten()
    );
    if (process.env.NODE_ENV !== "production") {
      throw new Error(`[audit] invalid payload for ${input.actionType}`);
    }
    return null;
  }

  const actor = getAuditActor();
  const scope = getAuditScope();

  try {
    const row = await client(options).actionLog.create({
      data: {
        requestId: scope?.meta.requestId ?? null,
        actionType: input.actionType,
        category: def.category,
        state: "RECORDED",
        reversibility: def.reversibility,
        severity: def.severity,
        actorKind: actor.kind,
        actorRefId: actor.refId,
        actorName: actor.displayName,
        actorEmail: actor.email,
        actorGrant: actor.adminGrantSource,
        actorHash: hashActorIdentity(actor.kind, actor.refId),
        storeId: input.storeId ?? scope?.storeId ?? null,
        businessId: input.businessId ?? null,
        targetType: def.targetType ?? null,
        targetId: input.targetId ?? null,
        targetLabel: input.label ?? def.label(parsed.data),
        subjectUserIds: def.subjects?.(parsed.data) ?? [],
        payload: parsed.data as Prisma.InputJsonValue,
        reason: input.reason ?? null,
        snapshotId: input.snapshotId ?? null,
      },
      select: { id: true },
    });

    noteRecordedAction(row.id);

    // Supersede any earlier RECORDED row for the same (target, actionType).
    // Without this, reverting an older entry after a newer one already
    // overwrote the same field applies a stale value with full confidence —
    // the per-row unique index on reversesActionId only stops reverting the
    // *same* action twice, not two different actions that touched one field.
    if (def.targetType && input.targetId) {
      await markSuperseded(def.targetType, input.targetId, input.actionType, row.id);
    }

    return row.id;
  } catch (error) {
    console.error(`[audit] failed to record ${input.actionType}:`, error);
    return null;
  }
}

/**
 * Two-phase capture for destructive actions.
 *
 * `beginAction` commits a PENDING row *before* the destructive write runs, in
 * its own transaction. If the write then crashes halfway through a cascade —
 * the case where the data is gone and nothing else survives to say so — the
 * PENDING row is the only artifact left. Without it, a half-completed tenant
 * delete looks identical to a delete that never started.
 *
 * The caller must follow with {@link completeAction} or {@link failAction}.
 */
export async function beginAction<T extends ActionType>(
  input: RecordActionInput<T>
): Promise<string | null> {
  if (!isAuditCaptureEnabled()) return null;

  const def = getActionDefinition(input.actionType);
  if (!def) return null;

  const parsed = def.payload.safeParse(input.payload);
  if (!parsed.success) {
    console.error(`[audit] invalid payload for ${input.actionType}:`, parsed.error.flatten());
    return null;
  }

  const actor = getAuditActor();
  const scope = getAuditScope();

  try {
    // Deliberately on the base client, never the caller's transaction: a
    // PENDING row that rolls back with the mutation it was meant to outlive
    // would defeat the entire purpose.
    const row = await prisma.actionLog.create({
      data: {
        requestId: scope?.meta.requestId ?? null,
        actionType: input.actionType,
        category: def.category,
        state: "PENDING",
        reversibility: def.reversibility,
        severity: def.severity,
        actorKind: actor.kind,
        actorRefId: actor.refId,
        actorName: actor.displayName,
        actorEmail: actor.email,
        actorGrant: actor.adminGrantSource,
        actorHash: hashActorIdentity(actor.kind, actor.refId),
        storeId: input.storeId ?? scope?.storeId ?? null,
        businessId: input.businessId ?? null,
        targetType: def.targetType ?? null,
        targetId: input.targetId ?? null,
        targetLabel: input.label ?? def.label(parsed.data),
        subjectUserIds: def.subjects?.(parsed.data) ?? [],
        payload: parsed.data as Prisma.InputJsonValue,
        reason: input.reason ?? null,
      },
      select: { id: true },
    });
    noteRecordedAction(row.id);
    return row.id;
  } catch (error) {
    console.error(`[audit] failed to begin ${input.actionType}:`, error);
    return null;
  }
}

/** Promote a PENDING row to RECORDED once the destructive write committed. */
export async function completeAction(
  actionLogId: string | null,
  patch?: { snapshotId?: string | null; payload?: unknown; targetId?: string | null }
): Promise<void> {
  if (!actionLogId) return;
  try {
    await prisma.actionLog.update({
      where: { id: actionLogId },
      data: {
        state: "RECORDED",
        ...(patch?.snapshotId !== undefined ? { snapshotId: patch.snapshotId } : {}),
        ...(patch?.targetId !== undefined ? { targetId: patch.targetId } : {}),
        ...(patch?.payload !== undefined
          ? { payload: patch.payload as Prisma.InputJsonValue }
          : {}),
      },
    });
  } catch (error) {
    console.error("[audit] failed to complete action:", error);
  }
}

/** Mark a PENDING row FAILED when the destructive write threw. */
export async function failAction(actionLogId: string | null, message: string): Promise<void> {
  if (!actionLogId) return;
  try {
    await prisma.actionLog.update({
      where: { id: actionLogId },
      data: { state: "FAILED", errorMessage: message.slice(0, 1000) },
    });
  } catch (error) {
    console.error("[audit] failed to mark action failed:", error);
  }
}

/**
 * Mark older entries superseded when a newer action wrote the same target.
 *
 * Without this, reverting action A and then action B — both of which touched
 * the same field — applies B's stale before-image on top of A's restored value,
 * with full confidence and no warning. The per-row unique index on
 * `reversesActionId` prevents reverting the *same* action twice; it does
 * nothing about two different actions racing over one field.
 */
export async function markSuperseded(
  targetType: string,
  targetId: string,
  actionType: string,
  newerThanId: string
): Promise<void> {
  try {
    const newer = await prisma.actionLog.findUnique({
      where: { id: newerThanId },
      select: { occurredAt: true },
    });
    if (!newer) return;
    await prisma.actionLog.updateMany({
      where: {
        targetType,
        targetId,
        actionType,
        occurredAt: { lt: newer.occurredAt },
        state: "RECORDED",
        supersededAt: null,
      },
      data: { state: "SUPERSEDED", supersededAt: new Date() },
    });
  } catch (error) {
    console.error("[audit] failed to mark superseded:", error);
  }
}
