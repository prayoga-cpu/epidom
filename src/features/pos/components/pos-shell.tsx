"use client";

import { useState } from "react";
import { Store } from "@prisma/client";
import { PosHeader } from "./pos-header";
import { PosCategoryBar } from "./pos-category-bar";
import { PosDepartmentBar } from "./pos-department-bar";
import { PosItemGrid } from "./pos-item-grid";
import { PosCart } from "./pos-cart";
import { PosMobileCart } from "./pos-mobile-cart";
import { PosOfflineBanner } from "./pos-offline-banner";
import { PosUnpaidAlert } from "./pos-unpaid-alert";
import { AddFilterMenu } from "./add-filter-menu";
import { RemovableFilter } from "./removable-filter";
import { usePosMenu } from "../hooks/use-pos-menu";
import { usePosCart } from "../hooks/use-pos-cart";
import { usePosOrders } from "../hooks/use-pos-orders";
import { PosStaffGate } from "./pos-staff-gate";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/components/providers/currency-provider";
import { MenuItemOptionsDialog } from "@/components/shared/menu-item-options-dialog";
import { getMergedOptionGroups } from "@/lib/utils/menu-item-options";
import type { PosMenuItem } from "../types/pos.types";

// Hidden by default behind "+ Add filter" — same Notion-chip pattern as the
// order queue/history toolbars, so the search bar isn't crowded with
// dimensions the cashier isn't actively narrowing by.
const POS_FILTER_KEYS = ["department", "category"] as const;
type PosFilterKey = (typeof POS_FILTER_KEYS)[number];

interface PosShellProps {
  store: Pick<Store, "id" | "name">;
  bypassStaffGate?: boolean;
}

export function PosShell({ store, bypassStaffGate }: PosShellProps) {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<"KITCHEN" | "BAR" | null>(null);
  const [activeFilterKeys, setActiveFilterKeys] = useState<PosFilterKey[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [configuringItem, setConfiguringItem] = useState<PosMenuItem | null>(null);
  const cart = usePosCart();

  const { data: menuData, isLoading } = usePosMenu(store.id);
  const { data: orders } = usePosOrders(store.id);
  const unpaidCount = orders?.filter((o) => o.paymentStatus === "PENDING").length ?? 0;
  const categoryNames = menuData?.categories.map((c: any) => c.name) ?? [];

  const addFilter = (key: PosFilterKey) => {
    setActiveFilterKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  };

  const removeFilter = (key: PosFilterKey) => {
    setActiveFilterKeys((prev) => prev.filter((k) => k !== key));
    if (key === "department") setSelectedDepartment(null);
    if (key === "category") setSelectedCategory(null);
  };

  const handleItemClick = (item: PosMenuItem) => {
    const groups = getMergedOptionGroups(item, item.product);
    if (groups.length === 0) {
      cart.addItem(item.id, item.name, item.price, 1, [], item.imageUrl);
      return;
    }
    setConfiguringItem(item);
  };

  return (
    <PosStaffGate storeId={store.id} bypassGate={bypassStaffGate}>
      <div className="bg-muted/10 flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl">
        <PosHeader store={store} onCartClick={() => setMobileCartOpen(true)} />
        <PosOfflineBanner storeId={store.id} />
        <PosUnpaidAlert storeId={store.id} unpaidCount={unpaidCount} />

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Left pane: Menu Grid. min-w-0 stops this pane's content from
              refusing to shrink below its natural width (the flex-item
              default) and squeezing the fixed-width cart pane next to it. */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="bg-background flex items-center gap-3 border-b p-4">
              <div className="relative w-full max-w-[200px] shrink-0 sm:max-w-xs">
                <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
                <Input
                  type="search"
                  placeholder={t("pos.menu.search")}
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Filters sit beside the search bar and scroll horizontally
                  as a single strip instead of wrapping — the search input
                  keeps its width, this row absorbs the overflow. */}
              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
                {activeFilterKeys.includes("department") && (
                  <RemovableFilter onRemove={() => removeFilter("department")}>
                    <PosDepartmentBar
                      selectedDepartment={selectedDepartment}
                      onSelectDepartment={setSelectedDepartment}
                    />
                  </RemovableFilter>
                )}
                {activeFilterKeys.includes("category") && categoryNames.length > 0 && (
                  <RemovableFilter onRemove={() => removeFilter("category")}>
                    <PosCategoryBar
                      categories={categoryNames}
                      selectedCategory={selectedCategory}
                      onSelectCategory={setSelectedCategory}
                    />
                  </RemovableFilter>
                )}
                <AddFilterMenu
                  options={POS_FILTER_KEYS.filter(
                    (k) =>
                      !activeFilterKeys.includes(k) && (k !== "category" || categoryNames.length > 0)
                  ).map((k) => ({ key: k, label: t(`pos.filters.${k}`) }))}
                  onAdd={(k) => addFilter(k as PosFilterKey)}
                />
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <PosItemGrid
                categories={menuData?.categories ?? []}
                selectedCategory={selectedCategory}
                selectedDepartment={selectedDepartment}
                searchQuery={searchQuery}
                onItemClick={handleItemClick}
              />
            )}
          </div>

          {/* Right pane: Cart. shrink-0 guarantees this pane keeps its
              fixed w-80/lg:w-96 width rather than being compressed if the
              menu pane's content pushes total width past what's available. */}
          <div className="z-10 hidden min-h-0 w-80 shrink-0 flex-col border-l shadow-xl md:flex lg:w-96">
            <PosCart storeId={store.id} storeName={store.name} />
          </div>
        </div>

        <PosMobileCart store={store} open={mobileCartOpen} onOpenChange={setMobileCartOpen} />

        {configuringItem && (
          <MenuItemOptionsDialog
            open={!!configuringItem}
            onOpenChange={(open) => !open && setConfiguringItem(null)}
            itemName={configuringItem.name}
            groups={getMergedOptionGroups(configuringItem, configuringItem.product)}
            formatPrice={formatPrice}
            onConfirm={({ selectedOptions, notes }) => {
              cart.addItem(
                configuringItem.id,
                configuringItem.name,
                configuringItem.price,
                1,
                selectedOptions,
                configuringItem.imageUrl,
                notes
              );
              setConfiguringItem(null);
            }}
          />
        )}
      </div>
    </PosStaffGate>
  );
}
