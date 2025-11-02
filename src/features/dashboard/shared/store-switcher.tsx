"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Store, MapPin, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useStores } from "@/features/stores/stores/hooks/use-stores";
import { useCurrentStore } from "./hooks/use-current-store";
import { useI18n } from "@/components/lang/i18n-provider";

/**
 * Store Switcher Component
 *
 * Displays current store and allows switching between stores.
 * Uses Command component for searchable dropdown with keyboard navigation.
 * Placed in topbar for global access across dashboard.
 *
 * Features:
 * - Searchable store list
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

  const handleSelectStore = (selectedStoreId: string) => {
    setOpen(false);
    router.push(`/store/${selectedStoreId}/dashboard`);
  };

  const handleCreateStore = () => {
    setOpen(false);
    router.push("/stores");
  };

  // Loading state
  if (isLoading) {
    return <Skeleton className="h-9 w-[180px]" />;
  }

  // No stores available
  if (!stores || stores.length === 0) {
    return (
      <Button variant="outline" size="sm" onClick={handleCreateStore} className="h-9 text-sm">
        <Store className="mr-2 h-4 w-4" />
        {t("dashboard.storeSelector.createFirst") || "Create Store"}
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={t("dashboard.storeSelector.label") || "Select store"}
          className="h-9 w-[180px] justify-between rounded-2xl text-sm text-black"
        >
          <div className="flex items-center gap-2 truncate">
            <Store className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="truncate">
              {currentStore?.name || t("dashboard.storeSelector.select") || "Select store"}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="end">
        <Command>
          <CommandInput
            placeholder={t("dashboard.storeSelector.searchPlaceholder") || "Search store..."}
          />
          <CommandList>
            <CommandEmpty>
              {t("dashboard.storeSelector.noStores") || "No stores found"}
            </CommandEmpty>
            <CommandGroup heading={t("dashboard.storeSelector.yourStores") || "Your Stores"}>
              {stores.map((store) => (
                <CommandItem
                  key={store.id}
                  value={store.name}
                  onSelect={() => handleSelectStore(store.id)}
                  className="cursor-pointer"
                >
                  <div className="flex flex-1 items-center gap-2">
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        storeId === store.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                      <span className="truncate font-medium">{store.name}</span>
                      {store.city && (
                        <span className="text-muted-foreground flex items-center gap-1 text-xs">
                          <MapPin className="h-3 w-3" />
                          {store.city}
                        </span>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem onSelect={handleCreateStore} className="cursor-pointer">
                <Plus className="mr-2 h-4 w-4" />
                {t("dashboard.storeSelector.createNew") || "Create new store"}
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
