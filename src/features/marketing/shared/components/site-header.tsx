"use client";

/**
 * Site Header Component
 *
 * Reusable navigation header used across all marketing pages.
 * Features:
 * - Responsive design (desktop navigation + mobile sheet menu)
 * - Two variants: landing (shows waitlist CTA) or authenticated (shows logout)
 * - Internationalization support with language switcher
 * - Active page highlighting with visual feedback
 * - Accessible navigation with ARIA labels
 * - Sticky/fixed positioning controlled by CSS classes
 *
 * @component
 */

import { memo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { WaitlistDialog } from "@/features/marketing/shared/components/waitlist-dialog";
import { usePathname } from "next/navigation";
import LangSwitcher from "@/components/lang/lang-switcher";
import { useI18n } from "@/components/lang/i18n-provider";
import { ChevronRight } from "lucide-react";
import { LogoWithSkeleton } from "./logo-with-skeleton";

/**
 * Props for SiteHeader component
 */
interface SiteHeaderProps {
  /** Header variant: "landing" shows waitlist CTA, "authenticated" shows logout button */
  variant?: "landing" | "authenticated";
  /** Whether to show main navigation links (Home, Services, Pricing, Contact) */
  showNav?: boolean;
}

export const SiteHeader = memo(function SiteHeader({
  variant = "landing",
  showNav = true,
}: SiteHeaderProps = {}) {
  const pathname = usePathname();
  const { t } = useI18n();

  /**
   * Handle logout action (TODO: implement NextAuth signOut)
   */
  const handleLogout = () => {
    // TODO: Implement logout logic using NextAuth
    console.log("Logout clicked");
  };

  return (
    <header className="mobile-navbar" style={{ color: "var(--color-brand-white)" }}>
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-4"
      >
        <div className="flex items-center gap-4 sm:gap-6 md:gap-8">
          {/* Logo */}
          <Link
            href="/"
            className="block flex-shrink-0 transition-opacity hover:opacity-80"
            aria-label={t("common.nav.homepage")}
          >
            <Image
              src="/images/logo-white.png"
              alt="EPIDOM logo"
              width={120}
              height={32}
              className="h-7 w-auto sm:h-8 md:h-8"
              style={{ width: "auto", height: "auto" }}
              sizes="(max-width: 768px) 120px, 120px"
              priority
            />
          </Link>

          {/* Desktop navigation */}
          {showNav && (
            <ul className="hidden items-center gap-4 md:flex md:gap-5 lg:gap-6">
              <li>
                <Link
                  href="/"
                  aria-current={pathname === "/" ? "page" : undefined}
                  className={`text-sm font-medium transition-colors hover:text-white/80 md:text-sm lg:text-base ${
                    pathname === "/"
                      ? "font-bold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                      : ""
                  }`}
                >
                  {t("common.nav.home")}
                </Link>
              </li>
              <li>
                <Link
                  href="/services"
                  aria-current={pathname === "/services" ? "page" : undefined}
                  className={`text-sm font-medium transition-colors hover:text-white/80 md:text-sm lg:text-base ${
                    pathname === "/services"
                      ? "font-bold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                      : ""
                  }`}
                >
                  {t("common.nav.services")}
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  aria-current={pathname === "/pricing" ? "page" : undefined}
                  className={`text-sm font-medium transition-colors hover:text-white/80 md:text-sm lg:text-base ${
                    pathname === "/pricing"
                      ? "font-bold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                      : ""
                  }`}
                >
                  {t("common.nav.pricing")}
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  aria-current={pathname === "/contact" ? "page" : undefined}
                  className={`text-sm font-medium transition-colors hover:text-white/80 md:text-sm lg:text-base ${
                    pathname === "/contact"
                      ? "font-bold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                      : ""
                  }`}
                >
                  {t("common.nav.contact")}
                </Link>
              </li>
            </ul>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
          <div className="hidden items-center gap-3 md:flex md:gap-4">
            <div className="flex-shrink-0">
              <LangSwitcher />
            </div>
            <div className="flex-shrink-0">
              {variant === "landing" ? (
                <WaitlistDialog />
              ) : (
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="rounded-full border-0 bg-white px-4 text-neutral-900 hover:bg-neutral-100 md:px-5 lg:px-6"
                >
                  {t("actions.logout")}
                </Button>
              )}
            </div>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg transition-colors hover:bg-white/20 md:hidden"
                aria-label={t("common.nav.openMenu")}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d="M4 6h16M4 12h16M4 18h16"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </Button>
            </SheetTrigger>

            <SheetContent side="right" className="flex w-80 flex-col p-0 sm:w-96 [&>button]:hidden">
              <SheetTitle className="sr-only">{t("common.nav.navTitle")}</SheetTitle>

              {/* Header Section */}
              <div className="border-border/20 flex items-center justify-between border-b p-6">
                <Link href="/" aria-label={t("common.nav.homepage")} className="flex items-center">
                  <LogoWithSkeleton
                    src="/images/logo-black.png"
                    alt="EPIDOM logo"
                    width={120}
                    height={32}
                    className="h-8 w-auto"
                    filter="invert(27%) sepia(0%) saturate(0%) hue-rotate(180deg) brightness(96%) contrast(80%)"
                    sizes="(max-width: 768px) 120px, 120px"
                  />
                  <span className="sr-only">{t("common.brand")}</span>
                </Link>

                {/* Close Button */}
                <SheetClose asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={t("common.nav.closeMenu")}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </SheetClose>
              </div>

              {/* Navigation Section */}
              <nav aria-label="Mobile" className="flex-1 px-4 py-6">
                {showNav && (
                  <div className="space-y-2">
                    <div className="text-muted-foreground px-3 py-2 text-xs font-semibold tracking-wider uppercase">
                      {t("common.nav.menu")}
                    </div>

                    <ul className="space-y-1">
                      <li>
                        <SheetClose asChild>
                          <Link
                            href="/"
                            aria-current={pathname === "/" ? "page" : undefined}
                            className={`hover:bg-muted/50 focus-visible:ring-primary flex h-11 items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                              pathname === "/"
                                ? "text-foreground bg-muted/30 font-bold"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <svg
                              className="mr-3 h-5 w-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                              />
                            </svg>
                            {t("common.nav.home")}
                          </Link>
                        </SheetClose>
                      </li>
                      <li>
                        <SheetClose asChild>
                          <Link
                            href="/services"
                            aria-current={pathname === "/services" ? "page" : undefined}
                            className={`hover:bg-muted/50 focus-visible:ring-primary flex h-11 items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                              pathname === "/services"
                                ? "text-foreground bg-muted/30 font-bold"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <svg
                              className="mr-3 h-5 w-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                              />
                            </svg>
                            {t("common.nav.services")}
                          </Link>
                        </SheetClose>
                      </li>
                      <li>
                        <SheetClose asChild>
                          <Link
                            href="/pricing"
                            aria-current={pathname === "/pricing" ? "page" : undefined}
                            className={`hover:bg-muted/50 focus-visible:ring-primary flex h-11 items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                              pathname === "/pricing"
                                ? "text-foreground bg-muted/30 font-bold"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <svg
                              className="mr-3 h-5 w-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                              />
                            </svg>
                            {t("common.nav.pricing")}
                          </Link>
                        </SheetClose>
                      </li>
                      <li>
                        <SheetClose asChild>
                          <Link
                            href="/contact"
                            aria-current={pathname === "/contact" ? "page" : undefined}
                            className={`hover:bg-muted/50 focus-visible:ring-primary flex h-11 items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                              pathname === "/contact"
                                ? "text-foreground bg-muted/30 font-bold"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <svg
                              className="mr-3 h-5 w-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                              />
                            </svg>
                            {t("common.nav.contact")}
                          </Link>
                        </SheetClose>
                      </li>
                    </ul>
                  </div>
                )}
              </nav>

              {/* Footer Section */}
              <div className="border-border/20 border-t p-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    {variant === "landing" ? (
                      <SheetClose asChild>
                        <div>
                          <WaitlistDialog variant="sidebar" />
                        </div>
                      </SheetClose>
                    ) : (
                      <Button
                        onClick={handleLogout}
                        variant="outline"
                        className="w-full border-0 bg-neutral-900 text-white hover:bg-neutral-800"
                      >
                        {t("actions.logout")}
                      </Button>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <LangSwitcher />
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
});
