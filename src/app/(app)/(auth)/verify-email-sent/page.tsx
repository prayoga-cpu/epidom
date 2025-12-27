"use client";

import { useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";

function VerifyEmailContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleResend = async () => {
    if (!email) return;

    setIsResending(true);
    try {
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: "/onboarding",
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
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            {resendSuccess ? (
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            ) : (
              <Mail className="h-8 w-8 text-green-600" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {t("auth.verifyEmail.heading")}
          </CardTitle>
          <CardDescription className="text-base">
            {t("auth.verifyEmail.description")}
            {email && <span className="mt-2 block font-semibold text-gray-900">{email}</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-700">
            {t("auth.verifyEmail.instructions")}
          </div>

          {email && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleResend}
              disabled={isResending || resendSuccess}
            >
              {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {resendSuccess
                ? t("auth.verifyEmail.resendSuccess")
                : isResending
                  ? t("auth.verifyEmail.resending")
                  : t("auth.verifyEmail.resendButton")}
            </Button>
          )}

          <div className="text-center">
            <Link
              href="/login"
              className="text-brand-primary hover:text-brand-primary/80 text-sm font-medium transition-colors"
            >
              {t("auth.verifyEmail.backToLogin")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailSentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
