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
      businessName: "",
      address: "",
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
        <h1 className="text-brand-primary text-2xl font-bold tracking-tight">
          {t("auth.createAccount")}
        </h1>
        <p className="text-gray-500">{t("auth.manageYourInventory")}</p>
      </div>

      <Button
        variant="outline"
        type="button"
        disabled={isPending}
        className="h-12 w-full rounded-xl border-gray-200 font-medium text-gray-700 hover:bg-gray-50"
        onClick={async () => {
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
          <span className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-gray-500">Or continue with email</span>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold tracking-wide text-gray-400 uppercase">
              {t("auth.accountInfo")}
            </h3>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700">{t("auth.name")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("auth.namePlaceholder") || "Jane Baker"}
                        disabled={isPending}
                        autoComplete="name"
                        className="focus:border-brand-primary h-12 rounded-xl border-gray-200 bg-gray-50 transition-all focus:bg-white"
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
                    <FormLabel className="text-gray-700">{t("auth.email")}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={t("auth.emailPlaceholder") || "you@bakery.com"}
                        disabled={isPending}
                        autoComplete="email"
                        className="focus:border-brand-primary h-12 rounded-xl border-gray-200 bg-gray-50 transition-all focus:bg-white"
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
                      <FormLabel className="text-gray-700">{t("auth.password")}</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          disabled={isPending}
                          autoComplete="new-password"
                          className="focus:border-brand-primary h-12 rounded-xl border-gray-200 bg-gray-50 transition-all focus:bg-white"
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
                      <FormLabel className="text-gray-700">{t("auth.confirmPassword")}</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          disabled={isPending}
                          autoComplete="new-password"
                          className="focus:border-brand-primary h-12 rounded-xl border-gray-200 bg-gray-50 transition-all focus:bg-white"
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

          <section className="space-y-4">
            <h3 className="text-sm font-semibold tracking-wide text-gray-400 uppercase">
              {t("auth.businessInfo")}
            </h3>
            <div className="grid gap-4">
              <FormField
                control={form.control}
                name="businessName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700">{t("auth.businessName")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("auth.businessNamePlaceholder") || "Epidom Bakery"}
                        disabled={isPending}
                        autoComplete="organization"
                        className="focus:border-brand-primary h-12 rounded-xl border-gray-200 bg-gray-50 transition-all focus:bg-white"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700">{t("auth.address")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="123 Main St, Paris"
                        disabled={isPending}
                        autoComplete="street-address"
                        className="focus:border-brand-primary h-12 rounded-xl border-gray-200 bg-gray-50 transition-all focus:bg-white"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <Button
            type="submit"
            disabled={isPending}
            className="bg-brand-primary shadow-brand-primary/25 hover:bg-brand-primary/90 hover:shadow-brand-primary/40 h-12 w-full rounded-xl text-base font-semibold text-white shadow-lg transition-all hover:scale-[1.02]"
          >
            {isPending ? "Creating account..." : t("auth.registerButton")}
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-gray-600">
        {t("auth.alreadyHaveAccount")}{" "}
        <Link
          href="/login"
          className="text-brand-primary hover:text-brand-primary/80 font-semibold transition-colors"
        >
          {t("auth.loginButton")}
        </Link>
      </p>
    </div>
  );
}
