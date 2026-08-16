"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    try {
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });

      if (error) {
        toast.error(error.message);
      } else {
        setIsSent(true);
        toast.success(t("pages.authForgotLinkSent"));
      }
    } catch (err) {
      toast.error(t("pages.authForgotSomethingWrong"));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh/var(--app-zoom,1))] items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">
            {t("pages.authForgotTitle")}
          </CardTitle>
          <CardDescription>{t("pages.authForgotDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isSent ? (
            <div className="space-y-4 text-center">
              <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700">
                {(() => {
                  const [before, after] = t("pages.authForgotCheckEmail").split("{email}");
                  return (
                    <>
                      {before}
                      <strong>{email}</strong>
                      {after}
                    </>
                  );
                })()}
              </div>
              <Button asChild className="w-full" variant="outline">
                <Link href="/login">{t("pages.authForgotBackToLogin")}</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder={t("pages.authForgotEmailPlaceholder")}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("pages.authForgotSendLink")}
              </Button>
              <div className="text-center text-sm">
                <Link href="/login" className="text-brand-primary hover:underline">
                  {t("pages.authForgotBackToLogin")}
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
