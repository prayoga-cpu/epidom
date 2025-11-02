"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { useI18n } from "@/components/lang/i18n-provider";
import { signIn } from "next-auth/react";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setError("");

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        console.error("Login error:", result.error);
        setError(t("messages.invalidCredentials") || "Invalid email or password");
        setLoading(false);
      } else if (result?.ok) {
        // Login successful
        router.push("/stores");
        router.refresh();
      } else {
        console.error("Unexpected result:", result);
        setError(t("messages.loginFailed") || "Login failed. Please try again.");
        setLoading(false);
      }
    } catch (error) {
      console.error("Login exception:", error);
      setError(t("messages.loginFailed") || "Login failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md border-2 shadow-xl">
      <CardHeader className="space-y-2 pb-6">
        <CardTitle className="from-primary to-primary/60 bg-gradient-to-r bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
          {t("auth.welcome")}
        </CardTitle>
        <CardDescription className="text-base">{t("auth.signInToContinue")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={onSubmit} className="space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive border-destructive/20 rounded-md border p-3 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              type="email"
              id="email"
              name="email"
              placeholder="you@bakery.com"
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input type="password" id="password" name="password" required disabled={loading} />
          </div>
          <div className="flex items-center justify-between">
            <Link className="text-primary text-sm underline underline-offset-4" href="#">
              {t("auth.forgotPassword")}
            </Link>
          </div>
          <Button
            type="submit"
            className="w-full shadow-md transition-all hover:shadow-lg"
            disabled={loading}
          >
            {loading ? t("messages.loggingIn") || "Logging in..." : t("auth.loginButton")}
          </Button>
        </form>
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
