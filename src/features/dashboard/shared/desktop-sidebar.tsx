"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CircleHelp,
  Ellipsis,
  Lock,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
} from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import LangSwitcher from "@/components/lang/lang-switcher";
import { FeedbackButton } from "@/features/dashboard/feedback/components/feedback-button";
import { EpidomIcon, EpidomLogo } from "@/features/marketing/shared/components/epidom-logo";
import { homeNavItem, type NavSection } from "@/config/navigation.config";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { PLAN_LABELS, upgradeHrefFor } from "@/lib/plans/entitlements";
import { cn } from "@/lib/utils";
import { FullscreenToggle } from "./fullscreen-toggle";
import { NavItemLink, SETTINGS_HREF, navItemHref, useNavContext } from "./nav-item-link";
import { NavUser } from "./nav-user";
import { NotificationBell } from "./notification-bell";
import { OfflineSyncTrigger, PwaInstallTrigger } from "./pwa-install-dialog";
import { StoreSwitcher } from "./store-switcher";
import { ThemeToggle } from "./theme-toggle";

/** The category rail (icons with a label under each) and the width of the pages panel beside it. */
const RAIL_PX = 76;
/** On Home the strip is wider (logo with its name, labels beside the icons) and the panel stays minimized. */
const HOME_RAIL_PX = 232;
const PANEL_PX = 208;
const EXPANDED_PX = RAIL_PX + PANEL_PX;
/** Released past the midpoint, the sidebar snaps to the nearer width. */
const SNAP_PX = (EXPANDED_PX + RAIL_PX) / 2;

const RAIL_ITEM_WIDE =
  "flex w-full flex-row items-center justify-start gap-3 rounded-lg px-3 py-2 text-sm font-medium transition active:scale-[0.98]";

const RAIL_ITEM =
  "flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2 text-center text-[10px] leading-tight font-medium transition active:scale-[0.97]";

function RailItem({
  icon: Icon,
  label,
  href,
  onClick,
  active = false,
  wide = false,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  /** Home's wider strip: icon and label side by side. */
  wide?: boolean;
  className?: string;
}) {
  const classes = cn(
    wide ? RAIL_ITEM_WIDE : RAIL_ITEM,
    active
      ? "bg-muted/60 text-foreground shadow-inner"
      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
    className
  );
  const content: ReactNode = (
    <>
      <Icon className="size-5 shrink-0" aria-hidden />
      <span
        className={
          wide ? "min-w-0 truncate text-left" : "w-full [overflow-wrap:anywhere] hyphens-auto"
        }
      >
        {label}
      </span>
    </>
  );
  return href ? (
    <Link href={href} className={classes} aria-current={active ? "page" : undefined}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={classes} aria-pressed={active || undefined}>
      {content}
    </button>
  );
}

/**
 * The desktop (xl+) sidebar, two panes:
 *  - the rail (always there): logo (it minimizes the panel), notifications, Search,
 *    Home, POS, then one button per category (General, Operations, ...), with the
 *    quick controls and your account at the bottom;
 *  - the panel (minimizable): the store and the pages of the chosen category.
 *
 * Minimized, the rail alone remains and a category button opens its first page.
 * The panel's edge can also be dragged: it follows the pointer, then snaps open
 * or closed on release.
 */
export function DesktopSidebar({
  navigation,
  onSearch,
}: {
  navigation: NavSection[];
  onSearch?: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const ctx = useNavContext();
  const { pathname, storeId, staffAllowedPages, hasAccess } = ctx;

  // Per device. The first render is always the open panel, to match the server.
  const [panel, setPanel] = usePersistedState(
    "epidom:sidebarCollapsed",
    { collapsed: false },
    (raw, defaults) =>
      raw &&
      typeof raw === "object" &&
      typeof (raw as { collapsed?: unknown }).collapsed === "boolean"
        ? { collapsed: (raw as { collapsed: boolean }).collapsed }
        : defaults
  );
  // Home is the start page: there the strip is wider, carries the logo with its
  // name and every control, and the pages panel is forced minimized.
  const homeHref = storeId ? `/store/${storeId}${homeNavItem.href}` : `/go${homeNavItem.href}`;
  const onHome = pathname === homeHref;
  // First visit on a tablet-width screen (lg, below xl): start with the pages
  // panel minimized so the content keeps its width. Only when this device has
  // no saved choice yet; after that the person's own choice is kept.
  useEffect(() => {
    try {
      if (
        window.localStorage.getItem("epidom:sidebarCollapsed") === null &&
        window.innerWidth < 1280
      ) {
        setPanel({ collapsed: true });
      }
    } catch {
      // Blocked storage: keep the open panel.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Live width while the edge is dragged (null otherwise).
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const drag = useRef<{ startX: number; startWidth: number; moved: boolean } | null>(null);
  const collapsed = onHome || (dragWidth !== null ? dragWidth < SNAP_PX : panel.collapsed);
  const toggle = () => setPanel((state) => ({ collapsed: !state.collapsed }));

  // The page may be zoomed (--app-zoom, see zoom-control.tsx): pointer deltas are
  // in screen pixels, the sidebar's width in zoomed layout pixels.
  const appZoom = () =>
    Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-zoom")) ||
    1;
  function onEdgePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      startX: event.clientX,
      startWidth: panel.collapsed ? RAIL_PX : EXPANDED_PX,
      moved: false,
    };
  }
  function onEdgePointerMove(event: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const delta = (event.clientX - d.startX) / appZoom();
    if (!d.moved && Math.abs(delta) < 3) return;
    d.moved = true;
    setDragWidth(Math.min(EXPANDED_PX, Math.max(RAIL_PX, d.startWidth + delta)));
  }
  function onEdgePointerUp(event: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!d) return;
    if (d.moved && dragWidth !== null) setPanel({ collapsed: dragWidth < SNAP_PX });
    else toggle(); // a plain click on the edge toggles
    setDragWidth(null);
  }
  function onEdgeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    } else if (event.key === "ArrowLeft") setPanel({ collapsed: true });
    else if (event.key === "ArrowRight") setPanel({ collapsed: false });
  }

  // Categories a staff persona can see at least one page of.
  const sections = navigation.filter(
    (section) =>
      section.items.length > 0 &&
      (staffAllowedPages === null ||
        section.items.some((item) => staffAllowedPages.includes(item.href)))
  );
  const sectionOfPath = sections.find((section) =>
    section.items.some((item) => {
      const href = navItemHref(item, storeId);
      return pathname === href || pathname.startsWith(`${href}/`);
    })
  );
  // A category the user picked holds only for the page it was picked on: moving
  // to another page follows that page's category again (state adjusted while
  // rendering, so the panel never flashes the old list).
  const [picked, setPicked] = useState<{ id: string; path: string } | null>(null);
  if (picked && picked.path !== pathname) setPicked(null);
  const activeSection =
    sections.find((section) => section.id === picked?.id) ?? sectionOfPath ?? sections[0];

  function onCategory(section: NavSection) {
    if (!collapsed) {
      setPicked({ id: section.id, path: pathname });
      return;
    }
    // Minimized: there is no panel to show the pages in, so go to the first one.
    const first = section.items.find(
      (item) =>
        (staffAllowedPages === null || staffAllowedPages.includes(item.href)) &&
        hasAccess(item.requiredPlan, item.href)
    );
    if (first) router.push(navItemHref(first, storeId));
    else {
      setPicked({ id: section.id, path: pathname });
      setPanel({ collapsed: false });
    }
  }

  const settingsItem = navigation
    .flatMap((section) => section.items)
    .find((item) => item.href === SETTINGS_HREF);

  const helpHref = storeId ? `/store/${storeId}/help` : null;
  const showPos = staffAllowedPages === null || staffAllowedPages.includes("/pos");
  const toggleLabel = collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar");

  return (
    <aside
      className={cn(
        // From lg (1024px: iPad landscape and up). Below that (phones, iPad
        // portrait) the Topbar's hamburger drawer is the menu. On a tablet the
        // pages panel starts minimized, so content keeps its width. `dark` re-scopes the theme tokens for
        // everything inside, so the sidebar stays the brand navy and its text,
        // hovers and the cream logo read the same in both themes.
        "dark text-foreground relative hidden h-full shrink-0 border-r border-white/10 bg-[var(--epi-navy-850)] lg:flex",
        // Tailwind 4 leaves buttons on the default arrow: every link and button in the sidebar gets the hand.
        "[&_a]:cursor-pointer [&_button]:cursor-pointer [&_button:disabled]:cursor-default",
        // Animates between the two widths, but follows the pointer while dragging.
        dragWidth === null && [
          "transition-[width] duration-200",
          onHome ? "w-[232px]" : collapsed ? "w-[76px]" : "w-[284px]",
        ]
      )}
      style={dragWidth !== null ? { width: dragWidth } : undefined}
    >
      <div className="flex h-full w-full overflow-hidden">
        {/* The category rail */}
        <div
          className={cn(
            "flex h-full shrink-0 flex-col gap-1 py-3 transition-[width] duration-200",
            onHome ? "w-[232px] items-stretch px-3" : "w-[76px] items-center px-2"
          )}
        >
          {onHome ? (
            <>
              {/* Home: the logo with its name (no minimize toggle: the panel is
                  forced closed here), notifications at its right, then the
                  controls the hidden panel would hold. */}
              <div className="flex items-center justify-between gap-2 px-1 pb-1">
                <EpidomLogo size={28} href={null} />
                <NotificationBell />
              </div>
              <div className="flex flex-col gap-2 pb-2 [&_button]:w-full [&_button]:max-w-none [&_button]:min-w-0">
                <StoreSwitcher />
                <LangSwitcher className="w-full" />
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={toggle}
                aria-expanded={!collapsed}
                aria-label={toggleLabel}
                title={toggleLabel}
                className="group/logo focus-visible:ring-ring grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg outline-none focus-visible:ring-2"
                style={{ color: "var(--epi-cream-50)" }}
              >
                {/* The logo turns into the panel icon on hover or focus, and back. */}
                <span className="pointer-events-none col-start-1 row-start-1 transition-all duration-200 group-hover/logo:scale-90 group-hover/logo:opacity-0 group-focus-visible/logo:scale-90 group-focus-visible/logo:opacity-0">
                  <EpidomIcon size={30} />
                </span>
                <span
                  className="pointer-events-none col-start-1 row-start-1 scale-75 -rotate-12 opacity-0 transition-all duration-200 group-hover/logo:scale-100 group-hover/logo:rotate-0 group-hover/logo:opacity-100 group-focus-visible/logo:scale-100 group-focus-visible/logo:rotate-0 group-focus-visible/logo:opacity-100"
                  aria-hidden
                >
                  {collapsed ? (
                    <PanelLeftOpen className="size-6" />
                  ) : (
                    <PanelLeftClose className="size-6" />
                  )}
                </span>
              </button>
              <NotificationBell />
            </>
          )}

          <div className="scrollbar-thin mt-2 flex min-h-0 w-full flex-1 flex-col gap-1 overflow-y-auto">
            <RailItem
              icon={homeNavItem.icon}
              label={t(homeNavItem.labelKey)}
              href={homeHref}
              active={pathname === homeHref}
              wide={onHome}
            />
            {/* Home has its own search bar, so the strip drops the Search button there. */}
            {!onHome && (
              <RailItem icon={Search} label={t("nav.search")} onClick={onSearch} wide={onHome} />
            )}
            {/* Switch to POS Mode: the one deliberate way into the cashier/kitchen
                shell (docs/back-office-revamp.md). Hidden for a staff persona
                without /pos access. */}
            {showPos &&
              (hasAccess("POS", "/pos") ? (
                <Link
                  href={storeId ? `/store/${storeId}/pos` : "/go/pos"}
                  className={cn(
                    onHome ? RAIL_ITEM_WIDE : RAIL_ITEM,
                    "bg-primary text-primary-foreground hover:bg-primary/90 my-1 py-2.5"
                  )}
                >
                  <Monitor className="size-5 shrink-0" aria-hidden />
                  <span className={onHome ? "truncate" : "w-full [overflow-wrap:anywhere]"}>
                    {t("nav.pos")}
                  </span>
                </Link>
              ) : (
                <Link
                  href={upgradeHrefFor("POS")}
                  title={`Upgrade to ${PLAN_LABELS.POS}`}
                  className={cn(
                    onHome ? RAIL_ITEM_WIDE : RAIL_ITEM,
                    "text-muted-foreground/50 my-1 border border-dashed hover:bg-amber-500/8 hover:text-amber-500/70"
                  )}
                >
                  <Monitor className="size-5 shrink-0" aria-hidden />
                  <span className={onHome ? "truncate" : "w-full [overflow-wrap:anywhere]"}>
                    {t("nav.pos")}
                  </span>
                  <Lock className="size-3 text-amber-500/60" aria-hidden />
                </Link>
              ))}

            <div className="my-1 border-t border-white/10" />
            {onHome
              ? // Home: the pages panel is closed, so the wide strip carries the
                // whole tree (every page one click away) rather than three
                // category buttons that only open a group's first page.
                sections.map((section) => (
                  <div key={section.id} className="mb-2">
                    <h2 className="text-muted-foreground mb-1 px-3 text-[11px] font-semibold tracking-wider uppercase">
                      {t(section.labelKey)}
                    </h2>
                    <ul className="space-y-0.5">
                      {section.items
                        .filter((item) => item.href !== SETTINGS_HREF)
                        .map((item) => (
                          <NavItemLink key={item.href} item={item} ctx={ctx} />
                        ))}
                    </ul>
                  </div>
                ))
              : sections.map((section) => (
                  <RailItem
                    key={section.id}
                    icon={section.icon}
                    label={t(section.labelKey)}
                    active={section.id === activeSection?.id}
                    onClick={() => onCategory(section)}
                  />
                ))}
          </div>

          <div
            className={cn(
              "flex w-full flex-col gap-0.5 border-t border-white/10 pt-2",
              !onHome && "items-center"
            )}
          >
            {/* Settings lives at the foot of the pages panel: whenever that panel is
                hidden (minimized, or on Home) it moves into the strip. */}
            {collapsed && settingsItem && storeId && (
              <RailItem
                icon={Settings}
                label={t(settingsItem.labelKey)}
                href={navItemHref(settingsItem, storeId)}
                active={pathname === navItemHref(settingsItem, storeId)}
                wide={onHome}
              />
            )}
            {helpHref && (
              <RailItem
                icon={CircleHelp}
                label={t("nav.help")}
                href={helpHref}
                active={pathname === helpHref}
                wide={onHome}
              />
            )}
            {onHome ? (
              // Home's wide strip has room for the quick controls in one row.
              <div className="flex flex-row flex-wrap items-center gap-1 px-1">
                <PwaInstallTrigger variant="icon" />
                <OfflineSyncTrigger variant="icon" />
                <ThemeToggle />
                <FeedbackButton />
                <FullscreenToggle />
              </div>
            ) : (
              // The narrow strip folds them into one "More" button, so a short laptop
              // screen keeps room for the pages. Minimized, it carries the language
              // too (the panel that holds it is hidden).
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      RAIL_ITEM,
                      "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    )}
                  >
                    <Ellipsis className="size-5 shrink-0" aria-hidden />
                    <span className="w-full">{t("nav.more")}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="right"
                  align="end"
                  sideOffset={8}
                  className="dark text-foreground flex w-auto items-center gap-1 border-white/10 bg-[var(--epi-navy-850)] p-1.5"
                >
                  {collapsed && <LangSwitcher dropUp />}
                  <PwaInstallTrigger variant="icon" />
                  <OfflineSyncTrigger variant="icon" />
                  <ThemeToggle />
                  <FeedbackButton />
                  <FullscreenToggle />
                </PopoverContent>
              </Popover>
            )}
            <NavUser variant="sidebar" compact={!onHome} />
          </div>
        </div>

        {/* The pages panel. Fixed inner width so it clips, rather than reflows, while the sidebar resizes. */}
        <div className="h-full w-[208px] shrink-0 border-l border-white/10">
          <div className="flex h-full w-[208px] flex-col" inert={collapsed}>
            <div className="flex flex-col gap-2 p-3 pb-2 [&_button]:w-full [&_button]:max-w-none [&_button]:min-w-0">
              <StoreSwitcher />
              <LangSwitcher className="w-full" />
            </div>
            {activeSection && (
              <nav
                aria-label={t(activeSection.labelKey)}
                className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 pb-3"
              >
                <h2 className="text-muted-foreground mt-2 mb-2 px-3 text-xs font-semibold tracking-wider uppercase">
                  {t(activeSection.labelKey)}
                </h2>
                <ul className="space-y-1.5">
                  {activeSection.items
                    .filter((item) => item.href !== SETTINGS_HREF)
                    .map((item) => (
                      <NavItemLink key={item.href} item={item} ctx={ctx} />
                    ))}
                </ul>
              </nav>
            )}
            {/* Settings stays at the very bottom whichever category is open. */}
            {settingsItem && (
              <ul className="border-t border-white/10 p-3">
                <NavItemLink item={settingsItem} ctx={ctx} />
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Drag the edge to open or minimize the panel; a click on it toggles. Not on Home, where the panel is forced closed. */}
      {!onHome && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          tabIndex={0}
          title={toggleLabel}
          onPointerDown={onEdgePointerDown}
          onPointerMove={onEdgePointerMove}
          onPointerUp={onEdgePointerUp}
          onPointerCancel={onEdgePointerUp}
          onKeyDown={onEdgeKeyDown}
          className="group/edge absolute top-0 right-0 z-20 flex h-full w-3 translate-x-1/2 cursor-col-resize touch-none justify-center outline-none"
        >
          <span
            className={cn(
              "h-full w-0.5 rounded-full bg-transparent transition-colors duration-150 group-hover/edge:bg-white/30 group-focus-visible/edge:bg-white/50",
              dragWidth !== null && "bg-white/50"
            )}
          />
        </div>
      )}
    </aside>
  );
}
