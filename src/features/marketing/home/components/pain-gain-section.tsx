"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "@/features/marketing/shared/components/container";
import { X, Check } from "lucide-react";

const OLD_ITEMS = ["manualNotes", "driveMenu", "waOrder", "unknownProfit"] as const;
const NEW_ITEMS = ["oneLink", "selfOrder", "waNotif", "autoReport"] as const;

export function PainGainSection() {
  const { t } = useI18n();

  return (
    <section className="bg-white py-24">
      <Container maxWidth="6xl">
        {/* Header */}
        <div className="mb-14 text-center">
          <h2 className="text-brand-primary mb-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {t("home.painGain.headline")}
          </h2>
          <p className="text-brand-primary/60 mx-auto max-w-xl text-lg leading-[1.7]">
            {t("home.painGain.description")}
          </p>
        </div>

        {/* Comparison grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Old way */}
          <div className="rounded-2xl border border-red-100 bg-red-50/40 p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <X className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-600">{t("home.painGain.oldWay.subtitle")}</p>
                <h3 className="text-lg font-bold text-neutral-800">{t("home.painGain.oldWay.title")}</h3>
              </div>
            </div>
            <ul className="space-y-3">
              {OLD_ITEMS.map((key) => (
                <li key={key} className="flex items-start gap-3 text-sm text-neutral-600">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  {t(`home.painGain.oldWay.items.${key}`)}
                </li>
              ))}
            </ul>
          </div>

          {/* Epidom way */}
          <div className="bg-brand-primary rounded-2xl p-8 text-white">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                <Check className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white/60">{t("home.painGain.epidomWay.subtitle")}</p>
                <h3 className="text-lg font-bold text-white">{t("home.painGain.epidomWay.title")}</h3>
              </div>
            </div>
            <ul className="space-y-3">
              {NEW_ITEMS.map((key) => (
                <li key={key} className="flex items-start gap-3 text-sm text-white/80">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-300" />
                  {t(`home.painGain.epidomWay.items.${key}`)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
