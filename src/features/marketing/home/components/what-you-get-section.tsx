"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "@/features/marketing/shared/components/container";
import { QrCode, ShoppingBag, LayoutDashboard } from "lucide-react";

const FEATURES = [
  {
    icon: QrCode,
    titleKey: "home.whatYouGet.feature1Title",
    descKey: "home.whatYouGet.feature1Desc",
    accentClass: "bg-amber-50 text-amber-700",
  },
  {
    icon: ShoppingBag,
    titleKey: "home.whatYouGet.feature2Title",
    descKey: "home.whatYouGet.feature2Desc",
    accentClass: "bg-green-50 text-green-700",
  },
  {
    icon: LayoutDashboard,
    titleKey: "home.whatYouGet.feature3Title",
    descKey: "home.whatYouGet.feature3Desc",
    accentClass: "bg-blue-50 text-blue-700",
  },
] as const;

export function WhatYouGetSection() {
  const { t } = useI18n();

  return (
    <section className="bg-bg-warm py-24">
      <Container maxWidth="6xl">
        {/* Header */}
        <div className="mb-16 text-center">
          <h2 className="text-brand-primary mb-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {t("home.whatYouGet.headline")}
          </h2>
          <p className="text-brand-primary/60 mx-auto max-w-2xl text-lg leading-[1.7]">
            {t("home.whatYouGet.subheadline")}
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, titleKey, descKey, accentClass }) => (
            <div
              key={titleKey}
              className="group rounded-2xl border border-neutral-100 bg-white p-8 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
            >
              <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl ${accentClass}`}>
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="text-brand-primary mb-3 text-lg font-semibold">
                {t(titleKey)}
              </h3>
              <p className="text-brand-primary/60 text-sm leading-[1.7]">
                {t(descKey)}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
