import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Search, Menu } from "lucide-react";
import { Sidebar } from "./sidebar";
import { StoreSwitcher } from "./store-switcher";
import { useI18n } from "../../../components/lang/i18n-provider";
import LangSwitcher from "../../../components/lang/lang-switcher";
import { NavUser } from "./nav-user";
import { NotificationBell } from "./notification-bell";
import { useEffect, useRef, useState } from "react";
import { useCurrentStore } from "./hooks/use-current-store";
import { homeNavItem } from "@/config/navigation.config";
import { EpidomLogo } from "@/features/marketing/shared/components/epidom-logo";

interface TopbarProps {
  /** Opens the global search dialog, which PageShell owns (the desktop rail opens it too). */
  onSearch: () => void;
}

/**
 * The phone / tablet header (below xl). On desktop there is no top bar: its
 * search, store switcher, bell, language, quick controls and account all live in
 * the left rail (Sidebar mode="desktop").
 */
export function Topbar({ onSearch }: TopbarProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  // The drawer outlives navigation (this topbar lives in the persistent
  // PageShell), so a tapped link used to leave it open over the new page.
  // Close it whenever the route changes — state adjusted during render, not
  // in an effect, so the new page never paints with the drawer still up.
  const [drawerPathname, setDrawerPathname] = useState(pathname);
  if (pathname !== drawerPathname) {
    setDrawerPathname(pathname);
    if (menuOpen) setMenuOpen(false);
  }
  const { t } = useI18n();

  // The logo opens the store's Home, like every other way into the app's start
  // page (on desktop the logo minimizes the sidebar instead).
  const { storeId } = useCurrentStore();
  const homeHref = storeId ? `/store/${storeId}${homeNavItem.href}` : "/stores";

  // Swipe in from the RIGHT edge to open the nav drawer (below the xl
  // breakpoint, where the fixed desktop rail isn't shown and the hamburger is
  // the only other way in). Right-hand side throughout: the drawer, the
  // hamburger and this gesture all sit under a right thumb, which is where
  // most people hold a phone.
  useEffect(() => {
    if (menuOpen) return;
    const EDGE_PX = 24;
    const OPEN_THRESHOLD_PX = 60;
    let start: { x: number; y: number } | null = null;

    function onTouchStart(e: TouchEvent) {
      if (window.innerWidth >= 1024) return; // lg+: the sidebar is always on screen
      const touch = e.touches[0];
      if (touch.clientX < window.innerWidth - EDGE_PX) return;
      start = { x: touch.clientX, y: touch.clientY };
    }

    function onTouchMove(e: TouchEvent) {
      if (!start) return;
      const touch = e.touches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dy) > Math.abs(dx)) {
        start = null;
        return;
      }
      if (dx < -OPEN_THRESHOLD_PX) {
        start = null;
        setMenuOpen(true);
      }
    }

    function onTouchEnd() {
      start = null;
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [menuOpen]);

  // Swipe-right inside the open drawer closes it, matching the
  // slide-in-from-right animation — the gesture pushes it back the way it came.
  const closeSwipe = useRef<{ x: number; y: number } | null>(null);
  const CLOSE_THRESHOLD_PX = 60;

  function handleDrawerTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0];
    closeSwipe.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleDrawerTouchMove(e: React.TouchEvent) {
    if (!closeSwipe.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - closeSwipe.current.x;
    const dy = touch.clientY - closeSwipe.current.y;
    if (Math.abs(dy) > Math.abs(dx)) {
      closeSwipe.current = null;
      return;
    }
    if (dx > CLOSE_THRESHOLD_PX) {
      closeSwipe.current = null;
      setMenuOpen(false);
    }
  }

  function handleDrawerTouchEnd() {
    closeSwipe.current = null;
  }

  return (
    <header
      role="banner"
      className="navbar-no-transition navbar-static fixed top-0 z-10 w-full rounded-none shadow lg:hidden"
      style={{
        background: "var(--epi-navy-850)",
        color: "var(--epi-cream-50)",
        animation: "none !important",
        transition: "none !important",
        transform: "none !important",
        opacity: "1 !important",
      }}
    >
      {/* Divided for the same reason as the content cap in page-shell.tsx, and
          it has to land in the same change as that one: correcting the content
          cap alone while this stayed a zoom-scaled 80rem tripled the visible
          header/content misalignment at 70% (measured 112px -> 352px of inset
          per side). 80rem is exactly max-w-7xl, so this is byte-identical at
          100% — the only thing that changes is that the two caps now keep the
          same ratio to each other across the whole zoom ladder. */}
      <div className="mx-auto max-w-[calc(80rem/var(--app-zoom,1))] px-2 sm:px-3 lg:px-3">
        {/* Phone / tablet layout: phones and iPad portrait. From lg (1024px,
            iPad landscape and up) the desktop sidebar replaces this bar. */}
        <div className="flex h-14 items-center justify-between gap-1 sm:gap-2 lg:hidden">
          {/* Left: Logo */}
          <div className="flex min-w-0 items-center justify-center">
            <EpidomLogo size={22} href={homeHref} />
          </div>

          {/* Right: search, profile (tablet only — on a phone the account
              menu, logout included, lives in the drawer), then the menu. The
              hamburger sits at the far right, on the same
              side as the drawer it opens and the edge-swipe that opens it —
              phones are held in the right hand, and the top-left corner is the
              hardest place on the screen to reach one-handed. */}
          <div className="flex min-w-0 items-center justify-end gap-1 sm:gap-1.5">
            {/* Mobile search button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 hover:bg-white/10"
              style={{ color: "var(--epi-cream-50)" }}
              onClick={onSearch}
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

            {/* Profile — tablet only. Below sm the avatar is gone: the drawer's
                Account block (NavUserDrawerSection) carries every action the
                dropdown does, and the header keeps room for search, the bell
                and the menu. */}
            <div className="hidden sm:flex sm:items-center">
              <NavUser />
            </div>

            {/* The app's only nav drawer. There used to be a second <Sheet>
                bound to this same `menuOpen` state in the desktop layout
                below — its trigger was `md:hidden` inside an `xl:grid`-only
                container, so it could never be clicked, but Radix portals
                sheet content to document.body, where an ancestor's
                `display: none` does not reach it. Opening the menu therefore
                mounted two identical drawers and stacked two overlays (a
                visibly darker scrim, two competing focus traps). Removed. */}
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
              <SheetContent
                side="right"
                navigation
                className="h-[calc(100dvh/var(--app-zoom,1))] w-[min(280px,calc(85vw/var(--app-zoom,1)))] p-0"
                onOpenAutoFocus={(e) => e.preventDefault()}
                onTouchStart={handleDrawerTouchStart}
                onTouchMove={handleDrawerTouchMove}
                onTouchEnd={handleDrawerTouchEnd}
              >
                <Sidebar mode="mobile" />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

    </header>
  );
}
