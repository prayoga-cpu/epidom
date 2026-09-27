"use client";

import Link from "next/link";
import { CircleAlert, X } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Shown when the visitor arrived from an email verification link that
 * didn't work (expired, already used). Never blocking: they are signed in
 * and can carry on with setup; the sign-in page resends a fresh link to an
 * account that still isn't verified.
 */
export function VerificationNotice({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useI18n();
  return (
    <Alert className="relative pr-12">
      <CircleAlert aria-hidden="true" />
      <AlertTitle className="line-clamp-none">{t("onboarding.landing.linkErrorTitle")}</AlertTitle>
      <AlertDescription>
        <p>{t("onboarding.landing.linkErrorBody")}</p>
        <Link
          href="/login"
          className="font-medium text-[var(--epi-gold-600)] underline underline-offset-4"
        >
          {t("onboarding.landing.linkErrorAction")}
        </Link>
      </AlertDescription>
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        onClick={onDismiss}
        className="absolute top-1 right-1"
        aria-label={t("onboarding.landing.dismiss")}
      >
        <X aria-hidden="true" />
      </Button>
    </Alert>
  );
}
