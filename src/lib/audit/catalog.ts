import { z } from "zod";
import { defineAction, type AnyActionDefinition } from "./catalog-types";

/**
 * The Layer 2 action catalogue.
 *
 * Every entry is a business action an operator would recognise, not a database
 * write. The unit matters: "reset this account" is one reversible thing, even
 * though it is four `deleteMany` calls in a transaction.
 *
 * Keys are the `ActionLog.actionType` values. They are Strings in the schema
 * rather than a Postgres enum on purpose — `ALTER TYPE ADD VALUE` cannot run in
 * the same transaction that inserts the new value, and `prisma migrate deploy`
 * is the first step of the Vercel build, so an enum would force two deploys for
 * every action added here.
 */

// Money is stored as a string and rebuilt with new Decimal(...). A JSON number
// would silently round a Decimal(14,6) — the exact failure this table exists to
// make visible, so it must not be introduced by the recorder itself.
const decimalString = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, "Decimal must be serialized as a plain numeric string");

const planEnum = z.enum(["FREE", "POS", "OPERATIONS", "ENTERPRISE"]);
const statusEnum = z.enum(["ACTIVE", "CANCELED", "PAST_DUE", "INCOMPLETE"]);

/** Shared shape for the admin actions, all of which target one user. */
const userTarget = {
  userId: z.string(),
  userEmail: z.string(),
  userName: z.string().optional(),
};

export const ACTION_CATALOG = {
  // ============================================================ admin: plan
  "admin.user.set_plan": defineAction({
    category: "admin",
    severity: "CRITICAL",
    reversibility: "REVERSIBLE",
    targetType: "Subscription",
    payload: z.object({
      ...userTarget,
      before: z.object({ plan: planEnum, status: statusEnum }).nullable(),
      after: z.object({ plan: planEnum, status: statusEnum }),
    }),
    label: (p) =>
      `Set ${p.userEmail} to ${p.after.plan}/${p.after.status}` +
      (p.before ? ` (was ${p.before.plan}/${p.before.status})` : " (no prior subscription)"),
    subjects: (p) => [p.userId],
    roundTrip: (p) => {
      if (p.after.plan !== planEnum.parse(p.after.plan)) throw new Error("plan round-trip failed");
    },
    precheck: async ({ payload, db }) => {
      const current = await db.subscription.findUnique({
        where: { userId: payload.userId },
        select: { plan: true, status: true },
      });
      // No prior subscription means the forward action created one. Reverting
      // would have to delete it, which is not what "undo a plan change" means —
      // the caller should cancel instead.
      if (!payload.before) {
        return {
          code: "NOT_REVERSIBLE",
          message:
            "This action created the subscription rather than changing it. Cancel the subscription instead of reverting.",
        };
      }
      if (!current) {
        return { code: "TARGET_MISSING", message: "The subscription no longer exists." };
      }
      if (current.plan !== payload.after.plan || current.status !== payload.after.status) {
        return {
          code: "SUPERSEDED",
          message: `The subscription is now ${current.plan}/${current.status}, not the ${payload.after.plan}/${payload.after.status} this action set. A newer change would be silently overwritten.`,
        };
      }
      return null;
    },
    reverse: async ({ payload, tx }) => {
      if (!payload.before) throw new Error("no before-image to restore");
      await tx.subscription.update({
        where: { userId: payload.userId },
        data: { plan: payload.before.plan, status: payload.before.status },
      });
    },
  }),

  "admin.user.set_period": defineAction({
    category: "admin",
    severity: "CRITICAL",
    reversibility: "REVERSIBLE",
    targetType: "Subscription",
    payload: z.object({
      ...userTarget,
      before: z
        .object({
          status: statusEnum,
          currentPeriodStart: z.string(),
          currentPeriodEnd: z.string(),
        })
        .nullable(),
      after: z.object({
        status: statusEnum,
        currentPeriodStart: z.string(),
        currentPeriodEnd: z.string(),
      }),
      lifetime: z.boolean().optional(),
      months: z.number().int().optional(),
    }),
    label: (p) =>
      `Set ${p.userEmail} billing period to ${p.lifetime ? "lifetime" : `${p.months ?? "?"} months`}`,
    subjects: (p) => [p.userId],
    roundTrip: (p) => {
      if (Number.isNaN(Date.parse(p.after.currentPeriodEnd))) {
        throw new Error("period round-trip failed: currentPeriodEnd is not an ISO date");
      }
    },
    precheck: async ({ payload, db }) => {
      if (!payload.before) {
        return {
          code: "NOT_REVERSIBLE",
          message: "This action created the subscription. Cancel it instead of reverting.",
        };
      }
      const current = await db.subscription.findUnique({
        where: { userId: payload.userId },
        select: { currentPeriodEnd: true },
      });
      if (!current) return { code: "TARGET_MISSING", message: "The subscription no longer exists." };
      // currentPeriodEnd is nullable: a subscription created outside the admin
      // flow may never have had one set. A null here means the period this
      // action wrote is gone, which is the same hazard as a changed value.
      if ((current.currentPeriodEnd?.toISOString() ?? null) !== payload.after.currentPeriodEnd) {
        return {
          code: "SUPERSEDED",
          message: "The billing period has changed since this action. Reverting would undo that newer change.",
        };
      }
      return null;
    },
    reverse: async ({ payload, tx }) => {
      if (!payload.before) throw new Error("no before-image to restore");
      await tx.subscription.update({
        where: { userId: payload.userId },
        data: {
          status: payload.before.status,
          currentPeriodStart: new Date(payload.before.currentPeriodStart),
          currentPeriodEnd: new Date(payload.before.currentPeriodEnd),
        },
      });
    },
  }),

  // =================================================== admin: custom pricing
  // Both custom-price actions touch Stripe. The database side reverses cleanly;
  // the Stripe side does not, because setCustomPrice cancels the live
  // subscription with prorate: false and a cancellation cannot be un-cancelled.
  "admin.user.set_custom_price": defineAction({
    category: "admin",
    severity: "CRITICAL",
    reversibility: "REVERSIBLE_WITH_CAVEAT",
    targetType: "Subscription",
    caveat:
      "Reverting restores the previous custom price in Epidom, but cannot restore the Stripe subscription this action cancelled. The customer will need to check out again.",
    payload: z.object({
      ...userTarget,
      before: z
        .object({
          amount: decimalString.nullable(),
          currency: z.string().nullable(),
          interval: z.string().nullable(),
          plan: planEnum.nullable(),
        })
        .nullable(),
      after: z.object({
        amount: decimalString,
        currency: z.string(),
        interval: z.string(),
        plan: planEnum,
      }),
      stripeSubscriptionCancelled: z.boolean().default(false),
    }),
    label: (p) => `Set custom price ${p.after.amount} ${p.after.currency} for ${p.userEmail}`,
    subjects: (p) => [p.userId],
    roundTrip: (p) => {
      // The whole point of storing money as a string: this must survive JSON
      // without becoming 19.989999999999998.
      if (!/^-?\d+(\.\d+)?$/.test(p.after.amount)) {
        throw new Error("custom price round-trip failed: amount is not a plain decimal string");
      }
    },
    precheck: async ({ payload, db }) => {
      const current = await db.subscription.findUnique({
        where: { userId: payload.userId },
        select: { customPriceAmount: true },
      });
      if (!current) return { code: "TARGET_MISSING", message: "The subscription no longer exists." };
      const currentAmount = current.customPriceAmount?.toString() ?? null;
      if (currentAmount !== payload.after.amount) {
        return {
          code: "SUPERSEDED",
          message: `The custom price is now ${currentAmount ?? "unset"}, not ${payload.after.amount}. A newer change would be overwritten.`,
        };
      }
      return null;
    },
    reverse: async ({ payload, tx }) => {
      const before = payload.before;
      await tx.subscription.update({
        where: { userId: payload.userId },
        data: {
          customPriceAmount: before?.amount ?? null,
          customPriceCurrency: before?.currency ?? null,
          customPriceInterval: (before?.interval as any) ?? null,
          customPricePlan: (before?.plan as any) ?? null,
        },
      });
    },
  }),

  "admin.user.clear_custom_price": defineAction({
    category: "admin",
    severity: "CRITICAL",
    reversibility: "REVERSIBLE_WITH_CAVEAT",
    targetType: "Subscription",
    caveat:
      "Reverting restores the custom price record, but the Stripe subscription item was already rewritten to the catalog price and is not changed back.",
    payload: z.object({
      ...userTarget,
      before: z.object({
        amount: decimalString,
        currency: z.string(),
        interval: z.string(),
        plan: planEnum,
      }),
    }),
    label: (p) => `Cleared custom price (${p.before.amount} ${p.before.currency}) for ${p.userEmail}`,
    subjects: (p) => [p.userId],
    roundTrip: (p) => {
      if (!/^-?\d+(\.\d+)?$/.test(p.before.amount)) {
        throw new Error("clear custom price round-trip failed");
      }
    },
    reverse: async ({ payload, tx }) => {
      await tx.subscription.update({
        where: { userId: payload.userId },
        data: {
          customPriceAmount: payload.before.amount,
          customPriceCurrency: payload.before.currency,
          customPriceInterval: payload.before.interval as any,
          customPricePlan: payload.before.plan as any,
        },
      });
    },
  }),

  // ========================================================== admin: access
  "admin.user.set_admin": defineAction({
    category: "admin",
    severity: "CRITICAL",
    reversibility: "REVERSIBLE",
    targetType: "User",
    payload: z.object({
      ...userTarget,
      before: z.boolean(),
      after: z.boolean(),
    }),
    label: (p) => `${p.after ? "Granted" : "Revoked"} admin for ${p.userEmail}`,
    subjects: (p) => [p.userId],
    roundTrip: (p) => {
      if (typeof p.before !== "boolean") throw new Error("set_admin round-trip failed");
    },
    precheck: async ({ payload, db }) => {
      const user = await db.user.findUnique({
        where: { id: payload.userId },
        select: { isAdmin: true },
      });
      if (!user) return { code: "TARGET_MISSING", message: "That user no longer exists." };
      if (user.isAdmin !== payload.after) {
        return {
          code: "SUPERSEDED",
          message: "Admin status has changed since this action. Reverting would undo the newer change.",
        };
      }
      return null;
    },
    reverse: async ({ payload, tx }) => {
      await tx.user.update({
        where: { id: payload.userId },
        data: { isAdmin: payload.before },
      });
    },
  }),

  // Credential overwrites. The previous password hash is deliberately never
  // captured — storing it would put a reversible credential in a table designed
  // to outlive the account. So "revert" means: undo the side effects that were
  // not the password itself, and force re-authentication everywhere.
  "admin.user.reset_password": defineAction({
    category: "admin",
    severity: "CRITICAL",
    reversibility: "REVERSIBLE_WITH_CAVEAT",
    targetType: "User",
    caveat:
      "The previous password is never stored, so it cannot be restored. Reverting revokes every session, undoes the forced email verification, and removes the credential row if this action created one — the user must then use 'forgot password'.",
    payload: z.object({
      ...userTarget,
      credentialExisted: z.boolean(),
      emailVerifiedBefore: z.boolean(),
    }),
    label: (p) => `Reset password for ${p.userEmail}`,
    subjects: (p) => [p.userId],
    maxReversalAgeDays: 7,
    roundTrip: (p) => {
      if (typeof p.credentialExisted !== "boolean") throw new Error("reset_password round-trip failed");
    },
    reverse: async ({ payload, tx }) => {
      // Revoking sessions is the part that actually matters: it ends any
      // session the new password was used to open.
      await tx.session.deleteMany({ where: { userId: payload.userId } });
      if (!payload.credentialExisted) {
        await tx.account.deleteMany({
          where: { userId: payload.userId, providerId: "credential" },
        });
      }
      if (!payload.emailVerifiedBefore) {
        await tx.user.update({
          where: { id: payload.userId },
          data: { emailVerified: false },
        });
      }
    },
  }),

  "admin.user.temp_password": defineAction({
    category: "admin",
    severity: "CRITICAL",
    reversibility: "REVERSIBLE_WITH_CAVEAT",
    targetType: "User",
    caveat:
      "The generated password was shown once and never stored. Reverting revokes every session and undoes the forced email verification.",
    payload: z.object({
      ...userTarget,
      credentialExisted: z.boolean(),
      emailVerifiedBefore: z.boolean(),
    }),
    label: (p) => `Issued a temporary password for ${p.userEmail}`,
    subjects: (p) => [p.userId],
    maxReversalAgeDays: 7,
    roundTrip: (p) => {
      if (typeof p.emailVerifiedBefore !== "boolean") throw new Error("temp_password round-trip failed");
    },
    reverse: async ({ payload, tx }) => {
      await tx.session.deleteMany({ where: { userId: payload.userId } });
      if (!payload.credentialExisted) {
        await tx.account.deleteMany({
          where: { userId: payload.userId, providerId: "credential" },
        });
      }
      if (!payload.emailVerifiedBefore) {
        await tx.user.update({ where: { id: payload.userId }, data: { emailVerified: false } });
      }
    },
  }),

  // ================================================ admin: cascade roots
  // These two are the highest-risk actions in the product and the reason the
  // snapshot tier exists. A hand-written inverse is impossible: the delete
  // cascades across 56 FK edges inside Postgres, where Prisma never sees it.
  "admin.user.delete": defineAction({
    category: "admin",
    severity: "CRITICAL",
    reversibility: "SNAPSHOT_RESTORE",
    snapshotRoot: "User",
    targetType: "User",
    maxReversalAgeDays: 90,
    payload: z.object({
      ...userTarget,
      snapshotId: z.string().nullable(),
      rowCount: z.number().int().default(0),
    }),
    label: (p) => `Deleted account ${p.userEmail}`,
    subjects: (p) => [p.userId],
  }),

  "admin.user.reset_account": defineAction({
    category: "admin",
    severity: "CRITICAL",
    reversibility: "SNAPSHOT_RESTORE",
    snapshotRoot: "Business",
    targetType: "Business",
    maxReversalAgeDays: 90,
    payload: z.object({
      ...userTarget,
      snapshotId: z.string().nullable(),
      rowCount: z.number().int().default(0),
    }),
    label: (p) => `Reset all business data for ${p.userEmail}`,
    subjects: (p) => [p.userId],
  }),

  "admin.user.reactivate": defineAction({
    category: "admin",
    severity: "CRITICAL",
    reversibility: "REVERSIBLE",
    targetType: "User",
    payload: z.object({
      ...userTarget,
      before: z.object({
        deactivatedAt: z.string().nullable(),
        purgeAt: z.string().nullable(),
      }),
    }),
    label: (p) => `Reactivated account ${p.userEmail}`,
    subjects: (p) => [p.userId],
    roundTrip: (p) => {
      if (p.before.deactivatedAt && Number.isNaN(Date.parse(p.before.deactivatedAt))) {
        throw new Error("reactivate round-trip failed: deactivatedAt is not an ISO date");
      }
    },
    reverse: async ({ payload, tx }) => {
      await tx.user.update({
        where: { id: payload.userId },
        data: {
          deactivatedAt: payload.before.deactivatedAt ? new Date(payload.before.deactivatedAt) : null,
          purgeAt: payload.before.purgeAt ? new Date(payload.before.purgeAt) : null,
        },
      });
    },
  }),

  "admin.seed_demo": defineAction({
    category: "admin",
    severity: "CRITICAL",
    reversibility: "IRREVERSIBLE",
    rationale:
      "Seeding overwrites an existing account's data in place with generated content. The original was not captured, so there is nothing to restore.",
    targetType: "Store",
    payload: z.object({ storeId: z.string().nullable(), userEmail: z.string().optional() }),
    label: (p) => `Seeded demo data${p.userEmail ? ` for ${p.userEmail}` : ""}`,
  }),

  // ======================================================== triage / support
  "admin.feedback.triage": defineAction({
    category: "support",
    severity: "INFO",
    reversibility: "REVERSIBLE",
    targetType: "Feedback",
    payload: z.object({
      feedbackId: z.string(),
      before: z.object({
        status: z.string(),
        priority: z.string(),
        devNote: z.string().nullable(),
      }),
      after: z.object({
        status: z.string().optional(),
        priority: z.string().optional(),
        devNote: z.string().nullable().optional(),
      }),
    }),
    label: (p) =>
      `Triaged feedback ${p.feedbackId.slice(0, 8)}` +
      (p.after.status ? ` -> ${p.after.status}` : "") +
      (p.after.priority ? ` (${p.after.priority})` : ""),
    roundTrip: (p) => {
      if (!p.before.status) throw new Error("feedback triage round-trip failed");
    },
    precheck: async ({ payload, db }) => {
      const row = await db.feedback.findUnique({
        where: { id: payload.feedbackId },
        select: { status: true },
      });
      if (!row) return { code: "TARGET_MISSING", message: "That feedback entry no longer exists." };
      return null;
    },
    reverse: async ({ payload, tx }) => {
      await tx.feedback.update({
        where: { id: payload.feedbackId },
        data: {
          status: payload.before.status as any,
          priority: payload.before.priority as any,
          devNote: payload.before.devNote,
        },
      });
    },
  }),

  "admin.custom_development.triage": defineAction({
    category: "support",
    severity: "INFO",
    reversibility: "REVERSIBLE",
    targetType: "CustomDevelopmentRequest",
    payload: z.object({
      requestId: z.string(),
      before: z.object({
        status: z.string(),
        devNote: z.string().nullable(),
      }),
      after: z.object({
        status: z.string().optional(),
        devNote: z.string().nullable().optional(),
      }),
    }),
    label: (p) =>
      `Triaged custom development request ${p.requestId.slice(0, 8)}` +
      (p.after.status ? ` -> ${p.after.status}` : ""),
    roundTrip: (p) => {
      if (!p.before.status) throw new Error("custom development triage round-trip failed");
    },
    precheck: async ({ payload, db }) => {
      const row = await db.customDevelopmentRequest.findUnique({
        where: { id: payload.requestId },
        select: { status: true },
      });
      if (!row) {
        return { code: "TARGET_MISSING", message: "That request no longer exists." };
      }
      return null;
    },
    reverse: async ({ payload, tx }) => {
      await tx.customDevelopmentRequest.update({
        where: { id: payload.requestId },
        data: {
          status: payload.before.status as any,
          devNote: payload.before.devNote,
        },
      });
    },
  }),

  // ===================================================== store domain: stock
  // Stock is COMPENSATE_ONLY across the board. reverseStockForOrder is
  // deliberately asymmetric — it clamps restoration to what balanceAfter proves
  // left, and writes off raw materials unless the caller asserts the food was
  // never made. Inverting a movement row directly would desynchronise
  // currentStock from the ledger, which is the exact corruption this feature
  // exists to detect.
  "stock.adjust": defineAction({
    category: "inventory",
    severity: "CRITICAL",
    reversibility: "COMPENSATE_ONLY",
    compensation:
      "Stock is a ledger. Reverting a movement row would leave currentStock disagreeing with the sum of movements. Post a compensating adjustment instead, so both the mistake and the correction stay visible.",
    remedyHref: (p: { storeId: string }) => `/store/${p.storeId}/management`,
    targetType: "StockMovement",
    payload: z.object({
      storeId: z.string(),
      itemType: z.enum(["PRODUCT", "MATERIAL"]),
      itemId: z.string(),
      itemName: z.string(),
      quantityDelta: decimalString,
      balanceAfter: decimalString.nullable(),
      reason: z.string().nullable(),
    }),
    label: (p) => `Adjusted ${p.itemName} by ${p.quantityDelta}`,
  }),

  "waste.delete": defineAction({
    category: "inventory",
    severity: "CRITICAL",
    reversibility: "COMPENSATE_ONLY",
    compensation:
      "Deleting a waste entry already reversed its stock movement. Re-creating the entry is the correct remedy; reverting the deletion would double-count the stock.",
    remedyHref: (p: { storeId: string }) => `/store/${p.storeId}/management`,
    targetType: "WasteEntry",
    payload: z.object({
      storeId: z.string(),
      wasteId: z.string(),
      itemName: z.string(),
      quantity: decimalString,
      reason: z.string(),
    }),
    label: (p) => `Deleted waste entry for ${p.itemName}`,
  }),

  "pos.order.refund": defineAction({
    category: "pos",
    severity: "CRITICAL",
    reversibility: "COMPENSATE_ONLY",
    compensation:
      "A refund is a financial record, and the money has already moved at the payment provider. Issue a correcting transaction rather than erasing the record.",
    targetType: "Order",
    payload: z.object({
      storeId: z.string(),
      orderId: z.string(),
      orderNumber: z.string(),
      amount: decimalString,
      reason: z.string().nullable(),
    }),
    label: (p) => `Refunded ${p.amount} on order ${p.orderNumber}`,
  }),

  "store.delete": defineAction({
    category: "store",
    severity: "CRITICAL",
    reversibility: "SNAPSHOT_RESTORE",
    snapshotRoot: "Store",
    targetType: "Store",
    maxReversalAgeDays: 90,
    payload: z.object({
      storeId: z.string(),
      storeName: z.string(),
      snapshotId: z.string().nullable(),
      rowCount: z.number().int().default(0),
    }),
    label: (p) => `Deleted store ${p.storeName}`,
  }),
} satisfies Record<string, AnyActionDefinition>;

export type ActionType = keyof typeof ACTION_CATALOG;

export function getActionDefinition(actionType: string): AnyActionDefinition | undefined {
  return (ACTION_CATALOG as Record<string, AnyActionDefinition>)[actionType];
}

export const ACTION_TYPES = Object.keys(ACTION_CATALOG) as ActionType[];
