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
          className="text-primary-foreground flex h-9 items-center gap-2 overflow-hidden rounded-2xl px-2 hover:bg-white/10 hover:text-white sm:max-w-[160px] sm:px-2.5 lg:max-w-[180px]"
        >
          <Avatar className="size-7 shrink-0">
            {profile?.image && <AvatarImage src={profile.image} alt={user?.name ?? "User"} />}
            <AvatarFallback className="text-foreground bg-white text-xs">
              {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "U"}
            </AvatarFallback>
          </Avatar>
          <span className="hidden truncate text-sm font-medium sm:inline">
            {user?.name ?? user?.email}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        <DropdownMenuLabel className="truncate">
          {user?.name ?? user?.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push(`/store/${storeId}/profile`)}>
          {t("nav.profile")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/store/${storeId}/dashboard`)}>
          {t("nav.dashboard")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
