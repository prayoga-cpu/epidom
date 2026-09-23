"use client";

import { Button } from "@/components/ui/button";
import { GoogleIcon } from "../../components/google-icon";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createLoginSchema, LoginInput } from "../../validation/auth.schemas";
import { useLogin } from "../../hooks/use-auth";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { trackEvent } from "@/lib/analytics";
import { safeInternalPath } from "@/lib/safe-redirect";

export function LoginForm() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || searchParams.get("callbackUrl");
  const registered = searchParams.get("registered");
  const oauthError = searchParams.get("error");

  const { mutate: login, isPending, error } = useLogin();
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // Use ref to track if toast has already been shown
  const toastShownRef = useRef(false);

  // Show error toast for OAuth failures redirected back here by Better Auth
  useEffect(() => {
    if (oauthError && !toastShownRef.current) {
      toastShownRef.current = true;
      const messages: Record<string, string> = {
        internal_server_error: t("messages.oauthInternalError"),
        account_not_linked: t("messages.accountNotLinked"),
        state_mismatch: t("messages.oauthStateMismatch"),
        please_restart_the_process: t("messages.oauthRestart"),
      };
      toast.error(messages[oauthError] || t("messages.oauthGenericError"));
      const cleaned = new URLSearchParams(searchParams.toString());
      cleaned.delete("error");
      router.replace(cleaned.toString() ? `/login?${cleaned.toString()}` : "/login", {
        scroll: false,
      });
    }
  }, [oauthError, searchParams, router, t]);

  // Show success toast for new registrations (only once)
  useEffect(() => {
    if (registered === "true" && !toastShownRef.current) {
      toastShownRef.current = true;
      toast.success(t("auth.accountCreatedSuccess"));

      // Remove the 'registered' query param to prevent toast from showing again
      // on component re-render or browser back/forward
      const newSearchParams = new URLSearchParams(searchParams.toString());
      newSearchParams.delete("registered");
      const newUrl = newSearchParams.toString() ? `/login?${newSearchParams.toString()}` : "/login";
      router.replace(newUrl, { scroll: false });
    }
  }, [registered, searchParams, router]);

  // Built from `t` so the validation messages follow the visitor's language.
  const schema = useMemo(() => createLoginSchema(t), [t]);

  const form = useForm<LoginInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: LoginInput) => {
    login(data, {
      onSuccess: () => {
        toast.success(t("messages.loginSuccess"));

        // Use full page reload to ensure session is properly loaded
        // This prevents race condition where session might not be available yet
        // when the profile page tries to fetch user data

        // Redirect logic:
        // 1. If callbackUrl exists (from middleware or manual), redirect there,
        //    but only a same-origin PATH: ?next= / ?callbackUrl= is attacker-
        //    controlled, so an absolute URL, "//host" or "javascript:" would
        //    otherwise send a freshly signed-in visitor off-site (open redirect)
        // 2. Otherwise, or if it is not a safe path, redirect to /stores
        //    (store selection page). More appropriate for new users than /profile
        window.location.href = safeInternalPath(nextUrl) ?? "/stores";
      },
      onError: (err) => {
        const msg = err?.message || "";
        // Detect unverified email errors by message content
        if (/verify|verification|not verified/i.test(msg)) {
          // Capture email from form to allow resending
          const emailFromForm = form.getValues().email;
          setUnverifiedEmail(emailFromForm || null);
          toast.error(msg || t("messages.invalidCredentials"));
        } else {
          toast.error(msg || t("messages.invalidCredentials"));
        }
        // User stays on login page to retry
      },
    });
  };

  return (
    <div className="w-full space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--epi-cream-50)" }}>
          {t("auth.welcome")}
        </h1>
        <p style={{ color: "rgba(251,249,228,0.55)" }}>{t("auth.signInToContinue")}</p>
      </div>

      <Button
        variant="outline"
        type="button"
        disabled={isPending}
        className="h-12 w-full rounded-xl bg-transparent font-medium hover:bg-white/5"
        style={{ borderColor: "rgba(255,255,255,0.18)", color: "var(--epi-cream-50)" }}
        onClick={async () => {
          // Click-intent only — this redirects to Google's OAuth flow, so
          // there's no client-side success callback to confirm completion.
          trackEvent("cta_click", {
            event_category: "engagement",
            event_label: "google_login_start",
          });
          await authClient.signIn.social({
            provider: "google",
            // Honors a deep link (e.g. the store-transfer accept page) the
            // same way the email login does — validated, since OAuth
            // callbacks are a classic open-redirect vector.
            callbackURL: safeInternalPath(nextUrl) ?? "/stores",
          });
        }}
      >
        <GoogleIcon />
        Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-white/15" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span
            className="px-2"
            style={{ background: "var(--epi-navy-900)", color: "rgba(251,249,228,0.4)" }}
          >
            {t("auth.orContinueWithEmail")}
          </span>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={{ color: "var(--epi-cream-50)" }}>{t("auth.email")}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder={t("auth.emailPlaceholder")}
                      disabled={isPending}
                      autoComplete="email"
                      className="h-12 rounded-xl border-white/10 bg-white/5 text-[var(--epi-cream-50)] transition-all placeholder:text-[rgba(251,249,228,0.35)] focus:border-[var(--epi-gold-500)] focus:bg-white/8"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel style={{ color: "var(--epi-cream-50)" }}>
                      {t("auth.password")}
                    </FormLabel>
                    <Link
                      href="/forgot-password"
                      className="text-sm font-medium transition-colors hover:underline"
                      style={{ color: "var(--epi-gold-400)" }}
                    >
                      {t("auth.forgotPassword")}
                    </Link>
                  </div>
                  <FormControl>
                    <Input
                      type="password"
                      disabled={isPending}
                      autoComplete="current-password"
                      className="h-12 rounded-xl border-white/10 bg-white/5 text-[var(--epi-cream-50)] transition-all placeholder:text-[rgba(251,249,228,0.35)] focus:border-[var(--epi-gold-500)] focus:bg-white/8"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button
            type="submit"
            className="h-12 w-full rounded-xl text-base font-semibold transition-all hover:scale-[1.02]"
            style={{ background: "var(--epi-gold-500)", color: "var(--epi-navy-900)" }}
            disabled={isPending}
          >
            {isPending ? t("messages.loggingIn") : t("auth.loginButton")}
          </Button>
        </form>
      </Form>

      {unverifiedEmail && (
        <div className="mt-4 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t("auth.verifyEmail.notice")}</p>
              <p className="mt-1 text-xs">{t("auth.verifyEmail.checkYourEmail")}</p>
            </div>
            <div className="ml-4">
              <button
                type="button"
                className="inline-flex items-center rounded-md border border-transparent bg-yellow-600 px-3 py-2 text-xs font-medium text-white hover:bg-yellow-700"
                onClick={async () => {
                  setIsResending(true);
                  try {
                    const { error } = await authClient.sendVerificationEmail({
                      email: unverifiedEmail,
                      callbackURL: safeInternalPath(nextUrl) ?? "/onboarding",
                    });

                    if (error) {
                      toast.error(error.message || t("auth.verifyEmail.resendError"));
                    } else {
                      setResendSuccess(true);
                      toast.success(t("auth.verifyEmail.resendSuccess"));
                    }
                  } catch {
                    toast.error(t("auth.verifyEmail.resendError"));
                  } finally {
                    setIsResending(false);
                  }
                }}
                disabled={isResending || resendSuccess}
              >
                {isResending
                  ? t("auth.verifyEmail.resending")
                  : resendSuccess
                    ? t("auth.verifyEmail.resendSuccess")
                    : t("auth.verifyEmail.resendButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-center text-sm" style={{ color: "rgba(251,249,228,0.55)" }}>
        {t("auth.dontHaveAccount")}{" "}
        <Link
          href={
            safeInternalPath(nextUrl)
              ? `/register?next=${encodeURIComponent(safeInternalPath(nextUrl)!)}`
              : "/register"
          }
          className="font-semibold transition-colors hover:underline"
          style={{ color: "var(--epi-gold-400)" }}
        >
          {t("auth.registerButton")}
        </Link>
      </p>
    </div>
  );
}
