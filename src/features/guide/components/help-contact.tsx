"use client";

import { useState } from "react";
import { MessageCircle, MessageSquarePlus } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { WHATSAPP_NUMBERS, getWhatsAppOptions, whatsappHref } from "@/lib/constants/contact";
import { FeedbackDialog } from "@/features/dashboard/feedback/components/feedback-dialog";
import { HelpActionRow, HelpRowGroup, HelpSection } from "./help-rows";

/**
 * WhatsApp support — the market's own number(s), from the one place they are
 * written down (src/lib/constants/contact.ts) — and the in-app feedback form.
 */
export function HelpContact() {
  const { t, locale } = useI18n();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const message = t("helpCenter.contact.whatsappMessage");

  return (
    <HelpSection
      title={t("helpCenter.contact.title")}
      description={t("helpCenter.contact.subtitle")}
    >
      <HelpRowGroup label={t("helpCenter.contact.title")}>
        {getWhatsAppOptions(locale ?? "en").map((option) => {
          const market =
            option.number === WHATSAPP_NUMBERS.id.number
              ? t("helpCenter.contact.markets.id")
              : t("helpCenter.contact.markets.fr");
          return (
            <HelpActionRow
              key={option.number}
              icon={MessageCircle}
              label={t("helpCenter.contact.whatsappMarket").replace("{market}", market)}
              description={t("helpCenter.contact.whatsappDesc")}
              externalHref={whatsappHref(option.number, message)}
            />
          );
        })}
        <HelpActionRow
          icon={MessageSquarePlus}
          label={t("helpCenter.contact.feedback")}
          description={t("helpCenter.contact.feedbackDesc")}
          onClick={() => setFeedbackOpen(true)}
        />
      </HelpRowGroup>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </HelpSection>
  );
}
