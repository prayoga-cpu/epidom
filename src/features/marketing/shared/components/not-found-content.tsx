"use client";

/**
 * Not Found Content Component
 *
 * Reusable 404 page content with multilanguage support and EPIDOM branding.
 * Can be used in both marketing and app route groups.
 *
 * @component
 */

import { Home, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { StatusScreen, type StatusAction } from "@/components/shared/status-screen";
import { useI18n } from "@/components/lang/i18n-provider";
import { getLocalizedPath } from "@/lib/i18n-routing";

interface NotFoundContentProps {
  /** Whether to show dashboard button (for app routes) */
  showDashboardButton?: boolean;
}

export function NotFoundContent({ showDashboardButton = false }: NotFoundContentProps) {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  // Extract storeId from /store/[storeId]/... pattern if present
  const storeIdMatch = pathname?.match(/\/store\/([^/]+)/);
  const dashboardHref = storeIdMatch ? `/store/${storeIdMatch[1]}/home` : "/stores";
  const thai = locale === "th";

  const actions: StatusAction[] = [
    {
      label: t("notFound.backToHome"),
      href: getLocalizedPath("/", locale),
      icon: <ArrowLeft />,
    },
  ];
  if (showDashboardButton) {
    actions.push({
      label: t("notFound.goToDashboard"),
      href: dashboardHref,
      icon: <Home />,
    });
  }

  // The navy "brand" surface: it brings its own background and fills the
  // viewport, so the wrappers (app/not-found.tsx, app/(app)/not-found.tsx) need
  // neither a background nor a min-height of their own.
  return (
    <StatusScreen
      tone="brand"
      layout="page"
      locale={locale}
      code="404"
      title={t("notFound.title")}
      description={t("notFound.description")}
      hint={t("statusPages.notFound.hint")}
      actions={actions}
      footer={
        <p className="m-0">
          {t("notFound.helpText")}
          {/* Thai writes the sentence without a space or a full stop. */}
          {thai ? "" : " "}
          <Link
            href={getLocalizedPath("/contact", locale)}
            className="text-epi-gold-400 decoration-epi-gold-500/50 hover:decoration-epi-gold-400 focus-visible:outline-epi-gold-300 inline-flex min-h-11 items-center font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {t("notFound.contactSupport")}
          </Link>
          {thai ? "" : "."}
        </p>
      }
    />
  );
}
