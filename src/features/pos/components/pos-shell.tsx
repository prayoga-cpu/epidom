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

interface PosShellProps {
  store: Pick<Store, "id" | "name">;
  bypassStaffGate?: boolean;
}

export function PosShell({ store, bypassStaffGate }: PosShellProps) {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<"KITCHEN" | "BAR" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [configuringItem, setConfiguringItem] = useState<PosMenuItem | null>(null);
  const cart = usePosCart();

  const { data: menuData, isLoading } = usePosMenu(store.id);
  const { data: orders } = usePosOrders(store.id);
  const unpaidCount = orders?.filter((o) => o.paymentStatus === "PENDING").length ?? 0;

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
            <div className="bg-background flex items-center gap-4 border-b p-4">
              <div className="relative max-w-md flex-1">
                <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
                <Input
                  type="search"
                  placeholder={t("pos.menu.search")}
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <PosDepartmentBar
              selectedDepartment={selectedDepartment}
              onSelectDepartment={setSelectedDepartment}
            />

            <PosCategoryBar
              categories={menuData?.categories.map((c: any) => c.name) ?? []}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />

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
