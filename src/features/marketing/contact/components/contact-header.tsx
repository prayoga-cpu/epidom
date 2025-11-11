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
      <h1 className="mb-6 text-3xl leading-tight font-bold tracking-tight md:mb-8 md:text-5xl lg:mb-4 lg:text-5xl text-brand-primary">
        {t("contact.title")}
      </h1>

      <p className="mb-6 text-lg leading-relaxed md:mb-8 md:text-2xl lg:mb-6 lg:text-xl text-brand-primary">
        {t("contact.subtitle")}
      </p>
    </div>
  );
}


