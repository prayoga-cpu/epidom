"use client";

import { Button } from "@/components/ui/button";
import { GoogleIcon } from "../../components/google-icon";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useI18n } from "@/components/lang/i18n-provider";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, RegisterInput } from "../../validation/auth.schemas";
import { useRegister } from "../../hooks/use-auth";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { trackEvent } from "@/lib/analytics";

export function RegisterForm() {
  const { t } = useI18n();
  const { mutate: register, isPending } = useRegister();

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = (data: RegisterInput) => {
    register(data, {
      onError: (err) => {
        toast.error(err.message || t("messages.registrationFailed"));
      },
    });
  };

  return (
    <div className="w-full space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--epi-cream-50)" }}>
          {t("auth.createAccount")}
        </h1>
        <p style={{ color: "rgba(251,249,228,0.55)" }}>{t("auth.manageYourInventory")}</p>
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
            event_label: "google_signup_start",
          });
          await authClient.signIn.social({
            provider: "google",
            callbackURL: "/onboarding",
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
            Or continue with email
          </span>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <section className="space-y-4">
            <h3
              className="text-sm font-semibold tracking-wide uppercase"
              style={{ color: "rgba(251,249,228,0.4)" }}
            >
              {t("auth.accountInfo")}
            </h3>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={{ color: "var(--epi-cream-50)" }}>{t("auth.name")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("auth.namePlaceholder") || "Jane Baker"}
                        disabled={isPending}
                        autoComplete="name"
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={{ color: "var(--epi-cream-50)" }}>
                      {t("auth.email")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={t("auth.emailPlaceholder") || "you@bakery.com"}
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

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel style={{ color: "var(--epi-cream-50)" }}>
                        {t("auth.password")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          disabled={isPending}
                          autoComplete="new-password"
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
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel style={{ color: "var(--epi-cream-50)" }}>
                        {t("auth.confirmPassword")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          disabled={isPending}
                          autoComplete="new-password"
                          className="h-12 rounded-xl border-white/10 bg-white/5 text-[var(--epi-cream-50)] transition-all placeholder:text-[rgba(251,249,228,0.35)] focus:border-[var(--epi-gold-500)] focus:bg-white/8"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </section>

          <Button
            type="submit"
            disabled={isPending}
            className="h-12 w-full rounded-xl text-base font-semibold transition-all hover:scale-[1.02]"
            style={{ background: "var(--epi-gold-500)", color: "var(--epi-navy-900)" }}
          >
            {isPending ? "Creating account..." : t("auth.registerButton")}
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm" style={{ color: "rgba(251,249,228,0.55)" }}>
        {t("auth.alreadyHaveAccount")}{" "}
        <Link
          href="/login"
          className="font-semibold transition-colors hover:underline"
          style={{ color: "var(--epi-gold-400)" }}
        >
          {t("auth.loginButton")}
        </Link>
      </p>
    </div>
  );
}
