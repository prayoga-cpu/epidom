"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "@/features/marketing/shared/components/container";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

const TIERS = [
  {
    nameKey: "home.featureLadder.tier1Name",
    priceKey: "home.featureLadder.tier1Price",
    items: [
      "home.featureLadder.tier1f1",
      "home.featureLadder.tier1f2",
      "home.featureLadder.tier1f3",
    ],
    highlight: false,
  },
  {
    nameKey: "home.featureLadder.tier2Name",
    priceKey: "home.featureLadder.tier2Price",
    items: [
      "home.featureLadder.tier2f1",
      "home.featureLadder.tier2f2",
      "home.featureLadder.tier2f3",
    ],
    highlight: false,
  },
  {
    nameKey: "home.featureLadder.tier3Name",
    priceKey: "home.featureLadder.tier3Price",
    items: [
      "home.featureLadder.tier3f1",
      "home.featureLadder.tier3f2",
      "home.featureLadder.tier3f3",
      "home.featureLadder.tier3f4",
    ],
    highlight: true,
  },
  {
    nameKey: "home.featureLadder.tier4Name",
    priceKey: "home.featureLadder.tier4Price",
    items: [
      "home.featureLadder.tier4f1",
      "home.featureLadder.tier4f2",
      "home.featureLadder.tier4f3",
    ],
    highlight: false,
  },
] as const;

export function FeatureLadderSection() {
  const { t } = useI18n();

  return (
    <section className="bg-bg-warm py-24">
      <Container maxWidth="6xl">
        {/* Header */}
        <div className="mb-14 text-center">
          <h2 className="text-brand-primary mb-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {t("home.featureLadder.headline")}
          </h2>
          <p className="text-brand-primary/60 mx-auto max-w-xl text-lg leading-[1.7]">
            {t("home.featureLadder.subheadline")}
          </p>
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map(({ nameKey, priceKey, items, highlight }) => (
            <div
              key={nameKey}
              className={`flex flex-col rounded-2xl border p-6 transition-all duration-200 ${
                highlight
                  ? "bg-brand-primary border-brand-primary text-white shadow-xl"
                  : "border-neutral-150 bg-white text-neutral-800 shadow-sm hover:shadow-md"
              }`}
            >
              {highlight && (
                <span className="mb-3 inline-block w-fit rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold text-white">
                  {t("home.featureLadder.popular")}
                </span>
              )}
              <p className={`text-xs font-semibold tracking-widest uppercase mb-2 ${highlight ? "text-white/60" : "text-neutral-400"}`}>
                {t(nameKey)}
              </p>
              <p className={`text-2xl font-bold mb-6 ${highlight ? "text-white" : "text-brand-primary"}`}>
                {t(priceKey)}
              </p>
              <ul className="flex-1 space-y-2.5">
                {items.map((key) => (
                  <li key={key} className="flex items-start gap-2.5 text-sm">
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${highlight ? "text-white/70" : "text-green-500"}`} />
                    <span className={highlight ? "text-white/80" : "text-neutral-600"}>{t(key)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Link to full pricing */}
        <div className="mt-10 text-center">
          <Button variant="outline" className="border-brand-primary/20 text-brand-primary hover:bg-brand-primary/5 rounded-full px-8" asChild>
            <Link href="/pricing">
              {t("home.featureLadder.viewFull")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}
