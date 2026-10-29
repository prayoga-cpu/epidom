import type { StaffRole, Store } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyStoreAccess } from "@/lib/utils/store-verification";
import { getStorePlan } from "@/lib/plans/store-plan";
import {
  planHasFeature,
  PLAN_LABELS,
  minPlanFor,
  type PlanFeature,
} from "@/lib/plans/entitlements";
import { resolveStaffAllowedPages } from "@/config/staff-permissions.config";
import type { AuditActor } from "@/lib/audit/actor-scope";
import { MCP_SCOPE_WRITE } from "./config";
import type { McpPrincipal } from "./principal";

/**
 * What a tool needs from the caller, beyond being allowed into the store.
 *
 * The owner passes every rule. A linked staff account passes only what its
 * role and page grants allow — the same grants that decide which Back Office
 * pages it can open — and nothing by default: a tool that sets no `pages` is
 * owner-only.
 */
export interface McpToolAccess {
  /** Page grants that admit a staff account (any one of them). */
  pages?: readonly string[];
  /** Staff must also be a MANAGER (e.g. publishing the roster). */
  managerOnly?: boolean;
  /** The owner only, whatever the staff grants (payroll, all outlets). */
  ownerOnly?: boolean;
  /** A plan feature the tool needs on top of the connector itself. */
  feature?: PlanFeature;
}

export type McpAccessErrorCode =
  | "STORE_NOT_FOUND"
  | "PLAN_REQUIRED"
  | "FORBIDDEN"
  | "WRITE_SCOPE_REQUIRED";

/** A refusal Claude can explain to the person. Messages are written for them. */
export class McpAccessError extends Error {
  constructor(
    readonly code: McpAccessErrorCode,
    message: string
  ) {
    super(message);
    this.name = "McpAccessError";
  }
}

/** The caller, resolved for one store. Handed to every tool handler. */
export interface McpStoreContext {
  storeId: string;
  store: Store;
  principal: McpPrincipal;
  /** "owner", or the linked staff account's role at this store. */
  role: "OWNER" | Exclude<StaffRole, "OWNER">;
  /** Set for a linked staff account: the only persona it acts as. */
  staffMemberId: string | null;
  /** Who the audit trail records. */
  actor: AuditActor;
}

/** The role + grants a staff account holds, for the rules below. */
export interface StaffGrant {
  role: StaffRole;
  pages: readonly string[];
}

/**
 * Whether a staff account with `grant` may use a tool with `access`. Pure, so
 * the server can also hide tools a staff-only account could never use.
 */
export function staffMayUse(access: McpToolAccess, grant: StaffGrant): boolean {
  if (access.ownerOnly) return false;
  if (!access.pages || access.pages.length === 0) return false;
  if (access.managerOnly && grant.role !== "MANAGER") return false;
  return access.pages.some((page) => grant.pages.includes(page));
}

/**
 * Resolve the caller for `storeId` and check every rule a tool call must pass,
 * in this order: write scope, store access, the store's plan, staff rules.
 * Each check is live, so deactivating a staff member, downgrading the plan or
 * revoking the connection applies on the very next call.
 *
 * @throws McpAccessError with a sentence Claude can relay to the person.
 */
export async function authorizeMcpStore(
  principal: McpPrincipal,
  storeId: string,
  access: McpToolAccess,
  kind: "read" | "write"
): Promise<McpStoreContext> {
  if (kind === "write" && !principal.scopes.includes(MCP_SCOPE_WRITE)) {
    throw new McpAccessError(
      "WRITE_SCOPE_REQUIRED",
      "This Claude connection can only read Epidom data. To let Claude make changes, " +
        "reconnect Epidom in Claude and tick “Allow changes” on the Epidom consent screen."
    );
  }

  const storeAccess = await verifyStoreAccess(storeId, principal.userId).catch(() => null);
  if (!storeAccess) {
    throw new McpAccessError(
      "STORE_NOT_FOUND",
      "That store doesn't exist or this account can't open it. Call list_stores for the stores it can."
    );
  }

  const plan = await getStorePlan(storeId);
  if (!planHasFeature(plan, "claudeConnector")) {
    throw new McpAccessError(
      "PLAN_REQUIRED",
      `${storeAccess.store.name} is on the ${PLAN_LABELS[plan]} plan. Using Epidom from Claude ` +
        `needs the ${PLAN_LABELS[minPlanFor("claudeConnector")]} plan: the store owner can ask ` +
        "Epidom about it from the Profile page."
    );
  }
  if (access.feature && !planHasFeature(plan, access.feature)) {
    throw new McpAccessError(
      "PLAN_REQUIRED",
      `This needs the ${PLAN_LABELS[minPlanFor(access.feature)]} plan, and ` +
        `${storeAccess.store.name} is on ${PLAN_LABELS[plan]}.`
    );
  }

  if (storeAccess.accessType === "owner") {
    const user = await prisma.user.findUnique({
      where: { id: principal.userId },
      select: { name: true, email: true },
    });
    return {
      storeId,
      store: storeAccess.store,
      principal,
      role: "OWNER",
      staffMemberId: null,
      actor: {
        kind: "USER",
        refId: principal.userId,
        displayName: user?.name ?? null,
        email: user?.email ?? null,
        adminGrantSource: null,
      },
    };
  }

  const staff = await prisma.staffMember.findUnique({
    where: { id: storeAccess.staffMemberId },
    select: { id: true, name: true, role: true, allowedPages: true },
  });
  // verifyStoreAccess only admits an active, non-OWNER row at this store.
  if (!staff || staff.role === "OWNER") {
    throw new McpAccessError("FORBIDDEN", "This staff account can't use Epidom from Claude.");
  }
  const grant = {
    role: staff.role,
    pages: resolveStaffAllowedPages(staff.role, staff.allowedPages),
  };
  if (!staffMayUse(access, grant)) {
    throw new McpAccessError(
      "FORBIDDEN",
      access.ownerOnly
        ? "Only the store owner can see this."
        : "Your staff access at this store doesn't include this. The owner or a manager can " +
          "change your access on the Staff page."
    );
  }

  return {
    storeId,
    store: storeAccess.store,
    principal,
    role: staff.role,
    staffMemberId: staff.id,
    actor: {
      kind: "STAFF",
      refId: staff.id,
      displayName: staff.name,
      email: null,
      adminGrantSource: null,
    },
  };
}
