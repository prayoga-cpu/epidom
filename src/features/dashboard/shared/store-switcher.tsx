"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Store, MapPin, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useStores } from "@/features/stores/stores/hooks/use-stores";
import { useCurrentStore } from "./hooks/use-current-store";
import { useDefaultLanding } from "@/features/dashboard/profile/hooks/use-default-landing";
import { useI18n } from "@/components/lang/i18n-provider";
import { usePosSession } from "@/features/pos/hooks/use-pos-session";

/**
 * Store Switcher Component
 *
 * Displays current store and allows switching between stores.
 * Placed in topbar for global access across dashboard, and in the mobile drawer.
 *
 * A plain dropdown, not a search box: an account has a handful of stores (the
 * plan caps how many), and on a phone a search field takes focus on open and
 * brings up the keyboard over the list. Arrow keys and type-to-jump still work
 * on desktop (Radix menu typeahead on the store name).
 *
 * Features:
 * - Store list, capped and scrolling past a dozen or so
 * - Current store highlighting
 * - Empty state with link to stores page
 * - Loading and error states
 * - Responsive design (can be hidden on mobile)
 */
export function StoreSwitcher() {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const { store: currentStore, storeId } = useCurrentStore();
  const { data: stores, isLoading } = useStores();
  const defaultLanding = useDefaultLanding();
  const posSession = usePosSession();

  const handleSelectStore = (selectedStoreId: string) => {
    setOpen(false);
    router.push(`/store/${selectedStoreId}/${defaultLanding}`);
  };

  const handleCreateStore = () => {
    setOpen(false);
    router.push("/stores");
  };

  // A restricted staff persona is scoped to the store they logged into —
  // switching stores (and seeing the rest of the business's store list) is
  // an owner-level capability, so show a plain, non-interactive label instead.
  const isRestrictedStaff =
    posSession.isActive && posSession.storeId === storeId && posSession.staffRole !== "OWNER";
  if (isRestrictedStaff) {
    return (
      <div className="text-foreground flex h-9 w-[140px] items-center gap-1.5 truncate rounded-2xl px-3 text-xs sm:w-[160px] sm:gap-2 sm:text-sm lg:w-[180px] lg:text-sm">
        <Store className="text-muted-foreground h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
        <span className="truncate">{currentStore?.name}</span>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return <Skeleton className="h-9 w-[140px] rounded-2xl sm:w-[160px] lg:w-[180px]" />;
  }

  // No stores available
  if (!stores || stores.length === 0) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleCreateStore}
        className="h-9 w-[140px] text-xs sm:w-[160px] sm:text-sm lg:h-9 lg:w-auto lg:text-sm"
      >
        <Store className="mr-1 hidden h-3.5 w-3.5 sm:mr-1 sm:inline sm:h-4 sm:w-4 lg:mr-1 lg:h-4 lg:w-4" />
        <span className="hidden sm:inline lg:inline">
          {t("dashboard.storeSelector.createFirst")}
        </span>
        <span className="sm:hidden">Store</span>
      </Button>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-label={t("dashboard.storeSelector.label")}
          className="text-foreground h-9 w-[140px] justify-between rounded-2xl text-xs sm:w-[160px] sm:text-sm lg:w-[180px] lg:text-sm"
        >
          <div className="flex min-w-0 items-center gap-1.5 truncate sm:gap-2">
            <Store className="text-muted-foreground h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
            <span className="truncate">
              {currentStore?.name || t("dashboard.storeSelector.select")}
            </span>
          </div>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50 sm:ml-2 sm:h-4 sm:w-4" />
        </Button>
      </DropdownMenuTrigger>
      {/* As wide as the trigger (full width in the mobile drawer), never narrower than 220px.
          z-[80]: the phone menu drawer (Sheet) is z-[70], and at the menu's default
          z-50 the list opened underneath it, out of sight and out of reach. */}
      <DropdownMenuContent
        align="end"
        className="z-[80] w-(--radix-dropdown-menu-trigger-width) min-w-[220px]"
      >
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          {t("dashboard.storeSelector.yourStores")}
        </DropdownMenuLabel>
        <div className="max-h-64 overflow-y-auto">
          {stores.map((store) => (
            <DropdownMenuItem
              key={store.id}
              textValue={store.name}
              aria-current={storeId === store.id ? "true" : undefined}
              onSelect={() => handleSelectStore(store.id)}
              className="min-h-11 cursor-pointer"
            >
              <Check
                className={cn(
                  "h-4 w-4 shrink-0",
                  storeId === store.id ? "opacity-100" : "opacity-0"
                )}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium">{store.name}</span>
                {store.city && (
                  <span className="text-muted-foreground flex items-center gap-1 text-xs">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{store.city}</span>
                  </span>
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleCreateStore} className="min-h-11 cursor-pointer">
          <Plus className="h-4 w-4" />
          {t("dashboard.storeSelector.createNew")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
