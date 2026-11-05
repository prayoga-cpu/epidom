import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { applyReversal, planReversal } from "@/lib/audit/reverse";
import { defineStoreTool } from "../define-tool";
import { McpToolError } from "../errors";
import { PAGES, storeIdInput } from "./shared";

/**
 * Menu change history and undo.
 *
 * Every menu change Claude makes (items, categories, a product's option
 * groups) leaves a Layer 2 row (src/lib/audit/menu-undo.ts) holding what the
 * rows looked like before and after. These two tools list those rows and put
 * one back, going through the same reversal engine the admin Activity log
 * uses: it refuses when anything touched the same rows since, so an undo never
 * overwrites a newer edit. Only menu changes of this store can be undone here;
 * stock adjustments, expenses, supplier orders, rosters and customers keep a
 * who/when record but no before-image, so they are corrected with a new change.
 */

const access = { pages: PAGES.menu } as const;

const UNDOABLE_PREFIX = "menu.";
const MAX_AGE_DAYS = 30;

export const listMenuChanges = defineStoreTool({
  name: "list_menu_changes",
  title: "Menu change history",
  description:
    "Recent menu changes made through Claude or the app's audited paths for this store, newest first: " +
    "what changed, who, when, and whether it can still be undone (undoable: true needs nothing else to " +
    "have touched the same rows since). Use the changeId with undo_menu_change. Only menu changes (items, " +
    "categories, a product's option groups) can be undone, for 30 days.",
  input: z.object({
    ...storeIdInput,
    limit: z.number().int().min(1).max(50).default(15),
    onlyUndoable: z
      .boolean()
      .optional()
      .describe("Leave out changes already undone or superseded."),
  }),
  kind: "read",
  access,
  handler: async (input, ctx) => {
    const rows = await prisma.actionLog.findMany({
      where: {
        storeId: ctx.storeId,
        actionType: { startsWith: UNDOABLE_PREFIX },
        ...(input.onlyUndoable && { state: "RECORDED", reversesActionId: null }),
      },
      orderBy: { occurredAt: "desc" },
      take: input.limit,
      select: {
        id: true,
        occurredAt: true,
        actionType: true,
        targetLabel: true,
        state: true,
        actorName: true,
        reversesActionId: true,
      },
    });
    const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    return {
      changes: rows.map((row) => ({
        changeId: row.id,
        at: row.occurredAt.toISOString(),
        what: row.targetLabel,
        by: row.actorName ?? undefined,
        kind: row.actionType,
        state: row.reversesActionId
          ? "an undo"
          : row.state === "RECORDED"
            ? "active"
            : row.state.toLowerCase(),
        undoable:
          row.state === "RECORDED" && !row.reversesActionId && row.occurredAt.getTime() > cutoff,
      })),
      note:
        "undoable is a first look: undo_menu_change (mode: preview) checks the live menu and says " +
        "plainly if something has changed since.",
    };
  },
});

export const undoMenuChange = defineStoreTool({
  name: "undo_menu_change",
  title: "Undo a menu change",
  description:
    "Put the menu back the way it was before one change from list_menu_changes: restores the items' " +
    "previous name, price, category, department, availability, product link and option groups, removes " +
    "items that change added, brings back categories it removed, or restores a product's previous option " +
    "groups. Refuses if anything touched the same rows since, saying what, so a newer edit is never " +
    "overwritten. Always run mode: preview first and show the person; the undo itself is recorded in the " +
    "history. Not for stock, expenses, supplier orders, rosters or customers.",
  input: z.object({
    ...storeIdInput,
    changeId: z.string().describe("From list_menu_changes."),
    reason: z
      .string()
      .max(300)
      .optional()
      .describe("Why, in the person's words. Kept in the history. Optional."),
    mode: z.enum(["preview", "commit"]).default("commit"),
  }),
  kind: "write",
  access,
  severity: "NOTICE",
  hints: { destructiveHint: true, idempotentHint: false },
  handler: async (input, ctx) => {
    const row = await prisma.actionLog.findFirst({
      where: {
        id: input.changeId,
        storeId: ctx.storeId,
        actionType: { startsWith: UNDOABLE_PREFIX },
      },
      select: { id: true },
    });
    if (!row) {
      throw new McpToolError(
        "NOT_FOUND",
        "No undoable menu change with that id in this store. Use list_menu_changes."
      );
    }

    if (input.mode === "preview") {
      const plan = await planReversal(row.id);
      if (!plan.ok) {
        return { mode: "preview", canUndo: false, reason: plan.refusal?.message };
      }
      return {
        mode: "preview",
        canUndo: true,
        what: plan.label,
        effect: plan.effect,
        next: "Show the person. If they confirm, call again with mode: commit.",
      };
    }

    // The engine wants a reason of at least 10 characters; the person's own
    // words when given, otherwise a plain default that names who asked.
    const reason =
      input.reason && input.reason.trim().length >= 10
        ? input.reason.trim()
        : `Undone from Claude at the request of ${ctx.actor.displayName ?? "the store owner"}`;
    const result = await applyReversal(row.id, reason);
    if (!result.ok) {
      throw new McpToolError(
        "CANNOT_UNDO",
        result.refusal?.message ?? "This change can't be undone."
      );
    }
    return { mode: "commit", undone: true, undoChangeId: result.reversalActionId };
  },
});
