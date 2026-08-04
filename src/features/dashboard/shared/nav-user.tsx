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
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrentStore } from "./hooks/use-current-store";
import { useOwnerPinStatus } from "./hooks/use-owner-pin";
import { useProfile } from "@/features/dashboard/profile/hooks/use-profile";
import { isAdminEmail } from "@/lib/admin";
import { Shield, TrendingUp, Users, KeyRound } from "lucide-react";
import { usePosSession } from "@/features/pos/hooks/use-pos-session";
import { apiClient } from "@/lib/api/client";
import { StaffSwitcherDialog } from "./staff-switcher-dialog";
import { VerifyOwnerPinDialog } from "./verify-owner-pin-dialog";
import { SetOwnerPinDialog } from "./set-owner-pin-dialog";

export function NavUser() {
  const router = useRouter();
  const { user } = useUser();
  const { t } = useI18n();
  const { storeId } = useCurrentStore();
  // Defer profile loading - only fetch when dropdown is opened (lazy loading)
  // This prevents blocking initial render
  const { data: profile } = useProfile();

  const posSession = usePosSession();
  const { data: pinStatus } = useOwnerPinStatus();

  // A persona left logged in from a previous day shouldn't keep showing
  // here — real enforcement is the server-side StaffSession expiry, this
  // just keeps the dropdown's own label/badge honest without a round-trip.
  useEffect(() => {
    posSession.checkStale();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [verifyOwnerOpen, setVerifyOwnerOpen] = useState(false);
  const [setOwnerPinOpen, setSetOwnerPinOpen] = useState(false);

  // Role-based, not ID-based: a StaffMember row can itself have role "OWNER"
  // (e.g. seeded accounts), and that persona is functionally the owner too —
  // checking staffId !== "owner" alone missed that case and showed "Switch
  // back to Owner" while already acting as the (real-row) owner.
  const actingAsStaff =
    posSession.isActive && posSession.storeId === storeId && posSession.staffRole !== "OWNER";

  const handleSwitchedBackToOwner = async () => {
    posSession.logout();
    if (storeId) {
      try {
        await apiClient.post(`/stores/${storeId}/staff/logout`, {});
      } catch {
        // Best-effort — the client-side session is already cleared either way.
      }
    }
    // Hard reload, not just client state: the current page's server-rendered
    // content was fetched under the (now-cleared) staff session, so a client
    // router transition wouldn't re-run the page guards or refetch anything
    // that was hidden/redirected while restricted.
    window.location.reload();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex h-9 items-center gap-2 overflow-hidden rounded-2xl px-2 hover:bg-white/10 sm:max-w-[160px] sm:px-2.5 lg:max-w-[180px]"
            style={{ color: "var(--epi-cream-50)" }}
          >
            <Avatar className="size-7 shrink-0">
              {profile?.image && <AvatarImage src={profile.image} alt={user?.name ?? "User"} />}
              <AvatarFallback
                className="text-foreground bg-[var(--epi-navy-700)] text-xs"
                style={{ color: "var(--epi-cream-50)" }}
              >
                {actingAsStaff
                  ? (posSession.staffName?.[0]?.toUpperCase() ?? "S")
                  : (user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "U")}
              </AvatarFallback>
            </Avatar>
            <span className="hidden truncate text-sm font-medium sm:inline">
              {actingAsStaff ? posSession.staffName : (user?.name ?? user?.email)}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[220px]">
          <DropdownMenuLabel className="flex items-center gap-2">
            <span className="flex-1 truncate">
              {actingAsStaff ? posSession.staffName : (user?.name ?? user?.email)}
            </span>
            {actingAsStaff ? (
              <span className="shrink-0 rounded-full border border-amber-400/40 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-amber-600 uppercase">
                Staff
              </span>
            ) : (
              <span className="shrink-0 rounded-full border border-violet-400/40 bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-violet-600 uppercase">
                Beta
              </span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {actingAsStaff ? (
            <DropdownMenuItem
              onClick={() => {
                if (pinStatus?.hasPin) setVerifyOwnerOpen(true);
                else setSetOwnerPinOpen(true);
              }}
            >
              <KeyRound className="mr-2 h-3.5 w-3.5" />
              Back to Owner Account
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setSwitcherOpen(true)}>
              <Users className="mr-2 h-3.5 w-3.5" />
              Switch to Staff Account
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push(`/store/${storeId}/profile`)}>
            {t("nav.profile")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push(`/store/${storeId}/dashboard`)}>
            {t("nav.dashboard")}
          </DropdownMenuItem>
          {(isAdminEmail(user?.email) || (profile as any)?.isAdmin) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push("/admin")}
                className="text-red-400 focus:bg-red-500/10 focus:text-red-400"
              >
                <Shield className="mr-2 h-3.5 w-3.5" />
                Admin Panel
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push("/admin/revenue")}
                className="text-emerald-400 focus:bg-emerald-500/10 focus:text-emerald-400"
              >
                <TrendingUp className="mr-2 h-3.5 w-3.5" />
                Revenue Report
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {storeId && (
        <StaffSwitcherDialog open={switcherOpen} onOpenChange={setSwitcherOpen} storeId={storeId} />
      )}
      <VerifyOwnerPinDialog
        open={verifyOwnerOpen}
        onOpenChange={setVerifyOwnerOpen}
        onVerified={handleSwitchedBackToOwner}
      />
      <SetOwnerPinDialog
        open={setOwnerPinOpen}
        onOpenChange={setSetOwnerPinOpen}
        title="Set Owner PIN to continue"
        description="No Owner PIN is set yet. Set one now to switch this device back to your Owner account."
        onSuccess={handleSwitchedBackToOwner}
      />
    </>
  );
}
