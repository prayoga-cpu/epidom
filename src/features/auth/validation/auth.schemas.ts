import { z } from "zod";

/** The `t` from `useI18n()`. A bare function type, so this file needs no React. */
export type Translate = (key: string) => string;

// The numbers live here so a rule and the sentence that explains it cannot drift apart.
export const NAME_MIN_LENGTH = 2;
// 8 is Better Auth's own floor (`minPasswordLength` defaults to 8 and src/lib/auth.ts
// sets no override). Any lower number here lets a 6-7 character password clear the
// form only for the server to refuse it with an untranslated message.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 100;

/**
 * The messages are built per call because zod bakes a message in when the schema is
 * created. A form builds its schema with `useMemo(() => createXSchema(t), [t])`, so the
 * text it shows follows the visitor's language (same pattern as the customer form).
 */
function emailRule(t: Translate) {
  return z
    .string()
    .min(1, t("auth.validation.emailRequired"))
    .email(t("auth.validation.emailInvalid"));
}

/**
 * Login form validation schema.
 *
 * Sign-in only asks for a password. Strength rules belong to creating one: a length
 * floor here would block an account whose password predates today's minimum with a
 * "too short" message instead of letting the server answer "wrong password".
 */
export function createLoginSchema(t: Translate) {
  return z.object({
    email: emailRule(t),
    password: z.string().min(1, t("auth.validation.passwordRequired")),
  });
}

export type LoginInput = z.infer<ReturnType<typeof createLoginSchema>>;

/**
 * Registration form validation schema
 */
export function createRegisterSchema(t: Translate) {
  return z
    .object({
      name: z
        .string()
        .min(1, t("auth.validation.nameRequired"))
        .min(
          NAME_MIN_LENGTH,
          t("auth.validation.nameTooShort").replace("{min}", String(NAME_MIN_LENGTH))
        ),
      email: emailRule(t),
      password: z
        .string()
        .min(1, t("auth.validation.passwordRequired"))
        .min(
          PASSWORD_MIN_LENGTH,
          t("auth.validation.passwordTooShort").replace("{min}", String(PASSWORD_MIN_LENGTH))
        )
        .max(
          PASSWORD_MAX_LENGTH,
          t("auth.validation.passwordTooLong").replace("{max}", String(PASSWORD_MAX_LENGTH))
        ),
      confirmPassword: z.string().min(1, t("auth.validation.confirmPasswordRequired")),
      businessName: z.string().optional(),
      address: z.string().optional(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("messages.passwordsDoNotMatch"),
      path: ["confirmPassword"],
    });
}

export type RegisterInput = z.infer<ReturnType<typeof createRegisterSchema>>;
