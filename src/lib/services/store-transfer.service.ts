/**
 * Store ownership transfer — hands ONE store to a different account.
 *
 * Ownership of a store is `store.businessId === <caller's Business>.id`
 * (see verifyStoreOwnership), and every other store-scoped row references
 * storeId, so the handoff itself is a single `businessId` reassignment. What
 * makes it non-trivial is everything that silently rides on the Business
 * rather than the Store:
 *  - finance settings when `syncFinanceWithBusiness` is on (currency, tax,
 *    payment methods would flip to the new owner's defaults) — copied onto the
 *    store's own row first;
 *  - timezone / locale — a Business the recipient doesn't have yet is created
 *    with the old business's values so the store keeps its clock;
 *  - the old owner's identity inside the store (their OWNER StaffMember row,
 *    live staff PIN sessions) — stripped/ended so "fully removed" is true;
 *  - billing: Subscription hangs off the User, not the store, so it stays with
 *    whoever pays for it. Plan limits are only enforced when a store is
 *    CREATED, so a transferred store is grandfathered onto the new owner's plan
 *    (feature gates still apply to it as usual).
 * Storefront customer payments resolve their Connect account live via
 * store -> business -> user, so they follow the new owner (or fail closed)
 * with no extra handling here.
 *
 * The pending invite is a row in the shared `Verification` table — see
 * src/lib/store-transfer.ts for its scheme and why it's keyed by token.
 */
import { Prisma, PaymentMarket } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { ApiErrorCode } from "@/types/api/responses";
import { DEFAULT_ENABLED_PAYMENT_METHODS } from "@/config/payment-fees.config";
import { subscriptionService } from "./subscription.service";
import { sendStoreOwnershipTransferEmail } from "./email.service";
import {
  TRANSFER_IDENTIFIER_PREFIX,
  TRANSFER_TTL_MS,
  buildAcceptUrl,
  generateTransferToken,
  parseTransferValue,
  transferIdentifier,
  type StoreTransferValue,
} from "@/lib/store-transfer";

const INVALID_LINK = "This transfer link is invalid or has already been used.";

export interface TransferRecipient {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
}

/** A live (unexpired, well-formed) pending transfer for this store, if any. */
async function findPendingForStore(storeId: string) {
  const rows = await prisma.verification.findMany({
    where: {
      identifier: { startsWith: TRANSFER_IDENTIFIER_PREFIX },
      value: { contains: `"storeId":"${storeId}"` },
    },
  });
  const now = new Date();
  for (const row of rows) {
    const value = parseTransferValue(row.value);
    if (value?.storeId === storeId && row.expiresAt > now) return { row, value };
  }
  return null;
}

export async function getPendingTransfer(storeId: string) {
  const pending = await findPendingForStore(storeId);
  if (!pending) return null;
  return { toEmail: pending.value.toEmail, expiresAt: pending.row.expiresAt.toISOString() };
}

export async function cancelPendingTransfer(storeId: string): Promise<void> {
  // deleteMany over every row for this store, not just the live one — an
  // expired leftover shouldn't outlive an explicit cancel.
  await prisma.verification.deleteMany({
    where: {
      identifier: { startsWith: TRANSFER_IDENTIFIER_PREFIX },
      value: { contains: `"storeId":"${storeId}"` },
    },
  });
}

export async function startStoreTransfer(params: {
  storeId: string;
  toEmail: string;
  fromUser: { id: string; email: string | null; name: string | null };
}): Promise<{ toEmail: string }> {
  const { storeId, fromUser } = params;
  const toEmail = params.toEmail.trim().toLowerCase();

  if (fromUser.email && toEmail === fromUser.email.trim().toLowerCase()) {
    throw new AppError("You already own this store.", ApiErrorCode.INVALID_INPUT, 400);
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { name: true },
  });
  if (!store) {
    throw new AppError("Store not found", ApiErrorCode.NOT_FOUND, 404);
  }

  // A new invite replaces whatever was outstanding for this store rather than
  // stacking — an old, abandoned invite must not quietly stay acceptable with
  // a stale recipient.
  await cancelPendingTransfer(storeId);

  const token = generateTransferToken();
  const now = new Date();
  const value: StoreTransferValue = {
    storeId,
    toEmail,
    fromUserId: fromUser.id,
    storeName: store.name,
  };
  await prisma.verification.create({
    data: {
      identifier: transferIdentifier(token),
      value: JSON.stringify(value),
      expiresAt: new Date(now.getTime() + TRANSFER_TTL_MS),
      createdAt: now,
      updatedAt: now,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const sent = await sendStoreOwnershipTransferEmail(
    toEmail,
    store.name,
    fromUser.name,
    buildAcceptUrl(appUrl, token)
  );
  if (!sent.success) {
    // Nobody can act on a link they never received — don't leave it pending
    // (the owner would see "invite sent" for an email that never went out).
    await prisma.verification.deleteMany({ where: { identifier: transferIdentifier(token) } });
    throw new AppError(
      "We couldn't send the invitation email. Please try again.",
      ApiErrorCode.INTERNAL_ERROR,
      502
    );
  }

  return { toEmail };
}

/** Loads + validates the invite behind a token. Never mutates (except purging
 * an expired row so it can't be probed forever). */
async function loadInvite(token: string) {
  const row = await prisma.verification.findFirst({
    where: { identifier: transferIdentifier(token) },
  });
  const value = row ? parseTransferValue(row.value) : null;
  if (!row || !value) {
    throw new AppError(INVALID_LINK, ApiErrorCode.NOT_FOUND, 404);
  }
  if (row.expiresAt <= new Date()) {
    await prisma.verification.deleteMany({ where: { id: row.id } });
    throw new AppError(
      "This transfer link has expired. Ask the current owner to send a new one.",
      ApiErrorCode.TOKEN_EXPIRED,
      410
    );
  }
  return { row, value };
}

/**
 * Public, read-only: what the accept page shows before anyone is signed in.
 * Holding the token IS the credential (it only ever went to the recipient's
 * inbox), so this deliberately needs no session.
 */
export async function lookupStoreTransfer(token: string) {
  const { row, value } = await loadInvite(token);

  const store = await prisma.store.findUnique({
    where: { id: value.storeId },
    select: { name: true, business: { select: { userId: true, timezone: true } } },
  });
  // Sender no longer owns it (already handed off some other way) — same
  // answer as a dead link, so a stale invite reveals nothing.
  if (!store || store.business.userId !== value.fromUserId) {
    throw new AppError(INVALID_LINK, ApiErrorCode.NOT_FOUND, 404);
  }

  const fromUser = await prisma.user.findUnique({
    where: { id: value.fromUserId },
    select: { name: true },
  });

  return {
    storeName: store.name,
    toEmail: value.toEmail,
    fromName: fromUser?.name ?? null,
    storeTimezone: store.business.timezone,
    expiresAt: row.expiresAt.toISOString(),
  };
}

export async function acceptStoreTransfer(params: {
  token: string;
  recipient: TransferRecipient;
}): Promise<{ storeId: string }> {
  const { token, recipient } = params;
  const { row, value } = await loadInvite(token);

  if (!recipient.emailVerified) {
    throw new AppError(
      "Verify your email address before accepting a store transfer.",
      ApiErrorCode.FORBIDDEN,
      403
    );
  }
  if (recipient.email.trim().toLowerCase() !== value.toEmail) {
    throw new AppError(
      "This transfer was sent to a different email address. Sign in with the address the invitation was sent to.",
      ApiErrorCode.FORBIDDEN,
      403
    );
  }
  if (recipient.id === value.fromUserId) {
    throw new AppError("You already own this store.", ApiErrorCode.INVALID_INPUT, 400);
  }

  // Same first-run provisioning onboarding does (PATCH /api/user/business):
  // billing lives on the User, so a brand-new recipient needs the FREE
  // subscription every other account has. Outside the transaction on purpose
  // (the service manages its own writes) and idempotent; if the transfer
  // below then fails, the recipient is left with a normal free account.
  const existingSubscription = await prisma.subscription.findUnique({
    where: { userId: recipient.id },
    select: { id: true },
  });
  if (!existingSubscription) {
    await subscriptionService.activateFree(recipient.id, "FREE");
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const store = await tx.store.findUnique({
          where: { id: value.storeId },
          include: { business: { select: { id: true, userId: true, timezone: true, locale: true } } },
        });
        // Re-checked INSIDE the transaction: the sender may have handed the
        // store off, or lost it, since the invite was created.
        if (!store || store.business.userId !== value.fromUserId) {
          throw new AppError(INVALID_LINK, ApiErrorCode.NOT_FOUND, 404);
        }

        // Single-use lock: exactly one concurrent accept can delete the row.
        const consumed = await tx.verification.deleteMany({ where: { id: row.id } });
        if (consumed.count !== 1) {
          throw new AppError(INVALID_LINK, ApiErrorCode.CONFLICT, 409);
        }

        let business = await tx.business.findUnique({ where: { userId: recipient.id } });
        if (!business) {
          business = await tx.business.create({
            data: {
              userId: recipient.id,
              name: store.name,
              email: recipient.email,
              // The store's operational clock (reports' day boundaries, the
              // midnight PIN-session expiry) is read from its Business, so a
              // fresh one inherits the old values instead of silently
              // resetting them to app defaults.
              timezone: store.business.timezone,
              locale: store.business.locale,
            },
          });
        }
        if (business.id === store.businessId) {
          throw new AppError("You already own this store.", ApiErrorCode.INVALID_INPUT, 400);
        }

        // Finance: a store synced to its Business's shared settings would flip
        // to the NEW business's (default) currency/tax/payment methods the
        // moment businessId changes. Materialize what it resolves to today
        // onto its own row and stop syncing, so it behaves identically after.
        if (store.syncFinanceWithBusiness) {
          const shared = await tx.businessFinanceSettings.findUnique({
            where: { businessId: store.businessId },
          });
          const data = {
            currency: shared?.currency ?? "IDR",
            market: shared?.market ?? PaymentMarket.INDONESIA,
            enabledPaymentMethods: shared?.enabledPaymentMethods ?? DEFAULT_ENABLED_PAYMENT_METHODS,
            taxEnabled: shared?.taxEnabled ?? false,
            taxRate: shared?.taxRate ?? 0,
            taxLabel: shared?.taxLabel ?? null,
            taxInclusive: shared?.taxInclusive ?? true,
            serviceChargeEnabled: shared?.serviceChargeEnabled ?? false,
            serviceChargeRate: shared?.serviceChargeRate ?? 0,
            processingFeeEnabled: shared?.processingFeeEnabled ?? true,
            processingFeeOverrides:
              shared?.processingFeeOverrides == null
                ? Prisma.JsonNull
                : (shared.processingFeeOverrides as Prisma.InputJsonValue),
          };
          await tx.storeFinanceSettings.upsert({
            where: { storeId: store.id },
            create: { storeId: store.id, ...data },
            update: data,
          });
        }

        await tx.store.update({
          where: { id: store.id },
          data: { businessId: business.id, syncFinanceWithBusiness: false },
        });

        // "Fully removed": the old owner's proxy StaffMember row is kept (past
        // orders/shifts reference it and this app never hard-deletes ledger
        // data) but stripped of identity, deactivated and demoted, and any
        // live PIN sessions on the store are ended.
        await tx.staffMember.updateMany({
          where: { storeId: store.id, role: "OWNER" },
          data: {
            role: "MANAGER",
            isActive: false,
            email: null,
            whatsapp: null,
            username: null,
            pin: null,
            allowedPages: [],
          },
        });
        await tx.staffSession.deleteMany({ where: { storeId: store.id } });

        await tx.staffMember.create({
          data: {
            storeId: store.id,
            name: recipient.name || "Owner",
            email: recipient.email,
            role: "OWNER",
            pin: null,
            isActive: true,
            inviteStatus: "accepted",
          },
        });

        // A new owner taking over a running store has nothing to onboard
        // (onboarding exists to create a FIRST store), and the wizard would
        // otherwise still be offered to them.
        await tx.user.update({ where: { id: recipient.id }, data: { hasOnboarded: true } });

        // Any leftover invite rows for this store are dead now.
        await tx.verification.deleteMany({
          where: {
            identifier: { startsWith: TRANSFER_IDENTIFIER_PREFIX },
            value: { contains: `"storeId":"${store.id}"` },
          },
        });

        return { storeId: store.id };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5000,
        timeout: 15000,
      }
    );
  } catch (error) {
    // A P2002 here would mean a unique constraint (e.g. a store-name rule on
    // the recipient's business) — surface it as a clean conflict, not a 500.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(
        "This store couldn't be moved because it conflicts with an existing record on your account.",
        ApiErrorCode.CONFLICT,
        409
      );
    }
    throw error;
  }
}
