"use client";

import Link from "next/link";
import { ArrowRight, MonitorSmartphone } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";

/**
 * Setup was skipped on its plan questions: the store and its draft are saved,
 * only the last Confirm is left, and finishing it is what starts the 14-day
 * POS trial (no card). Shown on Your Stores until setup is finished.
 */
export function FinishSetupBanner() {
  const { t } = useI18n();
  return (
    <section
      data-testid="finish-setup-banner"
      aria-labelledby="finish-setup-title"
      className="mb-4 flex flex-col gap-3 rounded-2xl border border-[var(--epi-gold-500)]/40 bg-[var(--epi-gold-500)]/8 p-4 sm:mb-6 sm:flex-row sm:items-center"
    >
      <span
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--epi-gold-500)] text-[var(--epi-navy-900)]"
      >
        <MonitorSmartphone className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p id="finish-setup-title" className="text-foreground font-semibold">
          {t("stores.finishSetup.title")}
        </p>
        <p className="text-muted-foreground text-sm">{t("stores.finishSetup.body")}</p>
      </div>
      <Button
        asChild
        className="h-11 shrink-0 rounded-xl bg-[var(--epi-gold-500)] px-5 font-semibold text-[var(--epi-navy-900)] hover:bg-[var(--epi-gold-600)]"
      >
        <Link href="/onboarding">
          {t("stores.finishSetup.cta")}
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    </section>
  );
}
