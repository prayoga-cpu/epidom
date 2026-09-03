import type { z } from "zod";
import type { Prisma, PrismaClient, AuditSeverity } from "@prisma/client";

/**
 * Type contract for the Layer 2 action catalogue.
 *
 * The central design choice is that `reversibility` is a discriminant, and the
 * fields required to *act* on a class are only present on that class. A
 * REVERSIBLE entry cannot omit `reverse` or `roundTrip`, because omitting them
 * fails to satisfy the union member — a `tsc` error, not a review comment.
 *
 * That matters more here than it normally would: `pnpm lint` in this repo lints
 * zero TypeScript files and `pnpm test` is absent from CI, so `tsc --noEmit` is
 * the only enforcement that actually runs. Any invariant not expressed in the
 * type system is unenforced.
 */

/** Transaction client, so a log row commits atomically with its mutation. */
export type AuditTx = Prisma.TransactionClient | PrismaClient;

/** Why a reversal cannot proceed. Rendered verbatim to the operator. */
export interface Refusal {
  code:
    | "STALE_TARGET"
    | "TARGET_MISSING"
    | "ALREADY_REVERTED"
    | "SUPERSEDED"
    | "TOO_OLD"
    | "UNIQUE_COLLISION"
    | "DOWNSTREAM_CONSUMED"
    | "LEDGER_GUARDED"
    | "DEPTH_EXCEEDED"
    | "SCHEMA_DRIFT"
    | "NOT_REVERSIBLE"
    | "SIZE_EXCEEDED";
  message: string;
  /** Deep link to the domain action that *is* the correct remedy, if any. */
  remedyHref?: string;
}

export interface ReverseContext<P> {
  payload: P;
  tx: Prisma.TransactionClient;
  actionLogId: string;
  /** Operator-supplied justification; already validated as non-empty. */
  reason: string;
}

export interface PrecheckContext<P> {
  payload: P;
  db: PrismaClient;
  occurredAt: Date;
}

interface BaseAction<P> {
  /** Grouping for the admin UI filter, e.g. "admin", "pos", "inventory". */
  category: string;
  severity: AuditSeverity;
  /** Zod schema for the stored payload. Decimals are strings, never numbers. */
  payload: z.ZodType<P>;
  /** Prisma model the action targets. */
  targetType?: string;
  /** Human label for one row, e.g. `Deleted user ${p.email}`. */
  label: (payload: P) => string;
  /** Users whose personal data is in the payload. Drives the GDPR shredder. */
  subjects?: (payload: P) => string[];
}

interface ReversibleShape<P> {
  /** Refuse before attempting. Runs against live state, outside the write tx. */
  precheck?: (ctx: PrecheckContext<P>) => Promise<Refusal | null>;
  /** Apply the inverse. Runs inside a transaction with the log write. */
  reverse: (ctx: ReverseContext<P>) => Promise<void>;
  /**
   * Round-trip fixture. Required, so a REVERSIBLE action cannot ship without
   * one. Given a payload, it must assert that encode -> decode preserves every
   * field the reverse handler reads — the failure mode this catches is a
   * Decimal silently losing precision through JSON.
   */
  roundTrip: (payload: P) => void;
  /** Beyond this age the guard chain refuses regardless of state. */
  maxReversalAgeDays?: number;
}

export type ActionDefinition<P> = BaseAction<P> &
  (
    | ({ reversibility: "REVERSIBLE" } & ReversibleShape<P>)
    | ({
        reversibility: "REVERSIBLE_WITH_CAVEAT";
        /** Shown in the confirm dialog. What reversal will NOT restore. */
        caveat: string;
      } & ReversibleShape<P>)
    | {
        reversibility: "SNAPSHOT_RESTORE";
        /** Restore runs through the snapshot engine, not a hand-written inverse. */
        snapshotRoot: "User" | "Business" | "Store";
        maxReversalAgeDays?: number;
      }
    | {
        reversibility: "COMPENSATE_ONLY";
        /**
         * Why an inverse is wrong here, and what to do instead. Rendered as the
         * refusal message, so it must be actionable rather than apologetic.
         */
        compensation: string;
        /** Deep link to the domain action that is the correct remedy. */
        remedyHref?: (payload: P) => string;
      }
    | {
        reversibility: "IRREVERSIBLE";
        /** Why nothing can undo this. Rendered to the operator. */
        rationale: string;
      }
  );

/** Any catalogue entry, with its payload type erased. */
export type AnyActionDefinition = ActionDefinition<any>;

/**
 * Narrowing helpers. `reverse` and `roundTrip` exist only on the two reversible
 * shapes, so the rest of the engine must check before reaching for them.
 */
export function hasReverseHandler<P>(
  def: ActionDefinition<P>
): def is ActionDefinition<P> & ReversibleShape<P> {
  return def.reversibility === "REVERSIBLE" || def.reversibility === "REVERSIBLE_WITH_CAVEAT";
}

export function isSnapshotRestore<P>(def: ActionDefinition<P>): boolean {
  return def.reversibility === "SNAPSHOT_RESTORE";
}

/**
 * Identity helper that preserves the payload type through the catalogue object.
 * Without it, a `Record<string, AnyActionDefinition>` would erase `P` and every
 * handler would receive `any`.
 */
export function defineAction<P>(def: ActionDefinition<P>): ActionDefinition<P> {
  return def;
}
