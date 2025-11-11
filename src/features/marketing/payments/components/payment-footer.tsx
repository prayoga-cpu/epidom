"use client";

/**
 * Payment Footer Component
 *
 * Footer for payment page with copyright, Stripe branding, and contact support link.
 * Uses i18n for all text content.
 *
 * @component
 */

import { useI18n } from "@/components/lang/i18n-provider";
import Link from "next/link";

export function PaymentFooter() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-gray-200 bg-white py-6 animate-slide-up-delayed-2">
      <div className="mx-auto max-w-7xl px-6 md:px-8 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 text-sm text-gray-600 md:flex-row">
          <div className="text-center md:text-left">
            <p>{t("footer.rights")}</p>
          </div>
          <div className="flex items-center gap-4 text-center">
            <span className="text-xs text-gray-500">{t("payments.footer.securelyPowered")}</span>
            <span className="font-semibold text-brand-primary">{t("payments.footer.stripe")}</span>
            <span className="text-gray-300">|</span>
            <Link href="/contact" className="hover:underline text-brand-primary">
              {t("payments.footer.contactSupport")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

