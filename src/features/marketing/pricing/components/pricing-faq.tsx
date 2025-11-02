"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function PricingFaq() {
  const { t } = useI18n();

  return (
    <section className="pb-12 md:pb-20 lg:pb-24">
      <div className="mx-auto max-w-7xl px-6 md:px-8 lg:px-8">
        <h2 className="mb-6 text-center text-2xl font-bold tracking-tight md:mb-8 md:text-4xl">
          {t("pricing.faq.title")}
        </h2>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger className="text-base font-semibold">
              {t("pricing.faq.q1")}
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed">
              {t("pricing.faq.a1")}
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger className="text-base font-semibold">
              {t("pricing.faq.q2")}
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed">
              {t("pricing.faq.a2")}
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger className="text-base font-semibold">
              {t("pricing.faq.q3")}
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed">
              {t("pricing.faq.a3")}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </section>
  );
}
