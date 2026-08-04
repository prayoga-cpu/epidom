import { cookies } from "next/headers";
import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { resolveStaffAllowedPages } from "@/config/staff-permissions.config";
import { getNextMidnightUTC } from "@/lib/utils/timezone";

/**
 * Server-verified "this browser is currently operating as this staff
 * member" session — established when a staff PIN is verified (see
 * /api/stores/[id]/staff/verify-pin). Mirrors the HMAC-signed-cookie +
 * DB-row pattern better-auth's own Session uses (src/lib/auth.ts), so a
 * restricted staff persona can't be spoofed by editing client state the way
 * the old POS-only localStorage session could be.
 *
 * Sessions expire at the next local midnight (business timezone), not a
 * fixed duration — whoever is using a shared device must pick their account
 * and PIN again each day, however long their shift was.
 */

const STAFF_SESSION_COOKIE = "epidom-staff-session";

function getSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("[staff-session] No auth secret configured");
  return secret;
}

function sign(token: string): string {
  const signature = createHmac("sha256", getSecret()).update(token).digest("base64url");
  return `${token}.${signature}`;
}

function verify(signedValue: string): string | null {
  const parts = signedValue.split(".");
  if (parts.length !== 2) return null;
  const [token, signature] = parts;
  const expected = createHmac("sha256", getSecret()).update(token).digest("base64url");
  try {
    const sigBuffer = Buffer.from(signature, "base64url");
    const expectedBuffer = Buffer.from(expected, "base64url");
    if (sigBuffer.length === expectedBuffer.length && timingSafeEqual(sigBuffer, expectedBuffer)) {
      return token;
    }
  } catch {
    // Invalid base64 or comparison failed
  }
  return null;
}

export interface ActiveStaffSession {
  storeId: string;
  staffMemberId: string;
  name: string;
  role: string;
  allowedPages: string[];
}

export async function createStaffSession(storeId: string, staffMemberId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { business: { select: { timezone: true } } },
  });
  const expiresAt = getNextMidnightUTC(store?.business.timezone ?? "UTC");

  await prisma.staffSession.create({
    data: { storeId, staffMemberId, token, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(STAFF_SESSION_COOKIE, sign(token), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Reads and verifies the active staff session for the current browser, if any. */
export async function getActiveStaffSession(): Promise<ActiveStaffSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(STAFF_SESSION_COOKIE)?.value;
  if (!raw) return null;

  const token = verify(raw);
  if (!token) return null;

  const session = await prisma.staffSession.findUnique({
    where: { token },
    select: {
      storeId: true,
      expiresAt: true,
      staffMember: {
        select: { id: true, name: true, role: true, isActive: true, allowedPages: true },
      },
    },
  });

  if (!session || !session.staffMember.isActive || new Date() > session.expiresAt) {
    return null;
  }

  return {
    storeId: session.storeId,
    staffMemberId: session.staffMember.id,
    name: session.staffMember.name,
    role: session.staffMember.role,
    allowedPages: resolveStaffAllowedPages(session.staffMember.role, session.staffMember.allowedPages),
  };
}

/** Ends the active staff session (both the cookie and its DB row), if any. */
export async function clearStaffSession(): Promise<void> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(STAFF_SESSION_COOKIE)?.value;
  cookieStore.delete(STAFF_SESSION_COOKIE);

  const token = raw ? verify(raw) : null;
  if (token) {
    await prisma.staffSession.deleteMany({ where: { token } });
  }
}
