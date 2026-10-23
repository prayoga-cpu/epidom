/**
 * The verification email carries two ways to confirm an address: the link and
 * a 6-digit code typed on the "check your email" page (or the login page's
 * "email not verified" box). The code is there for when the link can't be
 * opened: Gmail turns links off in mail it files as spam, and someone who
 * signed up on a laptop may be reading the email on their phone.
 *
 * Better Auth's emailOTP plugin stores and checks the code. src/lib/auth.ts
 * makes it inside the link email's hook (`createVerificationOTP`, a
 * server-only call), so one email carries both. The plugin's own mailer is
 * never used.
 *
 * Shared by the server config and the client form, so no server imports here.
 */

/** Digits in the code. The form, the email and the plugin all read this. */
export const EMAIL_CODE_LENGTH = 6;

/**
 * Seconds the link and the code stay valid. Better Auth's own default for the
 * link is 3600; it is set explicitly so the two cannot drift apart. A resend
 * makes a new code, and only the newest one is accepted.
 */
export const EMAIL_VERIFICATION_EXPIRES_IN = 60 * 60;

/** Wrong guesses allowed per code before it is thrown away (plugin default is 3). */
export const EMAIL_CODE_ALLOWED_ATTEMPTS = 5;

/**
 * Every emailOTP endpoint except `/email-otp/verify-email`, which the form
 * calls. Left open, they would add sign-in and password reset by code, plus
 * a way to ask for codes that we never email (our `sendVerificationOTP`
 * refuses to send). Any of those is a new way into an account, so they
 * answer 404. Paths are relative to /api/auth, as Better Auth matches them.
 */
export const DISABLED_EMAIL_OTP_PATHS = [
  "/email-otp/send-verification-otp",
  "/email-otp/check-verification-otp",
  "/sign-in/email-otp",
  "/email-otp/request-password-reset",
  "/forget-password/email-otp",
  "/email-otp/reset-password",
  "/email-otp/request-email-change",
  "/email-otp/change-email",
];

/** Keeps the digits of what was typed or pasted ("123 456" → "123456"), up to the code length. */
export function normalizeEmailCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, EMAIL_CODE_LENGTH);
}
