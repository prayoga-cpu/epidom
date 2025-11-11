"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, LoginInput } from "../../validation/auth.schemas";
import { useLogin } from "../../hooks/use-auth";
import { useEffect } from "react";
import { toast } from "sonner";

export function LoginForm() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || searchParams.get("callbackUrl");
  const registered = searchParams.get("registered");

  const { mutate: login, isPending, error } = useLogin();

  // Show success toast for new registrations
  useEffect(() => {
    if (registered === "true") {
      toast.success("Account created successfully! Please log in to continue.");
    }
  }, [registered]);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: LoginInput) => {
    login(data, {
      onSuccess: () => {
        toast.success(t("messages.loginSuccess") || "Logged in successfully!");

        // Use full page reload to ensure session is properly loaded
        // This prevents race condition where session might not be available yet
        // when the profile page tries to fetch user data
        const redirectUrl = nextUrl || "/profile";
        window.location.href = redirectUrl;
      },
      onError: (err) => {
        toast.error(err.message || t("messages.invalidCredentials"));
      },
    });
  };

  return (
    <Card className="w-full max-w-md border-2 shadow-xl">
      <CardHeader className="space-y-2 pb-6">
        <CardTitle className="from-primary to-primary/60 bg-gradient-to-r bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
          {t("auth.welcome")}
        </CardTitle>
        <CardDescription className="text-base">{t("auth.signInToContinue")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
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

            <Button
              type="submit"
              className="w-full shadow-md transition-all hover:shadow-lg"
              disabled={isPending}
            >
              {isPending ? t("messages.loggingIn") || "Logging in..." : t("auth.loginButton")}
            </Button>
          </form>
        </Form>

        <Separator className="my-6" />
        <p className="text-muted-foreground text-center text-sm">
          {t("auth.dontHaveAccount")}{" "}
          <Link
            href="/register"
            className="text-primary hover:text-primary/80 font-semibold underline underline-offset-4 transition-colors"
          >
            {t("auth.registerButton")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
