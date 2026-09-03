import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminApiHandler } from "@/lib/admin-api-handler";
import { adminActor } from "@/lib/admin-api-handler";
import { getActionDetail } from "@/lib/services/audit-query.service";
import { planReversal, applyReversal } from "@/lib/audit/reverse";
import { planRestore, applyRestore } from "@/lib/audit/restore";
import { annotateSchema, flagSchema, lockSchema, revertSchema } from "@/lib/validation/audit.schemas";
import { z } from "zod";

/**
 * Actions on a recorded action: inspect, preview a reversal, apply it,
 * annotate, flag, or place under legal hold.
 *
 * Note what is absent: there is no endpoint that edits an ActionLog's event
 * columns. A correction is always a new forward row carrying
 * `correctsActionId`. An audit log whose contents an admin can quietly rewrite
 * is not evidence, and distrust of admin actions is this feature's premise.
 */

// `.extend()` rather than `.and()`: z.discriminatedUnion needs each member to
// be a ZodObject so it can read the discriminant, and an intersection is not one.
const bodySchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("detail"), actionLogId: z.string().min(1) }),
  z.object({ op: z.literal("plan"), actionLogId: z.string().min(1) }),
  z.object({ op: z.literal("planRestore"), snapshotId: z.string().min(1) }),
  z.object({
    op: z.literal("restore"),
    snapshotId: z.string().min(1),
    reason: z.string().min(10, "Give a reason of at least 10 characters").max(1000),
    confirmed: z.literal(true),
  }),
  revertSchema.extend({ op: z.literal("revert") }),
  annotateSchema.extend({ op: z.literal("annotate") }),
  flagSchema.extend({ op: z.literal("flag") }),
  lockSchema.extend({ op: z.literal("lock") }),
]);

export const POST = withAdminApiHandler(async (request, { admin }) => {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;

  if (input.op === "detail") {
    const detail = await getActionDetail(input.actionLogId);
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ detail });
  }

  if (input.op === "plan") {
    // Dry run only. Nothing is written, so an operator can always look before
    // committing — and the refusal reason is the most useful output here.
    const plan = await planReversal(input.actionLogId);
    return NextResponse.json({ plan });
  }

  if (input.op === "revert") {
    const result = await applyReversal(input.actionLogId, input.reason);
    if (!result.ok) {
      return NextResponse.json({ error: result.refusal?.message, refusal: result.refusal }, { status: 409 });
    }
    return NextResponse.json({ ok: true, reversalActionId: result.reversalActionId });
  }

  if (input.op === "planRestore") {
    // Dry run over the snapshot: row counts per table, collisions, missing
    // external references, and any schema drift since capture.
    const plan = await planRestore(input.snapshotId);
    return NextResponse.json({ plan });
  }

  if (input.op === "restore") {
    const actor = adminActor(admin);
    const result = await applyRestore(input.snapshotId, input.reason, {
      refId: actor.refId,
      name: actor.displayName,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.message, result }, { status: 409 });
    }
    return NextResponse.json({ ok: true, result });
  }

  if (input.op === "annotate") {
    const actor = adminActor(admin);
    const annotation = await prisma.actionAnnotation.create({
      data: {
        actionLogId: input.actionLogId,
        authorKind: actor.kind,
        authorRefId: actor.refId,
        authorName: actor.displayName,
        body: input.body,
      },
    });
    return NextResponse.json({ annotation });
  }

  if (input.op === "flag") {
    const updated = await prisma.actionLog.update({
      where: { id: input.actionLogId },
      data: {
        flaggedAt: input.flagged ? new Date() : null,
        flaggedNote: input.flagged ? (input.note ?? null) : null,
      },
      select: { id: true, flaggedAt: true, flaggedNote: true },
    });
    return NextResponse.json({ actionLog: updated });
  }

  if (input.op === "lock") {
    // Legal hold. Exempts the row from retention pruning AND from the GDPR
    // shredder — which is a genuine conflict with an erasure request and needs
    // a written legal basis before it is used. See docs/AUDIT_LOG_PLAN.md §8.
    const updated = await prisma.actionLog.update({
      where: { id: input.actionLogId },
      data: { lockedAt: input.locked ? new Date() : null },
      select: { id: true, lockedAt: true },
    });
    return NextResponse.json({ actionLog: updated });
  }

  return NextResponse.json({ error: "Unhandled operation" }, { status: 400 });
});
