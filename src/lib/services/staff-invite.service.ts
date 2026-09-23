/**
 * Staff sign-in invites — letting a StaffMember claim (or create) their own
 * Epidom login, linked to their StaffMember row via StaffMember.userId.
 *
 * The trust model, because this is where a mistake would be an account
 * takeover rather than a bug:
 *  - The emailed token is a bearer credential for ONE staff row, delivered to
 *    ONE mailbox (StaffInvite.email, a snapshot taken at send time).
 *  - Holding the token is enough to CREATE a brand-new account for that exact
 *    email (the link click is itself the email verification — nobody else can
 *    have received it).
 *  - Holding the token is NOT enough to link an account that ALREADY exists:
 *    an authenticated session proves who someone is, not that they control
 *    this mailbox, so the session's VERIFIED email must equal the invite's
 *    email or the claim is refused. Without that check, anyone signed in to
 *    any account who obtained a link meant for someone else could link
 *    themselves as that staffer.
 *  - Single use is enforced by an atomic `consumedAt IS NULL` update inside the
 *    same transaction that links the row, not by a read-then-write.
 *  - Every fact that can change between sending and claiming is re-checked at
 *    claim time (staffer deactivated, made the owner row, email edited, already
 *    linked, account created in the meantime) rather than trusted from the
 *    earlier page load.
 */
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  emailsMatch,
  maskEmail,
  staffInviteState,
  type StaffInviteState,
} from "@/lib/staff-invite";

/** Why a claim can't proceed. The route maps these to HTTP statuses. */
export type ClaimFailure =
  // The link itself
  | "invalid"
  | "expired"
  | "consumed"
  // The staff row it points at is no longer claimable
  | "unavailable"
  // The claimant
  | "email_mismatch"
  | "email_unverified"
  | "account_exists"
  | "already_linked"
  | "linked_elsewhere"
  | "own_store"
  | "sign_in_required";

export type ClaimResult =
  | { ok: true; email: string; userId: string; staffMemberId: string; storeId: string }
  | { ok: false; reason: ClaimFailure; maskedEmail?: string };

export type LookupResult =
  | { state: Exclude<StaffInviteState, "valid"> | "unavailable" }
  | {
      state: "valid";
      staffName: string;
      storeName: string;
      /** Masked — the link holder can confirm it's their mailbox, not read someone else's. */
      maskedEmail: string;
      hasExistingAccount: boolean;
    };

type LoadedInvite = NonNullable<Awaited<ReturnType<typeof loadInvite>>>;

async function loadInvite(token: string) {
  return prisma.staffInvite.findUnique({
    where: { token },
    include: {
      staffMember: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          userId: true,
        },
      },
      store: { select: { id: true, name: true } },
    },
  });
}

/** The invite, or the reason it can't be claimed right now. */
async function loadClaimable(
  token: string
): Promise<{ ok: true; invite: LoadedInvite } | { ok: false; reason: ClaimFailure }> {
  const invite = await loadInvite(token);

  const state = staffInviteState(invite);
  if (state === "not_found") return { ok: false, reason: "invalid" };
  if (state !== "valid" || !invite) return { ok: false, reason: state === "expired" ? "expired" : "consumed" };

  const member = invite.staffMember;
  if (member.userId) return { ok: false, reason: "already_linked" };

  // The row may have changed since the email went out. An owner who edits the
  // email usually does so because it was WRONG — the old mailbox's link must
  // not keep working — and the owner row / a deactivated member are never
  // claimable at all.
  if (
    !member.isActive ||
    member.role === "OWNER" ||
    !member.email ||
    !emailsMatch(member.email, invite.email)
  ) {
    return { ok: false, reason: "unavailable" };
  }

  return { ok: true, invite };
}

async function findUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
}

/** What the claim page shows before anyone has done anything. */
export async function lookupStaffInvite(token: string): Promise<LookupResult> {
  const loaded = await loadClaimable(token);
  if (!loaded.ok) {
    const map: Record<string, LookupResult["state"]> = {
      invalid: "not_found",
      expired: "expired",
      consumed: "consumed",
      already_linked: "consumed",
      unavailable: "unavailable",
    };
    return { state: map[loaded.reason] ?? "unavailable" } as LookupResult;
  }

  const { invite } = loaded;
  const existing = await findUserByEmail(invite.email);
  return {
    state: "valid",
    staffName: invite.staffMember.name,
    storeName: invite.store.name,
    maskedEmail: maskEmail(invite.email),
    hasExistingAccount: !!existing,
  };
}

class ClaimRaceError extends Error {}

/** Atomically spend the invite AND link the account, or do neither. */
async function consumeAndLink(params: {
  inviteId: string;
  staffMemberId: string;
  userId: string;
  /** A brand-new account created by this claim (vs. an existing one being linked). */
  isNewAccount?: boolean;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // `consumedAt: null` in the WHERE is the single-use guarantee: two
    // concurrent claims of the same token cannot both see count === 1.
    const spent = await tx.staffInvite.updateMany({
      where: { id: params.inviteId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (spent.count !== 1) throw new ClaimRaceError("invite already used");

    if (params.isNewAccount) {
      // The click on an emailed link IS the verification for a brand-new
      // account — and this account isn't an owner, so it skips merchant
      // onboarding (same as a transferred-store recipient).
      await tx.user.update({
        where: { id: params.userId },
        data: { emailVerified: true, hasOnboarded: true },
      });
    }

    const linked = await tx.staffMember.updateMany({
      where: { id: params.staffMemberId, userId: null },
      data: { userId: params.userId, userLinkedAt: new Date() },
    });
    if (linked.count !== 1) throw new ClaimRaceError("staff member already linked");
  });
}

/**
 * The invited email has no account yet: create one with the password the
 * person just chose, verified by virtue of having received the link.
 */
export async function claimStaffInviteWithNewAccount(params: {
  token: string;
  password: string;
  name?: string;
}): Promise<ClaimResult> {
  const loaded = await loadClaimable(params.token);
  if (!loaded.ok) return loaded;
  const { invite } = loaded;

  // Re-checked NOW, not trusted from the page load: an account for this email
  // may have appeared since (ordinary registration, or an earlier claim).
  if (await findUserByEmail(invite.email)) {
    return { ok: false, reason: "account_exists", maskedEmail: maskEmail(invite.email) };
  }

  // Better Auth's own server API — never a hand-rolled hash written into
  // Account.password (that column uses Better Auth's format, not the bcrypt
  // used for staff PINs). It also fires Better Auth's own verification email,
  // which is redundant here and harmless.
  let userId: string;
  try {
    const created = await auth.api.signUpEmail({
      body: {
        email: invite.email,
        password: params.password,
        name: params.name?.trim() || invite.staffMember.name,
      },
      headers: await headers(),
    });
    userId = created.user.id;
  } catch (error) {
    // Lost a race to another claim/registration, or a policy rejection.
    if (await findUserByEmail(invite.email)) {
      return { ok: false, reason: "account_exists", maskedEmail: maskEmail(invite.email) };
    }
    throw error;
  }

  try {
    await consumeAndLink({
      inviteId: invite.id,
      staffMemberId: invite.staffMember.id,
      userId,
      isNewAccount: true,
    });
  } catch (error) {
    if (error instanceof ClaimRaceError) return { ok: false, reason: "consumed" };
    throw error;
  }

  return {
    ok: true,
    email: invite.email,
    userId,
    staffMemberId: invite.staffMember.id,
    storeId: invite.storeId,
  };
}

/**
 * The invited email already has an account: link THAT account, but only if the
 * caller is signed in as it. See the trust model at the top of this file.
 */
export async function claimStaffInviteWithSession(params: {
  token: string;
  user: { id: string; email: string; emailVerified: boolean };
}): Promise<ClaimResult> {
  const loaded = await loadClaimable(params.token);
  if (!loaded.ok) return loaded;
  const { invite } = loaded;

  if (!emailsMatch(params.user.email, invite.email)) {
    return { ok: false, reason: "email_mismatch", maskedEmail: maskEmail(invite.email) };
  }
  // A session for an unverified address shouldn't exist (sign-in requires
  // verification), but "shouldn't" is not a check.
  if (!params.user.emailVerified) {
    return { ok: false, reason: "email_unverified" };
  }

  // Linking yourself as staff at a store you already own is meaningless and
  // would leave a confusing second identity on it.
  const store = await prisma.store.findUnique({
    where: { id: invite.storeId },
    select: { business: { select: { userId: true } } },
  });
  if (store?.business.userId === params.user.id) {
    return { ok: false, reason: "own_store" };
  }

  // One linked staff identity per account for now (StaffMember.userId is
  // @unique). Checked first for a clear message; the constraint below is the
  // backstop for the race.
  const elsewhere = await prisma.staffMember.findFirst({
    where: { userId: params.user.id },
    select: { id: true },
  });
  if (elsewhere) return { ok: false, reason: "linked_elsewhere" };

  try {
    await consumeAndLink({
      inviteId: invite.id,
      staffMemberId: invite.staffMember.id,
      userId: params.user.id,
    });
  } catch (error) {
    if (error instanceof ClaimRaceError) return { ok: false, reason: "consumed" };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, reason: "linked_elsewhere" };
    }
    throw error;
  }

  return {
    ok: true,
    email: invite.email,
    userId: params.user.id,
    staffMemberId: invite.staffMember.id,
    storeId: invite.storeId,
  };
}
