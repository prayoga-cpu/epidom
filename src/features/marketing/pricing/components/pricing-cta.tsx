"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "@/features/marketing/shared/components/container";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

export function PricingCta() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <section className="pb-16 md:pb-24">
      <Container maxWidth="5xl">
        <div className="bg-brand-primary rounded-2xl p-8 text-center md:p-14">
          <h3 className="mb-4 text-2xl font-bold text-white md:text-3xl lg:text-4xl">
            {t("pricing.finalCta.title")}
          </h3>
          <p className="mx-auto mb-8 max-w-xl text-base leading-[1.7] text-white/70">
            {t("pricing.finalCta.desc")}
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              onClick={() => router.push("/register")}
              className="group w-full cursor-pointer rounded-full bg-white px-8 py-6 text-base font-semibold text-neutral-900 shadow-lg hover:bg-neutral-100 sm:w-auto"
            >
              {t("pricing.finalCta.ctaFree")}
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
            <Button
              onClick={() => window.open("https://wa.me/6281234567890", "_blank")}
              variant="outline"
              className="w-full cursor-pointer rounded-full border border-white/30 bg-transparent px-8 py-6 text-base font-semibold text-white hover:bg-white/10 sm:w-auto"
            >
              {t("pricing.finalCta.ctaWhatsApp")}
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
