import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The token in a newsletter's unsubscribe link: the address plus an HMAC of
 * it, so a link only ever unsubscribes the inbox it was sent to and nobody
 * can unsubscribe someone else by editing the URL. It never expires, since an
 * old newsletter's link must keep working.
 */

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("BETTER_AUTH_SECRET is not set");
  return "dev-newsletter-unsubscribe-secret";
}

function signature(email: string): string {
  return createHmac("sha256", secret())
    .update(`newsletter-unsubscribe:${email}`)
    .digest("base64url")
    .slice(0, 32);
}

export function createUnsubscribeToken(email: string): string {
  const normalized = email.trim().toLowerCase();
  return `${Buffer.from(normalized).toString("base64url")}.${signature(normalized)}`;
}

/** The address a token was made for, or null when it was tampered with. */
export function verifyUnsubscribeToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const [encoded, given] = token.split(".");
  if (!encoded || !given) return null;
  const email = Buffer.from(encoded, "base64url").toString("utf8");
  if (!email.includes("@")) return null;
  const expected = Buffer.from(signature(email));
  const actual = Buffer.from(given);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return email;
}

/**
 * Where the links point. In production the apex (epidom.fr) is a Vercel
 * domain redirect (308) to www.epidom.fr, and a mail app's one-click
 * unsubscribe POST isn't guaranteed to follow a redirect, so production
 * links go straight to the host that serves. Other hosts are kept as they are.
 */
function appUrl(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return base === "https://epidom.fr" ? "https://www.epidom.fr" : base;
}

/** The page a reader lands on from the footer link (asks before unsubscribing). */
export function unsubscribePageUrl(email: string, locale: string): string {
  return `${appUrl()}/newsletter/unsubscribe?t=${createUnsubscribeToken(email)}&l=${locale}`;
}

/** RFC 8058 one-click target for the List-Unsubscribe header (POST only). */
export function oneClickUnsubscribeUrl(email: string): string {
  return `${appUrl()}/api/public/newsletter/unsubscribe?t=${createUnsubscribeToken(email)}`;
}
