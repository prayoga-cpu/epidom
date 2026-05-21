"use client";

import { useState } from "react";
import { Store } from "@prisma/client";
import { PosHeader } from "./pos-header";
import { PosCategoryBar } from "./pos-category-bar";
import { PosItemGrid } from "./pos-item-grid";
import { PosCart } from "./pos-cart";
import { PosOfflineBanner } from "./pos-offline-banner";
import { usePosMenu } from "../hooks/use-pos-menu";
import { usePosCart } from "../hooks/use-pos-cart";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Skeleton } from "@/components/ui/skeleton";

interface PosShellProps {
  store: Pick<Store, "id" | "name">;
}

export function PosShell({ store }: PosShellProps) {
  const { t } = useI18n();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const cart = usePosCart();

  const { data: menuData, isLoading } = usePosMenu(store.id);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-muted/10">
      <PosHeader store={store} />
      <PosOfflineBanner storeId={store.id} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left pane: Menu Grid */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-4 border-b bg-background p-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder={t("pos.menu.search")}
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <PosCategoryBar
            categories={menuData?.categories.map((c: any) => c.name) ?? []}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />

          {isLoading ? (
            <div className="p-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <PosItemGrid
              categories={menuData?.categories ?? []}
              selectedCategory={selectedCategory}
              searchQuery={searchQuery}
              onItemClick={(item) => cart.addItem(item.id, item.name, item.price, 1, [], item.imageUrl)}
            />
          )}
        </div>

        {/* Right pane: Cart */}
        <div className="hidden w-80 flex-col md:flex lg:w-96 border-l shadow-xl z-10">
          <PosCart storeId={store.id} storeName={store.name} />
        </div>
      </div>
    </div>
  );
}
