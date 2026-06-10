/**
 * Email Service using Resend
 *
 * Handles all transactional emails for authentication:
 * - Email verification
 * - Password reset
 *
 * Setup instructions:
 * 1. Create account at https://resend.com
 * 2. Add your domain or use onboarding@resend.dev for testing
 * 3. Get API key and add to .env as RESEND_API_KEY
 * 4. Set EMAIL_FROM in .env (e.g., "EPIDOM <noreply@yourdomain.com>")
 */

import { Resend } from "resend";
import { logger } from "@/lib/logger";

// Lazy-initialized Resend client to avoid build errors when API key is not set
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

// Email configuration
const EMAIL_FROM = process.env.EMAIL_FROM || "EPIDOM <onboarding@resend.dev>";
const APP_NAME = "EPIDOM";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send verification email to new users
 */
export async function sendVerificationEmail(
  email: string,
  name: string | null,
  verificationUrl: string
): Promise<SendEmailResult> {
  // In development without API key, log to console
  if (!process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV === "development") {
      logger.debug("[DEV] Verification Email", {
        to: email,
        urlPreview: verificationUrl.slice(0, 60),
      });
    }
    return { success: true, messageId: "dev-mode" };
  }

  try {
    const resend = getResendClient()!;
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: `Verify your email for ${APP_NAME}`,
      html: generateVerificationEmailHtml(name, verificationUrl),
    });

    if (error) {
      logger.error("[Email] Failed to send verification email", { error });
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    logger.error("[Email] Verification email error", { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  name: string | null,
  resetUrl: string
): Promise<SendEmailResult> {
  // In development without API key, log to console
  if (!process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV === "development") {
      logger.debug("[DEV] Password Reset Email", {
        to: email,
        urlPreview: resetUrl.slice(0, 60),
      });
    }
    return { success: true, messageId: "dev-mode" };
  }

  try {
    const resend = getResendClient()!;
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: `Reset your password for ${APP_NAME}`,
      html: generatePasswordResetEmailHtml(name, resetUrl),
    });

    if (error) {
      logger.error("[Email] Failed to send password reset email", { error });
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    logger.error("[Email] Password reset email error", { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate HTML for verification email
 */
function generateVerificationEmailHtml(name: string | null, verificationUrl: string): string {
  const greeting = name ? `Hi ${name},` : "Hi,";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
  <div style="background-color: #444444; padding: 40px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 32px; letter-spacing: 2px; font-weight: 800;">${APP_NAME}</h1>
  </div>

  <div style="background: #ffffff; padding: 40px 35px; border: 1px solid #eeeeee; border-top: none; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
    <h2 style="color: #111111; margin-top: 0; font-size: 24px; font-weight: 700;">Verify your email address</h2>

    <p style="color: #555555; font-size: 16px;">${greeting}</p>

    <p style="color: #555555; font-size: 16px;">
      Thanks for signing up for <strong>${APP_NAME}</strong>. To complete your registration and secure your account, please verify your email address.
    </p>

    <div style="text-align: center; margin: 40px 0;">
      <a href="${verificationUrl}"
         style="background-color: #444444;
                color: #ffffff;
                padding: 16px 40px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 700;
                display: inline-block;
                text-transform: uppercase;
                letter-spacing: 1px;
                font-size: 14px;">
        Verify Email Address
      </a>
    </div>

    <p style="color: #888888; font-size: 13px; text-align: center;">
      If the button doesn't work, copy and paste this link into your browser:
    </p>
    <p style="color: #444444; font-size: 12px; word-break: break-all; text-align: center; background: #f5f5f5; padding: 10px; border-radius: 4px;">
      ${verificationUrl}
    </p>

    <hr style="border: none; border-top: 1px solid #eeeeee; margin: 40px 0;">

    <p style="color: #999999; font-size: 12px; margin: 0; text-align: center;">
      If you didn't create an account with ${APP_NAME}, you can safely ignore this email.
    </p>
  </div>

  <div style="text-align: center; padding: 30px; color: #999999; font-size: 11px; letter-spacing: 0.5px;">
    <p style="margin: 0; text-transform: uppercase;">&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
    <p style="margin: 8px 0 0 0;">
      <a href="${APP_URL}" style="color: #444444; text-decoration: underline;">Visit our website</a>
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate HTML for password reset email
 */
function generatePasswordResetEmailHtml(name: string | null, resetUrl: string): string {
  const greeting = name ? `Hi ${name},` : "Hi,";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
  <div style="background-color: #444444; padding: 40px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 32px; letter-spacing: 2px; font-weight: 800;">${APP_NAME}</h1>
  </div>

  <div style="background: #ffffff; padding: 40px 35px; border: 1px solid #eeeeee; border-top: none; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
    <h2 style="color: #111111; margin-top: 0; font-size: 24px; font-weight: 700;">Reset your password</h2>

    <p style="color: #555555; font-size: 16px;">${greeting}</p>

    <p style="color: #555555; font-size: 16px;">
      We received a request to reset your password for your <strong>${APP_NAME}</strong> account. Click the button below to secure your account.
    </p>

    <div style="text-align: center; margin: 40px 0;">
      <a href="${resetUrl}"
         style="background-color: #444444;
                color: #ffffff;
                padding: 16px 40px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 700;
                display: inline-block;
                text-transform: uppercase;
                letter-spacing: 1px;
                font-size: 14px;">
        Reset Password
      </a>
    </div>

    <p style="color: #888888; font-size: 13px; text-align: center;">
      If the button doesn't work, copy and paste this link into your browser:
    </p>
    <p style="color: #444444; font-size: 12px; word-break: break-all; text-align: center; background: #f5f5f5; padding: 10px; border-radius: 4px;">
      ${resetUrl}
    </p>

    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 20px; margin: 35px 0;">
      <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.5;">
        <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour.
        If you didn't request this, please ignore this email or contact our support if you believe your account is at risk.
      </p>
    </div>

    <hr style="border: none; border-top: 1px solid #eeeeee; margin: 40px 0;">

    <p style="color: #999999; font-size: 12px; margin: 0; text-align: center;">
      If you didn't request this, you can safely ignore this email.
    </p>
  </div>

  <div style="text-align: center; padding: 30px; color: #999999; font-size: 11px; letter-spacing: 0.5px;">
    <p style="margin: 0; text-transform: uppercase;">&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
    <p style="margin: 8px 0 0 0;">
      <a href="${APP_URL}" style="color: #444444; text-decoration: underline;">Visit our website</a>
    </p>
  </div>
</body>
</html>
  `.trim();
}
