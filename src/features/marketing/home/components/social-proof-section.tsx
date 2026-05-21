"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "@/features/marketing/shared/components/container";
import { Star } from "lucide-react";

const TESTIMONIALS = [
  { nameKey: "home.testimonials.t1Name", roleKey: "home.testimonials.t1Role", quoteKey: "home.testimonials.t1Quote" },
  { nameKey: "home.testimonials.t2Name", roleKey: "home.testimonials.t2Role", quoteKey: "home.testimonials.t2Quote" },
  { nameKey: "home.testimonials.t3Name", roleKey: "home.testimonials.t3Role", quoteKey: "home.testimonials.t3Quote" },
] as const;

export function SocialProofSection() {
  const { t } = useI18n();

  return (
    <section className="bg-bg-warm py-24">
      <Container maxWidth="6xl">
        {/* Header */}
        <div className="mb-14 text-center">
          <h2 className="text-brand-primary mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
            {t("home.testimonials.headline")}
          </h2>
          <p className="text-brand-primary/60 text-lg">{t("home.testimonials.subheadline")}</p>
        </div>

        {/* Testimonial cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {TESTIMONIALS.map(({ nameKey, roleKey, quoteKey }) => (
            <div
              key={nameKey}
              className="flex flex-col rounded-2xl border border-neutral-100 bg-white p-7 shadow-sm"
            >
              {/* Stars */}
              <div className="mb-4 flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              {/* Quote */}
              <p className="text-brand-primary/75 mb-6 flex-1 text-sm leading-[1.7] italic">
                &ldquo;{t(quoteKey)}&rdquo;
              </p>
              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="bg-brand-primary/10 text-brand-primary flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold">
                  {t(nameKey).charAt(0)}
                </div>
                <div>
                  <p className="text-brand-primary text-sm font-semibold">{t(nameKey)}</p>
                  <p className="text-brand-primary/50 text-xs">{t(roleKey)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Rating badge */}
        <div className="mt-10 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-neutral-100 bg-white px-4 py-2 text-sm text-neutral-600 shadow-sm">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            {t("home.testimonials.ratingBadge")}
          </span>
        </div>
      </Container>
    </section>
  );
}
