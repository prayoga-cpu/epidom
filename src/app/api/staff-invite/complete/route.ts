/**
 * POST /api/staff-invite/complete
 *
 * Claims a staff sign-in invite. Not wrapped in withApiHandler: an ABSENT
 * session is a normal, expected state here (the invited person may not have an
 * account yet), which that wrapper rejects outright. Two shapes:
 *
 *  - { token, password, name? }  — create a brand-new account for the invited
 *    email and link it. The link click was the email verification.
 *  - { token }                   — link the account the caller is ALREADY
 *    signed in as, only if its verified email is the invited one.
 *
 * This endpoint never mints a session. It creates/links; the client then signs
 * in with the normal Better Auth flow, exactly like the login form.
 *
 * Token in the body, IP rate-limited, and written to the audit trail by hand
 * (it doesn't pass through the wrapper that does that for other routes).
 */
import { NextResponse, after } from "next/server";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { getSession } from "@/lib/auth";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { staffInviteCompleteSchema } from "@/lib/validation/staff-invite.schemas";
import {
  claimStaffInviteWithNewAccount,
  claimStaffInviteWithSession,
  type ClaimFailure,
  type ClaimResult,
} from "@/lib/services/staff-invite.service";
import { buildRequestMeta } from "@/lib/audit/request-meta";
import { writeActivityEvent } from "@/lib/audit/activity";
import type { AuditActor } from "@/lib/audit/actor-scope";

export const dynamic = "force-dynamic";

const FAILURE_STATUS: Record<ClaimFailure, number> = {
  invalid: 404,
  expired: 410,
  consumed: 410,
  unavailable: 410,
  sign_in_required: 401,
  email_mismatch: 403,
  email_unverified: 403,
  account_exists: 409,
  already_linked: 409,
  linked_elsewhere: 409,
  own_store: 409,
};

const FAILURE_MESSAGE: Record<ClaimFailure, string> = {
  invalid: "This invite link is invalid.",
  expired: "This invite link has expired. Ask the store owner to send a new one.",
  consumed: "This invite link has already been used.",
  unavailable: "This invite is no longer valid. Ask the store owner to send a new one.",
  sign_in_required: "Sign in to link your account.",
  email_mismatch: "You're signed in with a different account than the one this invite was sent to.",
  email_unverified: "Verify your email address before linking your account.",
  account_exists: "An account already exists for this email. Sign in to link it.",
  already_linked: "This staff member already has a sign-in account.",
  linked_elsewhere: "This account is already linked to a staff profile at another store.",
  own_store: "You own this store — there's nothing to link.",
};

export async function POST(request: Request) {
  const meta = buildRequestMeta(request);
  try {
    const rateLimitResult = await rateLimitMiddleware(request, "/api/staff-invite/complete");
    if (rateLimitResult) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.RATE_LIMIT_EXCEEDED,
          `Rate limit exceeded. Please try again in ${rateLimitResult.reset} seconds.`
        ),
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": rateLimitResult.reset.toString(),
          },
        }
      );
    }

    const parsed = staffInviteCompleteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      // A bad password gets its own message; anything else is just "invalid".
      const passwordIssue = parsed.error.issues.find((i) => i.path[0] === "password");
      return NextResponse.json(
        createErrorResponse(
          passwordIssue ? ApiErrorCode.INVALID_INPUT : ApiErrorCode.NOT_FOUND,
          passwordIssue?.message ?? FAILURE_MESSAGE.invalid
        ),
        { status: passwordIssue ? 400 : 404 }
      );
    }
    const { token, password, name } = parsed.data;

    let result: ClaimResult;
    let actor: AuditActor = {
      kind: "PUBLIC",
      refId: null,
      displayName: null,
      email: null,
      adminGrantSource: null,
    };

    if (password) {
      result = await claimStaffInviteWithNewAccount({ token, password, name });
      if (result.ok) {
        actor = { kind: "USER", refId: result.userId, displayName: name ?? null, email: result.email, adminGrantSource: null };
      }
    } else {
      const session = await getSession();
      if (!session?.user?.id) {
        result = { ok: false, reason: "sign_in_required" };
      } else {
        actor = {
          kind: "USER",
          refId: session.user.id,
          displayName: session.user.name ?? null,
          email: session.user.email ?? null,
          adminGrantSource: null,
        };
        result = await claimStaffInviteWithSession({
          token,
          user: {
            id: session.user.id,
            email: session.user.email ?? "",
            emailVerified: Boolean(session.user.emailVerified),
          },
        });
      }
    }

    // Recorded by hand: this route can't use withApiHandler. A claim changes
    // who can access a store (CRITICAL by the audit map's own definition), and
    // a refused attempt to claim with the wrong account is exactly the signal
    // the trail exists to surface.
    const denied = !result.ok && (result.reason === "email_mismatch" || result.reason === "email_unverified");
    after(() =>
      writeActivityEvent({
        actor,
        meta,
        actionCode: "staff.invite.claim",
        severity: result.ok || denied ? "CRITICAL" : "NOTICE",
        outcome: result.ok ? "SUCCESS" : denied ? "DENIED" : "FAILED",
        statusCode: result.ok ? 200 : FAILURE_STATUS[result.reason],
        storeId: result.ok ? result.storeId : null,
        targetType: result.ok ? "StaffMember" : null,
        targetId: result.ok ? result.staffMemberId : null,
      })
    );

    if (!result.ok) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, FAILURE_MESSAGE[result.reason], {
          reason: result.reason,
          ...(result.maskedEmail ? { maskedEmail: result.maskedEmail } : {}),
        }),
        { status: FAILURE_STATUS[result.reason] }
      );
    }

    return NextResponse.json(
      createSuccessResponse({
        linked: true,
        // Only returned to whoever just set the password for it, so the client
        // can sign in. (The token holder already receives this inbox's mail.)
        ...(password ? { email: result.email } : {}),
      })
    );
  } catch (error) {
    return handleApiError(error, { endpoint: "/api/staff-invite/complete", context: {} });
  }
}
