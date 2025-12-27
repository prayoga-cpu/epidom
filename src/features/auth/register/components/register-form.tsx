"use client";

import { Button } from "@/components/ui/button";
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
      <div className="space-y-2 text-center md:text-left">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
          {t("auth.createAccount")}
        </h1>
        <p className="text-gray-500">{t("auth.manageYourInventory")}</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
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
                        className="h-12 rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:border-brand-primary transition-all"
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
                        className="h-12 rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:border-brand-primary transition-all"
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
                          className="h-12 rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:border-brand-primary transition-all"
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
                          className="h-12 rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:border-brand-primary transition-all"
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
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
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
                        className="h-12 rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:border-brand-primary transition-all"
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
                        className="h-12 rounded-xl bg-gray-50 border-gray-200 focus:bg-white focus:border-brand-primary transition-all"
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
            className="h-12 w-full rounded-xl bg-brand-primary text-base font-semibold text-white shadow-lg shadow-brand-primary/25 transition-all hover:bg-brand-primary/90 hover:scale-[1.02] hover:shadow-brand-primary/40"
          >
            {isPending ? "Creating account..." : t("auth.registerButton")}
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-gray-600">
        {t("auth.alreadyHaveAccount")}{" "}
        <Link
          href="/login"
          className="font-semibold text-brand-primary hover:text-brand-primary/80 transition-colors"
        >
          {t("auth.loginButton")}
        </Link>
      </p>
    </div>
  );
}
