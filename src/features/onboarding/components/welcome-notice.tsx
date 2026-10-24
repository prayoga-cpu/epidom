"use client";

import { PartyPopper, X } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Greets a brand-new account that just finished signing up (email
 * verified, or Google created it) on the setup wizard. Dismissible, and gone
 * once the owner moves on from the first step.
 */
export function WelcomeNotice({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useI18n();
  return (
    <Alert
      role="status"
      className="border-epi-gold-500/40 bg-epi-gold-500/10 [&>svg]:text-epi-gold-600 dark:[&>svg]:text-epi-gold-400 relative pr-12"
    >
      <PartyPopper aria-hidden="true" />
      <AlertTitle className="line-clamp-none">{t("onboarding.landing.welcomeTitle")}</AlertTitle>
      <AlertDescription>
        <p>{t("onboarding.landing.welcomeBody")}</p>
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
