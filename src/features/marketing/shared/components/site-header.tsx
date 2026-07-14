"use client";

import { memo, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { WaitlistDialog } from "@/features/marketing/shared/components/waitlist-dialog";
import { usePathname, useRouter } from "next/navigation";
import LangSwitcher from "@/components/lang/lang-switcher";
import { useI18n } from "@/components/lang/i18n-provider";
import { ChevronRight, Shield } from "lucide-react";
import { EpidomLogo } from "./epidom-logo";
import { useSession, signOut } from "@/lib/auth-client";
import { getNavigationByVariant, type NavItem } from "@/config/navigation.config";
import { isAdminEmail } from "@/lib/admin";
import { trackEvent } from "@/lib/analytics";

/**
 * BUTTON MODE SELECTION
 * - "waitlist"        → Always show "Join Waitlist"
 * - "login-my-stores" → Login (unauthenticated) or My Stores (authenticated)
 */
const BUTTON_MODE = "login-my-stores" as "waitlist" | "login-my-stores";

interface SiteHeaderProps {
  showNav?: boolean;
  variant?: "landing" | "authenticated";
  showLogout?: boolean;
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

  useEffect(() => {
    setMounted(true);
  }, []);

  const variant = useMemo(() => variantOverride ?? "landing", [variantOverride]);
  const navigationItems = useMemo(() => getNavigationByVariant(variant), [variant]);

  const handleLogin = () => router.push("/login");
  const handleStartFree = () => {
    trackEvent("cta_click", { event_category: "engagement", event_label: "header_try_epidom" });
    router.push("/register");
  };
  const handleGoToStores = () => router.push("/stores");
  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  const renderDesktopNavLink = (item: NavItem) => {
    const isActive = pathname === item.href;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={isActive ? "page" : undefined}
          className={`transition-colors ${
            isActive
              ? "font-semibold text-[var(--epi-cream-50)]"
              : "text-[var(--epi-cream-50)]/60 hover:text-[var(--epi-cream-50)]/90"
          }`}
          style={{
            fontFamily: "var(--epi-font-body)",
            fontSize: 13,
            fontWeight: isActive ? 600 : 400,
            letterSpacing: "0.01em",
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

  const renderMobileNavLink = (item: NavItem) => {
    const isActive = pathname === item.href;
    const Icon = item.icon;
    return (
      <li key={item.href}>
        <SheetClose asChild>
          <Link
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex h-11 items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-white/5 text-[var(--epi-gold-400)]"
                : "text-[var(--epi-cream-50)]/60 hover:bg-white/5 hover:text-[var(--epi-cream-50)]"
            }`}
          >
            <Icon className="mr-3 h-5 w-5" />
            {t(item.labelKey)}
          </Link>
        </SheetClose>
      </li>
    );
  };

  /* ── Desktop CTA button ── */
  const DesktopCTA = () => {
    if (BUTTON_MODE === "waitlist") return <WaitlistDialog />;
    if (showLogout && session?.user) {
      return (
        <button
          onClick={handleLogout}
          className="cursor-pointer rounded-full px-5 py-2 text-sm font-medium tracking-widest uppercase transition-all"
          style={{
            background: "var(--epi-gold-500)",
            color: "var(--epi-navy-900)",
            fontFamily: "var(--epi-font-body)",
            letterSpacing: "0.06em",
          }}
        >
          {t("common.actions.logout")}
        </button>
      );
    }
    if (session?.user) {
      return (
        <button
          onClick={handleGoToStores}
          className="cursor-pointer rounded-full px-5 py-2 text-sm font-medium transition-all hover:-translate-y-px"
          style={{
            background: "var(--epi-gold-500)",
            color: "var(--epi-navy-900)",
            fontFamily: "var(--epi-font-body)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {t("common.nav.stores")} →
        </button>
      );
    }
    return (
      <button
        onClick={handleStartFree}
        className="cursor-pointer rounded-full px-5 py-2 text-sm font-medium transition-all hover:-translate-y-px active:translate-y-0"
        style={{
          background: "var(--epi-gold-500)",
          color: "var(--epi-navy-900)",
          fontFamily: "var(--epi-font-body)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          boxShadow: "0 8px 24px -10px rgba(217,174,59,0.6)",
        }}
      >
        {t("nav.tryEpidom")} →
      </button>
    );
  };

  return (
    <nav className="epi-floating-nav backdrop-blur-xs" role="navigation" aria-label="Main header">
      <EpidomLogo href="/" size={30} />

      {/* Desktop nav links */}
      {showNav && (
        <ul
          className="epi-nav-items hidden items-center gap-6 lg:flex"
          aria-label="Main navigation"
        >
          {navigationItems.map(renderDesktopNavLink)}
        </ul>
      )}

      {/* Right side */}
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-3 lg:flex">
          {mounted &&
            isAdminEmail(session?.user?.email) && ( // DB isAdmin not checked here — email check is sufficient for header
              <button
                onClick={() => router.push("/admin")}
                className="flex cursor-pointer items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-red-400 uppercase transition-all hover:bg-red-500/20"
              >
                <Shield className="h-3 w-3" /> Admin
              </button>
            )}
          <LangSwitcher />
          {mounted && <DesktopCTA />}
        </div>

        {/* Mobile hamburger */}
        {!mounted ? (
          <button
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/10 lg:hidden"
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
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-white/10 lg:hidden"
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
                <EpidomLogo href="/" size={24} />
                <SheetClose asChild>
                  <button
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full hover:bg-white/10"
                    aria-label={t("common.nav.closeMenu")}
                  >
                    <ChevronRight className="h-4 w-4 text-[var(--epi-cream-50)]" />
                  </button>
                </SheetClose>
              </div>

              <nav aria-label="Mobile" className="flex-1 px-4 py-6">
                {showNav && (
                  <div>
                    <div
                      className="mb-2 px-3 py-2 text-xs font-semibold tracking-wider uppercase"
                      style={{ color: "var(--epi-cream-50)", opacity: 0.4 }}
                    >
                      {t("common.nav.menu")}
                    </div>
                    <ul className="space-y-1">{navigationItems.map(renderMobileNavLink)}</ul>
                  </div>
                )}
              </nav>

              <div className="p-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                {mounted && isAdminEmail(session?.user?.email) && (
                  <SheetClose asChild>
                    <button
                      onClick={() => router.push("/admin")}
                      className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 py-2.5 text-xs font-semibold tracking-wide text-red-400 uppercase transition-all hover:bg-red-500/20"
                    >
                      <Shield className="h-3.5 w-3.5" /> Admin
                    </button>
                  </SheetClose>
                )}
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    {BUTTON_MODE === "waitlist" ? (
                      <SheetClose asChild>
                        <div>
                          <WaitlistDialog variant="sidebar" />
                        </div>
                      </SheetClose>
                    ) : showLogout && session?.user ? (
                      <button
                        onClick={handleLogout}
                        className="w-full cursor-pointer rounded-full py-3 text-sm font-medium tracking-widest uppercase"
                        style={{ background: "var(--epi-gold-500)", color: "var(--epi-navy-900)" }}
                      >
                        {t("common.actions.logout")}
                      </button>
                    ) : session?.user ? (
                      <SheetClose asChild>
                        <button
                          onClick={handleGoToStores}
                          className="w-full cursor-pointer rounded-full py-3 text-sm font-medium tracking-widest uppercase"
                          style={{
                            background: "var(--epi-gold-500)",
                            color: "var(--epi-navy-900)",
                          }}
                        >
                          {t("common.nav.stores")}
                        </button>
                      </SheetClose>
                    ) : (
                      <SheetClose asChild>
                        <button
                          onClick={handleStartFree}
                          className="w-full cursor-pointer rounded-full py-3 text-sm font-medium tracking-widest uppercase"
                          style={{
                            background: "var(--epi-gold-500)",
                            color: "var(--epi-navy-900)",
                          }}
                        >
                          {t("nav.tryEpidom")} →
                        </button>
                      </SheetClose>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <LangSwitcher dropUp />
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </nav>
  );
});
