import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

export default function NavUser() {
  const router = useRouter();
  const { user } = useUser();
  const { t } = useI18n();
  const { storeId } = useCurrentStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="text-primary-foreground flex items-center gap-2 rounded-2xl hover:bg-white/10 hover:text-white"
        >
          <Avatar className="size-6">
            <AvatarFallback className="text-foreground bg-white text-xs">
              {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "U"}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline">{user?.name ?? user?.email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="max-w-[220px] truncate">
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
