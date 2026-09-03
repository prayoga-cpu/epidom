import { AsyncLocalStorage } from "node:async_hooks";
import type { AdminGrantSource } from "@/lib/auth/require-admin-api";

/**
 * Request-scoped audit context.
 *
 * Deliberately NOT built on `src/lib/request-context.ts`. That module stores
 * the request id on `global`, which is a single slot shared by every request a
 * lambda handles concurrently — two overlapping requests overwrite each other,
 * so an audit row could be stamped with another request's actor. For an audit
 * trail, confidently wrong attribution is worse than none.
 *
 * `getRequestId()` is also unusable here: `src/proxy.ts` sets `x-request-id`
 * on the *response* for `/api/*` and returns before any handler runs, so the
 * value never reaches route code. The id is generated in the wrapper instead.
 *
 * AsyncLocalStorage gives each request its own store, propagated through
 * awaits, which is what correct per-request attribution requires.
 */

/** Who performed an action. */
export type ActorKind =
  /** A signed-in User (owner or admin) acting as themselves. */
  | "USER"
  /** A StaffMember persona on a shared device — no User row of their own. */
  | "STAFF"
  /** An unauthenticated public actor (storefront ordering). */
  | "PUBLIC"
  /** A background job (Inngest, cron). */
  | "SYSTEM"
  /** An external provider callback (Stripe, Xendit, email). */
  | "WEBHOOK";

export interface AuditActor {
  kind: ActorKind;
  /**
   * `User.id` for USER, `StaffMember.id` for STAFF, a stable job name for
   * SYSTEM/WEBHOOK, null for PUBLIC.
   */
  refId: string | null;
  /** Display name captured at action time, so it survives the actor's deletion. */
  displayName: string | null;
  /** Email captured at action time. Null for STAFF/PUBLIC. */
  email: string | null;
  /**
   * Set only when the actor passed the admin check. Records whether they
   * qualified on the DB flag or the hardcoded email list — the latter leaves
   * no other trace that the account was ever privileged.
   */
  adminGrantSource: AdminGrantSource | null;
}

export interface AuditRequestMeta {
  /** Generated in the API wrapper; correlates Layer 1 and Layer 2 rows. */
  requestId: string;
  method: string;
  /** Route pathname, query string stripped. */
  route: string;
  /** Salted SHA-256 of the client IP. Never the raw address. */
  ipHash: string | null;
  userAgent: string | null;
  startedAt: number;
}

export interface AuditScope {
  actor: AuditActor;
  meta: AuditRequestMeta;
  storeId?: string;
  /**
   * Layer 2 rows recorded during this request. Lets a later row reference an
   * earlier one in the same request without threading ids through call stacks.
   */
  recordedActionIds: string[];
}

const storage = new AsyncLocalStorage<AuditScope>();

/** Run `fn` with an audit scope bound to the current async context. */
export function runWithAuditScope<T>(scope: AuditScope, fn: () => T): T {
  return storage.run(scope, fn);
}

/**
 * The current scope, or undefined outside a scoped request.
 *
 * Undefined is a normal, expected state — background jobs, build-time code and
 * anything not routed through the API wrapper have no scope. Callers must
 * degrade to an unattributed row rather than throwing: a missing actor is a
 * gap in the trail, but a throw here would turn audit capture into an outage.
 */
export function getAuditScope(): AuditScope | undefined {
  return storage.getStore();
}

/** The current actor, or a SYSTEM placeholder when unscoped. */
export function getAuditActor(): AuditActor {
  return (
    storage.getStore()?.actor ?? {
      kind: "SYSTEM",
      refId: null,
      displayName: null,
      email: null,
      adminGrantSource: null,
    }
  );
}

/** Attach the resolved store to the current scope, if there is one. */
export function setAuditScopeStore(storeId: string | undefined): void {
  const scope = storage.getStore();
  if (scope && storeId) scope.storeId = storeId;
}

/** Note a Layer 2 action recorded during this request. */
export function noteRecordedAction(actionId: string): void {
  storage.getStore()?.recordedActionIds.push(actionId);
}

/** Replace the scope's actor once a staff persona has been resolved lazily. */
export function upgradeAuditActor(actor: AuditActor): void {
  const scope = storage.getStore();
  if (scope) scope.actor = actor;
}
