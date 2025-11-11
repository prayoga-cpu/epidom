"use client";

/**
 * Site Footer Component
 *
 * Global footer displayed across all marketing pages.
 * Displays company information, contact details, and copyright.
 * Uses brand primary color (#444444) with white text.
 *
 * @component
 */

import { memo } from "react";
import Link from "next/link";
import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "./container";

export const SiteFooter = memo(function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer
      role="contentinfo"
      className="border-border/20 border-t bg-brand-primary text-white"
    >
      <Container maxWidth="7xl" className="px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 py-8 sm:gap-10 sm:py-12 md:grid-cols-2 md:py-16 lg:grid-cols-3">
          {/* Left: tagline */}
          <div className="space-y-4 lg:col-span-1">
            <h3 className="text-lg leading-snug font-bold tracking-tight text-pretty sm:text-xl">
              {t("footer.tagline")}
            </h3>
            <p className="text-sm opacity-75 sm:text-base">{t("footer.rights")}</p>
          </div>

          {/* Middle: address */}
          <div className="space-y-3 lg:col-span-1">
            <h4 className="text-base font-semibold text-pretty sm:text-lg">
              {t("footer.addressHeading")}
            </h4>
            <p className="text-sm text-white/80 sm:text-base">
              {t("footer.address")}
            </p>
          </div>

          {/* Right: contact */}
          <div className="space-y-3 lg:col-span-1">
            <h4 className="text-base font-semibold text-pretty sm:text-lg">
              {t("footer.contact")}
            </h4>
            <ul className="space-y-2 text-sm leading-7 sm:text-base">
              <li>
                <Link
                  href="mailto:info@epidom.com"
                  className="text-white/80 no-underline transition-opacity hover:text-white hover:opacity-80"
                >
                  info@epidom.com
                </Link>
              </li>
              <li>
                <Link
                  href="mailto:mrcaoevan@gmail.com"
                  className="text-white/80 no-underline transition-opacity hover:text-white hover:opacity-80"
                >
                  mrcaoevan@gmail.com
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </Container>
    </footer>
  );
});

