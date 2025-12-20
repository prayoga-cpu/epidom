"use client";

/**
 * Site Header Component
 *
 * Reusable navigation header used across all marketing pages.
 * Features:
 * - Config-based navigation (uses navigation.config.ts)
 * - Responsive design (desktop navigation + mobile sheet menu)
 * - Two button modes: Waitlist CTA or Login/My Stores (based on session)
 * - Navigation always shows landing navigation for marketing pages
 * - Navigation only changes when variant prop is explicitly set (for authenticated pages)
 * - Internationalization support with language switcher
 * - Active page highlighting with visual feedback
 * - Accessible navigation with ARIA labels
 * - Sticky/fixed positioning controlled by CSS classes
 *
 * Navigation items are defined in src/config/navigation.config.ts:
 * - landingNavigation: for public/marketing pages (Home, Services, Pricing, Contact)
 * - authenticatedNavigation: for authenticated pages (My Stores, Profile, Pricing)
 *
 * NAVIGATION BEHAVIOR:
 * ========================================
 * - Marketing pages (default): Always shows landing navigation (Home, Services, Pricing, Contact)
 *   regardless of login status
 * - Authenticated pages: Shows authenticated navigation (My Stores, Profile, Pricing)
 *   when variant="authenticated" is explicitly passed via props
 *
 * BUTTON BEHAVIOR:
 * ========================================
 * - Marketing pages (not logged in): Shows "Login" button
 * - Marketing pages (logged in): Shows "My Stores" button (redirects to /stores)
 * - Authenticated pages: Shows "Logout" button (when showLogout={true})
 * - Waitlist mode: Shows "Join Waitlist" button (when BUTTON_MODE = "waitlist")
 *
 * NOTE: Marketing pages allow users to browse even when logged in, so navigation
 * stays consistent (landing navigation) while button changes based on session.
 * Logout button is only available in authenticated pages (stores/profile).
 *
 * BUTTON MODE SELECTION:
 * ========================================
 * CONTROL BUTTON MODE WITH COMMENT BELOW
 * ========================================
 *
 * To enable WAITLIST mode (show "Join Waitlist" button):
 *   1. Set BUTTON_MODE to "waitlist"
 *
 * To enable LOGIN/MY STORES mode (show Login/My Stores based on session):
 *   1. Set BUTTON_MODE to "login-my-stores"
 *
 * AI/ROBOT INSTRUCTIONS:
 *   - Prompt: "enable waitlist mode" -> set BUTTON_MODE = "waitlist"
 *   - Prompt: "enable login my stores mode" -> set BUTTON_MODE = "login-my-stores"
 * ========================================
 *
 * @component
 */

import { memo, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { WaitlistDialog } from "@/features/marketing/shared/components/waitlist-dialog";
import { usePathname, useRouter } from "next/navigation";
import LangSwitcher from "@/components/lang/lang-switcher";
import { useI18n } from "@/components/lang/i18n-provider";
import { ChevronRight } from "lucide-react";
import { LogoWithSkeleton } from "./logo-with-skeleton";
import { useSession, signOut } from "@/lib/auth-client";
import { getNavigationByVariant, type NavItem } from "@/config/navigation.config";
/**
 * Props for SiteHeader component
 */
interface SiteHeaderProps {
  /** Whether to show main navigation links (Home, Services, Pricing, Contact) */
  showNav?: boolean;
  /**
   * Navigation variant override
   * - If provided, forces navigation to use this variant (for authenticated pages)
   * - If not provided, defaults to "landing" navigation (for marketing pages)
   * - Marketing pages always show landing navigation regardless of login status
   * - "authenticated" variant in authenticated pages will show logout button when showLogout={true}
   */
  variant?: "landing" | "authenticated";
  /**
   * Whether to show logout button instead of My Stores button
   * - If true, shows logout button (for authenticated pages)
   * - If false or undefined, shows Login/My Stores based on session (for marketing pages)
   */
  showLogout?: boolean;
  // Note: Button mode (waitlist vs login/my-stores) is controlled by BUTTON_MODE constant inside component
}

export const SiteHeader = memo(function SiteHeader({
  showNav = true,
  variant: variantOverride,
  showLogout = false,
}: SiteHeaderProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);

  // Track mounted state for hydration safety
  useEffect(() => {
    setMounted(true);
  }, []);

  /**
   * BUTTON MODE SELECTION
   * ========================================
   * Change the value below to switch between modes:
   * - "waitlist": Always show "Join Waitlist" button
   * - "login-my-stores": Show Login (if not logged in) or My Stores (if logged in)
   * ========================================
   */
  // CURRENT MODE: login-my-stores (shows Login/My Stores based on session)
  // To switch to waitlist mode, change below to: "waitlist"
  const BUTTON_MODE = "login-my-stores" as "waitlist" | "login-my-stores";

  // Determine which navigation to show based on override or default to landing
  const variant = useMemo(() => {
    // If variant is explicitly provided, use it (for authenticated pages)
    if (variantOverride) return variantOverride;
    // Marketing pages: Always use landing navigation, regardless of session
    // Button will change based on session, but navigation stays consistent
    return "landing";
  }, [variantOverride]);

  // Get navigation items from config
  const navigationItems = useMemo(() => getNavigationByVariant(variant), [variant]);

  /**
   * Handle login action - redirect to login page
   * After successful login, user will be redirected to /stores (store selection)
   * This is the natural entry point for authenticated users
   */
  const handleLogin = () => {
    // Simply redirect to login page
    // Login form will redirect to /stores after successful login (if no callbackUrl)
    router.push("/login");
  };

  /**
   * Handle go to stores action - redirect to stores page (authenticated area)
   */
  const handleGoToStores = () => {
    router.push("/stores");
  };

  /**
   * Handle logout action - only used in authenticated pages
   */
  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  /**
   * Render desktop navigation link
   */
  const renderDesktopNavLink = (item: NavItem) => {
    const isActive = pathname === item.href;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={isActive ? "page" : undefined}
          className={`text-sm font-medium transition-colors hover:text-white/80 md:text-sm lg:text-base ${
            isActive ? "font-bold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" : ""
          }`}
        >
          {t(item.labelKey)}
        </Link>
      </li>
    );
  };

  /**
   * Render mobile navigation link
   */
  const renderMobileNavLink = (item: NavItem) => {
    const isActive = pathname === item.href;
    const Icon = item.icon;
    return (
      <li key={item.href}>
        <SheetClose asChild>
          <Link
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`hover:bg-muted/50 focus-visible:ring-primary flex h-11 items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none ${
              isActive
                ? "text-foreground bg-muted/30 font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="mr-3 h-5 w-5" />
            {t(item.labelKey)}
          </Link>
        </SheetClose>
      </li>
    );
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

          {/* Desktop navigation - Config-based */}
          {showNav && (
            <ul className="hidden items-center gap-4 md:flex md:gap-5 lg:gap-6">
              {navigationItems.map(renderDesktopNavLink)}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
          <div className="hidden items-center gap-3 md:flex md:gap-4">
            <div className="flex-shrink-0">
              <LangSwitcher />
            </div>
            <div className="flex-shrink-0">
              {/* Desktop Button - Mode: Waitlist, Login/My Stores, or Logout */}
              {BUTTON_MODE === "waitlist" ? (
                // WAITLIST MODE: Always show waitlist button
                <WaitlistDialog />
              ) : showLogout && session?.user ? (
                // LOGOUT MODE: Show logout button (for authenticated pages like stores/profile)
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="cursor-pointer rounded-full border-0 bg-white px-4 text-neutral-900 hover:bg-neutral-100 md:px-5 lg:px-6"
                >
                  {t("common.actions.logout")}
                </Button>
              ) : session?.user ? (
                // MY STORES MODE: Show My Stores button (for marketing pages when logged in)
                <Button
                  onClick={handleGoToStores}
                  variant="outline"
                  className="cursor-pointer rounded-full border-0 bg-white px-4 text-neutral-900 hover:bg-neutral-100 md:px-5 lg:px-6"
                >
                  {t("common.nav.stores")}
                </Button>
              ) : (
                // LOGIN MODE: Show Login button (for marketing pages when not logged in or loading)
                <Button
                  onClick={handleLogin}
                  variant="outline"
                  className="cursor-pointer rounded-full border-0 bg-white px-4 text-neutral-900 hover:bg-neutral-100 md:px-5 lg:px-6"
                >
                  {t("common.actions.login")}
                </Button>
              )}
            </div>
          </div>

          {/* Mobile Menu - Only render Sheet after mount to prevent hydration mismatch */}
          {!mounted ? (
            // Static placeholder during SSR
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg transition-colors hover:bg-white/20 md:hidden"
              aria-label={t("common.nav.openMenu")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M4 6h16M4 12h16M4 18h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </Button>
          ) : (
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

              <SheetContent
                side="right"
                className="flex w-80 flex-col p-0 sm:w-96 [&>button]:hidden"
              >
                <SheetTitle className="sr-only">{t("common.nav.navTitle")}</SheetTitle>

                {/* Header Section */}
                <div className="border-border/20 flex items-center justify-between border-b p-6">
                  <Link
                    href="/"
                    aria-label={t("common.nav.homepage")}
                    className="flex items-center"
                  >
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
                        {/* Mobile navigation - Config-based */}
                        {navigationItems.map(renderMobileNavLink)}
                      </ul>
                    </div>
                  )}
                </nav>

                {/* Footer Section */}
                <div className="border-border/20 border-t p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      {/* Mobile Button - Mode: Waitlist, Login/My Stores, or Logout */}
                      {BUTTON_MODE === "waitlist" ? (
                        // WAITLIST MODE: Always show waitlist button
                        <SheetClose asChild>
                          <div>
                            <WaitlistDialog variant="sidebar" />
                          </div>
                        </SheetClose>
                      ) : showLogout && session?.user ? (
                        // LOGOUT MODE: Show logout button (for authenticated pages like stores/profile)
                        <Button
                          onClick={handleLogout}
                          variant="outline"
                          className="w-full border-0 bg-neutral-900 text-white hover:bg-neutral-800"
                        >
                          {t("common.actions.logout")}
                        </Button>
                      ) : session?.user ? (
                        // MY STORES MODE: Show My Stores button (for marketing pages when logged in)
                        <SheetClose asChild>
                          <Button
                            onClick={handleGoToStores}
                            variant="outline"
                            className="w-full border-0 bg-neutral-900 text-white hover:bg-neutral-800"
                          >
                            {t("common.nav.stores")}
                          </Button>
                        </SheetClose>
                      ) : (
                        // LOGIN MODE: Show Login button (for marketing pages when not logged in or loading)
                        <SheetClose asChild>
                          <Button
                            onClick={handleLogin}
                            variant="outline"
                            className="w-full border-0 bg-neutral-900 text-white hover:bg-neutral-800"
                          >
                            {t("common.actions.login")}
                          </Button>
                        </SheetClose>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      <LangSwitcher />
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </nav>
    </header>
  );
});
