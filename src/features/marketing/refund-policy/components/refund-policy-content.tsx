"use client";

/**
 * Refund Policy Content Component
 *
 * Displays the complete Refund Policy content with multilanguage support.
 * Organized into clear sections for easy reading with improved UI/UX and branding.
 *
 * @component
 */

import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "@/features/marketing/shared/components/container";
import { LegalPageHero } from "@/features/marketing/shared/components/legal-page-hero";

export function RefundPolicyContent() {
  const { t } = useI18n();

  return (
    <div className="space-y-8 py-8 md:space-y-12 md:py-12 lg:py-16">
      {/* Hero Section */}
      <LegalPageHero
        titleKey="refundPolicy.title"
        lastUpdatedKey="refundPolicy.lastUpdated"
        lastUpdatedDateKey="refundPolicy.lastUpdatedDate"
      />

      {/* Content Sections */}
      <Container maxWidth="4xl">
        <div className="space-y-10 md:space-y-12">
          {/* Introduction */}
          <section className="rounded-lg border border-gray-200 bg-gray-50 p-6 md:p-8">
            <p className="text-base leading-relaxed text-gray-700 md:text-lg">
              {t("refundPolicy.introduction")}
            </p>
          </section>

          {/* Section 1: Refund Eligibility */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold md:text-3xl text-brand-primary">
              {t("refundPolicy.section1.title")}
            </h2>
            <p className="leading-relaxed text-gray-700 md:text-base">
              {t("refundPolicy.section1.content")}
            </p>
            <ul className="ml-6 space-y-2.5 text-gray-700 md:ml-8">
              <li className="relative pl-2 before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-gray-400">
                {t("refundPolicy.section1.item1")}
              </li>
              <li className="relative pl-2 before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-gray-400">
                {t("refundPolicy.section1.item2")}
              </li>
              <li className="relative pl-2 before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-gray-400">
                {t("refundPolicy.section1.item3")}
              </li>
            </ul>
          </section>

          {/* Section 2: Refund Process */}
          <section className="space-y-4 border-t border-gray-200 pt-8">
            <h2 className="text-2xl font-semibold md:text-3xl text-brand-primary">
              {t("refundPolicy.section2.title")}
            </h2>
            <p className="leading-relaxed text-gray-700 md:text-base">
              {t("refundPolicy.section2.content")}
            </p>
            <ol className="ml-6 list-decimal space-y-3 text-gray-700 md:ml-8">
              <li className="pl-2">{t("refundPolicy.section2.step1")}</li>
              <li className="pl-2">{t("refundPolicy.section2.step2")}</li>
              <li className="pl-2">{t("refundPolicy.section2.step3")}</li>
              <li className="pl-2">{t("refundPolicy.section2.step4")}</li>
            </ol>
          </section>

          {/* Section 3: Processing Time */}
          <section className="space-y-4 border-t border-gray-200 pt-8">
            <h2 className="text-2xl font-semibold md:text-3xl text-brand-primary">
              {t("refundPolicy.section3.title")}
            </h2>
            <p className="leading-relaxed text-gray-700 md:text-base">
              {t("refundPolicy.section3.content")}
            </p>
          </section>

          {/* Section 4: Non-Refundable Items */}
          <section className="space-y-4 border-t border-gray-200 pt-8">
            <h2 className="text-2xl font-semibold md:text-3xl text-brand-primary">
              {t("refundPolicy.section4.title")}
            </h2>
            <p className="leading-relaxed text-gray-700 md:text-base">
              {t("refundPolicy.section4.content")}
            </p>
            <ul className="ml-6 space-y-2.5 text-gray-700 md:ml-8">
              <li className="relative pl-2 before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-gray-400">
                {t("refundPolicy.section4.item1")}
              </li>
              <li className="relative pl-2 before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-gray-400">
                {t("refundPolicy.section4.item2")}
              </li>
              <li className="relative pl-2 before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-gray-400">
                {t("refundPolicy.section4.item3")}
              </li>
            </ul>
          </section>

          {/* Section 5: Cancellation */}
          <section className="space-y-4 border-t border-gray-200 pt-8">
            <h2 className="text-2xl font-semibold md:text-3xl text-brand-primary">
              {t("refundPolicy.section5.title")}
            </h2>
            <p className="leading-relaxed text-gray-700 md:text-base">
              {t("refundPolicy.section5.content")}
            </p>
          </section>

          {/* Section 6: Partial Refunds */}
          <section className="space-y-4 border-t border-gray-200 pt-8">
            <h2 className="text-2xl font-semibold md:text-3xl text-brand-primary">
              {t("refundPolicy.section6.title")}
            </h2>
            <p className="leading-relaxed text-gray-700 md:text-base">
              {t("refundPolicy.section6.content")}
            </p>
          </section>

          {/* Section 7: Contact for Refunds */}
          <section className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-6 md:p-8">
            <h2 className="text-2xl font-semibold md:text-3xl text-brand-primary">
              {t("refundPolicy.section7.title")}
            </h2>
            <p className="leading-relaxed text-gray-700 md:text-base">
              {t("refundPolicy.section7.content")}
            </p>
            <p className="leading-relaxed text-gray-700 md:text-base">
              <strong className="font-semibold">{t("refundPolicy.section7.email")}:</strong>{" "}
              <a
                href="mailto:support@epidom.com"
                className="font-medium underline transition-colors hover:no-underline text-brand-primary"
              >
                support@epidom.com
              </a>
            </p>
          </section>

          {/* Footer */}
          <div className="border-t border-gray-200 pt-8">
            <p className="text-sm leading-relaxed text-gray-500 md:text-base">
              {t("refundPolicy.footer")}
            </p>
          </div>
        </div>
      </Container>
    </div>
  );
}

