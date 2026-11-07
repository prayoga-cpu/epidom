"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import { useCurrentStore } from "./hooks/use-current-store";
import { useAccountSwitcher } from "./hooks/use-account-switcher";
import { useProfile } from "@/features/dashboard/profile/hooks/use-profile";
import { isAdminEmail } from "@/lib/admin";
import {
  Shield,
  TrendingUp,
  ShieldCheck,
  LogOut,
  RefreshCw,
  Store,
  Handshake,
  ChevronsUpDown,
  type LucideIcon,
} from "lucide-react";
import { AccountAccessDialog } from "./account-access-dialog";
import { ZoomControl } from "./zoom-control";
import { APP_VERSION } from "@/lib/version";

/**
 * Everything the account menu shows, shared by the topbar's avatar dropdown
 * (NavUser, tablet and desktop) and the phone menu drawer's Account block
 * (NavUserDrawerSection) — on a phone the avatar is gone from the topbar, so
 * the drawer is the only way to these actions and has to list all of them.
 */
function useNavUserModel() {
  const router = useRouter();
  const { user } = useUser();
  const { storeId } = useCurrentStore();
  const { data: profile } = useProfile();
  const adminAccess = profile?.adminAccess;
  const isFullAdmin = isAdminEmail(user?.email) || adminAccess?.full === true;
  const hasAdminPages = isFullAdmin || (adminAccess?.sections.length ?? 0) > 0;
  const canSeeRevenue = isFullAdmin || (adminAccess?.sections ?? []).includes("revenue");
  const isPartner = adminAccess?.partner === true;

  const {
    posSession,
    actingAsStaff,
    hasSwitchableStaff,
    handleSwitchAccount,
    handleReturnToPicker,
    handleOwnerAccountLogout,
  } = useAccountSwitcher(storeId);

  // A persona left logged in from a previous day shouldn't keep showing
  // here — real enforcement is the server-side StaffSession expiry, this
  // just keeps the menu's own label/badge honest without a round-trip.
  useEffect(() => {
    posSession.checkStale();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayName = actingAsStaff ? posSession.staffName : (user?.name ?? user?.email);
  const initial = actingAsStaff
    ? (posSession.staffName?.[0]?.toUpperCase() ?? "S")
    : (user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "U");

  return {
    router,
    user,
    profile,
    posSession,
    actingAsStaff,
    hasSwitchableStaff,
    handleSwitchAccount,
    handleReturnToPicker,
    handleOwnerAccountLogout,
    hasAdminPages,
    canSeeRevenue,
    isPartner,
    displayName,
    initial,
    staffAllowedPages: actingAsStaff ? (posSession.allowedPages ?? []) : null,
  };
}

function RoleBadge({ actingAsStaff }: { actingAsStaff: boolean }) {
  return actingAsStaff ? (
    <span className="shrink-0 rounded-full border border-amber-400/40 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-amber-600 uppercase">
      Staff
    </span>
  ) : (
    <span className="shrink-0 rounded-full border border-violet-400/40 bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-violet-600 uppercase">
      Beta
    </span>
  );
}

interface NavUserProps {
  /**
   * "topbar" (default): the round avatar button of the phone/tablet header.
   * "sidebar": the full-width account row at the foot of the desktop rail
   * (Lovable-style), whose menu opens upward.
   */
  variant?: "topbar" | "sidebar";
  /** Sidebar only: just the avatar, for the collapsed rail. */
  compact?: boolean;
}

export function NavUser({ variant = "topbar", compact = false }: NavUserProps = {}) {
  const { t } = useI18n();
  const { storeId } = useCurrentStore();
  const sidebar = variant === "sidebar";
  const model = useNavUserModel();
  const {
    router,
    user,
    profile,
    posSession,
    actingAsStaff,
    hasSwitchableStaff,
    handleSwitchAccount,
    handleReturnToPicker,
    handleOwnerAccountLogout,
    hasAdminPages,
    canSeeRevenue,
    isPartner,
    displayName,
    initial,
  } = model;

  const [accountAccessOpen, setAccountAccessOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "flex items-center gap-2 overflow-hidden hover:bg-white/10",
              sidebar
                ? cn("h-12 w-full rounded-lg px-2", compact ? "justify-center px-0" : "justify-start")
                : "h-9 rounded-2xl px-2 sm:max-w-[160px] sm:px-2.5 lg:max-w-[180px]"
            )}
            style={{ color: "var(--epi-cream-50)" }}
          >
            <Avatar className="size-7 shrink-0">
              {profile?.image && <AvatarImage src={profile.image} alt={user?.name ?? "User"} />}
              <AvatarFallback
                className="text-foreground bg-[var(--epi-navy-700)] text-xs"
                style={{ color: "var(--epi-cream-50)" }}
              >
                {initial}
              </AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "truncate text-sm font-medium",
                sidebar ? "min-w-0 flex-1 text-left" : "hidden sm:inline",
                compact && "sr-only"
              )}
            >
              {displayName}
            </span>
            {sidebar && !compact && (
              <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={sidebar ? "start" : "end"}
          side={sidebar ? "top" : "bottom"}
          className="w-[220px]"
        >
          <DropdownMenuLabel className="flex items-center gap-2">
            <span className="flex-1 truncate">{displayName}</span>
            <RoleBadge actingAsStaff={actingAsStaff} />
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {(actingAsStaff || hasSwitchableStaff) && (
            <DropdownMenuItem onClick={handleSwitchAccount}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              {t("nav.switchAccount")}
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={() => setAccountAccessOpen(true)}>
            <ShieldCheck className="mr-2 h-3.5 w-3.5" />
            {t("nav.accountAccess")}
          </DropdownMenuItem>

          {!actingAsStaff && (
            <DropdownMenuItem onClick={() => router.push("/stores")}>
              <Store className="mr-2 h-3.5 w-3.5" />
              {t("nav.backToStores")}
            </DropdownMenuItem>
          )}

          {/* Its own section: a display preference, not an account action —
              and available to staff personas too, since the cashier tablet is
              exactly where the browser's own zoom is out of reach. */}
          <DropdownMenuSeparator />
          <ZoomControl />

          {sidebar && (
            <DropdownMenuItem asChild>
              <Link href={storeId ? `/store/${storeId}/changelog` : "/changelog"}>
                <span className="flex-1">{t("footer.linkChangelog")}</span>
                <span className="text-muted-foreground text-xs">{`v${APP_VERSION}`}</span>
              </Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          {actingAsStaff && (
            <DropdownMenuItem onClick={handleReturnToPicker}>
              <LogOut className="mr-2 h-3.5 w-3.5" />
              {t("nav.logoutStaffSession")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={handleOwnerAccountLogout}
            className="text-red-400 focus:bg-red-500/10 focus:text-red-400"
          >
            <LogOut className="mr-2 h-3.5 w-3.5" />
            {t("nav.logoutOwnerAccount")}
          </DropdownMenuItem>

          {!actingAsStaff && (hasAdminPages || isPartner) && (
            <>
              <DropdownMenuSeparator />
              {hasAdminPages && (
                <DropdownMenuItem
                  onClick={() => router.push("/admin")}
                  className="text-red-400 focus:bg-red-500/10 focus:text-red-400"
                >
                  <Shield className="mr-2 h-3.5 w-3.5" />
                  Admin Panel
                </DropdownMenuItem>
              )}
              {canSeeRevenue && (
                <DropdownMenuItem
                  onClick={() => router.push("/admin/revenue")}
                  className="text-emerald-400 focus:bg-emerald-500/10 focus:text-emerald-400"
                >
                  <TrendingUp className="mr-2 h-3.5 w-3.5" />
                  Revenue Report
                </DropdownMenuItem>
              )}
              {isPartner && (
                <DropdownMenuItem
                  onClick={() => router.push("/admin/my-referrals")}
                  className="text-amber-400 focus:bg-amber-500/10 focus:text-amber-400"
                >
                  <Handshake className="mr-2 h-3.5 w-3.5" />
                  {t("partnerPortal.menuItem")}
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AccountAccessDialog
        open={accountAccessOpen}
        onOpenChange={setAccountAccessOpen}
        actingAsStaff={actingAsStaff}
        name={displayName ?? null}
        role={actingAsStaff ? posSession.staffRole : "OWNER"}
        allowedPages={model.staffAllowedPages}
      />
    </>
  );
}

/** One full-width, ≥40px row of the drawer's Account block. */
function DrawerAction({
  icon: Icon,
  label,
  onClick,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger" | "admin" | "revenue" | "partner";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-10 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm transition-colors active:scale-[0.98]",
        tone === "default" && "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        tone === "danger" && "text-red-500 hover:bg-red-500/10",
        tone === "admin" && "text-red-500 hover:bg-red-500/10",
        tone === "revenue" && "text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400",
        tone === "partner" && "text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </button>
  );
}

/**
 * The account menu, laid out for the phone menu drawer (Sidebar mode="mobile").
 * Below `sm` the topbar has no avatar any more, so this block carries every
 * action the avatar dropdown does: who's signed in, switch account, account
 * access, back to stores, the admin shortcuts, and log out last.
 */
export function NavUserDrawerSection() {
  const { t } = useI18n();
  const model = useNavUserModel();
  const {
    router,
    user,
    profile,
    posSession,
    actingAsStaff,
    hasSwitchableStaff,
    handleSwitchAccount,
    handleReturnToPicker,
    handleOwnerAccountLogout,
    hasAdminPages,
    canSeeRevenue,
    isPartner,
    displayName,
    initial,
  } = model;
  const [accountAccessOpen, setAccountAccessOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1" data-testid="drawer-account">
      <span className="text-muted-foreground text-xs font-medium">{t("nav.account")}</span>
      <div className="flex min-w-0 items-center gap-2.5 px-2 py-1.5">
        <Avatar className="size-8 shrink-0">
          {profile?.image && <AvatarImage src={profile.image} alt={user?.name ?? "User"} />}
          <AvatarFallback className="bg-muted text-foreground text-xs">{initial}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{displayName}</span>
          {!actingAsStaff && user?.email && user.email !== displayName && (
            <span className="text-muted-foreground truncate text-xs">{user.email}</span>
          )}
        </div>
        <RoleBadge actingAsStaff={actingAsStaff} />
      </div>

      {(actingAsStaff || hasSwitchableStaff) && (
        <DrawerAction
          icon={RefreshCw}
          label={t("nav.switchAccount")}
          onClick={handleSwitchAccount}
        />
      )}
      <DrawerAction
        icon={ShieldCheck}
        label={t("nav.accountAccess")}
        onClick={() => setAccountAccessOpen(true)}
      />
      {!actingAsStaff && (
        <DrawerAction
          icon={Store}
          label={t("nav.backToStores")}
          onClick={() => router.push("/stores")}
        />
      )}
      {!actingAsStaff && hasAdminPages && (
        <DrawerAction
          icon={Shield}
          label="Admin Panel"
          tone="admin"
          onClick={() => router.push("/admin")}
        />
      )}
      {!actingAsStaff && canSeeRevenue && (
        <DrawerAction
          icon={TrendingUp}
          label="Revenue Report"
          tone="revenue"
          onClick={() => router.push("/admin/revenue")}
        />
      )}
      {!actingAsStaff && isPartner && (
        <DrawerAction
          icon={Handshake}
          label={t("partnerPortal.menuItem")}
          tone="partner"
          onClick={() => router.push("/admin/my-referrals")}
        />
      )}
      {actingAsStaff && (
        <DrawerAction
          icon={LogOut}
          label={t("nav.logoutStaffSession")}
          onClick={handleReturnToPicker}
        />
      )}
      <DrawerAction
        icon={LogOut}
        label={t("nav.logoutOwnerAccount")}
        tone="danger"
        onClick={handleOwnerAccountLogout}
      />

      <AccountAccessDialog
        open={accountAccessOpen}
        onOpenChange={setAccountAccessOpen}
        actingAsStaff={actingAsStaff}
        name={displayName ?? null}
        role={actingAsStaff ? posSession.staffRole : "OWNER"}
        allowedPages={model.staffAllowedPages}
        aboveSheet
      />
    </div>
  );
}
