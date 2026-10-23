"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useI18n } from "@/components/lang/i18n-provider";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { normalizeEmailCode } from "@/lib/auth/email-verification-code";
import { createVerifyEmailCodeSchema, type VerifyEmailCodeInput } from "../validation/auth.schemas";

interface VerifyEmailCodeFormProps {
  /**
   * The address the code went to. Null when the page does not know it (another
   * tab or device): the form then asks for it.
   */
  email: string | null;
  /** Where to land once verified. The same URL the email's link uses. */
  callbackURL: string;
  /** "card" on the check-your-email page; "notice" inside the login page's yellow box. */
  variant?: "card" | "notice";
}

/** Error from Better Auth's client: the plugin's error `code`, or the HTTP status for a rate limit. */
function messageKeyFor(error: { code?: string; status?: number }): string {
  if (error.status === 429) return "auth.verifyEmail.codeRateLimited";
  switch (error.code) {
    case "OTP_EXPIRED":
      return "auth.verifyEmail.codeExpired";
    case "TOO_MANY_ATTEMPTS":
      return "auth.verifyEmail.codeTooManyAttempts";
    // USER_NOT_FOUND reads the same as a wrong code: nothing to fix but the code.
    case "INVALID_OTP":
    case "USER_NOT_FOUND":
      return "auth.verifyEmail.codeInvalid";
    default:
      return "auth.verifyEmail.codeError";
  }
}

/**
 * Option 2 of the verification email: type the 6-digit code instead of tapping
 * the link. Works when the link can't be opened (Gmail turns links off in
 * spam) and when the email is read on another device. Success signs the person
 * in, like the link, and lands them where the link would have.
 */
export function VerifyEmailCodeForm({
  email,
  callbackURL,
  variant = "card",
}: VerifyEmailCodeFormProps) {
  const { t } = useI18n();
  const schema = useMemo(() => createVerifyEmailCodeSchema(t), [t]);
  const form = useForm<VerifyEmailCodeInput>({
    resolver: zodResolver(schema),
    defaultValues: { email: email ?? "", code: "" },
  });
  // The check-your-email page reads the address from storage after mounting.
  useEffect(() => {
    if (email) form.setValue("email", email);
  }, [email, form]);
  const [verified, setVerified] = useState(false);
  const notice = variant === "notice";

  const onSubmit = async ({ email: address, code }: VerifyEmailCodeInput) => {
    try {
      const { error } = await authClient.emailOtp.verifyEmail({ email: address, otp: code });
      if (error) {
        form.setError("code", { message: t(messageKeyFor(error)) });
        return;
      }
    } catch {
      form.setError("code", { message: t("auth.verifyEmail.codeError") });
      return;
    }
    setVerified(true);
    toast.success(t("auth.verifyEmail.codeSuccess"));
    // A full load, like the link's redirect, so the new session cookie is read
    // from the first request on.
    window.location.assign(callbackURL);
  };

  const busy = form.formState.isSubmitting || verified;
  const inputTone = notice
    ? "border-yellow-300 bg-white text-gray-900 placeholder:text-gray-400"
    : undefined;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-3">
        {!email && (
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={cn(notice && "text-xs")}>{t("auth.email")}</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    className={cn("h-11", inputTone)}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={cn(notice && "text-xs")}>
                {t("auth.verifyEmail.codeLabel")}
              </FormLabel>
              <div className={cn("flex flex-col gap-2", notice && "sm:flex-row")}>
                <FormControl>
                  <Input
                    // Lets iOS and Android offer the code from the email above the keyboard.
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className={cn(
                      "h-12 text-center font-mono text-2xl tracking-[0.4em] md:text-2xl",
                      notice && "h-11 min-w-0 text-xl tracking-[0.3em] sm:flex-1 md:text-xl",
                      inputTone
                    )}
                    {...field}
                    // Keep digits only, so a pasted "123 456" or "Code: 123456" still works.
                    onChange={(e) => field.onChange(normalizeEmailCode(e.target.value))}
                  />
                </FormControl>
                <Button
                  type="submit"
                  disabled={busy}
                  className={cn(
                    "h-11 w-full",
                    notice && "shrink-0 bg-yellow-600 text-white hover:bg-yellow-700 sm:w-auto"
                  )}
                >
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {busy ? t("auth.verifyEmail.codeVerifying") : t("auth.verifyEmail.codeSubmit")}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
