"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "@/features/marketing/shared/components/container";
import { Button } from "@/components/ui/button";
import { ArrowRight, Lock, Smartphone, Zap } from "lucide-react";
import { useRouter } from "next/navigation";

const TRUST_BADGES = [
  { icon: Lock, titleKey: "home.closingCta.badges.secure.title", descKey: "home.closingCta.badges.secure.description" },
  { icon: Smartphone, titleKey: "home.closingCta.badges.mobile.title", descKey: "home.closingCta.badges.mobile.description" },
  { icon: Zap, titleKey: "home.closingCta.badges.quick.title", descKey: "home.closingCta.badges.quick.description" },
] as const;

export function ClosingCtaSection() {
  const { t } = useI18n();
  const router = useRouter();

  const handleStartFree = () => router.push("/register");
  const handleWhatsApp = () => window.open("https://wa.me/6281234567890", "_blank");

  return (
    <section className="bg-brand-primary py-24">
      <Container maxWidth="5xl">
        <div className="text-center">
          {/* Badge */}
          <span className="mb-6 inline-block rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white/80">
            {t("home.closingCta.badge")}
          </span>

          {/* Headline */}
          <h2 className="mb-5 text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
            {t("home.closingCta.headline")}
          </h2>

          {/* Sub */}
          <p className="mb-10 text-lg leading-[1.7] text-white/65">
            {t("home.closingCta.description")}
          </p>

          {/* CTAs */}
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              onClick={handleStartFree}
              className="group w-full cursor-pointer rounded-full bg-white px-8 py-6 text-base font-semibold text-neutral-900 shadow-lg hover:bg-neutral-100 sm:w-auto"
            >
              {t("home.closingCta.ctaStartFree")}
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
            <Button
              onClick={handleWhatsApp}
              variant="outline"
              className="w-full cursor-pointer rounded-full border border-white/30 bg-transparent px-8 py-6 text-base font-semibold text-white hover:bg-white/10 sm:w-auto"
            >
              {t("home.closingCta.ctaWhatsApp")}
            </Button>
          </div>

          {/* Trust badges */}
          <div className="mt-12 flex flex-col items-center justify-center gap-6 sm:flex-row sm:gap-10">
            {TRUST_BADGES.map(({ icon: Icon, titleKey, descKey }) => (
              <div key={titleKey} className="flex items-center gap-2.5 text-white/60">
                <Icon className="h-4 w-4 shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-medium text-white/80">{t(titleKey)}</p>
                  <p className="text-xs">{t(descKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
