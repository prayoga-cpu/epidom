"use client";

import { CreditCard, Printer, ReceiptText, TabletSmartphone, type LucideIcon } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { onlinePaymentCopyKey } from "@/config/storefront-ordering.config";
import { SectionHeading } from "./landing-ui";

const ITEMS: readonly { key: string; icon: LucideIcon }[] = [
  { key: "online", icon: CreditCard },
  { key: "till", icon: ReceiptText },
  { key: "devices", icon: TabletSmartphone },
  { key: "print", icon: Printer },
];

/**
 * "No new hardware needed", stated as the code has it: online card payments
 * go to the merchant's own Stripe account (Connect); cash, cheque,
 * Titre-Restaurant or an outside card terminal are recorded at the till, not
 * processed; Bluetooth printing works from Chrome on Android or a computer
 * only. No payment or integration logos: Epidom records Apple Pay, Google Pay
 * and PayPal, it does not process them.
 */
export function WorksWithSection() {
  const { t } = useI18n();

  return (
    <section aria-labelledby="works-title" className="epi-section">
      <div className="epi-container">
        <SectionHeading
          id="works-title"
          eyebrow={t("redesign.landing.works.eyebrow")}
          title={t("redesign.landing.works.title")}
        />
        <ul className="m-0 mt-12 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map(({ key, icon: Icon }) => (
            <li
              key={key}
              className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-6"
            >
              <Icon aria-hidden="true" className="text-epi-gold-400 size-6" />
              <h3 className="text-epi-cream-50 m-0 text-lg font-medium">
                {t(
                  key === "online"
                    ? onlinePaymentCopyKey("redesign.landing.works.onlineTitle")
                    : `redesign.landing.works.${key}Title`
                )}
              </h3>
              <p className="text-epi-cream-50/70 m-0 text-[15px] leading-relaxed">
                {t(
                  key === "online"
                    ? onlinePaymentCopyKey("redesign.landing.works.onlineBody")
                    : `redesign.landing.works.${key}Body`
                )}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
