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
import { useProfile } from "@/features/dashboard/profile/hooks/use-profile";
import { isAdminEmail } from "@/lib/admin";
import { Shield } from "lucide-react";

export function NavUser() {
  const router = useRouter();
  const { user } = useUser();
  const { t } = useI18n();
  const { storeId } = useCurrentStore();
  // Defer profile loading - only fetch when dropdown is opened (lazy loading)
  // This prevents blocking initial render
  const { data: profile } = useProfile();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex h-9 items-center gap-2 overflow-hidden rounded-2xl px-2 hover:bg-white/10 sm:max-w-[160px] sm:px-2.5 lg:max-w-[180px]" style={{ color: "var(--epi-cream-50)" }}
        >
          <Avatar className="size-7 shrink-0">
            {profile?.image && <AvatarImage src={profile.image} alt={user?.name ?? "User"} />}
            <AvatarFallback className="text-foreground bg-[var(--epi-navy-700)] text-xs" style={{ color: "var(--epi-cream-50)" }}>
              {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "U"}
            </AvatarFallback>
          </Avatar>
          <span className="hidden truncate text-sm font-medium sm:inline">
            {user?.name ?? user?.email}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        <DropdownMenuLabel className="flex items-center gap-2">
          <span className="truncate flex-1">{user?.name ?? user?.email}</span>
          <span className="shrink-0 rounded-full border border-violet-400/40 bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-600">
            Beta
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push(`/store/${storeId}/profile`)}>
          {t("nav.profile")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/store/${storeId}/dashboard`)}>
          {t("nav.dashboard")}
        </DropdownMenuItem>
        {isAdminEmail(user?.email) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push("/admin")}
              className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
            >
              <Shield className="mr-2 h-3.5 w-3.5" />
              Admin Panel
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
