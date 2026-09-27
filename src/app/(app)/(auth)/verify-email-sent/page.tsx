"use client";

import { useEffect, useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { emailVerificationCallbackURL } from "@/features/auth/register/lib/verification-landing";
import {
  readStashedVerifyEmail,
  stashVerifyEmail,
} from "@/features/auth/register/lib/verify-email-handoff";

function VerifyEmailContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  // The address signup just registered. useRegister leaves it in
  // sessionStorage rather than the URL (analytics records page URLs). It is
  // read in an effect because the server has no storage, so reading it during
  // render would not match the server HTML.
  const [email, setEmail] = useState<string | null>(null);
  const urlEmail = searchParams.get("email");
  useEffect(() => {
    if (!urlEmail) {
      setEmail(readStashedVerifyEmail());
      return;
    }
    // A legacy link (history, a bookmark) still carries ?email=. Honour it,
    // and once it is safely stashed, take it out of the address bar so a
    // reload does not put it back in front of analytics. If storage is
    // unavailable it stays in the URL, or a reload would lose it.
    setEmail(urlEmail);
    if (!stashVerifyEmail(urlEmail)) return;
    const rest = new URLSearchParams(window.location.search);
    rest.delete("email");
    const query = rest.toString();
    // null, not history.state: Next's patched replaceState only syncs its
    // router (and useSearchParams) for state it did not write itself.
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`
    );
  }, [urlEmail]);
  // Same landing as the first email: the safe ?next= deep link, else the
  // setup wizard as /onboarding?verified=1.
  const callbackURL = emailVerificationCallbackURL(searchParams.get("next"));
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleResend = async () => {
    if (!email) return;

    setIsResending(true);
    try {
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL,
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
    <div className="flex min-h-[calc(100vh/var(--app-zoom,1))] items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
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
        <div className="flex min-h-[calc(100vh/var(--app-zoom,1))] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
