/**
 * Dashboard Sidebar
 *
 * `mode="desktop"` (xl+) is the two-pane DesktopSidebar: a category rail and the
 * active category's pages. `mode="mobile"` is the phone / tablet menu drawer
 * (opened from the Topbar): one scrolling list of every group, with the store,
 * language, display preferences and the account menu at the bottom.
 */

"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { Search, Lock, Monitor, ArrowRight, CircleHelp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/lang/i18n-provider";
import { dashboardNavigation, homeNavItem, type NavSection } from "@/config/navigation.config";
import LangSwitcher from "@/components/lang/lang-switcher";
import { FeedbackButton } from "@/features/dashboard/feedback/components/feedback-button";
import { APP_VERSION } from "@/lib/version";
import { PLAN_LABELS, upgradeHrefFor } from "@/lib/plans/entitlements";
import { cn } from "@/lib/utils";
import { DesktopSidebar } from "./desktop-sidebar";
import { NavItemLink, SETTINGS_HREF, navItemHref, useNavContext } from "./nav-item-link";
import { NavUserDrawerSection } from "./nav-user";
import { OfflineSyncTrigger, PwaInstallTrigger } from "./pwa-install-dialog";
import { StoreSwitcher } from "./store-switcher";
import { ThemeToggle } from "./theme-toggle";
import { ZoomControl } from "./zoom-control";

/** Case- and accent-insensitive, so "resume" finds "Résumé" and "kasir" finds "Kasir". */
function foldForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

interface SidebarProps {
  mode?: "desktop" | "mobile";
  navigation?: NavSection[];
  /** Opens the global search dialog (desktop: its button in the rail). */
  onSearch?: () => void;
}

export function Sidebar({
  mode = "desktop",
  navigation = dashboardNavigation,
  onSearch,
}: SidebarProps) {
  if (mode === "desktop") return <DesktopSidebar navigation={navigation} onSearch={onSearch} />;
  return <MobileSidebar navigation={navigation} />;
}

function MobileSidebar({ navigation }: { navigation: NavSection[] }) {
  const { t } = useI18n();
  const ctx = useNavContext();
  const { pathname, storeId, staffAllowedPages, hasAccess } = ctx;

  // The Help centre: a footer link, not a nav item — every member of the store
  // can open it (no plan tier, no page grant), like the changelog.
  const helpHref = storeId ? `/store/${storeId}/help` : null;
  const helpActive = helpHref !== null && pathname === helpHref;

  // Home: its own first row rather than a dashboardNavigation item (see
  // homeNavItem) — open to every member of the store, no plan, no grant.
  const homeHref = storeId ? `/store/${storeId}${homeNavItem.href}` : `/go${homeNavItem.href}`;
  const homeActive = pathname === homeHref;
  const HomeIcon = homeNavItem.icon;

  // The drawer's search box filters the list by label.
  const [navQuery, setNavQuery] = useState("");
  const foldedQuery = foldForSearch(navQuery.trim());
  const matchesQuery = (label: string) =>
    foldedQuery === "" || foldForSearch(label).includes(foldedQuery);
  const filteredNavigation =
    foldedQuery === ""
      ? navigation
      : navigation.map((section) => ({
          ...section,
          items: section.items.filter((item) => matchesQuery(t(item.labelKey))),
        }));
  const showHome = matchesQuery(t(homeNavItem.labelKey));
  const showPos = matchesQuery(t("nav.pos"));
  const searching = foldedQuery !== "";

  // Same grouping as the desktop sidebar: one category at a time (General,
  // Operations, Reports), following the open page, with Settings pinned under
  // its list. Searching drops the grouping and lists every match.
  const visibleSections = navigation.filter(
    (section) =>
      section.items.length > 0 &&
      (staffAllowedPages === null ||
        section.items.some((item) => staffAllowedPages.includes(item.href)))
  );
  const sectionOfPath = visibleSections.find((section) =>
    section.items.some((item) => {
      const href = navItemHref(item, storeId);
      return pathname === href || pathname.startsWith(`${href}/`);
    })
  );
  // A category the person tapped holds only for the page it was tapped on
  // (adjusted while rendering, so the old list never flashes).
  const [picked, setPicked] = useState<{ id: string; path: string } | null>(null);
  if (picked && picked.path !== pathname) setPicked(null);
  const activeSection =
    visibleSections.find((section) => section.id === picked?.id) ??
    sectionOfPath ??
    visibleSections[0];
  const settingsItem = navigation
    .flatMap((section) => section.items)
    .find((item) => item.href === SETTINGS_HREF);

  const nothingMatches =
    foldedQuery !== "" &&
    !showHome &&
    !showPos &&
    filteredNavigation.every((section) => section.items.length === 0);

  return (
    <aside className="mt-12 flex h-[calc(100%-3rem)] lg:hidden">
      <div className="scrollbar-thin bg-card flex h-full w-full flex-col overflow-y-auto rounded-t-xl border shadow-sm">
        <div className="border-b p-3">
          <div className="relative">
            <Search className="text-foreground/70 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              type="search"
              value={navQuery}
              onChange={(event) => setNavQuery(event.target.value)}
              placeholder={t("actions.searchPlaceholder")}
              aria-label={t("actions.searchPlaceholder")}
              className="h-10 rounded-full pl-9"
            />
          </div>
        </div>
        <nav className="flex-1 p-3">
          {showHome && (
            <Link
              href={homeHref}
              aria-current={homeActive ? "page" : undefined}
              className={cn(
                "mb-2 flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition active:scale-[0.98]",
                homeActive
                  ? "bg-muted/60 text-foreground shadow-inner"
                  : "text-foreground/80 hover:bg-muted/40 hover:text-foreground"
              )}
            >
              <HomeIcon className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{t(homeNavItem.labelKey)}</span>
            </Link>
          )}
          {/* Switch to POS Mode — the one deliberate way from the Store Dashboard
              into the cashier/kitchen shell (docs/back-office-revamp.md). Not a
              dashboardNavigation item: /pos lives in posModeNavItems, its own
              shell's tab bar. Hidden for a staff persona without /pos access. */}
          {showPos && (staffAllowedPages === null || staffAllowedPages.includes("/pos")) && (
            <div className="mb-3">
              {hasAccess("POS", "/pos") ? (
                <Link
                  href={storeId ? `/store/${storeId}/pos` : "/go/pos"}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-between gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition active:scale-[0.98]"
                >
                  <span className="flex items-center gap-2">
                    <Monitor className="size-4 shrink-0" aria-hidden />
                    {t("nav.pos")}
                  </span>
                  <ArrowRight className="size-4 shrink-0" aria-hidden />
                </Link>
              ) : (
                <Link
                  href={upgradeHrefFor("POS")}
                  title={`Upgrade to ${PLAN_LABELS.POS}`}
                  className="group text-muted-foreground/40 flex items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2.5 text-sm transition hover:bg-amber-500/8 hover:text-amber-500/70"
                >
                  <span className="flex items-center gap-2">
                    <Monitor className="size-4 shrink-0" aria-hidden />
                    {t("nav.pos")}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium whitespace-nowrap text-amber-500/50 transition-colors group-hover:text-amber-500">
                    <Lock className="size-3 shrink-0" />
                    {PLAN_LABELS.POS}
                  </span>
                </Link>
              )}
            </div>
          )}
          {nothingMatches && (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">
              {t("search.noResults")}
            </p>
          )}
          {!searching && activeSection && (
            <>
              {visibleSections.length > 1 && (
                <div className="mb-3 grid grid-cols-3 gap-1">
                  {visibleSections.map((section) => {
                    const SectionIcon = section.icon;
                    const active = section.id === activeSection.id;
                    return (
                      <button
                        key={section.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setPicked({ id: section.id, path: pathname })}
                        className={cn(
                          "flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-center text-[11px] leading-tight font-medium transition active:scale-[0.97]",
                          active
                            ? "bg-muted/60 text-foreground shadow-inner"
                            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                        )}
                      >
                        <SectionIcon className="size-5 shrink-0" aria-hidden />
                        <span className="w-full [overflow-wrap:anywhere]">
                          {t(section.labelKey)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <ul className="space-y-1.5" aria-label={t(activeSection.labelKey)}>
                {activeSection.items
                  .filter((item) => item.href !== SETTINGS_HREF)
                  .map((item) => (
                    <NavItemLink key={item.href} item={item} ctx={ctx} />
                  ))}
              </ul>
              {settingsItem && (
                <ul className="mt-3 border-t pt-3">
                  <NavItemLink item={settingsItem} ctx={ctx} />
                </ul>
              )}
            </>
          )}
          {searching && filteredNavigation.map((section, sectionIndex) => {
            // A staff persona with none of this section's pages granted shouldn't
            // see a dangling title with nothing under it — nor should a section
            // the search filtered empty.
            const sectionHasVisibleItem =
              section.items.length > 0 &&
              (staffAllowedPages === null ||
                section.items.some((item) => staffAllowedPages.includes(item.href)));
            if (!sectionHasVisibleItem) return null;
            return (
              <div key={section.id} className={sectionIndex > 0 ? "mt-4" : ""}>
                {section.title && (
                  <h3 className="text-muted-foreground mb-2 px-3 text-xs font-semibold tracking-wider uppercase">
                    {section.title}
                  </h3>
                )}
                <ul className="space-y-1.5">
                  {section.items.map((item) => (
                    <NavItemLink key={item.href} item={item} ctx={ctx} />
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
        <div className="space-y-3 border-t p-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {/* Store and language: from sm the Topbar shows both, so only phones need them here. */}
          <div className="flex flex-col gap-2 sm:hidden">
            <span className="text-muted-foreground text-xs font-medium">
              {t("dashboard.storeSelector.label")}
            </span>
            <div className="[&_button]:w-full [&_button]:max-w-none [&_button]:min-w-0">
              <StoreSwitcher />
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:hidden">
            <span className="text-muted-foreground text-xs font-medium">
              {t("common.language.label")}
            </span>
            <LangSwitcher className="w-full" />
          </div>
          {/* Zoom sits with the other per-device display preferences: on a phone
              the drawer is where language and theme live, so it is where someone
              looking for it will look. */}
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-xs font-medium">{t("nav.zoom")}</span>
            <ZoomControl label="none" />
          </div>
          {/* Quick actions: theme + feedback. Styled for the light card surface
              (override the topbar-only cream color to the themed foreground). */}
          <div className="text-foreground flex items-center gap-1">
            <ThemeToggle tone="surface" />
            <div style={{ "--epi-cream-50": "var(--foreground)" } as CSSProperties}>
              <FeedbackButton />
            </div>
          </div>
          <PwaInstallTrigger variant="full" />
          <OfflineSyncTrigger variant="full" />
          {helpHref && (
            <Link
              href={helpHref}
              aria-current={helpActive ? "page" : undefined}
              className="text-muted-foreground hover:text-foreground flex min-h-10 items-center gap-2 text-sm transition-colors"
            >
              <CircleHelp className="size-4 shrink-0" aria-hidden />
              <span>{t("nav.help")}</span>
            </Link>
          )}
          <Link
            href={storeId ? `/store/${storeId}/changelog` : "/changelog"}
            className="text-muted-foreground hover:text-foreground flex items-center justify-between gap-2 text-xs transition-colors"
          >
            <span>{t("footer.linkChangelog")}</span>
            <span className="font-medium">{`v${APP_VERSION}`}</span>
          </Link>
          {/* The account menu lives here on a phone — the topbar has no avatar
              below sm (see topbar.tsx); from sm the avatar's own menu has it.
              Log out stays the last row. */}
          <div className="border-t pt-3 sm:hidden">
            <NavUserDrawerSection />
          </div>
        </div>
      </div>
    </aside>
  );
}
