import { prisma } from "@/lib/prisma";
import type { ActionLog } from "@prisma/client";
import { DEFAULT_MAX_REVERSAL_AGE_DAYS } from "./config";
import { getActionDefinition } from "./catalog";
import { hasReverseHandler, type Refusal } from "./catalog-types";
import { checkDownstreamConsumption, isLedgerModel } from "./guards";
import { getAuditActor } from "./actor-scope";
import { hashActorIdentity } from "./actor";

/**
 * The reversal engine.
 *
 * Design stance: this engine refuses far more often than it acts, and every
 * refusal names a reason an operator can act on. That asymmetry is deliberate —
 * an incomplete log is recoverable, a wrong revert is not. A reversal that
 * silently overwrites newer state is worse than no reversal feature at all,
 * because the operator will believe the problem is fixed.
 */

export interface ReversalPlan {
  ok: boolean;
  actionLogId: string;
  actionType: string;
  label: string | null;
  reversibility: string;
  /** Populated when ok === false. */
  refusal?: Refusal;
  /** Rendered in the confirm dialog for REVERSIBLE_WITH_CAVEAT. */
  caveat?: string;
  /** Human summary of what applying will do. */
  effect?: string;
  plannedAt: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function refuse(row: ActionLog, refusal: Refusal): ReversalPlan {
  return {
    ok: false,
    actionLogId: row.id,
    actionType: row.actionType,
    label: row.targetLabel,
    reversibility: row.reversibility,
    refusal,
    plannedAt: new Date().toISOString(),
  };
}

/**
 * The guard chain. Runs against live state and returns a plan without writing
 * anything, so an operator always sees the verdict before committing.
 */
export async function planReversal(actionLogId: string): Promise<ReversalPlan> {
  const row = await prisma.actionLog.findUnique({ where: { id: actionLogId } });

  if (!row) {
    return {
      ok: false,
      actionLogId,
      actionType: "unknown",
      label: null,
      reversibility: "IRREVERSIBLE",
      refusal: { code: "TARGET_MISSING", message: "That action no longer exists." },
      plannedAt: new Date().toISOString(),
    };
  }

  // 1. State. Only a committed action can be reverted; a PENDING row describes
  //    a write that may never have landed.
  if (row.state === "REVERTED") {
    return refuse(row, { code: "ALREADY_REVERTED", message: "This action has already been reverted." });
  }
  if (row.state === "SUPERSEDED") {
    return refuse(row, {
      code: "SUPERSEDED",
      message:
        "A newer action has since changed the same field. Reverting would apply a stale value on top of that change.",
    });
  }
  if (row.state !== "RECORDED") {
    return refuse(row, {
      code: "STALE_TARGET",
      message: `This action is in state ${row.state} and cannot be reverted.`,
    });
  }

  // 2. Double-revert. The partial unique index on reversesActionId also
  //    enforces this at the database level, so two admins racing cannot both
  //    win; this check exists to give the loser a readable message.
  const existingReversal = await prisma.actionLog.findUnique({
    where: { reversesActionId: row.id },
    select: { id: true, occurredAt: true },
  });
  if (existingReversal) {
    return refuse(row, {
      code: "ALREADY_REVERTED",
      message: `Already reverted on ${existingReversal.occurredAt.toISOString().slice(0, 16).replace("T", " ")}.`,
    });
  }

  // 3. Depth. Reverting a reversal is a correction, not an undo — it should go
  //    through the forward-correction path so both steps stay visible.
  if (row.reversesActionId) {
    return refuse(row, {
      code: "DEPTH_EXCEEDED",
      message:
        "This row is itself a reversal. Record a forward correction instead, so the full sequence stays legible.",
    });
  }

  const def = getActionDefinition(row.actionType);
  if (!def) {
    return refuse(row, {
      code: "NOT_REVERSIBLE",
      message: `No catalogue entry for ${row.actionType}; this action predates the current catalogue.`,
    });
  }

  // 4. Age.
  const maxAge =
    ("maxReversalAgeDays" in def && def.maxReversalAgeDays) || DEFAULT_MAX_REVERSAL_AGE_DAYS;
  const ageDays = (Date.now() - row.occurredAt.getTime()) / MS_PER_DAY;
  if (ageDays > maxAge) {
    return refuse(row, {
      code: "TOO_OLD",
      message: `This action is ${Math.floor(ageDays)} days old; reversal is limited to ${maxAge} days because downstream state has almost certainly been derived from it since.`,
    });
  }

  // 5. Class.
  if (def.reversibility === "IRREVERSIBLE") {
    return refuse(row, { code: "NOT_REVERSIBLE", message: (def as any).rationale });
  }
  if (def.reversibility === "COMPENSATE_ONLY") {
    return refuse(row, {
      code: "LEDGER_GUARDED",
      message: (def as any).compensation,
      remedyHref: (def as any).remedyHref?.(row.payload as any),
    });
  }
  if (def.reversibility === "SNAPSHOT_RESTORE") {
    if (!row.snapshotId) {
      return refuse(row, {
        code: "TARGET_MISSING",
        message:
          "No snapshot was captured for this action, so there is nothing to restore from. Recovery would require the nightly backup.",
      });
    }
    return {
      ok: true,
      actionLogId: row.id,
      actionType: row.actionType,
      label: row.targetLabel,
      reversibility: row.reversibility,
      effect: "Restores the captured entity graph. Run the restore planner for a row-level preview.",
      plannedAt: new Date().toISOString(),
    };
  }

  // 6. Ledger models never take a generic inverse, whatever the catalogue says.
  //    Belt and braces: a future catalogue entry that mislabels a ledger write
  //    as REVERSIBLE would otherwise corrupt currentStock.
  if (isLedgerModel(row.targetType)) {
    return refuse(row, {
      code: "LEDGER_GUARDED",
      message:
        "This action wrote to a ledger. Reverting the row would leave the running balance disagreeing with the sum of its movements. Post a compensating entry instead.",
    });
  }

  // 7. Downstream consumption — a value already folded into a settled figure.
  const downstream = await checkDownstreamConsumption(row.targetType, row.targetId);
  if (downstream) return refuse(row, downstream);

  // 8. Catalogue precheck — per-action staleness against live state.
  if (hasReverseHandler(def)) {
    const parsed = def.payload.safeParse(row.payload);
    if (!parsed.success) {
      return refuse(row, {
        code: "SCHEMA_DRIFT",
        message:
          "The stored payload no longer matches the current action schema, so the reverse handler cannot read it safely.",
      });
    }
    if (def.precheck) {
      const refusal = await def.precheck({
        payload: parsed.data,
        db: prisma,
        occurredAt: row.occurredAt,
      });
      if (refusal) return refuse(row, refusal);
    }
  }

  return {
    ok: true,
    actionLogId: row.id,
    actionType: row.actionType,
    label: row.targetLabel,
    reversibility: row.reversibility,
    caveat: def.reversibility === "REVERSIBLE_WITH_CAVEAT" ? (def as any).caveat : undefined,
    effect: `Restores the previous value for ${row.targetLabel ?? row.actionType}.`,
    plannedAt: new Date().toISOString(),
  };
}

export interface ApplyResult {
  ok: boolean;
  reversalActionId?: string;
  refusal?: Refusal;
}

/**
 * Apply a reversal.
 *
 * Re-runs the entire guard chain inside the write path rather than trusting the
 * plan the caller was shown: between preview and apply, another admin may have
 * acted. The plan is advisory; this is the gate.
 */
export async function applyReversal(actionLogId: string, reason: string): Promise<ApplyResult> {
  const trimmed = reason?.trim() ?? "";
  if (trimmed.length < 10) {
    return {
      ok: false,
      refusal: {
        code: "NOT_REVERSIBLE",
        message: "A reversal needs a reason of at least 10 characters. It becomes part of the record.",
      },
    };
  }

  const plan = await planReversal(actionLogId);
  if (!plan.ok) return { ok: false, refusal: plan.refusal };

  const row = await prisma.actionLog.findUniqueOrThrow({ where: { id: actionLogId } });
  const def = getActionDefinition(row.actionType);
  if (!def || !hasReverseHandler(def)) {
    return {
      ok: false,
      refusal: { code: "NOT_REVERSIBLE", message: "This action has no reverse handler." },
    };
  }

  const parsed = def.payload.safeParse(row.payload);
  if (!parsed.success) {
    return {
      ok: false,
      refusal: { code: "SCHEMA_DRIFT", message: "Stored payload no longer matches the schema." },
    };
  }

  const actor = getAuditActor();

  try {
    const reversalId = await prisma.$transaction(async (tx) => {
      // Claim the target first. The unique index on reversesActionId means a
      // second concurrent apply fails here rather than running the handler
      // twice — the database is the arbiter, not application logic.
      const reversal = await tx.actionLog.create({
        data: {
          actionType: row.actionType,
          category: row.category,
          state: "RECORDED",
          reversibility: "IRREVERSIBLE",
          severity: "CRITICAL",
          actorKind: actor.kind,
          actorRefId: actor.refId,
          actorName: actor.displayName,
          actorEmail: actor.email,
          actorGrant: actor.adminGrantSource,
          actorHash: hashActorIdentity(actor.kind, actor.refId),
          storeId: row.storeId,
          businessId: row.businessId,
          targetType: row.targetType,
          targetId: row.targetId,
          targetLabel: `Reverted: ${row.targetLabel ?? row.actionType}`,
          subjectUserIds: row.subjectUserIds,
          payload: row.payload ?? undefined,
          reason: trimmed,
          reversesActionId: row.id,
        },
        select: { id: true },
      });

      await def.reverse({
        payload: parsed.data,
        tx,
        actionLogId: row.id,
        reason: trimmed,
      });

      await tx.actionLog.update({
        where: { id: row.id },
        data: { state: "REVERTED" },
      });

      return reversal.id;
    });

    return { ok: true, reversalActionId: reversalId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // A unique-violation here is the concurrent-apply case, not a bug.
    if (message.includes("reversesActionId") || message.includes("Unique constraint")) {
      return {
        ok: false,
        refusal: {
          code: "ALREADY_REVERTED",
          message: "Another admin reverted this action at the same moment. Reload to see the result.",
        },
      };
    }
    console.error("[audit] reversal failed:", error);
    return {
      ok: false,
      refusal: { code: "STALE_TARGET", message: `Reversal failed and was rolled back: ${message}` },
    };
  }
}
