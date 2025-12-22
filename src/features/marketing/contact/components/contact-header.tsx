"use client";

/**
 * Contact Header Component
 *
 * Page header for contact page with title and subtitle.
 * Responsive typography sizing.
 *
 * @component
 */

import { useI18n } from "@/components/lang/i18n-provider";

export function ContactHeader() {
  const { t } = useI18n();

  return (
    <div>
      <h1 className="text-brand-primary mb-6 text-4xl leading-none font-extrabold tracking-tight md:mb-8 md:text-5xl lg:mb-6 lg:text-6xl">
        {t("contact.title")}
      </h1>

      <p className="text-brand-primary/60 mb-6 text-lg leading-relaxed md:mb-8 md:text-2xl lg:mb-6 lg:text-xl">
        {t("contact.subtitle")}
      </p>
    </div>
  );
}
