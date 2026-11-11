"use client";

import { memo, useCallback, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { usePathname, useRouter } from "next/navigation";
import LangSwitcher from "@/components/lang/lang-switcher";
import { ThemeToggle } from "@/features/dashboard/shared/theme-toggle";
import { useI18n } from "@/components/lang/i18n-provider";
import { ChevronRight, ChevronDown, ArrowLeft, LogIn } from "lucide-react";
import { EpidomLogo } from "./epidom-logo";
import { useSession, signOut } from "@/lib/auth-client";
import { getNavigationByVariant, type LandingNavEntry } from "@/config/navigation.config";
import { trackEvent } from "@/lib/analytics";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { PLATFORM_NAME } from "@/lib/device-platform";
import { useDevicePlatform } from "@/hooks/use-device-platform";
import { PlatformIcon } from "@/components/platform-icon";
import { cn } from "@/lib/utils";
import { resolveMenu, type ResolvedMenu } from "../lib/landing-nav";
import { DesktopNavMenu, navTextClass, navTextStyle } from "./site-nav-menu";

const GOLD_BUTTON_STYLE: React.CSSProperties = {
  background: "linear-gradient(180deg,#f4dc90,#d7b54b 55%,#a97c1c)",
  color: "#151004",
  fontFamily: "var(--epi-font-body)",
  boxShadow: "0 0 0 1px rgba(255,255,255,.22) inset",
};

interface SiteHeaderProps {
  showNav?: boolean;
  variant?: "landing" | "authenticated";
  showLogout?: boolean;
  /** A light / dark toggle after the language switcher. The marketing pages have one look, so only the signed-in pages (the store list) turn it on. */
  showThemeToggle?: boolean;
  /** When set, renders an explicit back arrow before the logo, so a page
   * that's a dead end in the app's own parent/child structure (e.g. /stores,
   * whose only parent is the marketing homepage) always has a way out
   * instead of relying on the logo click alone. */
  backHref?: string;
}

export const SiteHeader = memo(function SiteHeader({
  showNav = true,
  variant: variantOverride,
  showLogout = false,
  showThemeToggle = false,
  backHref,
}: SiteHeaderProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale } = useI18n();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  // Which dropdown is open (desktop), and which accordion row is expanded (mobile menu).
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);
  // Closes a dropdown only if it is still the open one (a delayed close must not shut the next).
  const closeMenu = useCallback(
    (id: string) => setOpenMenu((current) => (current === id ? null : current)),
    []
  );
  // A page change (a menu link was followed) shuts any open menu.
  useEffect(() => {
    setOpenMenu(null);
  }, [pathname]);

  // Lighter glass at the top of the page; once scrolled it settles darker
  // (and, on the home page, leaves the hero card). See .epi-floating-nav[data-scrolled].
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      setScrolled(window.scrollY > 24);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const variant = useMemo(() => variantOverride ?? "landing", [variantOverride]);
  const navigationItems = useMemo(() => getNavigationByVariant(variant), [variant]);
  // navigation.config.ts hrefs are locale-agnostic ("/pricing") — only the
  // "landing" variant (marketing site) participates in URL-based locale
  // routing, "authenticated" (in-app shell) never does.
  const localizeHref = (href: string) =>
    variant === "landing" ? getLocalizedPath(href, locale) : href;
  // A section's sub-pages count too (/compare/moka lights up Compare).
  const isPathActive = (href: string) => {
    const base = href.split("#")[0];
    return pathname === base || pathname.startsWith(`${base}/`);
  };
  const isActiveHref = (item: LandingNavEntry, href: string) =>
    pathname === href || (item.href !== "/" && pathname.startsWith(`${href}/`));
  // A dropdown's links in the visitor's language (a landing page with no version in it is left out).
  const menuFor = (item: LandingNavEntry): ResolvedMenu | null => {
    const menu = item.menu ? resolveMenu(item.menu, locale) : null;
    return menu && menu.sections.length > 0 ? menu : null;
  };
  // A dropdown is "current" on its own page or on any page it links to.
  const isEntryActive = (
    item: LandingNavEntry,
    href: string | undefined,
    menu: ResolvedMenu | null
  ) =>
    (href !== undefined && isActiveHref(item, href)) ||
    (menu?.sections ?? []).some((section) => section.links.some((link) => isPathActive(link.href)));

  // "Start on macOS" / "Start on Android": the sign-up button names the
  // device the visitor is on (Epidom runs in its browser, nothing to install).
  // Until that is known (the server, the first paint) it reads "Start Trial".
  const platform = useDevicePlatform();
  const startLabel = platform ? (
    <>
      <PlatformIcon platform={platform} className="size-4 shrink-0" />
      {t("nav.startOn").replace("{device}", PLATFORM_NAME[platform])}
    </>
  ) : (
    <>{t("nav.startTrial")} →</>
  );

  const handleLogin = () => router.push("/login");
  const handleStartFree = () => {
    trackEvent("cta_click", {
      event_category: "engagement",
      event_label: "header_try_epidom",
      platform: platform ?? "unknown",
    });
    router.push("/register");
  };
  const handleGoToStores = () => router.push("/stores");
  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  const renderDesktopNavLink = (item: LandingNavEntry) => {
    const href = item.href ? localizeHref(item.href) : undefined;
    const menu = menuFor(item);
    if (menu) {
      return (
        <DesktopNavMenu
          key={item.id}
          entry={item}
          menu={menu}
          href={href}
          active={isEntryActive(item, href, menu)}
          open={openMenu === item.id}
          setOpen={setOpenMenu}
          closeMenu={closeMenu}
        />
      );
    }
    if (!href) return null;
    const isActive = isActiveHref(item, href);
    return (
      <li key={item.id}>
        <Link
          href={href}
          aria-current={isActive ? "page" : undefined}
          className={navTextClass(isActive)}
          style={{
            ...navTextStyle(isActive),
            background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
            padding: "4px 12px",
            borderRadius: 999,
          }}
        >
          {t(item.labelKey)}
        </Link>
      </li>
    );
  };

  const mobileRow = (active: boolean) =>
    cn(
      "flex h-11 min-w-0 flex-1 items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
      active
        ? "bg-white/5 text-[var(--epi-gold-400)]"
        : "text-[var(--epi-cream-50)]/60 hover:bg-white/5 hover:text-[var(--epi-cream-50)]"
    );

  const renderMobileNavLink = (item: LandingNavEntry) => {
    const href = item.href ? localizeHref(item.href) : undefined;
    const menu = menuFor(item);
    const Icon = item.icon;
    if (!menu) {
      if (!href) return null;
      const isActive = isActiveHref(item, href);
      return (
        <li key={item.id}>
          <SheetClose asChild>
            <Link
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={mobileRow(isActive)}
            >
              <Icon className="mr-3 h-5 w-5" />
              {t(item.labelKey)}
            </Link>
          </SheetClose>
        </li>
      );
    }

    // A dropdown becomes an accordion row: its own page (if it has one) and a chevron that expands the links.
    const isActive = isEntryActive(item, href, menu);
    const expanded = mobileOpen === item.id;
    const toggle = () => setMobileOpen(expanded ? null : item.id);
    const label = t(item.labelKey);
    const chevron = (
      <ChevronDown
        aria-hidden="true"
        className={cn(
          "h-4 w-4 shrink-0 transition-transform duration-200",
          expanded && "rotate-180"
        )}
      />
    );
    return (
      <li key={item.id}>
        <div className="flex items-center">
          {href ? (
            <>
              <SheetClose asChild>
                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={mobileRow(isActive)}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {label}
                </Link>
              </SheetClose>
              <button
                type="button"
                aria-expanded={expanded}
                aria-label={t("common.nav.openSubmenu").replace("{name}", label)}
                onClick={toggle}
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--epi-cream-50)]/60 hover:bg-white/5 hover:text-[var(--epi-cream-50)]"
              >
                {chevron}
              </button>
            </>
          ) : (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={toggle}
              className={cn(mobileRow(isActive), "cursor-pointer text-left")}
            >
              <Icon className="mr-3 h-5 w-5" />
              {label}
              <span className="ml-auto">{chevron}</span>
            </button>
          )}
        </div>
        {expanded ? (
          <ul className="mt-1 mb-2 ml-5 space-y-0.5 border-l border-white/10 pl-3">
            {menu.sections.map((section, i) => (
              <li key={i}>
                {section.headingKey ? (
                  <p className="m-0 px-3 pt-2 pb-1 text-[11px] tracking-[0.14em] text-[var(--epi-cream-50)]/40 uppercase">
                    {t(section.headingKey)}
                  </p>
                ) : null}
                <ul className="m-0 list-none space-y-0.5 p-0">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <SheetClose asChild>
                        <Link
                          href={link.href}
                          className="flex min-h-11 flex-col justify-center rounded-lg px-3 py-1.5 text-sm text-[var(--epi-cream-50)]/80 transition-colors hover:bg-white/5 hover:text-[var(--epi-cream-50)]"
                        >
                          {t(link.labelKey)}
                          {link.descKey ? (
                            <span className="text-xs text-[var(--epi-cream-50)]/50">
                              {t(link.descKey)}
                            </span>
                          ) : null}
                        </Link>
                      </SheetClose>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {menu.footer ? (
              <li>
                <SheetClose asChild>
                  <Link
                    href={menu.footer.href}
                    className="block rounded-lg px-3 py-2.5 text-[13px] font-medium text-[var(--epi-gold-300)]"
                  >
                    {t(menu.footer.labelKey)}
                  </Link>
                </SheetClose>
              </li>
            ) : null}
          </ul>
        ) : null}
      </li>
    );
  };

  /* ── "Log in" for someone who is not signed in: a quiet link beside the gold button ── */
  const showLogin = variant === "landing" && !session?.user;
  const trackLogin = () =>
    trackEvent("cta_click", { event_category: "engagement", event_label: "header_login" });

  /* ── Desktop CTA button ── */
  const DesktopCTA = () => {
    if (showLogout && session?.user) {
      return (
        <button
          onClick={handleLogout}
          className="cursor-pointer rounded-full px-5 py-2 text-sm font-semibold transition-[transform,box-shadow] duration-150 hover:-translate-y-[2px]"
          style={GOLD_BUTTON_STYLE}
        >
          {t("common.actions.logout")}
        </button>
      );
    }
    if (session?.user) {
      return (
        <button
          onClick={handleGoToStores}
          className="cursor-pointer rounded-full px-5 py-2 text-sm font-semibold transition-[transform,box-shadow] duration-150 hover:-translate-y-[2px]"
          style={GOLD_BUTTON_STYLE}
        >
          {t("common.nav.stores")} →
        </button>
      );
    }
    return (
      <button
        onClick={handleStartFree}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold whitespace-nowrap transition-[transform,box-shadow] duration-150 hover:-translate-y-[2px] active:translate-y-0"
        style={GOLD_BUTTON_STYLE}
      >
        {startLabel}
      </button>
    );
  };

  return (
    <nav
      className="epi-floating-nav backdrop-blur-xs"
      data-scrolled={scrolled ? "" : undefined}
      role="navigation"
      aria-label={t("common.nav.mainHeader")}
    >
      <div className="flex min-w-0 items-center gap-2">
        {backHref && (
          <Link
            href={backHref}
            aria-label={t("common.actions.back")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4 text-[var(--epi-cream-50)]" />
          </Link>
        )}
        {/* Signed in (the store list, profile), the marketing homepage is only for
            someone who has logged out — the logo is branding here, not a link. */}
        <EpidomLogo href={variant === "authenticated" ? null : localizeHref("/")} size={30} />
      </div>

      {/* Desktop nav links */}
      {showNav && (
        <ul
          className="epi-nav-items hidden items-center gap-2 lg:flex"
          aria-label={t("common.nav.navTitle")}
        >
          {navigationItems.map(renderDesktopNavLink)}
        </ul>
      )}

      {/* Right side */}
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-3 lg:flex">
          <LangSwitcher urlDriven />
          {showThemeToggle && <ThemeToggle />}
          {mounted && showLogin && (
            <Link
              href="/login"
              onClick={trackLogin}
              className={cn(navTextClass(false), "px-1")}
              style={navTextStyle(false)}
            >
              {t("common.nav.login")}
            </Link>
          )}
          {mounted && <DesktopCTA />}
        </div>

        {/* Mobile hamburger */}
        {!mounted ? (
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-white/10 lg:hidden"
            aria-label={t("common.nav.openMenu")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 6h16M4 12h16M4 18h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : (
          <Sheet>
            <SheetTrigger asChild>
              <button
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-white/10 lg:hidden"
                aria-label={t("common.nav.openMenu")}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M4 6h16M4 12h16M4 18h16"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </SheetTrigger>

            <SheetContent
              side="right"
              className="flex w-80 flex-col p-0 sm:w-96 [&>button]:hidden"
              style={{ background: "var(--epi-navy-850)", borderColor: "rgba(255,255,255,0.08)" }}
            >
              <SheetTitle className="sr-only">{t("common.nav.navTitle")}</SheetTitle>

              <div
                className="flex items-center justify-between p-6"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
              >
                <EpidomLogo
                  href={variant === "authenticated" ? null : localizeHref("/")}
                  size={24}
                />
                <SheetClose asChild>
                  <button
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full hover:bg-white/10"
                    aria-label={t("common.nav.closeMenu")}
                  >
                    <ChevronRight className="h-4 w-4 text-[var(--epi-cream-50)]" />
                  </button>
                </SheetClose>
              </div>

              <nav
                aria-label={t("common.nav.mobileMenu")}
                className="min-h-0 flex-1 overflow-y-auto px-4 py-6"
              >
                {showNav && (
                  <div>
                    <div
                      className="mb-2 px-3 py-2 text-xs font-semibold tracking-wider uppercase"
                      style={{ color: "var(--epi-cream-50)", opacity: 0.4 }}
                    >
                      {t("common.nav.menu")}
                    </div>
                    <ul className="space-y-1">
                      {navigationItems.map(renderMobileNavLink)}
                      {showLogin && (
                        <li>
                          <SheetClose asChild>
                            <Link href="/login" onClick={trackLogin} className={mobileRow(false)}>
                              <LogIn className="mr-3 h-5 w-5" />
                              {t("common.nav.login")}
                            </Link>
                          </SheetClose>
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </nav>

              <div className="p-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    {showLogout && session?.user ? (
                      <button
                        onClick={handleLogout}
                        className="w-full cursor-pointer rounded-full py-3 text-sm font-bold tracking-[0.06em] uppercase transition-transform hover:-translate-y-[2px]"
                        style={GOLD_BUTTON_STYLE}
                      >
                        {t("common.actions.logout")}
                      </button>
                    ) : session?.user ? (
                      <SheetClose asChild>
                        <button
                          onClick={handleGoToStores}
                          className="w-full cursor-pointer rounded-full py-3 text-sm font-bold tracking-[0.06em] uppercase transition-transform hover:-translate-y-[2px]"
                          style={GOLD_BUTTON_STYLE}
                        >
                          {t("common.nav.stores")}
                        </button>
                      </SheetClose>
                    ) : (
                      <SheetClose asChild>
                        <button
                          onClick={handleStartFree}
                          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition-transform hover:-translate-y-[2px]"
                          style={GOLD_BUTTON_STYLE}
                        >
                          {startLabel}
                        </button>
                      </SheetClose>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <LangSwitcher dropUp urlDriven />
                  </div>
                  {showThemeToggle && (
                    <div className="flex-shrink-0">
                      <ThemeToggle />
                    </div>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </nav>
  );
});
