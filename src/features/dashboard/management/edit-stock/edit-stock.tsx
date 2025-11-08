"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { ExportButton } from "@/components/ui/export-button";
import { useToast } from "@/hooks/use-toast";
import { useMaterials } from "@/features/dashboard/data/materials/hooks/use-materials";
import {
  Search,
  Package,
  History,
  Upload,
  Edit3,
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { StockAdjustmentDialog } from "./stock-adjustment-dialog";
import { BulkAdjustmentDialog } from "./bulk-adjustment-dialog";
import { AdjustmentHistoryDialog } from "./adjustment-history-dialog";
import { useCurrency } from "@/components/providers/currency-provider";

type ItemType = "material" | "product";

interface StockItem {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unit: string;
  costPerUnit: number;
  type: ItemType;
}

export function EditStockCard() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const params = useParams();
  const storeId = params?.storeId as string;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<ItemType>("material");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [bulkAdjustmentOpen, setBulkAdjustmentOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);
  const [historyItemType, setHistoryItemType] = useState<ItemType>("material");

  // Fetch materials from API
  const { data: materialsData, isLoading } = useMaterials(storeId);

  // Combine materials and products into a unified list
  const allStockItems: StockItem[] = useMemo(() => {
    if (!materialsData?.materials) return [];

    const materials = materialsData.materials.map((m) => ({
      id: m.id,
      name: m.name,
      sku: m.sku || "",
      currentStock: Number(m.currentStock),
      minStock: Number(m.minStock),
      maxStock: Number(m.maxStock),
      unit: m.unit,
      costPerUnit: Number(m.unitCost),
      type: "material" as ItemType,
    }));

    // TODO: Add products when recipe/products API is available
    // const products = ...

    return materials;
  }, [materialsData]);

  // Filter items by search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return allStockItems;

    const query = searchQuery.toLowerCase();
    return allStockItems.filter(
      (item) => item.name.toLowerCase().includes(query) || item.sku.toLowerCase().includes(query)
    );
  }, [allStockItems, searchQuery]);

  // Get selected item details
  const selectedItem = useMemo(
    () => allStockItems.find((item) => item.id === selectedItemId),
    [allStockItems, selectedItemId]
  );

  // Get stock status
  const getStockStatus = (item: StockItem) => {
    if (item.currentStock <= item.minStock) {
      return {
        label: "Low Stock",
        variant: "outline" as const,
        icon: AlertCircle,
      };
    } else if (item.currentStock > item.maxStock) {
      return {
        label: "Overstock",
        variant: "outline" as const,
        icon: AlertCircle,
      };
    } else {
      return {
        label: "In Stock",
        variant: "outline" as const,
        icon: CheckCircle,
      };
    }
  };

  // Calculate stock percentage
  const getStockPercentage = (item: StockItem) => {
    if (item.maxStock === 0) return 0;
    return (item.currentStock / item.maxStock) * 100;
  };

  // Handle bulk selection
  const toggleItemSelection = (itemId: string) => {
    setSelectedItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map((item) => item.id));
    }
  };

  // Get selected items for bulk adjustment
  const selectedStockItems = useMemo(() => {
    return allStockItems
      .filter((item) => selectedItems.includes(item.id))
      .map((item) => ({
        id: item.id,
        name: item.name,
        currentStock: item.currentStock,
        unit: item.unit,
        type: item.type,
      }));
  }, [allStockItems, selectedItems]);

  // Handle CSV import (placeholder)
  const handleCSVImport = () => {
    toast({
      title: t("management.editStock.importCSV"),
      description: t("management.editStock.importCSVDescription"),
    });
    // TODO: Implement CSV import functionality
  };

  // Export data
  const exportData = filteredItems.map((item) => ({
    [t("common.sku")]: item.sku,
    [t("common.name")]: item.name,
    [t("common.type")]:
      item.type === "material"
        ? t("management.editStock.material")
        : t("management.editStock.product"),
    [t("management.editStock.currentStock")]: item.currentStock,
    [t("management.editStock.minStock")]: item.minStock,
    [t("management.editStock.maxStock")]: item.maxStock,
    [t("management.editStock.unit")]: item.unit,
    [t("common.cost")]: item.costPerUnit,
    [t("management.editStock.stockValue")]: item.currentStock * item.costPerUnit,
    [t("management.editStock.status")]: getStockStatus(item).label,
  }));

  // Handle viewing adjustment history
  const viewAdjustmentHistory = (itemId: string, itemType: ItemType) => {
    setHistoryItemId(itemId);
    setHistoryItemType(itemType);
    setHistoryDialogOpen(true);
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header with Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{t("management.editStock.title")}</h2>
            <p className="text-muted-foreground text-sm">{t("management.editStock.description")}</p>
          </div>

          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
            <Button variant="outline" size="sm" onClick={handleCSVImport} className="w-full md:w-auto">
              <Upload className="mr-2 h-4 w-4" />
              {t("management.editStock.importCSV")}
            </Button>
            <ExportButton data={exportData} filename="stock-inventory" size="sm" className="w-full md:w-auto" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_1fr] lg:items-stretch">
          {/* Items List */}
          <Card className="flex min-h-[450px] flex-col p-4 lg:min-h-[400px]">
            <div className="shrink-0">
              <Label htmlFor="search" className="sr-only">
                {t("management.editStock.searchItems")}
              </Label>
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  id="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("management.editStock.searchItems")}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col space-y-2">
              <div className="mb-2 flex shrink-0 items-center justify-between">
                <span className="text-muted-foreground text-sm">
                  {filteredItems.length} {t("management.editStock.items")}
                </span>
                {filteredItems.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleSelectAll}
                    className="h-auto p-0 text-xs"
                  >
                    {selectedItems.length === filteredItems.length
                      ? t("management.editStock.deselectAll")
                      : t("management.editStock.selectAll")}
                  </Button>
                )}
              </div>

              <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <p className="text-muted-foreground text-sm">
                      {searchQuery
                        ? t("management.editStock.noItemsFound")
                        : t("management.editStock.noStockItemsYet")}
                    </p>
                  </div>
                ) : (
                  filteredItems.map((item) => {
                    const status = getStockStatus(item);
                    const StatusIcon = status.icon;
                    const isSelected = selectedItems.includes(item.id);

                    return (
                      <div
                        key={item.id}
                        className={`group hover:border-primary/50 flex w-full items-center gap-3 rounded-lg border p-3 transition-colors ${
                          selectedItemId === item.id ? "border-primary bg-primary/5" : ""
                        } ${isSelected ? "bg-muted/50" : ""}`}
                      >
                        <button
                          onClick={() => {
                            setSelectedItemId(item.id);
                            setSelectedItemType(item.type);
                          }}
                          className="flex-1 text-left"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{item.name}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-muted-foreground text-xs">{item.sku}</p>
                                <Badge variant="outline" className="text-xs">
                                  {item.type === "material"
                                    ? t("management.editStock.material")
                                    : t("management.editStock.product")}
                                </Badge>
                              </div>
                            </div>
                            <StatusIcon className="h-4 w-4" />
                          </div>
                          <div className="mt-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">
                                {item.currentStock} / {item.maxStock} {item.unit}
                              </span>
                              <span className="text-muted-foreground">
                                {Math.round(getStockPercentage(item))}%
                              </span>
                            </div>
                            <div className="bg-muted mt-1 h-1.5 w-full overflow-hidden rounded-full">
                              <div
                                className="h-full bg-black transition-all"
                                style={{
                                  width: `${Math.min(getStockPercentage(item), 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </Card>

          {/* Item Details & Editor */}
          <Card className="flex min-h-[450px] flex-col p-6 lg:min-h-[400px]">
            {selectedItem ? (
              <div className="flex flex-1 flex-col space-y-6">
                {/* Item Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-4">
                    <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-lg">
                      <Package className="text-muted-foreground h-8 w-8" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">{selectedItem.name}</h3>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-muted-foreground text-sm">
                          {t("common.sku")}: {selectedItem.sku}
                        </p>
                        <Badge variant="outline">
                          {selectedItem.type === "material"
                            ? t("management.editStock.material")
                            : t("management.editStock.product")}
                        </Badge>
                        <Badge variant={getStockStatus(selectedItem).variant}>
                          {getStockStatus(selectedItem).label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Stock Information */}
                <div className="space-y-4">
                  <h4 className="font-semibold">{t("management.editStock.stockInfo")}</h4>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground text-sm">
                        {t("management.editStock.currentStock")}
                      </p>
                      <p className="text-2xl font-bold">
                        {selectedItem.currentStock} {selectedItem.unit}
                      </p>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground text-sm">
                        {t("management.editStock.stockValue")}
                      </p>
                      <p className="text-2xl font-bold">
                        {formatPrice(selectedItem.currentStock * selectedItem.costPerUnit)}
                      </p>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground text-sm">
                        {t("management.editStock.minStock")}
                      </p>
                      <p className="text-lg font-semibold">
                        {selectedItem.minStock} {selectedItem.unit}
                      </p>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="text-muted-foreground text-sm">
                        {t("management.editStock.maxStock")}
                      </p>
                      <p className="text-lg font-semibold">
                        {selectedItem.maxStock} {selectedItem.unit}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Quick Actions */}
                <div className="space-y-4">
                  <h4 className="font-semibold">{t("management.editStock.quickActions")}</h4>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <StockAdjustmentDialog
                      itemId={selectedItem.id}
                      itemType={selectedItem.type}
                      trigger={
                        <Button variant="outline" className="w-full">
                          <Edit3 className="mr-2 h-4 w-4" />
                          {t("management.editStock.adjustStock")}
                        </Button>
                      }
                    />

                    <Button
                      variant="outline"
                      onClick={() => viewAdjustmentHistory(selectedItem.id, selectedItem.type)}
                    >
                      <History className="mr-2 h-4 w-4" />
                      {t("management.editStock.viewHistory")}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <Package className="text-muted-foreground mx-auto h-16 w-16" />
                  <h3 className="mt-4 text-lg font-semibold">
                    {t("management.editStock.selectItem")}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-sm">
                    {t("management.editStock.selectItemDescription")}
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Adjustment History Dialog */}
      <AdjustmentHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        itemId={historyItemId}
        itemType={historyItemType}
      />
    </>
  );
}
