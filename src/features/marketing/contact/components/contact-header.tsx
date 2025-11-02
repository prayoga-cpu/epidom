"use client";

import { useI18n } from "@/components/lang/i18n-provider";

export function ContactHeader() {
  const { t } = useI18n();

  return (
    <div>
      <h1
        className="mb-6 text-3xl leading-tight font-bold tracking-tight md:mb-8 md:text-5xl lg:text-6xl"
        style={{ color: "#444444" }}
      >
        {t("contact.title")}
      </h1>

      <p
        className="mb-6 text-lg leading-relaxed md:mb-8 md:text-2xl"
        style={{ color: "#444444" }}
      >
        {t("contact.subtitle")}
      </p>
    </div>
  );
}


