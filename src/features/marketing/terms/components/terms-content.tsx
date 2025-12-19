"use client";

/**
 * Terms and Conditions Content Component
 *
 * Displays the complete Terms and Conditions content with multilanguage support.
 * Organized into clear sections for easy reading with improved UI/UX and branding.
 *
 * @component
 */

import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "@/features/marketing/shared/components/container";
import { LegalPageHero } from "@/features/marketing/shared/components/legal-page-hero";

export function TermsContent() {
  const { t } = useI18n();

  return (
    <div className="space-y-8 py-8 md:space-y-12 md:py-12 lg:py-16">
      {/* Hero Section */}
      <LegalPageHero
        titleKey="terms.title"
        lastUpdatedKey="terms.lastUpdated"
        lastUpdatedDateKey="terms.lastUpdatedDate"
      />

      {/* Content Sections */}
      <Container maxWidth="4xl">
        <div className="space-y-10 md:space-y-12">
          {/* Introduction */}
          <section className="rounded-lg border border-gray-200 bg-gray-50 p-6 md:p-8">
            <p className="text-base leading-relaxed text-gray-700 md:text-lg">
              {t("terms.introduction")}
            </p>
          </section>

          {/* Section 1: Acceptance of Terms */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight text-brand-primary md:text-2xl lg:text-3xl">
              {t("terms.section1.title")}
            </h2>
            <p className="leading-relaxed text-gray-700 md:text-base">
              {t("terms.section1.content")}
            </p>
          </section>

          {/* Section 2: Description of Service */}
          <section className="space-y-4 border-t border-gray-200 pt-8">
            <h2 className="text-2xl font-semibold md:text-3xl text-brand-primary">
              {t("terms.section2.title")}
            </h2>
            <p className="leading-relaxed text-gray-700 md:text-base">
              {t("terms.section2.content")}
            </p>
          </section>

          {/* Section 3: User Accounts */}
          <section className="space-y-4 border-t border-gray-200 pt-8">
            <h2 className="text-2xl font-semibold md:text-3xl text-brand-primary">
              {t("terms.section3.title")}
            </h2>
            <p className="leading-relaxed text-gray-700 md:text-base">
              {t("terms.section3.content")}
            </p>
            <ul className="ml-6 space-y-2.5 text-gray-700 md:ml-8">
              <li className="relative pl-2 before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-gray-400">
                {t("terms.section3.item1")}
              </li>
              <li className="relative pl-2 before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-gray-400">
                {t("terms.section3.item2")}
              </li>
              <li className="relative pl-2 before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-gray-400">
                {t("terms.section3.item3")}
              </li>
              <li className="relative pl-2 before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-gray-400">
                {t("terms.section3.item4")}
              </li>
            </ul>
          </section>

          {/* Section 4: Subscription and Payment */}
          <section className="space-y-4 border-t border-gray-200 pt-8">
            <h2 className="text-2xl font-semibold md:text-3xl text-brand-primary">
              {t("terms.section4.title")}
            </h2>
            <p className="leading-relaxed text-gray-700 md:text-base">
              {t("terms.section4.content")}
            </p>
            <ul className="ml-6 space-y-2.5 text-gray-700 md:ml-8">
              <li className="relative pl-2 before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-gray-400">
                {t("terms.section4.item1")}
              </li>
              <li className="relative pl-2 before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-gray-400">
                {t("terms.section4.item2")}
              </li>
              <li className="relative pl-2 before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-gray-400">
                {t("terms.section4.item3")}
              </li>
              <li className="relative pl-2 before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-gray-400">
                {t("terms.section4.item4")}
              </li>
            </ul>
          </section>

          {/* Section 5: User Responsibilities */}
          <section className="space-y-4 border-t border-gray-200 pt-8">
            <h2 className="text-2xl font-semibold md:text-3xl text-brand-primary">
              {t("terms.section5.title")}
            </h2>
            <p className="leading-relaxed text-gray-700 md:text-base">
              {t("terms.section5.content")}
            </p>
            <ul className="ml-6 space-y-2.5 text-gray-700 md:ml-8">
              <li className="relative pl-2 before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-gray-400">
                {t("terms.section5.item1")}
              </li>
              <li className="relative pl-2 before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-gray-400">
                {t("terms.section5.item2")}
              </li>
              <li className="relative pl-2 before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-gray-400">
                {t("terms.section5.item3")}
              </li>
              <li className="relative pl-2 before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-gray-400">
                {t("terms.section5.item4")}
              </li>
            </ul>
          </section>

          {/* Section 6: Intellectual Property */}
          <section className="space-y-4 border-t border-gray-200 pt-8">
            <h2 className="text-2xl font-semibold md:text-3xl text-brand-primary">
              {t("terms.section6.title")}
            </h2>
            <p className="leading-relaxed text-gray-700 md:text-base">
              {t("terms.section6.content")}
            </p>
          </section>

          {/* Section 7: Limitation of Liability */}
          <section className="space-y-4 border-t border-gray-200 pt-8">
            <h2 className="text-2xl font-semibold md:text-3xl text-brand-primary">
              {t("terms.section7.title")}
            </h2>
            <p className="leading-relaxed text-gray-700 md:text-base">
              {t("terms.section7.content")}
            </p>
          </section>

          {/* Section 8: Termination */}
          <section className="space-y-4 border-t border-gray-200 pt-8">
            <h2 className="text-2xl font-semibold md:text-3xl text-brand-primary">
              {t("terms.section8.title")}
            </h2>
            <p className="leading-relaxed text-gray-700 md:text-base">
              {t("terms.section8.content")}
            </p>
          </section>

          {/* Section 9: Changes to Terms */}
          <section className="space-y-4 border-t border-gray-200 pt-8">
            <h2 className="text-2xl font-semibold md:text-3xl text-brand-primary">
              {t("terms.section9.title")}
            </h2>
            <p className="leading-relaxed text-gray-700 md:text-base">
              {t("terms.section9.content")}
            </p>
          </section>

          {/* Section 10: Contact Information */}
          <section className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-6 md:p-8">
            <h2 className="text-2xl font-semibold md:text-3xl text-brand-primary">
              {t("terms.section10.title")}
            </h2>
            <p className="leading-relaxed text-gray-700 md:text-base">
              {t("terms.section10.content")}
            </p>
            <p className="leading-relaxed text-gray-700 md:text-base">
              <strong className="font-semibold">{t("terms.section10.email")}:</strong>{" "}
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
              {t("terms.footer")}
            </p>
          </div>
        </div>
      </Container>
    </div>
  );
}

