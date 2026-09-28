"use client";

import { useEffect, useId, useState } from "react";
import type React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CircleHelp,
  Monitor,
  MonitorSmartphone,
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  Store,
  RefreshCw,
  LogOut,
  Bug,
  ChevronRight,
  X,
  CheckCircle2,
  CloudUpload,
  WifiOff,
  Cable,
  type LucideIcon,
} from "lucide-react";
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/components/lang/i18n-provider";
import { useUser } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useCustomerDisplaySettings } from "@/features/pos/hooks/use-customer-display-settings";
import { openCustomerDisplay } from "@/features/pos/lib/open-customer-display";
import { HardwareSettingsDialog } from "@/features/pos/components/hardware-settings-dialog";
import { FeedbackDialog } from "@/features/dashboard/feedback/components/feedback-dialog";
import { useAccountSwitcher } from "@/features/dashboard/shared/hooks/use-account-switcher";
import { useCurrentStore } from "@/features/dashboard/shared/hooks/use-current-store";
import { useOfflineSyncContext } from "@/features/dashboard/shared/offline-sync-provider";
import { STAFF_ROLE_LABEL_KEYS } from "@/features/dashboard/shared/lib/staff-role-label";
import { EpidomLockup } from "@/features/marketing/shared/components/epidom-logo";
import { canManageShift } from "@/features/pos/lib/shift-access";
import { LAST_VISITED_BACK_OFFICE_COOKIE, isBackOfficeAppPath } from "@/lib/last-visited";
import { PosModePreferences } from "./pos-mode-preferences";
import { isPosTabPath, usePosTabs } from "./pos-mode-tab-bar";
import { PosModeStoreSwitcher } from "./pos-mode-store-switcher";
// Every guide in three languages rides in the Help sheet: its own chunk, loaded
// on first open (or preloaded while online), failing into a toast when offline.
import { LazyHelpSheet, preloadHelpSheet } from "@/features/guide/components/help-sheet-loader";

interface PosModeOverflowMenuProps {
  storeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * This browser is signed in as a staff member's OWN Epidom account (not the
   * owner's account with a PIN persona on top). Their account is theirs: no
   * Back Office to return to, nobody else to switch to, and "Owner account"
   * isn't what they'd be logging out of.
   */
  linkedStaff?: boolean;
}

interface MenuRowProps {
  icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** The page this row links to is the one on screen. */
  active?: boolean;
  tone?: "default" | "destructive";
}

/**
 * One line of the drawer: icon tile, label, chevron. A Link when it goes
 * somewhere, a button when it does something. 48px tall — over the 44px
 * touch floor with room for the tile.
 */
function MenuRow({
  icon: Icon,
  label,
  href,
  onClick,
  disabled = false,
  active = false,
  tone = "default",
}: MenuRowProps) {
  const className = cn(
    "relative flex min-h-12 w-full items-center gap-3 px-3 text-left text-sm font-medium transition-colors hover:bg-accent active:bg-accent disabled:pointer-events-none disabled:opacity-50",
    active && "bg-primary/10 text-primary hover:bg-primary/10",
    tone === "destructive" && "text-destructive"
  );
  const content = (
    <>
      {/* The accent bar on the current page's row, as in a nav drawer. */}
      {active && (
        <span className="bg-primary absolute inset-y-2 left-0 w-1 rounded-r-full" aria-hidden />
      )}
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          active ? "bg-primary/15" : tone === "destructive" ? "bg-destructive/10" : "bg-muted"
        )}
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {tone !== "destructive" && (
        <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={className}
      >
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {content}
    </button>
  );
}

interface SpaceRowProps {
  icon: LucideIcon;
  label: string;
  /** One line on what the space holds — may wrap to two on a phone. */
  description: string;
  href: string;
  onClick: () => void;
  /** This space is the one on screen. */
  active?: boolean;
}

/**
 * One of POS Mode's spaces (Back Office, POS System, Operational): a MenuRow
 * scaled up — 48px logo-framed tile, 24px icon, large label — with a muted description
 * under the label. The link is named by the label alone; the description is
 * its accessible description, so a screen reader doesn't read it as the name.
 */
function SpaceRow({
  icon: Icon,
  label,
  description,
  href,
  onClick,
  active = false,
}: SpaceRowProps) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
      className={cn(
        "hover:bg-accent active:bg-accent relative flex w-full items-center gap-3 px-3 py-3 text-left transition-colors",
        active && "bg-primary/10 text-primary hover:bg-primary/10"
      )}
    >
      {/* The accent bar on the current space's row, as in a nav drawer. */}
      {active && (
        <span className="bg-primary absolute inset-y-3 left-0 w-1 rounded-r-full" aria-hidden />
      )}
      {/* Framed like the app icon — see .epi-logo-tile. */}
      <span
        className="epi-logo-tile size-12 shrink-0"
        data-active={active || undefined}
        aria-hidden
      >
        <Icon className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span id={labelId} className="block truncate text-lg leading-tight font-semibold">
          {label}
        </span>
        <span
          id={descriptionId}
          className="text-muted-foreground mt-0.5 block text-sm leading-snug"
        >
          {description}
        </span>
      </span>
      <ChevronRight className="text-muted-foreground size-5 shrink-0" aria-hidden />
    </Link>
  );
}

/** A bordered card of rows, split by hairlines. */
function MenuGroup({ children }: { children: React.ReactNode }) {
  return <div className="divide-y overflow-hidden rounded-xl border">{children}</div>;
}

/**
 * The POS Mode "More" drawer, opened by the Epidom button at the right end of
 * the status bar. It is where POS Mode's two spaces are picked — the POS
 * System (the four-tab till) and the Operational page (shift, schedule, clock
 * in/out) — and holds everything else that doesn't earn permanent tab-bar
 * space (customer display, hardware settings, feedback, Back Office, device
 * preferences, who's using the till).
 *
 * A right-hand Sheet laid out like a till's side menu: a navy brand header
 * with the signed-in profile (its Sync sales button on the right, the sync
 * state right under it), the spaces as large described rows, and rows with
 * chevrons. The sheet is pinned to the viewport with an explicit height
 * (divided by --app-zoom, like every viewport unit here), so the middle can
 * scroll while the header stays put — the definite height a bottom Sheet
 * never got through this shell's flex chain, which is why this was a Dialog
 * before.
 */
export function PosModeOverflowMenu({
  storeId,
  open,
  onOpenChange,
  linkedStaff = false,
}: PosModeOverflowMenuProps) {
  const { t } = useI18n();
  const pathname = usePathname();
  const { user } = useUser();
  const { store } = useCurrentStore();
  const { isOnline, isSyncing, pendingCount, syncNow } = useOfflineSyncContext();
  const displayEnabled = useCustomerDisplaySettings((state) => state.enabled);
  const setDisplayEnabled = useCustomerDisplaySettings((state) => state.setEnabled);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [hardwareOpen, setHardwareOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // This menu is mounted on every POS Mode screen: fetch the Help sheet while
  // online, so it (and the page intros' Learn more) still opens offline later.
  useEffect(() => preloadHelpSheet(), []);

  const {
    posSession,
    actingAsStaff,
    hasSwitchableStaff,
    handleSwitchAccount,
    handleReturnToPicker,
    handleOwnerAccountLogout,
  } = useAccountSwitcher(storeId);

  // The one deliberate way back into Back Office from this shell
  // (docs/back-office-revamp.md) — Owner/Manager only. Cashier/Kitchen never
  // see this: their allowedPages has no Back Office pages to land on, and
  // showing them a link into a shell they'd immediately be redirected out of
  // would be a dead end, not a shortcut. Same for a linked staff account, even
  // a Manager: staff logins are POS Mode only for now, so Back Office would
  // just redirect them straight back here.
  const canReachBackOffice =
    !linkedStaff && (posSession.staffRole === "OWNER" || posSession.staffRole === "MANAGER");

  // Whether this device's real account session has a store list to go to — a
  // staff PIN persona is scoped to the store it logged into and has none. A
  // linked staff account is the exception: it IS the account, so the list is
  // its own. Gates "Back to Stores" and the store switcher alike.
  const hasAccountStoreList = !actingAsStaff || linkedStaff;

  // Resumes the last Back Office section actually visited (Finance, Staff,
  // whatever was open before switching into POS Mode) instead of always
  // dropping back onto /dashboard — mirrors the same resume behavior already
  // used app-wide (src/lib/last-visited.ts), scoped to non-POS pages only so
  // it can't just point right back at this same shell.
  const [backOfficeHref, setBackOfficeHref] = useState(`/store/${storeId}/dashboard`);
  useEffect(() => {
    try {
      const last = localStorage.getItem(LAST_VISITED_BACK_OFFICE_COOKIE);
      if (last && last.startsWith(`/store/${storeId}/`) && isBackOfficeAppPath(last)) {
        setBackOfficeHref(last);
      }
    } catch {
      // Ignore blocked storage — falls back to the default /dashboard landing.
    }
  }, [storeId]);

  // Who the till is speaking as: the PIN persona when there is one, else the
  // signed-in account itself (an owner on a plan with no staff picker).
  const profileName = posSession.staffName ?? user?.name ?? user?.email ?? "";
  const profileRole = posSession.staffRole ?? (linkedStaff ? null : "OWNER");
  const roleLabel =
    profileRole && profileRole in STAFF_ROLE_LABEL_KEYS
      ? t(STAFF_ROLE_LABEL_KEYS[profileRole as keyof typeof STAFF_ROLE_LABEL_KEYS])
      : profileRole;
  // The account's own photo and email only when the account IS the person on
  // screen — never the owner's, under a cashier's PIN persona.
  const showsAccount = !actingAsStaff || linkedStaff;
  const avatarImage = showsAccount ? user?.image : null;
  const accountEmail = showsAccount ? user?.email : null;

  const close = () => onOpenChange(false);
  const hrefFor = (path: string) => `/store/${storeId}${path}`;

  // The two spaces of POS Mode. POS System is the four-tab till (cashier, orders,
  // kitchen & bar, tables) and leads to the first tab this persona's bar shows —
  // a kitchen persona lands on Kitchen & Bar, not a /pos it would be bounced
  // from. Operational is Shift, My Schedule and Clock In / Out, off the tab bar.
  const posTabs = usePosTabs(storeId);
  const posSystemHref = posTabs[0] ? hrefFor(posTabs[0].href) : null;
  const operationalHref = hrefFor("/pos/operational");
  // Mirrors the page's own tab rules (resolveOperationalTabs): every persona on
  // the owner's device clocks in there, so only a linked staff account with
  // neither a till nor the "/pos/schedule" grant has nothing to open.
  const showOperational =
    !linkedStaff ||
    canManageShift({ staffRole: posSession.staffRole, allowedPages: posSession.allowedPages }) ||
    (posSession.allowedPages?.includes("/pos/schedule") ?? true);

  const syncLabel = isSyncing ? t("pages.posOfflineSyncing") : t("pages.posSyncSales");

  // The strip under the profile card: the same three states the POS offline
  // banner reports, plus the all-clear it stays hidden for.
  const syncStatus = !isOnline
    ? {
        icon: WifiOff,
        className: "bg-destructive text-white",
        label:
          pendingCount > 0
            ? t("pages.posOfflineMessageWithPending").replace("{count}", String(pendingCount))
            : t("pages.posOfflineMessageNoPending"),
      }
    : pendingCount > 0
      ? {
          icon: CloudUpload,
          className: "bg-amber-500 text-black",
          label: t("pages.posOfflineSyncPending").replace("{count}", String(pendingCount)),
        }
      : {
          icon: CheckCircle2,
          className: "bg-emerald-600 text-white",
          label: t("pages.posAllSalesSynced"),
        };
  const SyncStatusIcon = syncStatus.icon;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          title={t("common.actions.more")}
          description={t("common.actions.more")}
          hideClose
          // No focus ring flashing on the close button every time it opens.
          onOpenAutoFocus={(event) => event.preventDefault()}
          // Phones: up to 340px, never past 88% of the screen. Tablet and up: 40% of
          // the screen, never under 340px. Lifts the Sheet's own sm:max-w-sm cap.
          className="h-[calc(100dvh/var(--app-zoom,1))] w-[min(340px,calc(88vw/var(--app-zoom,1)))] gap-0 overflow-hidden p-0 sm:max-w-none md:w-[max(340px,calc(40vw/var(--app-zoom,1)))]"
        >
          {/* Brand header — the Back Office top bar's navy and cream. */}
          <div
            className="shrink-0 px-4 pt-4 pb-8"
            style={{ background: "var(--epi-navy-850)", color: "var(--epi-cream-50)" }}
          >
            <div className="flex items-center gap-2.5">
              <EpidomLockup size={30} />
              <SheetClose className="-mr-1 ml-auto flex size-10 items-center justify-center rounded-full opacity-80 transition hover:bg-white/10 hover:opacity-100">
                <X className="size-5" aria-hidden />
                <span className="sr-only">{t("common.actions.close")}</span>
              </SheetClose>
            </div>

            {/* The profile card with the till's "sync" button on its right, and
                the sync state fused under it as one unit: offline, sales
                waiting, or all synced. */}
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
              <div className="flex items-center gap-3 bg-white/10 p-3">
                <Avatar className="size-11">
                  {avatarImage && <AvatarImage src={avatarImage} alt={profileName} />}
                  <AvatarFallback
                    className="text-base font-semibold"
                    style={{ background: "var(--epi-navy-600)", color: "var(--epi-cream-50)" }}
                  >
                    {profileName[0]?.toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-base leading-tight font-semibold">{profileName}</p>
                    {roleLabel && (
                      <span
                        className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase"
                        style={{
                          color: "var(--epi-gold-400)",
                          borderColor: "rgb(217 174 59 / 0.45)",
                          background: "rgb(217 174 59 / 0.15)",
                        }}
                      >
                        {roleLabel}
                      </span>
                    )}
                  </div>
                  {store?.name && (
                    <p className="mt-1 flex min-w-0 items-center gap-1 text-xs opacity-75">
                      <Store className="size-3 shrink-0" aria-hidden />
                      <span className="truncate">{store.name}</span>
                    </p>
                  )}
                  {accountEmail && (
                    <p className="mt-0.5 truncate text-xs opacity-60">{accountEmail}</p>
                  )}
                </div>
                {/* Sends any sales queued while offline and refreshes this device's
                    offline copy of the menu and orders. An icon button now, so its
                    old "Syncing…" caption lives on as its name while it spins.
                    Gold, not text-primary: that is navy in light mode, on navy. */}
                <button
                  type="button"
                  onClick={() => void syncNow()}
                  disabled={isSyncing || !isOnline}
                  aria-busy={isSyncing}
                  aria-label={syncLabel}
                  title={syncLabel}
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-[var(--epi-gold-400)] transition hover:bg-white/20 active:scale-[0.95] disabled:opacity-50"
                >
                  <RefreshCw className={cn("size-5", isSyncing && "animate-spin")} aria-hidden />
                </button>
              </div>
              <div
                role="status"
                className={cn(
                  "flex items-center justify-center gap-1 px-3 py-1 text-[10px] leading-4 font-medium",
                  syncStatus.className
                )}
              >
                <SyncStatusIcon className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{syncStatus.label}</span>
              </div>
            </div>
          </div>

          {/* Rounded panel tucked up under the header's profile card. */}
          <div className="bg-background relative -mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto rounded-t-3xl px-3 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {/* The spaces of POS Mode — the big rows, each saying what's inside. */}
            <MenuGroup>
              {canReachBackOffice && (
                <SpaceRow
                  icon={LayoutDashboard}
                  label={t("nav.backOffice")}
                  description={t("nav.backOfficeDesc")}
                  href={backOfficeHref}
                  onClick={close}
                />
              )}

              {posSystemHref && (
                <SpaceRow
                  icon={MonitorSmartphone}
                  label={t("nav.posSystem")}
                  description={t("nav.posSystemDesc")}
                  href={posSystemHref}
                  onClick={close}
                  active={isPosTabPath(pathname, storeId)}
                />
              )}

              {showOperational && (
                <SpaceRow
                  icon={ClipboardList}
                  label={t("nav.posOperational")}
                  description={t("nav.posOperationalDesc")}
                  href={operationalHref}
                  onClick={close}
                  active={pathname === operationalHref}
                />
              )}
            </MenuGroup>

            <MenuGroup>
              {/* One row: the switch, and the open-window button just left of it.
                  The button sits BETWEEN two labels rather than inside one — a
                  button inside the label would join the switch's name, and a tap
                  on it while disabled (pointer-events: none) would fall through
                  to the label and switch the display on. */}
              <div className="flex min-h-12 items-center gap-1 pr-1 pl-3">
                <label
                  htmlFor="pos-customer-display"
                  className="flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-3"
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg",
                      displayEnabled ? "bg-emerald-500/15 text-emerald-500" : "bg-muted"
                    )}
                    aria-hidden
                  >
                    <Monitor className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {t("pos.customerDisplay.enable")}
                  </span>
                </label>
                {/* Synchronous on purpose: window.open needs the tap's user activation. */}
                <button
                  type="button"
                  onClick={() => openCustomerDisplay(storeId)}
                  disabled={!displayEnabled}
                  aria-label={t("pos.customerDisplay.openWindow")}
                  title={t("pos.customerDisplay.openWindow")}
                  className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40"
                >
                  <ExternalLink className="size-4" aria-hidden />
                </button>
                {/* Its own label so the ~18px switch still gets a 48px target. */}
                <label
                  htmlFor="pos-customer-display"
                  className="flex h-12 min-w-11 cursor-pointer items-center justify-center"
                >
                  <Switch
                    id="pos-customer-display"
                    checked={displayEnabled}
                    onCheckedChange={setDisplayEnabled}
                  />
                </label>
              </div>

              <MenuRow
                icon={Cable}
                label={t("pos.hardware.title")}
                onClick={() => {
                  close();
                  setHardwareOpen(true);
                }}
              />
              <MenuRow
                icon={Bug}
                label={t("feedback.buttonLabel")}
                onClick={() => {
                  close();
                  setFeedbackOpen(true);
                }}
              />
              <MenuRow
                icon={CircleHelp}
                label={t("helpCenter.sheetTitle")}
                onClick={() => {
                  close();
                  setHelpOpen(true);
                }}
              />
            </MenuGroup>

            {/* Device preferences (language, light/dark, zoom) — every persona,
                since they belong to the tablet, not to whoever is signed in. */}
            <PosModePreferences />

            {/* Who's using this device — switching or logging out, not
                clocking in/out. Same actions, same reload/cache-clearing
                behavior as Back Office's NavUser dropdown
                (useAccountSwitcher), reachable without leaving POS Mode. */}
            {hasAccountStoreList && <PosModeStoreSwitcher storeId={storeId} onNavigate={close} />}

            <MenuGroup>
              {/* A linked account can only ever be itself — the server refuses
                  any other persona for it — so there's nobody to switch to. */}
              {!linkedStaff && (actingAsStaff || hasSwitchableStaff) && (
                <MenuRow
                  icon={RefreshCw}
                  label={t("nav.switchAccount")}
                  onClick={() => {
                    close();
                    handleSwitchAccount();
                  }}
                />
              )}

              {/* Tied to the real, underlying account session — a staff PIN
                  persona has no store list of its own, same gate nav-user.tsx
                  uses for this same action in Back Office. */}
              {hasAccountStoreList && (
                <MenuRow
                  icon={Store}
                  label={t("nav.backToStores")}
                  href="/stores"
                  onClick={close}
                />
              )}

              {actingAsStaff && (
                <MenuRow
                  icon={LogOut}
                  label={t("nav.logoutStaffSession")}
                  onClick={() => {
                    close();
                    handleReturnToPicker();
                  }}
                />
              )}

              <MenuRow
                icon={LogOut}
                label={linkedStaff ? t("nav.logoutAccount") : t("nav.logoutOwnerAccount")}
                tone="destructive"
                onClick={() => {
                  close();
                  handleOwnerAccountLogout();
                }}
              />
            </MenuGroup>
          </div>
        </SheetContent>
      </Sheet>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <HardwareSettingsDialog
        storeId={storeId}
        open={hardwareOpen}
        onOpenChange={setHardwareOpen}
      />
      {helpOpen && (
        <LazyHelpSheet
          storeId={storeId}
          open={helpOpen}
          onOpenChange={setHelpOpen}
          canManage={canReachBackOffice}
        />
      )}
    </>
  );
}
