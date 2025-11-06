"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
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
import { useEffect } from "react";
import { toast } from "sonner";

export function RegisterForm() {
  const { t } = useI18n();
  const { mutate: register, isPending, error } = useRegister();

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

  // Show toast on error
  useEffect(() => {
    if (error) {
      toast.error(error.message || t("messages.registrationFailed"));
    }
  }, [error, t]);

  const onSubmit = (data: RegisterInput) => {
    register(data);
  };

  return (
    <Card className="w-full max-w-lg border-2 shadow-xl">
      <CardHeader className="space-y-2 pb-6">
        <CardTitle className="from-primary to-primary/60 bg-gradient-to-r bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
          {t("auth.createAccount")}
        </CardTitle>
        <CardDescription className="text-base">{t("auth.manageYourInventory")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <section className="space-y-4">
              <h3 className="font-medium">{t("auth.accountInfo")}</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>{t("auth.name")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Jane Baker"
                          disabled={isPending}
                          autoComplete="off"
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
                    <FormItem className="md:col-span-2">
                      <FormLabel>{t("auth.email")}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@bakery.com"
                          disabled={isPending}
                          autoComplete="off"
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
                      <FormLabel>{t("auth.password")}</FormLabel>
                      <FormControl>
                        <Input type="password" disabled={isPending} {...field} />
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
                      <FormLabel>{t("auth.confirmPassword")}</FormLabel>
                      <FormControl>
                        <Input type="password" disabled={isPending} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <Separator />

            <section className="space-y-4">
              <h3 className="font-medium">{t("auth.businessInfo")}</h3>
              <div className="grid gap-4">
                <FormField
                  control={form.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("auth.businessName")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Epidom Bakery"
                          disabled={isPending}
                          autoComplete="off"
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
                      <FormLabel>{t("auth.address")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="123 Main St, Paris"
                          disabled={isPending}
                          autoComplete="off"
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
              className="w-full shadow-md transition-all hover:shadow-lg"
            >
              {isPending ? "Creating account..." : t("auth.registerButton")}
            </Button>
          </form>
        </Form>

        <p className="text-muted-foreground mt-6 text-center text-sm">
          {t("auth.alreadyHaveAccount")}{" "}
          <Link
            href="/login"
            className="text-primary hover:text-primary/80 font-semibold underline underline-offset-4 transition-colors"
          >
            {t("auth.loginButton")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
