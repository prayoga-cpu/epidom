"use client";

/**
 * Not Found Content Component
 *
 * Reusable 404 page content with multilanguage support and EPIDOM branding.
 * Can be used in both marketing and app route groups.
 *
 * @component
 */

import { FileQuestion, Home, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "./container";

interface NotFoundContentProps {
  /** Whether to show dashboard button (for app routes) */
  showDashboardButton?: boolean;
}

export function NotFoundContent({ showDashboardButton = false }: NotFoundContentProps) {
  const { t } = useI18n();
  const pathname = usePathname();
  // Extract storeId from /store/[storeId]/... pattern if present
  const storeIdMatch = pathname?.match(/\/store\/([^/]+)/);
  const dashboardHref = storeIdMatch
    ? `/store/${storeIdMatch[1]}/dashboard`
    : "/stores";

  return (
    <Container maxWidth="2xl">
      <div className="flex min-h-[60vh] flex-col items-center justify-center py-12 text-center md:py-16">
        <div className="w-full max-w-lg space-y-8">
          {/* 404 Icon */}
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gray-100 md:h-28 md:w-28">
            <FileQuestion className="h-12 w-12 md:h-14 md:w-14 text-brand-primary" />
          </div>

          {/* Heading */}
          <div className="space-y-3">
            <h1 className="text-7xl font-bold tracking-tight md:text-8xl lg:text-9xl text-brand-primary">
              404
            </h1>
            <h2 className="text-2xl font-semibold md:text-3xl lg:text-4xl text-brand-primary">
              {t("notFound.title")}
            </h2>
            <p className="mx-auto max-w-md text-base leading-relaxed text-gray-600 md:text-lg">
              {t("notFound.description")}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            {showDashboardButton && (
              <Link href={dashboardHref} className="flex-1 sm:flex-auto">
                <Button
                  variant="outline"
                  className="w-full gap-2 border-2 border-brand-primary text-brand-primary"
                >
                  <Home className="h-4 w-4" />
                  {t("notFound.goToDashboard")}
                </Button>
              </Link>
            )}
            <Link href="/" className="flex-1 sm:flex-auto">
              <Button className="w-full gap-2 text-white bg-brand-primary">
                <ArrowLeft className="h-4 w-4" />
                {t("notFound.backToHome")}
              </Button>
            </Link>
          </div>

          {/* Additional Help */}
          <div className="mx-auto max-w-md rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm md:p-6">
            <p className="text-gray-600">
              {t("notFound.helpText")}{" "}
              <Link
                href="/contact"
                className="font-medium underline transition-colors hover:no-underline text-brand-primary"
              >
                {t("notFound.contactSupport")}
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </Container>
  );
}

