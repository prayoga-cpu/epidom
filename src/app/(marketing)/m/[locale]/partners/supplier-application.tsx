"use client";

import { useId, useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { PlaceholderCta } from "@/features/marketing/shared/components/placeholder-page";
import { trackConversion } from "@/lib/analytics";
import {
  SUPPORT_EMAIL_DISPLAY,
  getWhatsAppOptions,
  supportMailto,
  whatsappHref,
} from "@/lib/constants/contact";
import { cn } from "@/lib/utils";

type SupplyCategory = "coffee" | "frozen" | "bakery";

/**
 * The supplier application path (docs/STRATEGY.md §9, acquisition channel #2:
 * bean roasters, frozen-food distributors, bakery suppliers). There is no form
 * and no backend: the primary action is a WhatsApp deep link with the message
 * already written in the visitor's language, and the picked category just
 * chooses which sentence is prefilled. The email button is the fallback.
 *
 * The visitor sees exactly what will be sent before tapping, and both actions
 * are ordinary links, so this works without JavaScript beyond the category chips.
 */
export function SupplierApplication() {
  const { t, locale } = useI18n();
  const [category, setCategory] = useState<SupplyCategory | null>(null);
  const titleId = useId();
  const pickLabelId = useId();

  const categories: Array<{ id: SupplyCategory; label: string; message: string }> = [
    {
      id: "coffee",
      label: t("partners.supplier.catCoffee"),
      message: t("partners.supplier.msgCoffee"),
    },
    {
      id: "frozen",
      label: t("partners.supplier.catFrozen"),
      message: t("partners.supplier.msgFrozen"),
    },
    {
      id: "bakery",
      label: t("partners.supplier.catBakery"),
      message: t("partners.supplier.msgBakery"),
    },
  ];
  const message =
    categories.find((c) => c.id === category)?.message ?? t("partners.supplier.msgGeneric");

  // fr and id pages offer their own market's number; en offers both.
  const whatsappOptions = getWhatsAppOptions(locale);

  return (
    <section
      aria-labelledby={titleId}
      className="w-full rounded-3xl border border-[rgba(217,174,59,0.28)] bg-[linear-gradient(180deg,rgba(217,174,59,0.08),rgba(255,255,255,0.02))] p-6 sm:p-8"
    >
      <p className="epi-eyebrow">{t("partners.supplier.eyebrow")}</p>
      <h2
        id={titleId}
        className="mt-3 text-2xl leading-tight font-semibold text-[var(--epi-cream-50)] sm:text-3xl"
      >
        {t("partners.supplier.title")}
      </h2>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[rgba(251,249,228,0.68)]">
        {t("partners.supplier.body")}
      </p>

      <div role="group" aria-labelledby={pickLabelId} className="mt-6">
        <p
          id={pickLabelId}
          className="mb-3 text-xs font-semibold tracking-[0.12em] text-[rgba(251,249,228,0.5)] uppercase"
        >
          {t("partners.supplier.pickLabel")}
        </p>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const selected = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setCategory(selected ? null : c.id)}
                className={cn(
                  "min-h-11 cursor-pointer rounded-full border px-4 text-sm font-medium transition-colors",
                  selected
                    ? "border-[var(--epi-gold-500)] bg-[rgba(217,174,59,0.16)] text-[var(--epi-gold-300)]"
                    : "border-white/15 text-[rgba(251,249,228,0.78)] hover:border-white/35"
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-[rgba(251,249,228,0.45)] uppercase">
          {t("partners.supplier.previewLabel")}
        </p>
        <p
          aria-live="polite"
          className="mt-1 text-[15px] leading-relaxed text-[var(--epi-cream-50)]"
        >
          {message}
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {whatsappOptions.map((option, i) => (
          <PlaceholderCta
            key={option.number}
            href={whatsappHref(option.number, message)}
            external
            variant={i === 0 ? "primary" : "secondary"}
            onClick={() =>
              trackConversion("contact_whatsapp", {
                event_label: "partners_supplier",
                supplier_category: category ?? "unspecified",
                market: option.label,
              })
            }
          >
            {whatsappOptions.length > 1
              ? `${t("partners.supplier.whatsappCta")} (${option.label})`
              : t("partners.supplier.whatsappCta")}
          </PlaceholderCta>
        ))}
        <PlaceholderCta
          href={supportMailto(t("partners.supplier.emailSubject"))}
          variant="secondary"
          onClick={() => trackConversion("contact_email", { event_label: "partners_supplier" })}
        >
          {t("partners.supplier.emailCta")}
        </PlaceholderCta>
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-[rgba(251,249,228,0.5)]">
        {t("partners.emailFallback").replace("{emails}", SUPPORT_EMAIL_DISPLAY)}
      </p>
    </section>
  );
}
