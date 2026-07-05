import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Search, Menu } from "lucide-react";
import { useCurrentStore } from "./hooks/use-current-store";
import { APP_VERSION } from "@/lib/version";
import { Sidebar } from "./sidebar";
import { StoreSwitcher } from "./store-switcher";
import { PwaInstallTrigger } from "./pwa-install-dialog";
import { useI18n } from "../../../components/lang/i18n-provider";
import LangSwitcher from "../../../components/lang/lang-switcher";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { NavUser } from "./nav-user";
import { NotificationBell } from "./notification-bell";
import { FeedbackButton } from "@/features/dashboard/feedback/components/feedback-button";
import { ThemeToggle } from "./theme-toggle";
import { useState } from "react";
import { GlobalSearchDialog } from "./global-search-dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { EpidomLogo } from "@/features/marketing/shared/components/epidom-logo";

export function Topbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { t } = useI18n();
  const { storeId } = useCurrentStore();

  return (
    <header
      role="banner"
      className="navbar-no-transition navbar-static fixed top-0 z-10 w-full rounded-none shadow"
      style={{
        background: "var(--epi-navy-850)",
        color: "var(--epi-cream-50)",
        animation: "none !important",
        transition: "none !important",
        transform: "none !important",
        opacity: "1 !important",
      }}
    >
      <div className="mx-auto max-w-7xl px-2 sm:px-3 lg:px-3">
        {/* Mobile/Tablet Layout */}
        <div className="flex h-14 items-center justify-between gap-1 sm:gap-2 lg:hidden">
          {/* Left: Mobile menu + Logo */}
          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 hover:bg-white/10"
                  style={{ color: "var(--epi-cream-50)" }}
                >
                  <Menu className="size-5" />
                  <span className="sr-only">{t("common.nav.openMenu")}</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="h-[100dvh] w-[min(280px,85vw)] p-0">
                <Sidebar mode="mobile" />
              </SheetContent>
            </Sheet>
            <div className="flex min-w-0 items-center justify-center">
              <EpidomLogo size={22} />
            </div>
          </div>

          {/* Right: search, profile, logout */}
          <div className="flex min-w-0 items-center justify-end gap-1 sm:gap-1.5">
            {/* Mobile search button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 hover:bg-white/10"
              style={{ color: "var(--epi-cream-50)" }}
              onClick={() => setSearchOpen(true)}
            >
              <Search className="size-5" />
              <span className="sr-only">{t("common.nav.searchAriaLabel")}</span>
            </Button>

            {/* Store switcher - hidden on mobile, shown on tablet+ */}
            <div className="hidden sm:block">
              <StoreSwitcher />
            </div>

            {/* Language switcher - hidden on mobile, shown on tablet+ */}
            <div className="hidden sm:block">
              <LangSwitcher />
            </div>

            {/* Notifications */}
            <NotificationBell />

            {/* Profile */}
            <NavUser />

            {/* Logout - icon only on mobile, text + icon on tablet+ */}
            <Button
              size="sm"
              variant="ghost"
              className="h-9 shrink-0 rounded-xl hover:bg-red-500/20 sm:px-2"
              style={{ color: "var(--epi-cream-50)" }}
              onClick={() => {
                signOut().then(() => (window.location.href = "/login"));
              }}
            >
              <LogOut className="size-4 sm:mr-1.5" />
              <span className="hidden sm:inline">{t("actions.logout")}</span>
            </Button>
          </div>
        </div>

        {/* Desktop Layout - SAME AS BEFORE */}
        <div className="hidden h-14 grid-cols-[1fr_minmax(220px,720px)_1fr] items-center gap-3 lg:grid">
          {/* Left: Mobile menu + Logo */}
          <div className="flex items-center gap-2">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary-foreground hover:bg-white/10 md:hidden"
                >
                  <Menu className="size-5" />
                  <span className="sr-only">{t("common.nav.openMenu")}</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="h-[100dvh] w-[min(280px,85vw)] p-0">
                <Sidebar mode="mobile" />
              </SheetContent>
            </Sheet>
            <div className="flex items-center">
              <EpidomLogo size={26} />
            </div>
          </div>

          {/* Center: Search */}
          <div className="hidden w-full items-center justify-end md:flex">
            <Button
              variant="outline"
              className="text-muted-foreground bg-background relative h-9 w-80 max-w-xl justify-start rounded-full text-sm font-normal sm:max-w-2xl"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="mr-1 hidden size-4 shrink-0 sm:inline" />
              <span>{t("actions.searchPlaceholder")}</span>
              <KbdGroup className="absolute right-3 hidden md:flex">
                <Kbd>⌘</Kbd>
                <Kbd>k</Kbd>
              </KbdGroup>
            </Button>
          </div>

          {/* Right: store switcher, language, profile, logout */}
          <div className="ml-auto flex items-center justify-end gap-2">
            {/* Store switcher */}
            <div className="hidden sm:flex sm:items-center">
              <StoreSwitcher />
            </div>
            {/* Language switcher */}
            <div className="hidden sm:flex sm:items-center">
              <LangSwitcher />
            </div>
            <div className="flex items-center">
              <PwaInstallTrigger variant="icon" />
            </div>
            <div className="flex items-center">
              <ThemeToggle />
            </div>
            <div className="flex items-center">
              <FeedbackButton />
            </div>
            <div className="hidden items-center lg:flex">
              <Link
                href={storeId ? `/store/${storeId}/changelog` : "/changelog"}
                className="rounded-lg px-2 py-1 text-xs font-medium text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
                aria-label={t("changelog.viewChangelog")}
              >
                {`v${APP_VERSION}`}
              </Link>
            </div>
            <div className="flex items-center">
              <NotificationBell />
            </div>
            <div className="flex items-center">
              <NavUser />
            </div>
            <div className="flex items-center">
              <Button
                size="sm"
                variant="ghost"
                className="h-9 rounded-xl px-3 hover:bg-red-500"
                onClick={() => {
                  signOut().then(() => (window.location.href = "/login"));
                }}
              >
                <LogOut className="mr-1.5 size-4" />
                {t("actions.logout")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Global Search Dialog */}
      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
