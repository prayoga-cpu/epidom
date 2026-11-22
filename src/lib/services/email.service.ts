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
import type { FeedbackSubmittedEventData, CustomDevelopmentSubmittedEventData } from "@/lib/inngest/client";
import { SUPPORT_EMAIL_ADDRESSES, SUPPORT_MAILTO } from "@/lib/constants/contact";

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
// Replies to the no-reply sender land with support instead of bouncing.
const EMAIL_REPLY_TO = SUPPORT_EMAIL_ADDRESSES[0];
const APP_NAME = "EPIDOM";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/** Languages the customer-facing e-mails are written in. */
type EmailLocale = "en" | "fr" | "id" | "th";

/**
 * Pick the language of an e-mail. Anything absent or unknown is English: these
 * e-mails were English-only before they were localized, so a caller that has no
 * recipient language yet keeps sending exactly what it always sent.
 */
function emailLocale(locale: string | null | undefined): EmailLocale {
  return locale === "fr" || locale === "id" || locale === "th" ? locale : "en";
}

/**
 * Words every localized e-mail shares: the copyright line, the "visit our
 * website" link and the "copy this link" fallback under a button.
 */
const EMAIL_COMMON_COPY: Record<
  EmailLocale,
  { rights: string; visit: string; fallbackLink: string }
> = {
  en: {
    rights: "All rights reserved.",
    visit: "Visit our website",
    fallbackLink: "If the button doesn't work, copy and paste this link into your browser:",
  },
  fr: {
    rights: "Tous droits réservés.",
    visit: "Visiter notre site web",
    fallbackLink:
      "Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :",
  },
  id: {
    rights: "Hak cipta dilindungi undang-undang.",
    visit: "Kunjungi situs web kami",
    fallbackLink: "Jika tombol tidak berfungsi, salin dan tempel tautan ini ke browser Anda:",
  },
  th: {
    rights: "สงวนลิขสิทธิ์",
    visit: "เยี่ยมชมเว็บไซต์ของเรา",
    fallbackLink: "หากปุ่มใช้งานไม่ได้ ให้คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์ของคุณ",
  },
};

/** "© 2026 EPIDOM. All rights reserved." in the e-mail's language. */
function copyrightLine(lang: EmailLocale): string {
  return `&copy; ${new Date().getFullYear()} ${APP_NAME}. ${EMAIL_COMMON_COPY[lang].rights}`;
}

/**
 * The verification e-mail, per locale. With a code it offers two ways in,
 * labelled Option 1 (the link) and Option 2 (the code); without one it is the
 * link alone.
 */
const VERIFICATION_EMAIL_COPY: Record<
  EmailLocale,
  {
    subjectWithCode: (code: string) => string;
    subjectLink: string;
    title: string;
    heading: string;
    introWithCode: string;
    introLink: string;
    option1: string;
    cta: string;
    option2: string;
    codeHelp: string;
    expiryWithCode: string;
    expiryLink: string;
    ignore: string;
  }
> = {
  en: {
    subjectWithCode: (code) => `${code} is your ${APP_NAME} verification code`,
    subjectLink: `Verify your email for ${APP_NAME}`,
    title: "Verify your email",
    heading: "Verify your email address",
    introWithCode: `Thanks for signing up for <strong>${APP_NAME}</strong>. Confirm your email address in one of two ways:`,
    introLink: `Thanks for signing up for <strong>${APP_NAME}</strong>. To complete your registration and secure your account, please verify your email address.`,
    option1: "Option 1: tap the button",
    cta: "Verify Email Address",
    option2: `Option 2: enter this code in ${APP_NAME}`,
    codeHelp: `Type it on the ${APP_NAME} page that asks you to verify your email, or on the sign-in page. It works even when the button above won't open.`,
    expiryWithCode: `The link and the code expire in 1 hour. If you asked for more than one email, use the newest one. Expired? Sign in to ${APP_NAME} and tap Resend.`,
    expiryLink: `This link expires in 1 hour. If it has expired, sign in to ${APP_NAME} and tap Resend to get a new one.`,
    ignore: `If you didn't create an account with ${APP_NAME}, you can safely ignore this email.`,
  },
  fr: {
    subjectWithCode: (code) => `${code} est votre code de vérification ${APP_NAME}`,
    subjectLink: `Vérifiez votre adresse e-mail pour ${APP_NAME}`,
    title: "Vérifiez votre e-mail",
    heading: "Vérifiez votre adresse e-mail",
    introWithCode: `Merci de vous être inscrit sur <strong>${APP_NAME}</strong>. Confirmez votre adresse e-mail de l'une des deux façons suivantes :`,
    introLink: `Merci de vous être inscrit sur <strong>${APP_NAME}</strong>. Pour finaliser votre inscription et sécuriser votre compte, veuillez vérifier votre adresse e-mail.`,
    option1: "Option 1 : touchez le bouton",
    cta: "Vérifier l'adresse e-mail",
    option2: `Option 2 : saisissez ce code dans ${APP_NAME}`,
    codeHelp: `Saisissez-le sur la page ${APP_NAME} qui vous demande de vérifier votre e-mail, ou sur la page de connexion. Il fonctionne même quand le bouton ci-dessus ne s'ouvre pas.`,
    expiryWithCode: `Le lien et le code expirent dans 1 heure. Si vous avez demandé plusieurs e-mails, utilisez le plus récent. Expiré ? Connectez-vous à ${APP_NAME} et touchez Renvoyer.`,
    expiryLink: `Ce lien expire dans 1 heure. S'il a expiré, connectez-vous à ${APP_NAME} et touchez Renvoyer pour en recevoir un nouveau.`,
    ignore: `Si vous n'avez pas créé de compte ${APP_NAME}, vous pouvez ignorer cet e-mail en toute sécurité.`,
  },
  id: {
    subjectWithCode: (code) => `${code} adalah kode verifikasi ${APP_NAME} Anda`,
    subjectLink: `Verifikasi email Anda untuk ${APP_NAME}`,
    title: "Verifikasi email Anda",
    heading: "Verifikasi alamat email Anda",
    introWithCode: `Terima kasih telah mendaftar di <strong>${APP_NAME}</strong>. Konfirmasikan alamat email Anda dengan salah satu dari dua cara berikut:`,
    introLink: `Terima kasih telah mendaftar di <strong>${APP_NAME}</strong>. Untuk menyelesaikan pendaftaran dan mengamankan akun Anda, silakan verifikasi alamat email Anda.`,
    option1: "Opsi 1: ketuk tombol",
    cta: "Verifikasi Alamat Email",
    option2: `Opsi 2: masukkan kode ini di ${APP_NAME}`,
    codeHelp: `Ketik kode ini di halaman ${APP_NAME} yang meminta verifikasi email Anda, atau di halaman masuk. Kode tetap berfungsi meskipun tombol di atas tidak bisa dibuka.`,
    expiryWithCode: `Tautan dan kode berlaku selama 1 jam. Jika Anda meminta lebih dari satu email, gunakan yang terbaru. Sudah kedaluwarsa? Masuk ke ${APP_NAME} lalu ketuk Kirim ulang.`,
    expiryLink: `Tautan ini berlaku selama 1 jam. Jika sudah kedaluwarsa, masuk ke ${APP_NAME} lalu ketuk Kirim ulang untuk mendapatkan yang baru.`,
    ignore: `Jika Anda tidak membuat akun ${APP_NAME}, abaikan saja email ini.`,
  },
  th: {
    subjectWithCode: (code) => `${code} คือรหัสยืนยัน ${APP_NAME} ของคุณ`,
    subjectLink: `ยืนยันอีเมลของคุณสำหรับ ${APP_NAME}`,
    title: "ยืนยันอีเมลของคุณ",
    heading: "ยืนยันที่อยู่อีเมลของคุณ",
    introWithCode: `ขอบคุณที่สมัครใช้งาน <strong>${APP_NAME}</strong> ยืนยันที่อยู่อีเมลของคุณได้ 2 วิธีดังนี้`,
    introLink: `ขอบคุณที่สมัครใช้งาน <strong>${APP_NAME}</strong> หากต้องการสมัครให้เสร็จสมบูรณ์และรักษาความปลอดภัยของบัญชี โปรดยืนยันที่อยู่อีเมลของคุณ`,
    option1: "ตัวเลือกที่ 1: แตะปุ่ม",
    cta: "ยืนยันที่อยู่อีเมล",
    option2: `ตัวเลือกที่ 2: ป้อนรหัสนี้ใน ${APP_NAME}`,
    codeHelp: `พิมพ์รหัสนี้ในหน้า ${APP_NAME} ที่ขอให้ยืนยันอีเมล หรือในหน้าเข้าสู่ระบบ ใช้ได้แม้ปุ่มด้านบนจะเปิดไม่ได้`,
    expiryWithCode: `ลิงก์และรหัสจะหมดอายุใน 1 ชั่วโมง หากคุณขออีเมลหลายฉบับ ให้ใช้ฉบับล่าสุด หมดอายุแล้ว? เข้าสู่ระบบ ${APP_NAME} แล้วแตะส่งอีกครั้ง`,
    expiryLink: `ลิงก์นี้จะหมดอายุใน 1 ชั่วโมง หากหมดอายุแล้ว ให้เข้าสู่ระบบ ${APP_NAME} แล้วแตะส่งอีกครั้งเพื่อรับลิงก์ใหม่`,
    ignore: `หากคุณไม่ได้สร้างบัญชี ${APP_NAME} คุณสามารถเพิกเฉยต่ออีเมลนี้ได้`,
  },
};

/** The password reset e-mail, per locale. */
const PASSWORD_RESET_EMAIL_COPY: Record<
  EmailLocale,
  {
    subject: string;
    title: string;
    heading: string;
    body: string;
    cta: string;
    noticeLabel: string;
    notice: string;
    ignore: string;
  }
> = {
  en: {
    subject: `Reset your password for ${APP_NAME}`,
    title: "Reset your password",
    heading: "Reset your password",
    body: `We received a request to reset your password for your <strong>${APP_NAME}</strong> account. Click the button below to secure your account.`,
    cta: "Reset Password",
    noticeLabel: "Security Notice:",
    notice:
      "This link will expire in 1 hour. If you didn't request this, please ignore this email or contact our support if you believe your account is at risk.",
    ignore: "If you didn't request this, you can safely ignore this email.",
  },
  fr: {
    subject: `Réinitialisez votre mot de passe ${APP_NAME}`,
    title: "Réinitialisez votre mot de passe",
    heading: "Réinitialisez votre mot de passe",
    body: `Nous avons reçu une demande de réinitialisation du mot de passe de votre compte <strong>${APP_NAME}</strong>. Cliquez sur le bouton ci-dessous pour sécuriser votre compte.`,
    cta: "Réinitialiser le mot de passe",
    noticeLabel: "Avis de sécurité :",
    notice:
      "Ce lien expirera dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail ou contactez notre support si vous pensez que votre compte est en danger.",
    ignore:
      "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.",
  },
  id: {
    subject: `Atur ulang kata sandi ${APP_NAME} Anda`,
    title: "Atur ulang kata sandi Anda",
    heading: "Atur ulang kata sandi Anda",
    body: `Kami menerima permintaan untuk mengatur ulang kata sandi akun <strong>${APP_NAME}</strong> Anda. Klik tombol di bawah untuk mengamankan akun Anda.`,
    cta: "Atur Ulang Kata Sandi",
    noticeLabel: "Pemberitahuan keamanan:",
    notice:
      "Tautan ini berlaku selama 1 jam. Jika Anda tidak memintanya, abaikan email ini atau hubungi dukungan kami jika Anda merasa akun Anda terancam.",
    ignore: "Jika Anda tidak memintanya, abaikan saja email ini.",
  },
  th: {
    subject: `รีเซ็ตรหัสผ่าน ${APP_NAME} ของคุณ`,
    title: "รีเซ็ตรหัสผ่านของคุณ",
    heading: "รีเซ็ตรหัสผ่านของคุณ",
    body: `เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชี <strong>${APP_NAME}</strong> ของคุณ คลิกปุ่มด้านล่างเพื่อรักษาความปลอดภัยของบัญชี`,
    cta: "รีเซ็ตรหัสผ่าน",
    noticeLabel: "ประกาศด้านความปลอดภัย:",
    notice:
      "ลิงก์นี้จะหมดอายุใน 1 ชั่วโมง หากคุณไม่ได้เป็นผู้ขอ โปรดเพิกเฉยต่ออีเมลนี้ หรือติดต่อทีมสนับสนุนของเราหากคุณคิดว่าบัญชีของคุณมีความเสี่ยง",
    ignore: "หากคุณไม่ได้เป็นผู้ขอ คุณสามารถเพิกเฉยต่ออีเมลนี้ได้",
  },
};

/**
 * Send verification email to new users
 */
export async function sendVerificationEmail(
  email: string,
  name: string | null,
  verificationUrl: string,
  /** 6-digit code offered next to the link. Null sends the link alone. */
  code: string | null = null,
  /** Recipient language; English when absent or unknown. */
  locale?: string | null
): Promise<SendEmailResult> {
  const lang = emailLocale(locale);
  const copy = VERIFICATION_EMAIL_COPY[lang];
  // In development, always log verification URL for easier testing
  if (process.env.NODE_ENV === "development") {
    console.log("\n📧 [DEV] Verification Email");
    console.log("To:", email);
    console.log("URL:", verificationUrl);
    if (code) console.log("Code:", code);
    console.log("");
  }

  // If no API key, short-circuit to dev-mode (still logged above)
  if (!process.env.RESEND_API_KEY) {
    return { success: true, messageId: "dev-mode" };
  }

  try {
    const resend = getResendClient()!;
    console.log(`[Email] Sending verification email to ${email}`);
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      replyTo: EMAIL_REPLY_TO,
      to: email,
      // The code leads the subject so it can be read from the inbox list or
      // a phone notification, even when the email sits in spam with its
      // links turned off.
      subject: code ? copy.subjectWithCode(code) : copy.subjectLink,
      html: generateVerificationEmailHtml(name, verificationUrl, code, lang),
    });

    console.log("[Email] Resend response:", data ? JSON.stringify(data) : "<no-data>");

    if (error) {
      console.error("[Email] Failed to send verification email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("[Email] Verification email error:", error);
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
  resetUrl: string,
  /** Recipient language; English when absent or unknown. */
  locale?: string | null
): Promise<SendEmailResult> {
  const lang = emailLocale(locale);
  // In development, always log password reset URL for easier testing
  if (process.env.NODE_ENV === "development") {
    console.log("\n🔑 [DEV] Password Reset Email");
    console.log("To:", email);
    console.log("URL:", resetUrl);
    console.log("");
  }

  // If no API key, short-circuit to dev-mode (still logged above)
  if (!process.env.RESEND_API_KEY) {
    return { success: true, messageId: "dev-mode" };
  }

  try {
    const resend = getResendClient()!;
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      replyTo: EMAIL_REPLY_TO,
      to: email,
      subject: PASSWORD_RESET_EMAIL_COPY[lang].subject,
      html: generatePasswordResetEmailHtml(name, resetUrl, lang),
    });

    if (error) {
      console.error("[Email] Failed to send password reset email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("[Email] Password reset email error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate HTML for verification email. With a code it offers two ways in,
 * labelled Option 1 (the link) and Option 2 (the code); without one it is the
 * link alone.
 */
function generateVerificationEmailHtml(
  name: string | null,
  verificationUrl: string,
  code: string | null = null,
  lang: EmailLocale = "en"
): string {
  const copy = VERIFICATION_EMAIL_COPY[lang];
  const common = EMAIL_COMMON_COPY[lang];
  const greeting = greetingFor(name, lang);
  const href = escapeHtml(verificationUrl);
  const optionLabel = (text: string) =>
    code
      ? `<p style="color: #111111; font-size: 14px; font-weight: 700; margin: 32px 0 0 0; text-transform: uppercase; letter-spacing: 1px; text-align: center;">${text}</p>`
      : "";

  return `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${copy.title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
  <div style="background-color: #444444; padding: 40px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 32px; letter-spacing: 2px; font-weight: 800;">${APP_NAME}</h1>
  </div>

  <div style="background: #ffffff; padding: 40px 35px; border: 1px solid #eeeeee; border-top: none; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
    <h2 style="color: #111111; margin-top: 0; font-size: 24px; font-weight: 700;">${copy.heading}</h2>

    <p style="color: #555555; font-size: 16px;">${greeting}</p>

    <p style="color: #555555; font-size: 16px;">
      ${code ? copy.introWithCode : copy.introLink}
    </p>

    ${optionLabel(copy.option1)}
    <div style="text-align: center; margin: ${code ? "16px 0 32px 0" : "40px 0"};">
      <a href="${href}"
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
        ${copy.cta}
      </a>
    </div>

    <p style="color: #888888; font-size: 13px; text-align: center;">
      ${common.fallbackLink}
    </p>
    <p style="color: #444444; font-size: 12px; word-break: break-all; text-align: center; background: #f5f5f5; padding: 10px; border-radius: 4px;">
      <a href="${href}" style="color: #444444; text-decoration: underline;">${href}</a>
    </p>
${
  code
    ? `
    ${optionLabel(copy.option2)}
    <div style="text-align: center; margin: 16px 0;">
      <span style="display: inline-block; background: #f5f5f5; border: 1px solid #e5e5e5; border-radius: 8px; padding: 14px 24px; font-family: 'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111111;">${escapeHtml(code)}</span>
    </div>
    <p style="color: #888888; font-size: 13px; text-align: center;">
      ${copy.codeHelp}
    </p>

    <p style="color: #888888; font-size: 13px; text-align: center;">
      ${copy.expiryWithCode}
    </p>
`
    : `
    <p style="color: #888888; font-size: 13px; text-align: center;">
      ${copy.expiryLink}
    </p>
`
}
    <hr style="border: none; border-top: 1px solid #eeeeee; margin: 40px 0;">

    <p style="color: #999999; font-size: 12px; margin: 0; text-align: center;">
      ${copy.ignore}
    </p>
  </div>

  <div style="text-align: center; padding: 30px; color: #999999; font-size: 11px; letter-spacing: 0.5px;">
    <p style="margin: 0; text-transform: uppercase;">${copyrightLine(lang)}</p>
    <p style="margin: 8px 0 0 0;">
      <a href="${APP_URL}" style="color: #444444; text-decoration: underline;">${common.visit}</a>
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate HTML for password reset email
 */
function generatePasswordResetEmailHtml(
  name: string | null,
  resetUrl: string,
  lang: EmailLocale = "en"
): string {
  const copy = PASSWORD_RESET_EMAIL_COPY[lang];
  const common = EMAIL_COMMON_COPY[lang];
  const greeting = greetingFor(name, lang);
  const href = escapeHtml(resetUrl);

  return `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${copy.title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
  <div style="background-color: #444444; padding: 40px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 32px; letter-spacing: 2px; font-weight: 800;">${APP_NAME}</h1>
  </div>

  <div style="background: #ffffff; padding: 40px 35px; border: 1px solid #eeeeee; border-top: none; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
    <h2 style="color: #111111; margin-top: 0; font-size: 24px; font-weight: 700;">${copy.heading}</h2>

    <p style="color: #555555; font-size: 16px;">${greeting}</p>

    <p style="color: #555555; font-size: 16px;">
      ${copy.body}
    </p>

    <div style="text-align: center; margin: 40px 0;">
      <a href="${href}"
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
        ${copy.cta}
      </a>
    </div>

    <p style="color: #888888; font-size: 13px; text-align: center;">
      ${common.fallbackLink}
    </p>
    <p style="color: #444444; font-size: 12px; word-break: break-all; text-align: center; background: #f5f5f5; padding: 10px; border-radius: 4px;">
      <a href="${href}" style="color: #444444; text-decoration: underline;">${href}</a>
    </p>

    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 20px; margin: 35px 0;">
      <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.5;">
        <strong>⚠️ ${copy.noticeLabel}</strong> ${copy.notice}
      </p>
    </div>

    <hr style="border: none; border-top: 1px solid #eeeeee; margin: 40px 0;">

    <p style="color: #999999; font-size: 12px; margin: 0; text-align: center;">
      ${copy.ignore}
    </p>
  </div>

  <div style="text-align: center; padding: 30px; color: #999999; font-size: 11px; letter-spacing: 0.5px;">
    <p style="margin: 0; text-transform: uppercase;">${copyrightLine(lang)}</p>
    <p style="margin: 8px 0 0 0;">
      <a href="${APP_URL}" style="color: #444444; text-decoration: underline;">${common.visit}</a>
    </p>
  </div>
</body>
</html>
  `.trim();
}

/** The account deactivation notice, per locale. */
const ACCOUNT_DEACTIVATED_EMAIL_COPY: Record<
  EmailLocale,
  {
    subject: string;
    title: string;
    heading: string;
    intro: string;
    window: (deadline: string, daysLeft: number) => string;
    after: string;
    contact: (link: string) => string;
    footer: string;
    dateLocale: string;
  }
> = {
  en: {
    subject: `Your ${APP_NAME} account has been deactivated`,
    title: "Account deactivated",
    heading: "Your account has been deactivated",
    intro: `Your ${APP_NAME} account was just deactivated. Your data — stores, products, orders, and settings — is safe and untouched.`,
    window: (deadline, daysLeft) =>
      `<strong>Changed your mind?</strong> Just log back in any time before <strong>${deadline}</strong> (${daysLeft} day${daysLeft === 1 ? "" : "s"} from now) and you'll be offered a one-click "Reactivate My Account" button that instantly restores full access.`,
    after:
      "After that window, your data stays on file for up to 12 months total. Recovering it at that point means contacting our support team, who will assess and quote a one-time recovery fee before manually restoring your account.",
    contact: (link) => `If you didn't request this, contact us immediately at\n      ${link}.`,
    footer:
      "This is an automated notice — no action is needed unless you want to reactivate or cancel.",
    dateLocale: "en-GB",
  },
  fr: {
    subject: `Votre compte ${APP_NAME} a été désactivé`,
    title: "Compte désactivé",
    heading: "Votre compte a été désactivé",
    intro: `Votre compte ${APP_NAME} vient d'être désactivé. Vos données — boutiques, produits, commandes et paramètres — sont en sécurité et intactes.`,
    window: (deadline, daysLeft) =>
      `<strong>Vous avez changé d'avis\u00a0?</strong> Reconnectez-vous à tout moment avant le <strong>${deadline}</strong> (dans ${daysLeft} jour${daysLeft === 1 ? "" : "s"}) et un bouton «\u00a0Réactiver mon compte\u00a0» vous sera proposé pour restaurer instantanément l'accès complet, en un clic.`,
    after:
      "Passé ce délai, vos données sont conservées jusqu'à 12 mois au total. Les récupérer à ce stade implique de contacter notre équipe support, qui évaluera la demande et vous communiquera un devis de frais de récupération uniques avant de restaurer manuellement votre compte.",
    contact: (link) =>
      `Si vous n'êtes pas à l'origine de cette demande, contactez-nous immédiatement à\n      ${link}.`,
    footer:
      "Ceci est une notification automatique — aucune action n'est nécessaire, sauf si vous souhaitez réactiver ou annuler.",
    dateLocale: "fr-FR",
  },
  id: {
    subject: `Akun ${APP_NAME} Anda telah dinonaktifkan`,
    title: "Akun dinonaktifkan",
    heading: "Akun Anda telah dinonaktifkan",
    intro: `Akun ${APP_NAME} Anda baru saja dinonaktifkan. Data Anda — toko, produk, pesanan, dan pengaturan — aman dan tidak berubah.`,
    window: (deadline, daysLeft) =>
      `<strong>Berubah pikiran?</strong> Cukup masuk kembali kapan saja sebelum <strong>${deadline}</strong> (${daysLeft} hari lagi) dan Anda akan ditawari tombol "Aktifkan Kembali Akun Saya" satu klik yang langsung memulihkan akses penuh.`,
    after:
      "Setelah masa itu, data Anda disimpan hingga total 12 bulan. Untuk memulihkannya pada tahap tersebut, Anda perlu menghubungi tim dukungan kami, yang akan menilai dan memberikan penawaran biaya pemulihan satu kali sebelum memulihkan akun Anda secara manual.",
    contact: (link) => `Jika Anda tidak memintanya, segera hubungi kami di\n      ${link}.`,
    footer:
      "Ini adalah pemberitahuan otomatis — tidak perlu tindakan apa pun kecuali Anda ingin mengaktifkan kembali atau membatalkan.",
    dateLocale: "id-ID",
  },
  th: {
    subject: `บัญชี ${APP_NAME} ของคุณถูกปิดใช้งานแล้ว`,
    title: "ปิดใช้งานบัญชีแล้ว",
    heading: "บัญชีของคุณถูกปิดใช้งานแล้ว",
    intro: `บัญชี ${APP_NAME} ของคุณเพิ่งถูกปิดใช้งาน ข้อมูลของคุณ ทั้งร้าน สินค้า ออเดอร์ และการตั้งค่า ปลอดภัยและไม่มีการเปลี่ยนแปลง`,
    window: (deadline, daysLeft) =>
      `<strong>เปลี่ยนใจใช่ไหม</strong> เพียงเข้าสู่ระบบอีกครั้งก่อนวันที่ <strong>${deadline}</strong> (อีก ${daysLeft} วัน) คุณจะเห็นปุ่ม "เปิดใช้งานบัญชีของฉันอีกครั้ง" ที่กดครั้งเดียวก็คืนสิทธิ์การเข้าใช้งานทั้งหมดได้ทันที`,
    after:
      "หลังพ้นช่วงเวลานั้น ข้อมูลของคุณจะถูกเก็บไว้รวมสูงสุด 12 เดือน การกู้คืนในช่วงนั้นต้องติดต่อทีมสนับสนุนของเรา ซึ่งจะประเมินและแจ้งค่าธรรมเนียมการกู้คืนแบบครั้งเดียว ก่อนกู้คืนบัญชีของคุณด้วยตนเอง",
    contact: (link) => `หากคุณไม่ได้เป็นผู้ดำเนินการนี้ โปรดติดต่อเราทันทีที่\n      ${link}`,
    footer:
      "นี่เป็นการแจ้งเตือนอัตโนมัติ ไม่ต้องดำเนินการใดๆ เว้นแต่คุณต้องการเปิดใช้งานบัญชีอีกครั้งหรือยกเลิก",
    dateLocale: "th-TH-u-ca-gregory",
  },
};

/**
 * Send account deactivation confirmation email.
 * Explains the self-service reactivation window (log back in) and that data
 * stays safe in the meantime.
 */
export async function sendAccountDeactivatedEmail(
  email: string,
  name: string | null,
  reactivationDeadline: Date,
  /** Recipient language; English when absent or unknown. */
  locale?: string | null
): Promise<SendEmailResult> {
  const lang = emailLocale(locale);
  const copy = ACCOUNT_DEACTIVATED_EMAIL_COPY[lang];
  const common = EMAIL_COMMON_COPY[lang];
  const daysLeft = Math.max(
    1,
    Math.ceil((reactivationDeadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  );

  if (process.env.NODE_ENV === "development") {
    console.log("\n🛑 [DEV] Account Deactivated Email");
    console.log("To:", email);
    console.log("Reactivation deadline:", reactivationDeadline.toISOString());
    console.log("");
  }

  if (!process.env.RESEND_API_KEY) {
    return { success: true, messageId: "dev-mode" };
  }

  const greeting = greetingFor(name, lang);
  const deadlineLabel = reactivationDeadline.toLocaleDateString(copy.dateLocale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  try {
    const resend = getResendClient()!;
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      replyTo: EMAIL_REPLY_TO,
      to: email,
      subject: copy.subject,
      html: `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${copy.title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
  <div style="background-color: #444444; padding: 40px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 32px; letter-spacing: 2px; font-weight: 800;">${APP_NAME}</h1>
  </div>

  <div style="background: #ffffff; padding: 40px 35px; border: 1px solid #eeeeee; border-top: none; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
    <h2 style="color: #111111; margin-top: 0; font-size: 24px; font-weight: 700;">${copy.heading}</h2>

    <p style="color: #555555; font-size: 16px;">${greeting}</p>

    <p style="color: #555555; font-size: 16px;">
      ${copy.intro}
    </p>

    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 20px; margin: 30px 0;">
      <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.5;">
        ${copy.window(deadlineLabel, daysLeft)}
      </p>
    </div>

    <p style="color: #555555; font-size: 16px;">
      ${copy.after}
    </p>

    <p style="color: #888888; font-size: 13px;">
      ${copy.contact(`<a href="${escapeHtml(SUPPORT_MAILTO)}" style="color: #444444;">${escapeHtml(SUPPORT_EMAIL_ADDRESSES[0])}</a>`)}
    </p>

    <hr style="border: none; border-top: 1px solid #eeeeee; margin: 40px 0;">

    <p style="color: #999999; font-size: 12px; margin: 0; text-align: center;">
      ${copy.footer}
    </p>
  </div>

  <div style="text-align: center; padding: 30px; color: #999999; font-size: 11px; letter-spacing: 0.5px;">
    <p style="margin: 0; text-transform: uppercase;">${copyrightLine(lang)}</p>
    <p style="margin: 8px 0 0 0;">
      <a href="${APP_URL}" style="color: #444444; text-decoration: underline;">${common.visit}</a>
    </p>
  </div>
</body>
</html>
      `.trim(),
    });

    if (error) {
      console.error("[Email] Failed to send account deactivated email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("[Email] Account deactivated email error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/** The staff PIN e-mail, per locale. `store` and `staff` arrive already escaped. */
const STAFF_PIN_EMAIL_COPY: Record<
  EmailLocale,
  {
    subject: (storeName: string) => string;
    heading: (store: string, staff: string) => string;
    added: string;
    pinIntro: string;
    keep: string;
  }
> = {
  en: {
    subject: (storeName) => `Your ${APP_NAME} Staff PIN for ${storeName}`,
    heading: (store, staff) => `Welcome to ${store}, ${staff}!`,
    added: `You have been added as a staff member on <strong>${APP_NAME}</strong>.`,
    pinIntro: "Your POS login PIN is:",
    keep: "Keep this PIN private. You can change it by contacting your manager.",
  },
  fr: {
    subject: (storeName) => `Votre code PIN employé ${APP_NAME} pour ${storeName}`,
    heading: (store, staff) => `Bienvenue chez ${store}, ${staff}\u00a0!`,
    added: `Vous avez été ajouté comme membre de l'équipe sur <strong>${APP_NAME}</strong>.`,
    pinIntro: "Votre code PIN de connexion au POS est\u00a0:",
    keep: "Gardez ce code PIN confidentiel. Vous pouvez le modifier en contactant votre responsable.",
  },
  id: {
    subject: (storeName) => `PIN Staf ${APP_NAME} Anda untuk ${storeName}`,
    heading: (store, staff) => `Selamat datang di ${store}, ${staff}!`,
    added: `Anda telah ditambahkan sebagai staf di <strong>${APP_NAME}</strong>.`,
    pinIntro: "PIN login POS Anda adalah:",
    keep: "Jaga kerahasiaan PIN ini. Anda dapat menggantinya dengan menghubungi manajer Anda.",
  },
  th: {
    subject: (storeName) => `PIN พนักงาน ${APP_NAME} ของคุณสำหรับ ${storeName}`,
    heading: (store, staff) => `ยินดีต้อนรับสู่ ${store} คุณ ${staff}`,
    added: `คุณถูกเพิ่มเป็นพนักงานใน <strong>${APP_NAME}</strong> แล้ว`,
    pinIntro: "PIN เข้าสู่ระบบ POS ของคุณคือ",
    keep: "เก็บ PIN นี้เป็นความลับ คุณสามารถเปลี่ยนได้โดยติดต่อผู้จัดการของคุณ",
  },
};

/**
 * Send staff PIN invitation email
 */
export async function sendStaffPinEmail(
  email: string,
  staffName: string,
  storeName: string,
  pin: string,
  /** Recipient language (the store's business language); English when absent or unknown. */
  locale?: string | null
): Promise<SendEmailResult> {
  const lang = emailLocale(locale);
  const copy = STAFF_PIN_EMAIL_COPY[lang];
  if (process.env.NODE_ENV === "development") {
    console.log("\n👤 [DEV] Staff PIN Email");
    console.log("To:", email);
    console.log("PIN:", pin);
    console.log("");
  }

  if (!process.env.RESEND_API_KEY) {
    return { success: true, messageId: "dev-mode" };
  }

  try {
    const resend = getResendClient()!;
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      replyTo: EMAIL_REPLY_TO,
      to: email,
      subject: copy.subject(storeName),
      html: `
<!DOCTYPE html>
<html lang="${lang}">
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #444;">${copy.heading(escapeHtml(storeName), escapeHtml(staffName))}</h2>
  <p>${copy.added}</p>
  <p>${copy.pinIntro}</p>
  <div style="text-align: center; margin: 30px 0;">
    <span style="font-size: 48px; font-weight: bold; letter-spacing: 16px; color: #444; background: #f5f5f5; padding: 20px 30px; border-radius: 8px; display: inline-block;">${pin}</span>
  </div>
  <p style="color: #888; font-size: 13px;">${copy.keep}</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px; text-align: center;">${copyrightLine(lang)}</p>
</body>
</html>
      `.trim(),
    });

    if (error) return { success: false, error: error.message };
    return { success: true, messageId: data?.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/** The Owner PIN reset code e-mail, per locale. */
const OWNER_PIN_RESET_EMAIL_COPY: Record<
  EmailLocale,
  { subject: string; intro: string; expiry: string }
> = {
  en: {
    subject: `Your ${APP_NAME} PIN reset code`,
    intro: `Use this code to reset your Owner PIN on <strong>${APP_NAME}</strong>:`,
    expiry:
      "This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.",
  },
  fr: {
    subject: `Votre code de réinitialisation du PIN ${APP_NAME}`,
    intro: `Utilisez ce code pour réinitialiser votre PIN Propriétaire sur <strong>${APP_NAME}</strong>\u00a0:`,
    expiry:
      "Ce code expire dans 10 minutes. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.",
  },
  id: {
    subject: `Kode reset PIN ${APP_NAME} Anda`,
    intro: `Gunakan kode ini untuk mereset PIN Pemilik Anda di <strong>${APP_NAME}</strong>:`,
    expiry:
      "Kode ini berlaku selama 10 menit. Jika Anda tidak memintanya, abaikan saja email ini.",
  },
  th: {
    subject: `รหัสรีเซ็ต PIN ${APP_NAME} ของคุณ`,
    intro: `ใช้รหัสนี้เพื่อรีเซ็ต PIN เจ้าของของคุณบน <strong>${APP_NAME}</strong>`,
    expiry:
      "รหัสนี้จะหมดอายุใน 10 นาที หากคุณไม่ได้เป็นผู้ขอ คุณสามารถเพิกเฉยต่ออีเมลนี้ได้",
  },
};

/**
 * Send a one-time code to reset the owner's PIN (shared-device "switch back
 * to Owner" gate). Mirrors sendStaffPinEmail's structure/format.
 */
export async function sendOwnerPinResetOtpEmail(
  email: string,
  name: string | null,
  otp: string,
  /** Recipient language; English when absent or unknown. */
  locale?: string | null
): Promise<SendEmailResult> {
  const lang = emailLocale(locale);
  const copy = OWNER_PIN_RESET_EMAIL_COPY[lang];
  if (process.env.NODE_ENV === "development") {
    console.log("\n🔐 [DEV] Owner PIN Reset OTP Email");
    console.log("To:", email);
    console.log("Code:", otp);
    console.log("");
  }

  if (!process.env.RESEND_API_KEY) {
    return { success: true, messageId: "dev-mode" };
  }

  const greeting = greetingFor(name, lang);

  try {
    const resend = getResendClient()!;
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      replyTo: EMAIL_REPLY_TO,
      to: email,
      subject: copy.subject,
      html: `
<!DOCTYPE html>
<html lang="${lang}">
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #444;">${greeting}</h2>
  <p>${copy.intro}</p>
  <div style="text-align: center; margin: 30px 0;">
    <span style="font-size: 40px; font-weight: bold; letter-spacing: 12px; color: #444; background: #f5f5f5; padding: 20px 30px; border-radius: 8px; display: inline-block;">${otp}</span>
  </div>
  <p style="color: #888; font-size: 13px;">${copy.expiry}</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px; text-align: center;">${copyrightLine(lang)}</p>
</body>
</html>
      `.trim(),
    });

    if (error) return { success: false, error: error.message };
    return { success: true, messageId: data?.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * The store ownership transfer invite, per locale. `from`, `store` and `to`
 * arrive already escaped for HTML; `subject` takes the plain-text forms.
 */
const STORE_TRANSFER_EMAIL_COPY: Record<
  EmailLocale,
  {
    subject: (from: string, storeName: string) => string;
    fromFallback: string;
    intro: (from: string, store: string, to: string) => string;
    consequence: string;
    cta: string;
    note: string;
  }
> = {
  en: {
    subject: (from, storeName) => `${from} wants to transfer "${storeName}" to you on ${APP_NAME}`,
    fromFallback: "The current owner",
    intro: (from, store, to) =>
      `<strong>${from}</strong> wants to transfer ownership of the store <strong>${store}</strong> on <strong>${APP_NAME}</strong> to you (${to}).`,
    consequence:
      "Accepting gives you full owner access to this store — its data, staff, and settings — and the current owner will no longer have access to it.",
    cta: "Review &amp; Accept Transfer",
    note: `If you don't have an ${APP_NAME} account yet, you'll be asked to create one with this same email address first. This link expires in 7 days. If you weren't expecting this, you can safely ignore this email — nothing changes until it's accepted.`,
  },
  fr: {
    subject: (from, storeName) =>
      `${from} souhaite vous transférer «\u00a0${storeName}\u00a0» sur ${APP_NAME}`,
    fromFallback: "Le propriétaire actuel",
    intro: (from, store, to) =>
      `<strong>${from}</strong> souhaite vous transférer la propriété de la boutique <strong>${store}</strong> sur <strong>${APP_NAME}</strong> (${to}).`,
    consequence:
      "En acceptant, vous obtenez un accès propriétaire complet à cette boutique — ses données, son équipe et ses paramètres — et le propriétaire actuel n'y aura plus accès.",
    cta: "Vérifier et accepter le transfert",
    note: `Si vous n'avez pas encore de compte ${APP_NAME}, il vous sera d'abord demandé d'en créer un avec cette même adresse e-mail. Ce lien expire dans 7 jours. Si vous n'attendiez pas ce message, vous pouvez l'ignorer en toute sécurité — rien ne change tant que le transfert n'est pas accepté.`,
  },
  id: {
    subject: (from, storeName) => `${from} ingin mengalihkan "${storeName}" kepada Anda di ${APP_NAME}`,
    fromFallback: "Pemilik saat ini",
    intro: (from, store, to) =>
      `<strong>${from}</strong> ingin mengalihkan kepemilikan toko <strong>${store}</strong> di <strong>${APP_NAME}</strong> kepada Anda (${to}).`,
    consequence:
      "Dengan menerima, Anda mendapat akses pemilik penuh ke toko ini — data, staf, dan pengaturannya — dan pemilik saat ini tidak akan lagi memiliki akses ke toko tersebut.",
    cta: "Tinjau &amp; Terima Pengalihan",
    note: `Jika Anda belum memiliki akun ${APP_NAME}, Anda akan diminta membuatnya terlebih dahulu dengan alamat email yang sama. Tautan ini berlaku selama 7 hari. Jika Anda tidak mengharapkan ini, abaikan saja email ini — tidak ada yang berubah sampai pengalihan diterima.`,
  },
  th: {
    subject: (from, storeName) => `${from} ต้องการโอนร้าน "${storeName}" ให้คุณบน ${APP_NAME}`,
    fromFallback: "เจ้าของปัจจุบัน",
    intro: (from, store, to) =>
      `<strong>${from}</strong> ต้องการโอนความเป็นเจ้าของร้าน <strong>${store}</strong> บน <strong>${APP_NAME}</strong> ให้คุณ (${to})`,
    consequence:
      "เมื่อยอมรับ คุณจะได้สิทธิ์เจ้าของเต็มรูปแบบของร้านนี้ ทั้งข้อมูล พนักงาน และการตั้งค่า และเจ้าของปัจจุบันจะไม่มีสิทธิ์เข้าถึงร้านนี้อีก",
    cta: "ตรวจสอบและยอมรับการโอน",
    note: `หากคุณยังไม่มีบัญชี ${APP_NAME} คุณจะต้องสร้างบัญชีด้วยอีเมลเดียวกันนี้ก่อน ลิงก์นี้จะหมดอายุใน 7 วัน หากคุณไม่ได้คาดหวังอีเมลนี้ คุณสามารถเพิกเฉยได้ จะไม่มีการเปลี่ยนแปลงใดๆ จนกว่าจะยอมรับการโอน`,
  },
};

/**
 * Send a store ownership transfer invite — the recipient (who may not have
 * an Epidom account yet) clicks through to accept and take over the store.
 */
export async function sendStoreOwnershipTransferEmail(
  toEmail: string,
  storeName: string,
  fromName: string | null,
  acceptUrl: string,
  /** Language of the e-mail (the store's business language); English when absent or unknown. */
  locale?: string | null
): Promise<SendEmailResult> {
  const lang = emailLocale(locale);
  const copy = STORE_TRANSFER_EMAIL_COPY[lang];
  if (process.env.NODE_ENV === "development") {
    console.log("\n🔑 [DEV] Store Ownership Transfer Email");
    console.log("To:", toEmail);
    console.log("Store:", storeName);
    console.log("Accept URL:", acceptUrl);
    console.log("");
  }

  if (!process.env.RESEND_API_KEY) {
    return { success: true, messageId: "dev-mode" };
  }

  // Two forms on purpose: the subject is plain text (escaping would show a
  // literal "&amp;" for "Tom & Jerry"), the HTML body is not.
  const fromText = fromName || copy.fromFallback;
  const from = escapeHtml(fromText);
  const store = escapeHtml(storeName);

  try {
    const resend = getResendClient()!;
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      replyTo: EMAIL_REPLY_TO,
      to: toEmail,
      subject: copy.subject(fromText, storeName),
      html: `
<!DOCTYPE html>
<html lang="${lang}">
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #444;">${greetingFor(null, lang)}</h2>
  <p>${copy.intro(from, store, escapeHtml(toEmail))}</p>
  <p>${copy.consequence}</p>
  <div style="text-align: center; margin: 30px 0;">
    <a href="${acceptUrl}" style="display: inline-block; background: #444; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold;">${copy.cta}</a>
  </div>
  <p style="color: #888; font-size: 13px;">${copy.note}</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px; text-align: center;">${copyrightLine(lang)}</p>
</body>
</html>
      `.trim(),
    });

    if (error) return { success: false, error: error.message };
    return { success: true, messageId: data?.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * The staff sign-in invite, per locale. `store`, `to` arrive already escaped
 * for HTML; `subject` takes the plain-text store name.
 */
const STAFF_INVITE_EMAIL_COPY: Record<
  EmailLocale,
  {
    subject: (storeName: string) => string;
    intro: (store: string) => string;
    cta: string;
    link: (to: string) => string;
    ignore: string;
  }
> = {
  en: {
    subject: (storeName) => `Set up your ${APP_NAME} sign-in for ${storeName}`,
    intro: (store) =>
      `You've been added as a staff member at <strong>${store}</strong> on <strong>${APP_NAME}</strong>. You can now sign in with your own account and go straight to the store.`,
    cta: "Set Up My Sign-In",
    link: (to) =>
      `This link is for ${to} only, can be used once, and expires in 7 days. If you already have an ${APP_NAME} account with this email, you'll be asked to sign in to it; otherwise you'll choose a password. You'll still enter your staff PIN at the store.`,
    ignore:
      "If you weren't expecting this, you can safely ignore this email — nothing changes until the link is used.",
  },
  fr: {
    subject: (storeName) => `Configurez votre connexion ${APP_NAME} pour ${storeName}`,
    intro: (store) =>
      `Vous avez été ajouté comme membre de l'équipe de <strong>${store}</strong> sur <strong>${APP_NAME}</strong>. Vous pouvez désormais vous connecter avec votre propre compte et accéder directement à la boutique.`,
    cta: "Configurer ma connexion",
    link: (to) =>
      `Ce lien est réservé à ${to}, ne peut être utilisé qu'une seule fois et expire dans 7 jours. Si vous avez déjà un compte ${APP_NAME} avec cette adresse e-mail, il vous sera demandé de vous y connecter\u00a0; sinon, vous choisirez un mot de passe. Vous saisirez toujours votre code PIN employé à la boutique.`,
    ignore:
      "Si vous n'attendiez pas ce message, vous pouvez l'ignorer en toute sécurité — rien ne change tant que le lien n'est pas utilisé.",
  },
  id: {
    subject: (storeName) => `Siapkan akses masuk ${APP_NAME} Anda untuk ${storeName}`,
    intro: (store) =>
      `Anda telah ditambahkan sebagai staf di <strong>${store}</strong> pada <strong>${APP_NAME}</strong>. Sekarang Anda dapat masuk dengan akun Anda sendiri dan langsung menuju toko.`,
    cta: "Siapkan Akses Masuk Saya",
    link: (to) =>
      `Tautan ini hanya untuk ${to}, hanya dapat digunakan sekali, dan berlaku selama 7 hari. Jika Anda sudah memiliki akun ${APP_NAME} dengan email ini, Anda akan diminta masuk ke akun tersebut; jika belum, Anda akan membuat kata sandi. Anda tetap akan memasukkan PIN staf di toko.`,
    ignore:
      "Jika Anda tidak mengharapkan ini, abaikan saja email ini — tidak ada yang berubah sampai tautan digunakan.",
  },
  th: {
    subject: (storeName) => `ตั้งค่าการเข้าสู่ระบบ ${APP_NAME} ของคุณสำหรับ ${storeName}`,
    intro: (store) =>
      `คุณถูกเพิ่มเป็นพนักงานของ <strong>${store}</strong> บน <strong>${APP_NAME}</strong> แล้ว ตอนนี้คุณเข้าสู่ระบบด้วยบัญชีของคุณเองและไปที่ร้านได้ทันที`,
    cta: "ตั้งค่าการเข้าสู่ระบบของฉัน",
    link: (to) =>
      `ลิงก์นี้ใช้ได้เฉพาะ ${to} ใช้ได้ครั้งเดียว และจะหมดอายุใน 7 วัน หากคุณมีบัญชี ${APP_NAME} ด้วยอีเมลนี้อยู่แล้ว ระบบจะให้คุณเข้าสู่ระบบบัญชีนั้น มิฉะนั้นคุณจะได้ตั้งรหัสผ่าน คุณยังต้องป้อน PIN พนักงานที่ร้านเช่นเดิม`,
    ignore:
      "หากคุณไม่ได้คาดหวังอีเมลนี้ คุณสามารถเพิกเฉยได้ จะไม่มีการเปลี่ยนแปลงใดๆ จนกว่าจะมีการใช้ลิงก์",
  },
};

/**
 * Invite a staff member to claim (or create) their own Epidom sign-in, linked
 * to their StaffMember row. Deliberately separate from sendStaffPinEmail: that
 * one delivers a PIN and says nothing about an account. This one carries a
 * single-use, expiring claim link (StaffInvite.token) and — unlike the PIN
 * email — the caller awaits its result, so "invite sent" is only ever reported
 * on confirmed delivery.
 *
 * staffName and storeName are owner-typed free text landing inside an email
 * that carries a security-relevant link, so both are HTML-escaped.
 */
export async function sendStaffAccountInviteEmail(
  toEmail: string,
  staffName: string,
  storeName: string,
  inviteUrl: string,
  /** Recipient language (the store's business language); English when absent or unknown. */
  locale?: string | null
): Promise<SendEmailResult> {
  const lang = emailLocale(locale);
  const copy = STAFF_INVITE_EMAIL_COPY[lang];
  if (process.env.NODE_ENV === "development") {
    console.log("\n🔗 [DEV] Staff Account Invite Email");
    console.log("To:", toEmail);
    console.log("Store:", storeName);
    console.log("Invite URL:", inviteUrl);
    console.log("");
  }

  if (!process.env.RESEND_API_KEY) {
    return { success: true, messageId: "dev-mode" };
  }

  const store = escapeHtml(storeName);

  try {
    const resend = getResendClient()!;
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      replyTo: EMAIL_REPLY_TO,
      to: toEmail,
      subject: copy.subject(storeName),
      html: `
<!DOCTYPE html>
<html lang="${lang}">
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #444;">${greetingFor(staffName, lang)}</h2>
  <p>${copy.intro(store)}</p>
  <div style="text-align: center; margin: 30px 0;">
    <a href="${inviteUrl}" style="display: inline-block; background: #444; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold;">${copy.cta}</a>
  </div>
  <p style="color: #888; font-size: 13px;">${copy.link(escapeHtml(toEmail))}</p>
  <p style="color: #888; font-size: 13px;">${copy.ignore}</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px; text-align: center;">${copyrightLine(lang)}</p>
</body>
</html>
      `.trim(),
    });

    if (error) return { success: false, error: error.message };
    return { success: true, messageId: data?.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Recipients for internal feedback notifications. Deliberately NOT the shared
// SUPPORT_EMAIL_ADDRESSES: this is the team's private alert routing (it names
// `founder@`, where the public inbox names `ceo@`), never shown to a customer,
// so a future branded support address must not silently re-route it. The
// support-email guard test allowlists exactly this array.
const FEEDBACK_NOTIFICATION_RECIPIENTS = [
  "cro@prionation.io",
  "founder@prionation.io",
  "consult@prionation.io",
];

/**
 * Escape user-controlled strings before interpolating into HTML
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const GREETING_WORD: Record<EmailLocale, string> = {
  en: "Hi",
  fr: "Bonjour",
  id: "Halo",
  th: "สวัสดี",
};

/**
 * "Hi <name>," for the top of an email (in the e-mail's language when one is given). The name is whatever the person typed
 * at signup, and anyone can sign up with someone else's address, so it is
 * escaped: otherwise a name like `<a href=...>` would put a link of the
 * signer's choosing into an email we send. Trimmed so "Ana " reads "Hi Ana,".
 */
export function greetingFor(name: string | null | undefined, locale?: string | null): string {
  const word = GREETING_WORD[emailLocale(locale)];
  const trimmed = name?.trim();
  return trimmed ? `${word} ${escapeHtml(trimmed)},` : `${word},`;
}

/**
 * The POS trial's "3 days left" reminder, per locale. Sent only when no card
 * is on file: without one Stripe ends the trial and the account goes back to
 * Free. Same server-side copy pattern as RECEIPT_EMAIL_COPY.
 */
const TRIAL_ENDING_EMAIL_COPY: Record<
  "en" | "fr" | "id" | "th",
  {
    subject: (date: string) => string;
    greeting: (name: string | null | undefined) => string;
    heading: string;
    body: (date: string) => string;
    keep: string;
    cta: string;
    footer: string;
    dateLocale: string;
  }
> = {
  en: {
    subject: (date) => `Your POS trial ends on ${date}`,
    greeting: (name) => greetingFor(name),
    heading: "Your POS trial ends soon",
    body: (date) =>
      `Your 14-day POS trial ends on <strong>${date}</strong>. To keep the till, kitchen display and tables after that, add a card in Billing. You won't be charged before ${date}.`,
    keep: "No card? Your account goes back to the Free plan on that day. Nothing is deleted: your menu, orders and staff stay, and POS comes back as soon as you subscribe.",
    cta: "Add a card",
    footer: "You get this email because you started a POS trial on Epidom.",
    dateLocale: "en-GB",
  },
  fr: {
    subject: (date) => `Votre essai POS se termine le ${date}`,
    greeting: (name) => (name?.trim() ? `Bonjour ${escapeHtml(name.trim())},` : "Bonjour,"),
    heading: "Votre essai POS se termine bientôt",
    body: (date) =>
      `Votre essai POS de 14 jours se termine le <strong>${date}</strong>. Pour garder la caisse, l'écran cuisine et les tables ensuite, ajoutez une carte dans Facturation. Rien n'est prélevé avant le ${date}.`,
    keep: "Pas de carte ? Votre compte repasse au plan Gratuit ce jour-là. Rien n'est supprimé : votre carte, vos commandes et votre équipe restent là, et le POS revient dès que vous vous abonnez.",
    cta: "Ajouter une carte",
    footer: "Vous recevez cet e-mail parce que vous avez commencé un essai POS sur Epidom.",
    dateLocale: "fr-FR",
  },
  id: {
    subject: (date) => `Uji coba POS Anda berakhir pada ${date}`,
    greeting: (name) => (name?.trim() ? `Halo ${escapeHtml(name.trim())},` : "Halo,"),
    heading: "Uji coba POS Anda segera berakhir",
    body: (date) =>
      `Uji coba POS 14 hari Anda berakhir pada <strong>${date}</strong>. Agar kasir, layar dapur, dan meja tetap aktif setelahnya, tambahkan kartu di menu Tagihan. Tidak ada tagihan sebelum ${date}.`,
    keep: "Tanpa kartu, akun Anda kembali ke paket Gratis pada hari itu. Tidak ada yang dihapus: menu, pesanan, dan data staf tetap tersimpan, dan POS aktif lagi begitu Anda berlangganan.",
    cta: "Tambah kartu",
    footer: "Anda menerima email ini karena memulai uji coba POS di Epidom.",
    dateLocale: "id-ID",
  },
  th: {
    subject: (date) => `การทดลองใช้ POS ของคุณสิ้นสุดวันที่ ${date}`,
    greeting: (name) => (name?.trim() ? `สวัสดี ${escapeHtml(name.trim())},` : "สวัสดี,"),
    heading: "การทดลองใช้ POS ของคุณใกล้สิ้นสุดแล้ว",
    body: (date) =>
      `การทดลองใช้ POS 14 วันของคุณสิ้นสุดวันที่ <strong>${date}</strong> หากต้องการใช้เครื่องคิดเงิน จอแสดงออเดอร์ในครัว และโต๊ะต่อหลังจากนั้น ให้เพิ่มบัตรในหน้าการเรียกเก็บเงิน คุณจะไม่ถูกเรียกเก็บเงินก่อนวันที่ ${date}`,
    keep: "ไม่มีบัตร? บัญชีของคุณจะกลับไปใช้แพ็กเกจ Free ในวันนั้น ไม่มีอะไรถูกลบ เมนู ออเดอร์ และพนักงานของคุณยังอยู่ และ POS จะกลับมาใช้งานได้ทันทีเมื่อคุณสมัครใช้งาน",
    cta: "เพิ่มบัตร",
    footer: "คุณได้รับอีเมลนี้เพราะคุณเริ่มทดลองใช้ POS บน Epidom",
    dateLocale: "th-TH-u-ca-gregory",
  },
};

/**
 * POS trial ending in 3 days with no card on file (Stripe's
 * customer.subscription.trial_will_end, see the Stripe webhook).
 */
export async function sendTrialEndingEmail(payload: {
  email: string;
  name: string | null;
  locale?: string | null;
  trialEndsAt: Date;
  billingUrl: string;
}): Promise<SendEmailResult> {
  const lang =
    payload.locale === "fr" ||
    payload.locale === "en" ||
    payload.locale === "th"
      ? payload.locale
      : "id";
  const copy = TRIAL_ENDING_EMAIL_COPY[lang];
  const date = payload.trialEndsAt.toLocaleDateString(copy.dateLocale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  if (process.env.NODE_ENV === "development") {
    console.log("\n⏳ [DEV] POS Trial Ending Email");
    console.log("To:", payload.email, "| ends:", payload.trialEndsAt.toISOString());
    console.log("Billing:", payload.billingUrl, "\n");
  }

  if (!process.env.RESEND_API_KEY) {
    return { success: true, messageId: "dev-mode" };
  }

  const href = escapeHtml(payload.billingUrl);
  try {
    const resend = getResendClient()!;
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      replyTo: EMAIL_REPLY_TO,
      to: payload.email,
      subject: copy.subject(date),
      html: `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(copy.heading)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
  <div style="background-color: #444444; padding: 40px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 32px; letter-spacing: 2px; font-weight: 800;">${APP_NAME}</h1>
  </div>

  <div style="background: #ffffff; padding: 40px 35px; border: 1px solid #eeeeee; border-top: none; border-radius: 0 0 12px 12px;">
    <h2 style="color: #111111; margin-top: 0; font-size: 24px; font-weight: 700;">${copy.heading}</h2>
    <p style="color: #555555; font-size: 16px;">${copy.greeting(payload.name)}</p>
    <p style="color: #555555; font-size: 16px;">${copy.body(date)}</p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${href}" style="display: inline-block; background-color: #111111; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">${copy.cta}</a>
    </div>

    <p style="color: #555555; font-size: 14px;">${copy.keep}</p>

    <hr style="border: none; border-top: 1px solid #eeeeee; margin: 32px 0;">
    <p style="color: #999999; font-size: 12px; margin: 0; text-align: center;">${copy.footer}</p>
  </div>
</body>
</html>
      `.trim(),
    });

    if (error) {
      console.error("[Email] Failed to send POS trial ending email:", error);
      return { success: false, error: error.message };
    }
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("[Email] POS trial ending email error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * The welcome email every new account gets, per locale: the 14-day POS trial
 * (no card) and the one thing left to do, finish setup, which publishes the
 * online store and gives the link to share.
 */
const WELCOME_EMAIL_COPY: Record<
  "en" | "fr" | "id" | "th",
  {
    subject: string;
    greeting: (name: string | null | undefined) => string;
    heading: string;
    intro: string;
    trialTitle: string;
    trialBody: string;
    linkTitle: string;
    linkBody: string;
    cta: string;
    skip: string;
    footer: string;
  }
> = {
  en: {
    subject: "Welcome to Epidom: your 14-day POS trial is waiting",
    greeting: (name) => greetingFor(name),
    heading: "Welcome to Epidom",
    intro: "Your account is ready. Finish setting up your store in a couple of minutes and you are live.",
    trialTitle: "14 days of POS, free",
    trialBody:
      "Finish setup and your 14-day POS trial starts on its own: till, kitchen display and tables, no card needed. Skip setup and you stay on the Free plan.",
    linkTitle: "Your online store link",
    linkBody:
      "Finishing setup publishes your online store and gives you its link to share with customers, on WhatsApp, Instagram or a QR code on your counter.",
    cta: "Finish setting up my store",
    skip: "You can also come back to it any time from Your Stores.",
    footer: "You get this email because you created an Epidom account.",
  },
  fr: {
    subject: "Bienvenue sur Epidom : votre essai POS de 14 jours vous attend",
    greeting: (name) => (name?.trim() ? `Bonjour ${escapeHtml(name.trim())},` : "Bonjour,"),
    heading: "Bienvenue sur Epidom",
    intro:
      "Votre compte est prêt. Terminez la configuration de votre boutique en quelques minutes et vous êtes en ligne.",
    trialTitle: "14 jours de POS offerts",
    trialBody:
      "Terminez la configuration et votre essai POS de 14 jours démarre tout seul : caisse, écran cuisine et tables, sans carte bancaire. Si vous passez la configuration, vous restez sur l'offre Gratuite.",
    linkTitle: "Le lien de votre boutique en ligne",
    linkBody:
      "Terminer la configuration publie votre boutique en ligne et vous donne son lien à partager avec vos clients, sur WhatsApp, Instagram ou en QR code sur votre comptoir.",
    cta: "Terminer la configuration",
    skip: "Vous pouvez aussi y revenir à tout moment depuis Vos boutiques.",
    footer: "Vous recevez cet e-mail parce que vous avez créé un compte Epidom.",
  },
  id: {
    subject: "Selamat datang di Epidom: uji coba POS 14 hari menunggu Anda",
    greeting: (name) => (name?.trim() ? `Halo ${escapeHtml(name.trim())},` : "Halo,"),
    heading: "Selamat datang di Epidom",
    intro:
      "Akun Anda sudah siap. Selesaikan pengaturan toko dalam beberapa menit dan toko Anda langsung tayang.",
    trialTitle: "POS gratis 14 hari",
    trialBody:
      "Selesaikan pengaturan dan uji coba POS 14 hari Anda dimulai otomatis: kasir, layar dapur, dan meja, tanpa kartu. Jika pengaturan dilewati, Anda tetap di paket Gratis.",
    linkTitle: "Tautan toko online Anda",
    linkBody:
      "Menyelesaikan pengaturan menayangkan toko online Anda dan memberi tautan untuk dibagikan ke pelanggan lewat WhatsApp, Instagram, atau kode QR di kasir.",
    cta: "Selesaikan pengaturan toko",
    skip: "Anda juga bisa kembali kapan saja dari Toko Anda.",
    footer: "Anda menerima email ini karena membuat akun Epidom.",
  },
  th: {
    subject: "ยินดีต้อนรับสู่ Epidom: ทดลองใช้ POS 14 วันรอคุณอยู่",
    greeting: (name) => (name?.trim() ? `สวัสดี ${escapeHtml(name.trim())},` : "สวัสดี,"),
    heading: "ยินดีต้อนรับสู่ Epidom",
    intro:
      "บัญชีของคุณพร้อมแล้ว ตั้งค่าร้านให้เสร็จในไม่กี่นาที แล้วร้านของคุณก็พร้อมเปิดใช้งาน",
    trialTitle: "POS ฟรี 14 วัน",
    trialBody:
      "ตั้งค่าให้เสร็จแล้วการทดลองใช้ POS 14 วันของคุณจะเริ่มให้อัตโนมัติ ทั้งเครื่องคิดเงิน จอแสดงออเดอร์ในครัว และโต๊ะ โดยไม่ต้องใช้บัตร หากข้ามการตั้งค่า คุณจะยังอยู่ในแพ็กเกจ Free",
    linkTitle: "ลิงก์หน้าร้านออนไลน์ของคุณ",
    linkBody:
      "เมื่อตั้งค่าเสร็จ หน้าร้านออนไลน์ของคุณจะเผยแพร่ และคุณจะได้ลิงก์ไปแชร์กับลูกค้าทาง WhatsApp, Instagram หรือ QR code ที่เคาน์เตอร์",
    cta: "ตั้งค่าร้านให้เสร็จ",
    skip: "คุณยังกลับมาตั้งค่าได้ทุกเมื่อจากหน้าร้านของคุณ",
    footer: "คุณได้รับอีเมลนี้เพราะคุณสร้างบัญชี Epidom",
  },
};

export async function sendWelcomeEmail(payload: {
  email: string;
  name: string | null;
  locale?: string | null;
  onboardingUrl: string;
}): Promise<SendEmailResult> {
  const lang =
    payload.locale === "fr" ||
    payload.locale === "en" ||
    payload.locale === "th"
      ? payload.locale
      : "id";
  const copy = WELCOME_EMAIL_COPY[lang];

  if (process.env.NODE_ENV === "development") {
    console.log("\n👋 [DEV] Welcome Email");
    console.log("To:", payload.email, "|", payload.onboardingUrl, "\n");
  }

  if (!process.env.RESEND_API_KEY) {
    return { success: true, messageId: "dev-mode" };
  }

  const href = escapeHtml(payload.onboardingUrl);
  const block = (title: string, body: string) =>
    `<div style="background: #faf7ea; border: 1px solid #efe6c4; border-radius: 10px; padding: 16px 18px; margin: 16px 0;"><p style="margin: 0 0 6px; color: #111111; font-size: 16px; font-weight: 700;">${title}</p><p style="margin: 0; color: #555555; font-size: 14px;">${body}</p></div>`;
  try {
    const resend = getResendClient()!;
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      replyTo: EMAIL_REPLY_TO,
      to: payload.email,
      subject: copy.subject,
      html: `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(copy.heading)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
  <div style="background-color: #444444; padding: 40px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 32px; letter-spacing: 2px; font-weight: 800;">${APP_NAME}</h1>
  </div>

  <div style="background: #ffffff; padding: 40px 35px; border: 1px solid #eeeeee; border-top: none; border-radius: 0 0 12px 12px;">
    <h2 style="color: #111111; margin-top: 0; font-size: 24px; font-weight: 700;">${copy.heading}</h2>
    <p style="color: #555555; font-size: 16px;">${copy.greeting(payload.name)}</p>
    <p style="color: #555555; font-size: 16px;">${copy.intro}</p>

    ${block(copy.trialTitle, copy.trialBody)}
    ${block(copy.linkTitle, copy.linkBody)}

    <div style="text-align: center; margin: 32px 0;">
      <a href="${href}" style="display: inline-block; background-color: #111111; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">${copy.cta}</a>
    </div>

    <p style="color: #777777; font-size: 13px; text-align: center;">${copy.skip}</p>

    <hr style="border: none; border-top: 1px solid #eeeeee; margin: 32px 0;">
    <p style="color: #999999; font-size: 12px; margin: 0; text-align: center;">${copy.footer}</p>
  </div>
</body>
</html>
      `.trim(),
    });

    if (error) {
      console.error("[Email] Failed to send welcome email:", error);
      return { success: false, error: error.message };
    }
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("[Email] Welcome email error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * The receipt for a subscription payment (Stripe's invoice.payment_succeeded),
 * per locale. Sent by Epidom itself the moment a payment goes through, so the
 * owner has it in their inbox whatever Stripe's own receipt emails are set to
 * (they are off in test mode and optional in the Dashboard).
 */
const SUBSCRIPTION_RECEIPT_EMAIL_COPY: Record<
  "en" | "fr" | "id" | "th",
  {
    subject: (plan: string) => string;
    greeting: (name: string | null | undefined) => string;
    heading: string;
    intro: (plan: string) => string;
    labels: { plan: string; amount: string; date: string; period: string; invoice: string };
    view: string;
    pdf: string;
    note: string;
    footer: string;
    dateLocale: string;
  }
> = {
  en: {
    subject: (plan) => `Your Epidom receipt: ${plan}`,
    greeting: (name) => greetingFor(name),
    heading: "Payment received, thank you",
    intro: (plan) => `We received your payment for the <strong>${plan}</strong> plan. Here is your receipt.`,
    labels: {
      plan: "Plan",
      amount: "Amount paid",
      date: "Date",
      period: "Covers",
      invoice: "Invoice",
    },
    view: "View invoice",
    pdf: "Download PDF",
    note: "Keep this email as your record. Prices are before tax unless the invoice says otherwise.",
    footer: "You get this email because you paid for an Epidom plan.",
    dateLocale: "en-GB",
  },
  fr: {
    subject: (plan) => `Votre reçu Epidom : ${plan}`,
    greeting: (name) => (name?.trim() ? `Bonjour ${escapeHtml(name.trim())},` : "Bonjour,"),
    heading: "Paiement reçu, merci",
    intro: (plan) => `Nous avons bien reçu votre paiement pour l'offre <strong>${plan}</strong>. Voici votre reçu.`,
    labels: {
      plan: "Offre",
      amount: "Montant payé",
      date: "Date",
      period: "Période couverte",
      invoice: "Facture",
    },
    view: "Voir la facture",
    pdf: "Télécharger le PDF",
    note: "Conservez cet e-mail comme justificatif. Les prix sont hors taxes sauf mention contraire sur la facture.",
    footer: "Vous recevez cet e-mail parce que vous avez payé une offre Epidom.",
    dateLocale: "fr-FR",
  },
  id: {
    subject: (plan) => `Tanda terima Epidom Anda: ${plan}`,
    greeting: (name) => (name?.trim() ? `Halo ${escapeHtml(name.trim())},` : "Halo,"),
    heading: "Pembayaran diterima, terima kasih",
    intro: (plan) => `Kami menerima pembayaran Anda untuk paket <strong>${plan}</strong>. Ini tanda terimanya.`,
    labels: {
      plan: "Paket",
      amount: "Jumlah dibayar",
      date: "Tanggal",
      period: "Mencakup",
      invoice: "Faktur",
    },
    view: "Lihat faktur",
    pdf: "Unduh PDF",
    note: "Simpan email ini sebagai bukti. Harga belum termasuk pajak kecuali tertulis lain di faktur.",
    footer: "Anda menerima email ini karena membayar paket Epidom.",
    dateLocale: "id-ID",
  },
  th: {
    subject: (plan) => `ใบเสร็จ Epidom ของคุณ: ${plan}`,
    greeting: (name) => (name?.trim() ? `สวัสดี ${escapeHtml(name.trim())},` : "สวัสดี,"),
    heading: "ได้รับการชำระเงินแล้ว ขอบคุณ",
    intro: (plan) => `เราได้รับการชำระเงินของคุณสำหรับแพ็กเกจ <strong>${plan}</strong> แล้ว นี่คือใบเสร็จของคุณ`,
    labels: {
      plan: "แพ็กเกจ",
      amount: "ยอดที่ชำระ",
      date: "วันที่",
      period: "ครอบคลุม",
      invoice: "ใบแจ้งหนี้",
    },
    view: "ดูใบแจ้งหนี้",
    pdf: "ดาวน์โหลด PDF",
    note: "เก็บอีเมลนี้ไว้เป็นหลักฐาน ราคายังไม่รวมภาษี เว้นแต่ใบแจ้งหนี้ระบุไว้เป็นอย่างอื่น",
    footer: "คุณได้รับอีเมลนี้เพราะคุณชำระเงินสำหรับแพ็กเกจ Epidom",
    dateLocale: "th-TH-u-ca-gregory",
  },
};

/** What a subscription receipt shows (the webhook builds it from the paid invoice). */
export interface SubscriptionReceiptPayload {
  email: string;
  name: string | null;
  locale?: string | null;
  /** "POS", "Operations"… as the owner knows it. */
  planName: string;
  /** Already formatted in the invoice's currency: "€137.88". */
  amountLabel: string;
  paidAt: Date;
  /** The billing period the payment covers, when the invoice says. */
  period: { start: Date; end: Date } | null;
  invoiceNumber: string | null;
  /** Stripe's hosted invoice page and PDF. */
  invoiceUrl: string | null;
  pdfUrl: string | null;
}

export async function sendSubscriptionReceiptEmail(
  payload: SubscriptionReceiptPayload
): Promise<SendEmailResult> {
  const lang =
    payload.locale === "fr" ||
    payload.locale === "en" ||
    payload.locale === "th"
      ? payload.locale
      : "id";
  const copy = SUBSCRIPTION_RECEIPT_EMAIL_COPY[lang];
  const fmt = (date: Date) =>
    date.toLocaleDateString(copy.dateLocale, {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  const plan = escapeHtml(payload.planName);

  if (process.env.NODE_ENV === "development") {
    console.log("\n🧾 [DEV] Subscription Receipt Email");
    console.log("To:", payload.email, "|", payload.planName, payload.amountLabel);
    console.log("Invoice:", payload.invoiceUrl ?? "-", "\n");
  }

  if (!process.env.RESEND_API_KEY) {
    return { success: true, messageId: "dev-mode" };
  }

  const row = (label: string, value: string) =>
    `<tr><td style="padding: 10px 0; color: #777777; font-size: 14px; border-bottom: 1px solid #eeeeee;">${label}</td><td style="padding: 10px 0; color: #111111; font-size: 14px; font-weight: 600; text-align: right; border-bottom: 1px solid #eeeeee;">${value}</td></tr>`;
  const rows = [
    row(copy.labels.plan, plan),
    row(copy.labels.amount, escapeHtml(payload.amountLabel)),
    row(copy.labels.date, fmt(payload.paidAt)),
    payload.period ? row(copy.labels.period, `${fmt(payload.period.start)} → ${fmt(payload.period.end)}`) : "",
    payload.invoiceNumber ? row(copy.labels.invoice, escapeHtml(payload.invoiceNumber)) : "",
  ].join("");
  const button = (href: string, label: string, primary: boolean) =>
    `<a href="${escapeHtml(href)}" style="display: inline-block; margin: 4px; ${primary ? "background-color: #111111; color: #ffffff;" : "background-color: #ffffff; color: #111111; border: 1px solid #111111;"} padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">${label}</a>`;
  const buttons = [
    payload.invoiceUrl ? button(payload.invoiceUrl, copy.view, true) : "",
    payload.pdfUrl ? button(payload.pdfUrl, copy.pdf, false) : "",
  ].join("");

  try {
    const resend = getResendClient()!;
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      replyTo: EMAIL_REPLY_TO,
      to: payload.email,
      subject: copy.subject(payload.planName),
      html: `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(copy.heading)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
  <div style="background-color: #444444; padding: 40px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 32px; letter-spacing: 2px; font-weight: 800;">${APP_NAME}</h1>
  </div>

  <div style="background: #ffffff; padding: 40px 35px; border: 1px solid #eeeeee; border-top: none; border-radius: 0 0 12px 12px;">
    <h2 style="color: #111111; margin-top: 0; font-size: 24px; font-weight: 700;">${copy.heading}</h2>
    <p style="color: #555555; font-size: 16px;">${copy.greeting(payload.name)}</p>
    <p style="color: #555555; font-size: 16px;">${copy.intro(plan)}</p>

    <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 24px 0;">${rows}</table>

    <div style="text-align: center; margin: 28px 0;">${buttons}</div>

    <p style="color: #555555; font-size: 13px;">${copy.note}</p>

    <hr style="border: none; border-top: 1px solid #eeeeee; margin: 32px 0;">
    <p style="color: #999999; font-size: 12px; margin: 0; text-align: center;">${copy.footer}</p>
  </div>
</body>
</html>
      `.trim(),
    });

    if (error) {
      console.error("[Email] Failed to send subscription receipt email:", error);
      return { success: false, error: error.message };
    }
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("[Email] Subscription receipt email error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send feedback notification email to the team
 */
export async function sendFeedbackNotificationEmail(
  payload: FeedbackSubmittedEventData
): Promise<SendEmailResult> {
  const reference = payload.feedbackId.slice(-8).toUpperCase();
  const subject = `[${APP_NAME} Feedback] ${payload.type} — ${payload.page} (#${reference})`;

  if (process.env.NODE_ENV === "development") {
    console.log("\n💬 [DEV] Feedback Notification Email");
    console.log("To:", FEEDBACK_NOTIFICATION_RECIPIENTS.join(", "));
    console.log("Subject:", subject);
    console.log("Reporter:", `${payload.userName} <${payload.userEmail}>`);
    console.log("");
  }

  if (!process.env.RESEND_API_KEY) {
    return { success: true, messageId: "dev-mode" };
  }

  try {
    const resend = getResendClient()!;
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      replyTo: EMAIL_REPLY_TO,
      to: FEEDBACK_NOTIFICATION_RECIPIENTS,
      subject,
      html: generateFeedbackNotificationEmailHtml(payload, reference),
    });

    if (error) {
      console.error("[Email] Failed to send feedback notification email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("[Email] Feedback notification email error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate HTML for feedback notification email
 */
function generateFeedbackNotificationEmailHtml(
  payload: FeedbackSubmittedEventData,
  reference: string
): string {
  const store = payload.storeName ?? payload.storeId;

  const rows: Array<[string, string]> = [
    ["Type", escapeHtml(payload.type)],
    ["Page", escapeHtml(payload.page)],
    ["Description", escapeHtml(payload.description).replace(/\n/g, "<br>")],
    ["Reporter", `${escapeHtml(payload.userName)} (${escapeHtml(payload.userEmail)})`],
  ];

  if (store) {
    rows.push(["Store", escapeHtml(store)]);
  }

  if (payload.screenshotUrl) {
    rows.push([
      "Screenshot",
      `<a href="${escapeHtml(payload.screenshotUrl)}" style="color: #444444; text-decoration: underline;">View screenshot</a>`,
    ]);
  }

  rows.push(["Reference", `#${reference}`]);

  const rowsHtml = rows
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #eeeeee; color: #888888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; vertical-align: top; white-space: nowrap;">${label}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #eeeeee; color: #333333; font-size: 14px; vertical-align: top; word-break: break-word;">${value}</td>
      </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New feedback submitted</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
  <div style="background-color: #444444; padding: 40px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 32px; letter-spacing: 2px; font-weight: 800;">${APP_NAME}</h1>
  </div>

  <div style="background: #ffffff; padding: 40px 35px; border: 1px solid #eeeeee; border-top: none; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
    <h2 style="color: #111111; margin-top: 0; font-size: 24px; font-weight: 700;">New feedback submitted</h2>

    <table style="width: 100%; border-collapse: collapse; margin: 25px 0; border: 1px solid #eeeeee; border-radius: 8px;">
      ${rowsHtml}
    </table>

    <div style="text-align: center; margin: 40px 0 10px;">
      <a href="${APP_URL}/admin/feedback"
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
        View in Admin
      </a>
    </div>
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
 * Send custom development request notification email to the team
 */
export async function sendCustomDevelopmentNotificationEmail(
  payload: CustomDevelopmentSubmittedEventData
): Promise<SendEmailResult> {
  const reference = payload.requestId.slice(-8).toUpperCase();
  const subject = `[${APP_NAME} Custom Dev] New request from ${payload.userName} (#${reference})`;

  if (process.env.NODE_ENV === "development") {
    console.log("\n🛠️  [DEV] Custom Development Notification Email");
    console.log("To:", FEEDBACK_NOTIFICATION_RECIPIENTS.join(", "));
    console.log("Subject:", subject);
    console.log("Requester:", `${payload.userName} <${payload.userEmail}>`);
    console.log("");
  }

  if (!process.env.RESEND_API_KEY) {
    return { success: true, messageId: "dev-mode" };
  }

  try {
    const resend = getResendClient()!;
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      replyTo: EMAIL_REPLY_TO,
      to: FEEDBACK_NOTIFICATION_RECIPIENTS,
      subject,
      html: generateCustomDevelopmentNotificationEmailHtml(payload, reference),
    });

    if (error) {
      console.error("[Email] Failed to send custom development notification email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("[Email] Custom development notification email error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate HTML for custom development request notification email
 */
function generateCustomDevelopmentNotificationEmailHtml(
  payload: CustomDevelopmentSubmittedEventData,
  reference: string
): string {
  const store = payload.storeName ?? payload.storeId;

  const rows: Array<[string, string]> = [
    ["Description", escapeHtml(payload.description).replace(/\n/g, "<br>")],
    ["Requester", `${escapeHtml(payload.userName)} (${escapeHtml(payload.userEmail)})`],
  ];

  if (payload.company) {
    rows.push(["Company", escapeHtml(payload.company)]);
  }
  if (payload.phone) {
    rows.push(["Phone", escapeHtml(payload.phone)]);
  }
  if (payload.budget) {
    rows.push(["Budget", escapeHtml(payload.budget)]);
  }
  if (payload.timeline) {
    rows.push(["Timeline", escapeHtml(payload.timeline)]);
  }
  if (store) {
    rows.push(["Store", escapeHtml(store)]);
  }

  rows.push(["Reference", `#${reference}`]);

  const rowsHtml = rows
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #eeeeee; color: #888888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; vertical-align: top; white-space: nowrap;">${label}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #eeeeee; color: #333333; font-size: 14px; vertical-align: top; word-break: break-word;">${value}</td>
      </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New custom development request</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
  <div style="background-color: #444444; padding: 40px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 32px; letter-spacing: 2px; font-weight: 800;">${APP_NAME}</h1>
  </div>

  <div style="background: #ffffff; padding: 40px 35px; border: 1px solid #eeeeee; border-top: none; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
    <h2 style="color: #111111; margin-top: 0; font-size: 24px; font-weight: 700;">New custom development request</h2>

    <table style="width: 100%; border-collapse: collapse; margin: 25px 0; border: 1px solid #eeeeee; border-radius: 8px;">
      ${rowsHtml}
    </table>

    <div style="text-align: center; margin: 40px 0 10px;">
      <a href="${APP_URL}/admin/custom-development"
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
        View in Admin
      </a>
    </div>
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
 * The purchase order e-mail to a supplier, per locale. The language is the
 * store's business language: it is the one the store writes to its suppliers in.
 */
const SUPPLIER_ORDER_EMAIL_COPY: Record<
  EmailLocale,
  {
    subject: (orderNumber: string, storeName: string) => string;
    greeting: string;
    body: (orderNumber: string, storeName: string) => string;
    thanks: string;
  }
> = {
  en: {
    subject: (orderNumber, storeName) => `Purchase Order ${orderNumber} from ${storeName}`,
    greeting: "Hello,",
    body: (orderNumber, storeName) =>
      `Please find attached purchase order <strong>${orderNumber}</strong> from <strong>${storeName}</strong>.`,
    thanks: "Thank you.",
  },
  fr: {
    subject: (orderNumber, storeName) => `Bon de commande ${orderNumber} de ${storeName}`,
    greeting: "Bonjour,",
    body: (orderNumber, storeName) =>
      `Veuillez trouver ci-joint le bon de commande <strong>${orderNumber}</strong> de <strong>${storeName}</strong>.`,
    thanks: "Merci.",
  },
  id: {
    subject: (orderNumber, storeName) => `Pesanan Pembelian ${orderNumber} dari ${storeName}`,
    greeting: "Halo,",
    body: (orderNumber, storeName) =>
      `Terlampir pesanan pembelian <strong>${orderNumber}</strong> dari <strong>${storeName}</strong>.`,
    thanks: "Terima kasih.",
  },
  th: {
    subject: (orderNumber, storeName) => `ใบสั่งซื้อ ${orderNumber} จาก ${storeName}`,
    greeting: "สวัสดี,",
    body: (orderNumber, storeName) =>
      `ขอส่งใบสั่งซื้อ <strong>${orderNumber}</strong> จาก <strong>${storeName}</strong> มาพร้อมอีเมลนี้`,
    thanks: "ขอบคุณ",
  },
};

/**
 * Send a supplier order (reorder/refill) detail as a PDF attachment —
 * "send the PDF detail to supplier" from the Stock tab's reorder panel.
 */
export async function sendSupplierOrderEmail(
  to: string,
  storeName: string,
  orderNumber: string,
  pdfBuffer: Buffer,
  /** Language of the e-mail (the store's business language); English when absent or unknown. */
  locale?: string | null
): Promise<SendEmailResult> {
  const copy = SUPPLIER_ORDER_EMAIL_COPY[emailLocale(locale)];
  if (!process.env.RESEND_API_KEY) {
    return { success: true, messageId: "dev-mode" };
  }

  try {
    const resend = getResendClient()!;
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      replyTo: EMAIL_REPLY_TO,
      to,
      subject: copy.subject(orderNumber, storeName),
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
          <p>${copy.greeting}</p>
          <p>${copy.body(orderNumber, storeName)}</p>
          <p>${copy.thanks}</p>
        </div>
      `,
      attachments: [
        {
          filename: `${orderNumber}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (error) {
      console.error("[Email] Failed to send supplier order email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("[Email] Supplier order email error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Customer-facing receipt email copy, per locale.
 *
 * Deliberately not routed through `useI18n()`/`src/locales`: this module runs
 * server-side with no React context, and the recipient's language is the
 * store's business locale, not whatever the cashier's dashboard is set to.
 * Same reasoning as receipt-labels.ts, which owns the printed receipt's
 * vocabulary — but the copy is different (a chat/email greeting, not a label
 * on a 32-column till roll), so it is not shared with it.
 */
const RECEIPT_EMAIL_COPY: Record<
  "en" | "fr" | "id" | "th",
  {
    subject: (orderNumber: string, storeName: string) => string;
    greeting: string;
    intro: (storeName: string) => string;
    totalLabel: string;
    orderLabel: string;
    cta: string;
    footer: string;
  }
> = {
  en: {
    subject: (orderNumber, storeName) => `Your receipt ${orderNumber} from ${storeName}`,
    greeting: "Hello,",
    intro: (storeName) => `Thank you for your visit to <strong>${storeName}</strong>.`,
    totalLabel: "Total",
    orderLabel: "Receipt",
    cta: "View receipt",
    footer: "This receipt stays available at the link above.",
  },
  fr: {
    subject: (orderNumber, storeName) => `Votre reçu ${orderNumber} — ${storeName}`,
    greeting: "Bonjour,",
    intro: (storeName) => `Merci pour votre visite chez <strong>${storeName}</strong>.`,
    totalLabel: "Total",
    orderLabel: "Reçu",
    cta: "Voir le reçu",
    footer: "Ce reçu reste consultable via le lien ci-dessus.",
  },
  id: {
    subject: (orderNumber, storeName) => `Struk ${orderNumber} dari ${storeName}`,
    greeting: "Halo,",
    intro: (storeName) => `Terima kasih sudah mampir ke <strong>${storeName}</strong>.`,
    totalLabel: "Total",
    orderLabel: "Struk",
    cta: "Lihat struk",
    footer: "Struk ini tetap bisa dibuka lewat tautan di atas.",
  },
  th: {
    subject: (orderNumber, storeName) => `ใบเสร็จ ${orderNumber} จาก ${storeName}`,
    greeting: "สวัสดี,",
    intro: (storeName) => `ขอบคุณที่มาใช้บริการ <strong>${storeName}</strong>`,
    totalLabel: "ยอดรวม",
    orderLabel: "ใบเสร็จ",
    cta: "ดูใบเสร็จ",
    footer: "คุณสามารถเปิดดูใบเสร็จนี้ได้ตลอดผ่านลิงก์ด้านบน",
  },
};

/**
 * Email a customer their receipt — the email counterpart of the WhatsApp
 * receipt (send-customer-receipt.ts), linking to the same public
 * `/r/[orderId]` page rather than attaching a PDF: that page is already the
 * canonical rendering, it reprints, and a link survives an email client that
 * strips attachments.
 *
 * Same dev/no-key short-circuit as the rest of this module — without
 * RESEND_API_KEY it reports success with `messageId: "dev-mode"` so local POS
 * work isn't blocked on an email provider (AGENTS.md §6, graceful degradation).
 */
export async function sendReceiptEmail(payload: {
  to: string;
  storeName: string;
  orderNumber: string;
  /** Already formatted in the store's display currency — never converted here. */
  totalFormatted: string;
  receiptUrl: string;
  locale?: "en" | "fr" | "id" | "th";
}): Promise<SendEmailResult> {
  const copy = RECEIPT_EMAIL_COPY[payload.locale ?? "id"] ?? RECEIPT_EMAIL_COPY.id;
  const subject = copy.subject(payload.orderNumber, payload.storeName);

  if (process.env.NODE_ENV === "development") {
    console.log("\n🧾 [DEV] Receipt Email");
    console.log("To:", payload.to);
    console.log("Subject:", subject);
    console.log("URL:", payload.receiptUrl);
    console.log("");
  }

  if (!process.env.RESEND_API_KEY) {
    return { success: true, messageId: "dev-mode" };
  }

  const html = `
    <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827">
      <h2 style="font-size:18px;margin:0 0 16px">${escapeHtml(payload.storeName)}</h2>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 8px">${escapeHtml(copy.greeting)}</p>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px">${copy.intro(escapeHtml(payload.storeName))}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;border:1px solid #e5e7eb;border-radius:8px">
        <tr>
          <td style="padding:10px 14px;color:#6b7280">${escapeHtml(copy.orderLabel)}</td>
          <td style="padding:10px 14px;text-align:right"><strong>${escapeHtml(payload.orderNumber)}</strong></td>
        </tr>
        <tr>
          <td style="padding:10px 14px;color:#6b7280;border-top:1px solid #e5e7eb">${escapeHtml(copy.totalLabel)}</td>
          <td style="padding:10px 14px;text-align:right;border-top:1px solid #e5e7eb"><strong>${escapeHtml(payload.totalFormatted)}</strong></td>
        </tr>
      </table>
      <p style="margin:24px 0">
        <a href="${escapeHtml(payload.receiptUrl)}" style="background:#111827;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-size:14px;display:inline-block">${escapeHtml(copy.cta)}</a>
      </p>
      <p style="color:#6b7280;font-size:12px;line-height:1.6;margin:0">${escapeHtml(copy.footer)}</p>
    </div>`;

  try {
    const resend = getResendClient()!;
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      replyTo: EMAIL_REPLY_TO,
      to: payload.to,
      subject,
      html,
    });

    if (error) {
      console.error("[Email] Failed to send receipt email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("[Email] Receipt email error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send an internal alert when the nightly database backup hasn't succeeded
 * recently — the one check that catches "the backup silently stopped working."
 */
export async function sendBackupAlertEmail(
  reason: string,
  lastSuccessAt: string | null
): Promise<SendEmailResult> {
  const subject = `[${APP_NAME}] ⚠ Database backup alert`;

  if (process.env.NODE_ENV === "development") {
    console.log("\n🗄️ [DEV] Backup Alert Email");
    console.log("To:", FEEDBACK_NOTIFICATION_RECIPIENTS.join(", "));
    console.log("Reason:", reason);
    console.log("");
  }

  if (!process.env.RESEND_API_KEY) {
    return { success: true, messageId: "dev-mode" };
  }

  try {
    const resend = getResendClient()!;
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      replyTo: EMAIL_REPLY_TO,
      to: FEEDBACK_NOTIFICATION_RECIPIENTS,
      subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
          <p><strong>${escapeHtml(reason)}</strong></p>
          <p>Last successful backup: ${lastSuccessAt ? escapeHtml(lastSuccessAt) : "never recorded"}.</p>
          <p><a href="${APP_URL}/admin/capacity">View backup status in Admin</a></p>
        </div>
      `,
    });

    if (error) {
      console.error("[Email] Failed to send backup alert email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("[Email] Backup alert email error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// Audit trail notifications
// =============================================================================

/**
 * Operator-facing alert for a critical audit event.
 *
 * Reuses FEEDBACK_NOTIFICATION_RECIPIENTS rather than introducing a second
 * distribution list: the people who triage feedback are the same people who
 * need to know an account was just deleted, and a second list is one more thing
 * to drift out of date.
 */
export async function sendAuditCriticalEmail(payload: {
  actionCode: string;
  targetLabel: string;
  actorEmail: string;
  occurredAt: string;
}): Promise<SendEmailResult> {
  const subject = `[${APP_NAME} Audit] ${payload.actionCode} — ${payload.targetLabel}`;

  if (process.env.NODE_ENV === "development") {
    console.log("\n🚨 [DEV] Critical Audit Alert");
    console.log("To:", FEEDBACK_NOTIFICATION_RECIPIENTS.join(", "));
    console.log("Subject:", subject);
    console.log("Actor:", payload.actorEmail);
    console.log("");
  }

  if (!process.env.RESEND_API_KEY) {
    return { success: true, messageId: "dev-mode" };
  }

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#7f1d1d;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;font-size:16px">Critical action recorded</h2>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 8px 8px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#6b7280">Action</td><td style="padding:6px 0"><code>${escapeHtml(payload.actionCode)}</code></td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Target</td><td style="padding:6px 0">${escapeHtml(payload.targetLabel)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Performed by</td><td style="padding:6px 0">${escapeHtml(payload.actorEmail)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">When</td><td style="padding:6px 0">${escapeHtml(payload.occurredAt)}</td></tr>
        </table>
        <p style="margin:20px 0 0">
          <a href="${APP_URL}/admin/activity" style="background:#111827;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-size:14px;display:inline-block">Open activity log</a>
        </p>
        <p style="color:#6b7280;font-size:12px;margin-top:16px">
          If this action was not expected, it can be reviewed and — for most action types — reverted from the activity log.
        </p>
      </div>
    </div>`;

  try {
    const resend = getResendClient()!;
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      replyTo: EMAIL_REPLY_TO,
      to: FEEDBACK_NOTIFICATION_RECIPIENTS,
      subject,
      html,
    });
    if (error) {
      console.error("[Email] Failed to send audit critical alert:", error);
      return { success: false, error: error.message };
    }
    return { success: true, messageId: data?.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

type AccountActionCopy = { title: string; body: string };

/** The "support changed your account" notice, per locale. */
const ACCOUNT_ACTION_COPY: Record<
  EmailLocale,
  {
    actions: Record<string, AccountActionCopy>;
    fallback: AccountActionCopy;
    greeting: (name: string) => string;
    happenedOn: (when: string) => string;
    cta: string;
    unexpected: string;
  }
> = {
  en: {
    actions: {
      "reset-password": {
        title: "Your password was reset by support",
        body: "A member of the EPIDOM support team reset the password on your account. You have been signed out on every device and will need to sign in again.",
      },
      "temp-password": {
        title: "A temporary password was issued for your account",
        body: "A member of the EPIDOM support team issued a temporary password for your account. Please sign in and change it as soon as you can.",
      },
      "plan-change": {
        title: "Your plan was changed by support",
        body: "A member of the EPIDOM support team changed the plan on your account.",
      },
      reactivated: {
        title: "Your account was reactivated",
        body: "A member of the EPIDOM support team reactivated your account. Your data is available again.",
      },
    },
    fallback: {
      title: "Your account was changed by support",
      body: "A member of the EPIDOM support team made a change to your account.",
    },
    greeting: (name) => `Hi ${escapeHtml(name || "there")},`,
    happenedOn: (when) => `This happened on ${escapeHtml(when)}.`,
    cta: "Review your account activity",
    unexpected:
      'If you did not expect this, reply to this email or use the "This wasn\'t me" link on your account activity page.',
  },
  fr: {
    actions: {
      "reset-password": {
        title: "Votre mot de passe a été réinitialisé par le support",
        body: "Un membre de l'équipe support d'EPIDOM a réinitialisé le mot de passe de votre compte. Vous avez été déconnecté de tous vos appareils et devrez vous reconnecter.",
      },
      "temp-password": {
        title: "Un mot de passe temporaire a été émis pour votre compte",
        body: "Un membre de l'équipe support d'EPIDOM a émis un mot de passe temporaire pour votre compte. Veuillez vous connecter et le modifier dès que possible.",
      },
      "plan-change": {
        title: "Votre offre a été modifiée par le support",
        body: "Un membre de l'équipe support d'EPIDOM a modifié l'offre de votre compte.",
      },
      reactivated: {
        title: "Votre compte a été réactivé",
        body: "Un membre de l'équipe support d'EPIDOM a réactivé votre compte. Vos données sont de nouveau disponibles.",
      },
    },
    fallback: {
      title: "Votre compte a été modifié par le support",
      body: "Un membre de l'équipe support d'EPIDOM a apporté une modification à votre compte.",
    },
    greeting: (name) => greetingFor(name, "fr"),
    happenedOn: (when) => `Cela s'est produit le ${escapeHtml(when)}.`,
    cta: "Consulter l'activité de votre compte",
    unexpected:
      "Si vous ne vous attendiez pas à cela, répondez à cet e-mail ou utilisez le lien «\u00a0Ce n'était pas moi\u00a0» sur la page d'activité de votre compte.",
  },
  id: {
    actions: {
      "reset-password": {
        title: "Kata sandi Anda diatur ulang oleh dukungan",
        body: "Anggota tim dukungan EPIDOM mengatur ulang kata sandi akun Anda. Anda telah dikeluarkan dari semua perangkat dan perlu masuk kembali.",
      },
      "temp-password": {
        title: "Kata sandi sementara diterbitkan untuk akun Anda",
        body: "Anggota tim dukungan EPIDOM menerbitkan kata sandi sementara untuk akun Anda. Silakan masuk dan segera ganti kata sandi tersebut.",
      },
      "plan-change": {
        title: "Paket Anda diubah oleh dukungan",
        body: "Anggota tim dukungan EPIDOM mengubah paket akun Anda.",
      },
      reactivated: {
        title: "Akun Anda telah diaktifkan kembali",
        body: "Anggota tim dukungan EPIDOM mengaktifkan kembali akun Anda. Data Anda tersedia lagi.",
      },
    },
    fallback: {
      title: "Akun Anda diubah oleh dukungan",
      body: "Anggota tim dukungan EPIDOM melakukan perubahan pada akun Anda.",
    },
    greeting: (name) => greetingFor(name, "id"),
    happenedOn: (when) => `Hal ini terjadi pada ${escapeHtml(when)}.`,
    cta: "Tinjau aktivitas akun Anda",
    unexpected:
      'Jika Anda tidak mengharapkan ini, balas email ini atau gunakan tautan "Ini bukan saya" di halaman aktivitas akun Anda.',
  },
  th: {
    actions: {
      "reset-password": {
        title: "ทีมสนับสนุนรีเซ็ตรหัสผ่านของคุณแล้ว",
        body: "สมาชิกทีมสนับสนุน EPIDOM ได้รีเซ็ตรหัสผ่านของบัญชีคุณ คุณถูกออกจากระบบในทุกอุปกรณ์และต้องเข้าสู่ระบบใหม่อีกครั้ง",
      },
      "temp-password": {
        title: "มีการออกรหัสผ่านชั่วคราวสำหรับบัญชีของคุณ",
        body: "สมาชิกทีมสนับสนุน EPIDOM ได้ออกรหัสผ่านชั่วคราวสำหรับบัญชีของคุณ โปรดเข้าสู่ระบบและเปลี่ยนรหัสผ่านโดยเร็วที่สุด",
      },
      "plan-change": {
        title: "ทีมสนับสนุนเปลี่ยนแพ็กเกจของคุณแล้ว",
        body: "สมาชิกทีมสนับสนุน EPIDOM ได้เปลี่ยนแพ็กเกจของบัญชีคุณ",
      },
      reactivated: {
        title: "บัญชีของคุณถูกเปิดใช้งานอีกครั้ง",
        body: "สมาชิกทีมสนับสนุน EPIDOM ได้เปิดใช้งานบัญชีของคุณอีกครั้ง ข้อมูลของคุณกลับมาใช้งานได้แล้ว",
      },
    },
    fallback: {
      title: "ทีมสนับสนุนเปลี่ยนแปลงบัญชีของคุณ",
      body: "สมาชิกทีมสนับสนุน EPIDOM ได้ทำการเปลี่ยนแปลงบัญชีของคุณ",
    },
    greeting: (name) => greetingFor(name, "th"),
    happenedOn: (when) => `เหตุการณ์นี้เกิดขึ้นเมื่อ ${escapeHtml(when)}`,
    cta: "ตรวจสอบกิจกรรมในบัญชีของคุณ",
    unexpected:
      'หากคุณไม่ได้คาดหวังเรื่องนี้ ให้ตอบกลับอีเมลนี้หรือใช้ลิงก์ "ไม่ใช่ฉัน" ในหน้ากิจกรรมของบัญชี',
  },
};

/**
 * Notify an account holder that support changed something on their account.
 *
 * The acting admin is deliberately not named. The user needs to know an action
 * happened and be able to challenge it; naming an individual staff member
 * invites retaliation and adds nothing they can act on.
 */
export async function sendAccountChangedEmail(payload: {
  userEmail: string;
  userName: string;
  action: string;
  occurredAt: string;
  /** Recipient language; English when absent or unknown. */
  locale?: string | null;
}): Promise<SendEmailResult> {
  const lang = emailLocale(payload.locale);
  const labels = ACCOUNT_ACTION_COPY[lang];
  const copy = labels.actions[payload.action] ?? labels.fallback;
  const subject = `[${APP_NAME}] ${copy.title}`;

  if (process.env.NODE_ENV === "development") {
    console.log("\n✉️  [DEV] Account Changed Notice");
    console.log("To:", payload.userEmail);
    console.log("Subject:", subject);
    console.log("");
  }

  if (!process.env.RESEND_API_KEY) {
    return { success: true, messageId: "dev-mode" };
  }

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="font-size:18px;margin:0 0 12px">${escapeHtml(copy.title)}</h2>
      <p style="color:#374151;font-size:14px;line-height:1.6">${labels.greeting(payload.userName)}</p>
      <p style="color:#374151;font-size:14px;line-height:1.6">${escapeHtml(copy.body)}</p>
      <p style="color:#374151;font-size:14px;line-height:1.6">${labels.happenedOn(payload.occurredAt)}</p>
      <p style="margin:20px 0">
        <a href="${APP_URL}/profile" style="background:#111827;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-size:14px;display:inline-block">${labels.cta}</a>
      </p>
      <p style="color:#6b7280;font-size:13px;line-height:1.6">
        ${labels.unexpected}
      </p>
    </div>`;

  try {
    const resend = getResendClient()!;
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      replyTo: EMAIL_REPLY_TO,
      to: payload.userEmail,
      subject,
      html,
    });
    if (error) {
      console.error("[Email] Failed to send account-changed notice:", error);
      return { success: false, error: error.message };
    }
    return { success: true, messageId: data?.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * The two referral partner e-mails, per locale. `deal` is the already-built
 * deal summary (src/lib/services/partner.service.ts) and `to` the escaped address.
 */
const PARTNER_EMAIL_COPY: Record<
  EmailLocale,
  {
    inviteSubject: string;
    inviteIntro: (deal: string) => string;
    inviteCreate: (to: string) => string;
    inviteExpiry: string;
    accessSubject: string;
    accessIntro: (deal: string) => string;
    accessPage: string;
    cta: string;
  }
> = {
  en: {
    inviteSubject: `You're invited to be an ${APP_NAME} referral partner`,
    inviteIntro: (deal) =>
      `${APP_NAME} has set you up as a <strong>referral partner</strong>: ${deal}`,
    inviteCreate: (to) =>
      `Create your free ${APP_NAME} account with this email address (${to}) to open your partner page: your link, the people who sign up through it and what you earn.`,
    inviteExpiry: "This link expires in 14 days. If you weren't expecting this, you can ignore this email.",
    accessSubject: `Your ${APP_NAME} partner page is ready`,
    accessIntro: (deal) => `You're now an ${APP_NAME} <strong>referral partner</strong>: ${deal}`,
    accessPage:
      'Your partner page shows your link, the people who sign up through it and what you earn. You\'ll also find it as "Partner dashboard" in your account menu.',
    cta: "Open my partner page",
  },
  fr: {
    inviteSubject: `Vous êtes invité à devenir partenaire de parrainage ${APP_NAME}`,
    inviteIntro: (deal) =>
      `${APP_NAME} vous a configuré comme <strong>partenaire de parrainage</strong>\u00a0: ${deal}`,
    inviteCreate: (to) =>
      `Créez votre compte ${APP_NAME} gratuit avec cette adresse e-mail (${to}) pour ouvrir votre page partenaire\u00a0: votre lien, les personnes qui s'inscrivent grâce à lui et ce que vous gagnez.`,
    inviteExpiry:
      "Ce lien expire dans 14 jours. Si vous n'attendiez pas ce message, vous pouvez l'ignorer.",
    accessSubject: `Votre page partenaire ${APP_NAME} est prête`,
    accessIntro: (deal) =>
      `Vous êtes désormais <strong>partenaire de parrainage</strong> ${APP_NAME}\u00a0: ${deal}`,
    accessPage:
      "Votre page partenaire affiche votre lien, les personnes qui s'inscrivent grâce à lui et ce que vous gagnez. Vous la retrouverez aussi sous «\u00a0Espace partenaire\u00a0» dans le menu de votre compte.",
    cta: "Ouvrir ma page partenaire",
  },
  id: {
    inviteSubject: `Anda diundang menjadi mitra referral ${APP_NAME}`,
    inviteIntro: (deal) =>
      `${APP_NAME} telah menyiapkan Anda sebagai <strong>mitra referral</strong>: ${deal}`,
    inviteCreate: (to) =>
      `Buat akun ${APP_NAME} gratis Anda dengan alamat email ini (${to}) untuk membuka halaman mitra Anda: tautan Anda, orang-orang yang mendaftar lewat tautan tersebut, dan penghasilan Anda.`,
    inviteExpiry:
      "Tautan ini berlaku selama 14 hari. Jika Anda tidak mengharapkannya, abaikan saja email ini.",
    accessSubject: `Halaman mitra ${APP_NAME} Anda sudah siap`,
    accessIntro: (deal) =>
      `Anda kini menjadi <strong>mitra referral</strong> ${APP_NAME}: ${deal}`,
    accessPage:
      'Halaman mitra Anda menampilkan tautan Anda, orang-orang yang mendaftar lewat tautan tersebut, dan penghasilan Anda. Halaman ini juga ada sebagai "Dasbor mitra" di menu akun Anda.',
    cta: "Buka halaman mitra saya",
  },
  th: {
    inviteSubject: `คุณได้รับเชิญให้เป็นพาร์ตเนอร์แนะนำของ ${APP_NAME}`,
    inviteIntro: (deal) =>
      `${APP_NAME} ได้ตั้งค่าให้คุณเป็น<strong>พาร์ตเนอร์แนะนำ</strong>: ${deal}`,
    inviteCreate: (to) =>
      `สร้างบัญชี ${APP_NAME} ฟรีด้วยอีเมลนี้ (${to}) เพื่อเปิดหน้าพาร์ตเนอร์ของคุณ ซึ่งแสดงลิงก์ของคุณ ผู้ที่สมัครผ่านลิงก์ และรายได้ที่คุณได้รับ`,
    inviteExpiry:
      "ลิงก์นี้จะหมดอายุใน 14 วัน หากคุณไม่ได้คาดหวังอีเมลนี้ คุณสามารถเพิกเฉยได้",
    accessSubject: `หน้าพาร์ตเนอร์ ${APP_NAME} ของคุณพร้อมแล้ว`,
    accessIntro: (deal) =>
      `ตอนนี้คุณเป็น<strong>พาร์ตเนอร์แนะนำ</strong>ของ ${APP_NAME} แล้ว: ${deal}`,
    accessPage:
      'หน้าพาร์ตเนอร์ของคุณแสดงลิงก์ของคุณ ผู้ที่สมัครผ่านลิงก์ และรายได้ที่คุณได้รับ คุณยังพบหน้านี้ได้ในชื่อ "แดชบอร์ดพาร์ตเนอร์" ในเมนูบัญชีของคุณ',
    cta: "เปิดหน้าพาร์ตเนอร์ของฉัน",
  },
};

/**
 * Invite someone with no Epidom account to become a referral partner
 * (src/lib/partner-invite.ts). The link opens /partner-invite, which has them
 * sign up (or sign in) with this address, then lands them on their partner page.
 */
export async function sendPartnerInviteEmail(
  toEmail: string,
  displayName: string,
  dealSummary: string,
  inviteUrl: string,
  /** Recipient language; English when absent or unknown. */
  locale?: string | null
): Promise<SendEmailResult> {
  const lang = emailLocale(locale);
  const copy = PARTNER_EMAIL_COPY[lang];
  if (process.env.NODE_ENV === "development") {
    console.log("\n🤝 [DEV] Partner Invite Email");
    console.log("To:", toEmail);
    console.log("Invite URL:", inviteUrl);
    console.log("");
  }
  if (!process.env.RESEND_API_KEY) return { success: true, messageId: "dev-mode" };

  try {
    const resend = getResendClient()!;
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      replyTo: EMAIL_REPLY_TO,
      to: toEmail,
      subject: copy.inviteSubject,
      html: `
<!DOCTYPE html>
<html lang="${lang}">
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #444;">${greetingFor(displayName, lang)}</h2>
  <p>${copy.inviteIntro(escapeHtml(dealSummary))}</p>
  <p>${copy.inviteCreate(escapeHtml(toEmail))}</p>
  <div style="text-align: center; margin: 30px 0;">
    <a href="${inviteUrl}" style="display: inline-block; background: #444; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold;">${copy.cta}</a>
  </div>
  <p style="color: #888; font-size: 13px;">${copy.inviteExpiry}</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px; text-align: center;">${copyrightLine(lang)}</p>
</body>
</html>
      `.trim(),
    });
    if (error) return { success: false, error: error.message };
    return { success: true, messageId: data?.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/** Tell an existing account it is now a referral partner, with a link to its partner page. */
export async function sendPartnerAccessEmail(
  toEmail: string,
  displayName: string,
  dealSummary: string,
  pageUrl: string,
  /** Recipient language; English when absent or unknown. */
  locale?: string | null
): Promise<SendEmailResult> {
  const lang = emailLocale(locale);
  const copy = PARTNER_EMAIL_COPY[lang];
  if (process.env.NODE_ENV === "development") {
    console.log("\n🤝 [DEV] Partner Access Email");
    console.log("To:", toEmail);
    console.log("Page URL:", pageUrl);
    console.log("");
  }
  if (!process.env.RESEND_API_KEY) return { success: true, messageId: "dev-mode" };

  try {
    const resend = getResendClient()!;
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      replyTo: EMAIL_REPLY_TO,
      to: toEmail,
      subject: copy.accessSubject,
      html: `
<!DOCTYPE html>
<html lang="${lang}">
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #444;">${greetingFor(displayName, lang)}</h2>
  <p>${copy.accessIntro(escapeHtml(dealSummary))}</p>
  <p>${copy.accessPage}</p>
  <div style="text-align: center; margin: 30px 0;">
    <a href="${pageUrl}" style="display: inline-block; background: #444; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold;">${copy.cta}</a>
  </div>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px; text-align: center;">${copyrightLine(lang)}</p>
</body>
</html>
      `.trim(),
    });
    if (error) return { success: false, error: error.message };
    return { success: true, messageId: data?.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
