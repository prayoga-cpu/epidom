"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Container } from "@/features/marketing/shared/components/container";

const FAQ_ITEMS = ["1", "2", "3", "4"] as const;

export function PricingFaq() {
  const { t } = useI18n();

  return (
    <section className="pb-12 md:pb-20 lg:pb-24">
      <Container maxWidth="3xl">
        <h2 className="text-brand-primary mb-8 text-center text-2xl font-bold tracking-tight md:text-4xl">
          {t("pricing.faq.title")}
        </h2>
        <Accordion type="single" collapsible className="w-full">
          {FAQ_ITEMS.map((n) => (
            <AccordionItem key={n} value={`item-${n}`}>
              <AccordionTrigger className="text-left text-base font-semibold text-brand-primary">
                {t(`pricing.faq.q${n}`)}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-brand-primary/70">
                {t(`pricing.faq.a${n}`)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Container>
    </section>
  );
}
