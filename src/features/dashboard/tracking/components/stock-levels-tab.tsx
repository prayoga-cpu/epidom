"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, AlertCircle, XCircle, Search, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { ExportButton } from "@/components/ui/export-button";
import { useI18n } from "@/components/lang/i18n-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMaterials } from "@/features/dashboard/data/materials/hooks/use-materials";
import { useProducts } from "@/features/dashboard/data/products/hooks/use-products";

function getStockStatus(currentStock: number, minStock: number, maxStock: number) {
  if (currentStock === 0) {
    return {
      color: "destructive",
      percentage: 0,
      status: "critical",
    } as const;
  } else if (currentStock <= minStock) {
    return {
      color: "destructive",
      percentage: (currentStock / maxStock) * 100,
      status: "critical",
    } as const;
  } else if (currentStock >= maxStock) {
    return { color: "dark", percentage: 100, status: "ok" } as const;
  } else {
    return {
      color: "muted",
      percentage: (currentStock / maxStock) * 100,
      status: "warning",
    } as const;
  }
}

type StockItem = {
  id: string;
  name: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unit: string;
  type: "material" | "product";
};

export function StockLevelsTab() {
  const { t } = useI18n();
  const params = useParams();
  const storeId = params.storeId as string;

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [itemType, setItemType] = useState<"all" | "material" | "product">("all");

  // Fetch materials
  const { data: materialsData, isLoading: materialsLoading } = useMaterials(storeId, {
    search: searchQuery,
    stockStatus: stockFilter !== "all" ? (stockFilter as any) : undefined,
    skip: 0,
    take: 100,
    sortBy: "currentStock",
    sortOrder: "asc",
  });

  // Fetch products
  const { data: productsData, isLoading: productsLoading } = useProducts(storeId, {
    search: searchQuery,
    skip: 0,
    take: 100,
    sortBy: "currentStock",
    sortOrder: "asc",
  });

  const isLoading = materialsLoading || productsLoading;

  // Combine materials and products into stock items
  const materials = materialsData?.materials || [];
  const products = productsData?.products || [];

  const allStockItems: StockItem[] = [
    ...materials.map((m) => ({
      id: m.id,
      name: m.name,
      currentStock: Number(m.currentStock),
      minStock: Number(m.minStock),
      maxStock: Number(m.maxStock),
      unit: m.unit,
      type: "material" as const,
    })),
    ...products.map((p) => ({
      id: p.id,
      name: p.name,
      currentStock: Number(p.currentStock),
      minStock: Number(p.minStock),
      maxStock: Number(p.maxStock),
      unit: p.unit,
      type: "product" as const,
    })),
  ];

  // Filter by item type
  const filteredItems =
    itemType === "all" ? allStockItems : allStockItems.filter((item) => item.type === itemType);

  // Apply stock status filter and sort by stock percentage
  const finalFilteredItems = filteredItems
    .filter((item) => {
      if (stockFilter === "all") return true;
      const status = getStockStatus(item.currentStock, item.minStock, item.maxStock).status;

      // Low stock = red bar only (critical status)
      if (stockFilter === "low_stock") return status === "critical";
      // Out of stock = 0 stock
      if (stockFilter === "out_of_stock") return item.currentStock === 0;
      // Overstock = dark/black bar only (ok status - at or above max)
      if (stockFilter === "overstocked") return status === "ok";
      // In stock = gray bar only (warning status - between min and max)
      if (stockFilter === "in_stock") return status === "warning";

      return true;
    })
    .sort((a, b) => {
      // Sort by stock percentage (lowest to highest) - most critical first
      const percentageA = (a.currentStock / a.maxStock) * 100;
      const percentageB = (b.currentStock / b.maxStock) * 100;
      return percentageA - percentageB;
    });

  // Export data
  const stockExportData = finalFilteredItems.map((item) => ({
    Name: item.name,
    Type: item.type === "material" ? "Material" : "Product",
    "Current Stock": item.currentStock,
    Unit: item.unit,
    "Min Stock": item.minStock,
    "Max Stock": item.maxStock,
  }));

  return (
    <div className="space-y-4">
      {/* Stock Table Card */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-foreground text-lg font-medium text-pretty">
            {t("tracking.stockLevels")}
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                type="text"
                placeholder={t("actions.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <ExportButton
              data={stockExportData}
              filename="stock-levels"
              variant="outline"
              size="sm"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <Select value={itemType} onValueChange={(v: any) => setItemType(v)}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder={t("tracking.filters.allItemsPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tracking.filters.allItems")}</SelectItem>
              <SelectItem value="material">{t("tracking.materialType")}</SelectItem>
              <SelectItem value="product">{t("tracking.productType")}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder={t("tracking.filters.allStatusPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tracking.filters.allStatus")}</SelectItem>
              <SelectItem value="out_of_stock">{t("tracking.filters.outOfStock")}</SelectItem>
              <SelectItem value="low_stock">{t("tracking.filters.lowStock")}</SelectItem>
              <SelectItem value="in_stock">{t("tracking.filters.inStock")}</SelectItem>
              <SelectItem value="overstocked">{t("tracking.filters.overstocked")}</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-muted-foreground ml-auto text-sm">
            {finalFilteredItems.length}{" "}
            {finalFilteredItems.length === 1 ? t("tracking.item") : t("tracking.items")}
          </span>
        </div>

        <div className="overflow-x-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="min-w-[640px]">
              <Table className="w-full text-sm">
              <TableHeader>
                <TableRow className="text-foreground/80">
                  <TableHead className="min-w-[150px] py-2 pr-3 text-left font-medium">
                    {t("tables.products")}
                  </TableHead>
                  <TableHead className="min-w-[100px] py-2 pr-3 text-left font-medium">
                    {t("tracking.type")}
                  </TableHead>
                  <TableHead className="min-w-[200px] w-1/2 py-2 pr-3 text-left font-medium">
                    {t("tracking.stockLevel")}
                  </TableHead>
                  <TableHead className="min-w-[120px] py-2 pr-3 text-right font-medium whitespace-nowrap">
                    {t("tables.currentUnits")}
                  </TableHead>
                  <TableHead className="min-w-[80px] py-2 pl-3 text-right font-medium">
                    {t("tables.status")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {finalFilteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                      {t("messages.noResults")}
                    </TableCell>
                  </TableRow>
                ) : (
                  finalFilteredItems.map((item) => {
                    const stockStatus = getStockStatus(
                      item.currentStock,
                      item.minStock,
                      item.maxStock
                    );
                    return (
                      <TableRow key={`${item.type}-${item.id}`} className="border-t">
                        <TableCell className="min-w-[150px] py-3 pr-3">{item.name}</TableCell>
                        <TableCell className="min-w-[100px] py-3 pr-3">
                          <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2 py-1 text-xs font-medium">
                            {item.type === "material"
                              ? t("tracking.materialType")
                              : t("tracking.productType")}
                          </span>
                        </TableCell>
                        <TableCell className="min-w-[200px] py-3 pr-3">
                          <Progress
                            value={stockStatus.percentage}
                            className={
                              stockStatus.color === "dark"
                                ? "bg-muted [&>div]:bg-foreground/80"
                                : stockStatus.color === "muted"
                                  ? "bg-muted [&>div]:bg-foreground/40"
                                  : "bg-muted [&>div]:bg-destructive"
                            }
                          />
                        </TableCell>
                        <TableCell className="min-w-[120px] py-3 pr-3 text-right whitespace-nowrap">
                          {item.currentStock.toFixed(2)} {item.unit}
                        </TableCell>
                        <TableCell className="min-w-[80px] py-3 pl-3 text-right">
                          {stockStatus.status === "ok" && (
                            <CheckCircle2 className="text-primary inline size-5" aria-label="OK" />
                          )}
                          {stockStatus.status === "warning" && (
                            <AlertCircle
                              className="text-foreground/70 inline size-5"
                              aria-label="Warning"
                            />
                          )}
                          {stockStatus.status === "critical" && (
                            <XCircle
                              className="text-destructive inline size-5"
                              aria-label="Critical"
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
