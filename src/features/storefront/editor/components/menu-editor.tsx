"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { storefrontApi } from "@/lib/api";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, GripVertical, Settings2, Trash2, ArrowRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DecimalInput } from "@/components/shared/decimal-input";
import { ImageUpload } from "@/components/shared/image-upload";
import { getCurrencySymbol } from "@/lib/utils/formatting";
import { useCurrency } from "@/components/providers/currency-provider";
import { useConfirm } from "@/components/ui/use-confirm";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { CategoryDeleteDialog, type CategoryDeleteMode } from "@/components/ui/category-delete-dialog";
import { OptionGroupsEditor } from "@/components/shared/option-groups-editor";
import {
  modifiersJsonToOptionGroups,
  optionGroupsToModifiersJson,
} from "@/lib/utils/menu-item-options";
import type { ProductOptionGroupInput } from "@/lib/validation/inventory.schemas";

interface Product {
  id: string;
  name: string;
  sellingPrice: number;
  category?: string | null;
}

interface MenuEditorProps {
  storeId: string;
  storefrontId: string;
  categories: any[];
  onSuccess: () => void;
}

export function MenuEditor({ storeId, storefrontId, categories, onSuccess }: MenuEditorProps) {
  const { t } = useI18n();
  const { confirm, confirmDialog } = useConfirm();
  const { currency, formatPrice } = useCurrency();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Categories/items edited here (name, price, availability, modifiers) are
  // what POS Cashier reads via usePosMenu — invalidate that cache on every
  // successful mutation so a cashier on another tab/device sees the change
  // on their next poll instead of only after usePosMenu's 5s interval fires
  // on its own, or worse, only after a manual page refresh.
  const refreshMenu = () => {
    onSuccess();
    queryClient.invalidateQueries({ queryKey: ["pos", "menu", storeId], exact: false });
  };

  const [newCatName, setNewCatName] = useState("");
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [pendingDeleteCategory, setPendingDeleteCategory] = useState<{
    id: string;
    name: string;
    itemCount: number;
  } | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  // Add item dialog state
  const [addItemDialog, setAddItemDialog] = useState<{ open: boolean; categoryId: string } | null>(
    null
  );
  const [newItemName, setNewItemName] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemPrice, setNewItemPrice] = useState<number | undefined>(undefined);
  const [newItemDepartment, setNewItemDepartment] = useState<"KITCHEN" | "BAR" | undefined>(
    undefined
  );
  const [newItemImageUrl, setNewItemImageUrl] = useState<string | undefined>(undefined);
  const [newItemModifiers, setNewItemModifiers] = useState<ProductOptionGroupInput[]>([]);
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);

  // Edit item dialog state
  const [editItemDialog, setEditItemDialog] = useState<{ open: boolean; item: any } | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemDescription, setEditItemDescription] = useState("");
  const [editItemPrice, setEditItemPrice] = useState<number | undefined>(undefined);
  const [editItemDepartment, setEditItemDepartment] = useState<"KITCHEN" | "BAR" | undefined>(
    undefined
  );
  const [editItemImageUrl, setEditItemImageUrl] = useState<string | undefined>(undefined);
  const [editItemModifiers, setEditItemModifiers] = useState<ProductOptionGroupInput[]>([]);
  const [isSubmittingEditItem, setIsSubmittingEditItem] = useState(false);

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setIsAddingCat(true);
    try {
      await storefrontApi.createCategory(storeId, { name: newCatName, displayOrder: 0 });
      setNewCatName("");
      refreshMenu();
      toast.success(t("storefront.menu.categoryAdded"));
    } catch {
      toast.error(t("storefront.menu.categoryAddFailed"));
    } finally {
      setIsAddingCat(false);
    }
  };

  const handleDeleteCategoryClick = (category: { id: string; name: string; items?: any[] }) => {
    setPendingDeleteCategory({
      id: category.id,
      name: category.name,
      itemCount: category.items?.length || 0,
    });
  };

  const handleConfirmDeleteCategory = async (mode: CategoryDeleteMode) => {
    if (!pendingDeleteCategory) return;
    setIsDeletingCategory(true);
    try {
      await storefrontApi.deleteCategory(storeId, pendingDeleteCategory.id, mode);
      refreshMenu();
      toast.success(t("storefront.menu.categoryDeleted"));
      setPendingDeleteCategory(null);
    } catch {
      toast.error(t("storefront.menu.categoryDeleteFailed"));
    } finally {
      setIsDeletingCategory(false);
    }
  };

  const openAddItemDialog = (categoryId: string) => {
    setNewItemName("");
    setNewItemDescription("");
    setNewItemPrice(undefined);
    setNewItemImageUrl(undefined);
    setNewItemModifiers([]);
    setNewItemDepartment(undefined);
    setAddItemDialog({ open: true, categoryId });
  };

  const handleCreateManualItem = async () => {
    if (!addItemDialog || !newItemName || newItemPrice === undefined) return;
    setIsSubmittingItem(true);
    try {
      await storefrontApi.createItem(storeId, {
        name: newItemName,
        description: newItemDescription || undefined,
        price: newItemPrice,
        categoryId: addItemDialog.categoryId,
        department: newItemDepartment,
        imageUrl: newItemImageUrl || "",
        isAvailable: true,
        modifiers: optionGroupsToModifiersJson(newItemModifiers),
      } as any);
      refreshMenu();
      toast.success(`"${newItemName}" added to menu`);
      setAddItemDialog(null);
    } catch {
      toast.error(t("storefront.menu.itemAddFailed") || "Failed to add item");
    } finally {
      setIsSubmittingItem(false);
    }
  };

  const openEditItemDialog = (item: any) => {
    setEditItemName(item.name);
    setEditItemDescription(item.description || "");
    setEditItemPrice(Number(item.price));
    setEditItemImageUrl(item.imageUrl || undefined);
    setEditItemModifiers(modifiersJsonToOptionGroups(item.modifiers));
    setEditItemDepartment(item.department ?? undefined);
    setEditItemDialog({ open: true, item });
  };

  const handleUpdateItem = async () => {
    if (!editItemDialog || !editItemName || editItemPrice === undefined) return;
    setIsSubmittingEditItem(true);
    try {
      await storefrontApi.updateItem(storeId, editItemDialog.item.id, {
        name: editItemName,
        description: editItemDescription || "",
        price: editItemPrice,
        department: editItemDepartment ?? null,
        imageUrl: editItemImageUrl || "",
        modifiers: optionGroupsToModifiersJson(editItemModifiers),
      });
      refreshMenu();
      toast.success(t("storefront.menu.itemUpdated"));
      setEditItemDialog(null);
    } catch {
      toast.error(t("storefront.menu.itemUpdateFailed"));
    } finally {
      setIsSubmittingEditItem(false);
    }
  };

  const handleDeleteItem = async (item: any) => {
    const ok = await confirm({
      title: t("storefront.menu.itemDeleteConfirm"),
      description: item.name,
      variant: "destructive",
      confirmText: t("actions.delete"),
      cancelText: t("actions.cancel"),
    });
    if (!ok) return;
    try {
      await storefrontApi.deleteItem(storeId, item.id);
      refreshMenu();
      toast.success(t("storefront.menu.itemDeleted"));
    } catch {
      toast.error(t("storefront.menu.itemDeleteFailed"));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>{t("storefront.menu.title")}</CardTitle>
            <CardDescription>{t("storefront.menu.desc")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="mb-6 flex items-center gap-3">
            <Input
              placeholder={t("storefront.menu.addCategoryPlaceholder")}
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="max-w-xs"
            />
            <Button onClick={handleAddCategory} disabled={isAddingCat || !newCatName.trim()}>
              <Plus className="mr-2 size-4" />
              {t("storefront.menu.addCategory")}
            </Button>
          </div>

          {categories.length === 0 ? (
            <div className="bg-muted/40 text-muted-foreground rounded-lg border border-dashed py-12 text-center">
              <p>{t("storefront.menu.noCategories")}</p>
              <p className="text-sm">{t("storefront.menu.noCategoriesDesc")}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="border-border bg-card overflow-hidden rounded-xl border shadow-sm"
                >
                  <div className="bg-muted/60 border-border flex items-center justify-between border-b px-4 py-3">
                    <div className="flex items-center gap-3">
                      <GripVertical className="text-muted-foreground size-4 cursor-grab" />
                      <h4 className="text-foreground font-bold">{category.name}</h4>
                      <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                        {category.items?.length || 0} {t("storefront.menu.itemsCount")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground h-8 w-8 hover:text-red-500"
                        onClick={() => handleDeleteCategoryClick(category)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    {category.items?.length === 0 ? (
                      <div className="text-muted-foreground py-6 text-center text-sm">
                        {t("storefront.menu.noItemsInCategory")}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {category.items?.map((item: any) => (
                          <div
                            key={item.id}
                            className="border-border hover:border-border/80 group bg-background flex items-center justify-between rounded-lg border p-3 transition"
                          >
                            <div className="flex items-center gap-4">
                              <GripVertical className="text-muted-foreground/50 group-hover:text-muted-foreground size-4 cursor-grab" />
                              <div className="bg-muted flex size-12 shrink-0 items-center justify-center overflow-hidden rounded">
                                {item.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span className="text-muted-foreground text-[10px] font-medium">
                                    {t("storefront.menu.imageAlt")}
                                  </span>
                                )}
                              </div>
                              <div>
                                <h5 className="text-foreground text-sm font-semibold">
                                  {item.name}
                                </h5>
                                {item.description && (
                                  <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                                    {item.description}
                                  </p>
                                )}
                                <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                                  <span className="text-foreground font-medium">
                                    {formatPrice(Number(item.price))}
                                  </span>
                                  {item.isAvailable ? (
                                    <span className="text-emerald-600">
                                      {t("storefront.menu.available")}
                                    </span>
                                  ) : (
                                    <span className="text-rose-500">
                                      {t("storefront.menu.unavailable")}
                                    </span>
                                  )}
                                  {item.department && (
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] ${
                                        item.department === "KITCHEN"
                                          ? "text-amber-600"
                                          : "text-blue-600"
                                      }`}
                                    >
                                      {item.department === "KITCHEN"
                                        ? t("common.departmentKitchen")
                                        : t("common.departmentBar")}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => openEditItemDialog(item)}
                              >
                                <Settings2 className="mr-1 size-3" />{" "}
                                {t("storefront.menu.editItem")}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground h-8 w-8 hover:text-red-500"
                                title={t("storefront.menu.deleteItem")}
                                onClick={() => handleDeleteItem(item)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <Button
                      variant="outline"
                      className="text-muted-foreground mt-2 w-full border-dashed"
                      onClick={() => openAddItemDialog(category.id)}
                    >
                      <Plus className="mr-2 size-4" />
                      {t("storefront.menu.addItem")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Item Dialog — Consistent Form Input */}
      <Dialog open={!!addItemDialog?.open} onOpenChange={(open) => !open && setAddItemDialog(null)}>
        <FormDialogLayout
          title={t("storefront.menu.addItem") || "Add New Item"}
          description={
            t("storefront.menu.addItemDesc") ||
            "Fill in the details below to add a new item to your menu."
          }
          footer={
            <>
              <Button
                variant="outline"
                onClick={() => setAddItemDialog(null)}
                className="transition-transform active:scale-[0.98]"
              >
                Cancel
              </Button>
              <Button
                disabled={!newItemName.trim() || newItemPrice === undefined || isSubmittingItem}
                onClick={handleCreateManualItem}
                className="transition-transform active:scale-[0.98]"
              >
                {isSubmittingItem ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                {t("storefront.menu.saveItem") || "Add Item"}
              </Button>
            </>
          }
        >
          <div className="grid gap-5 py-4">
            <div className="space-y-2">
              <label className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {t("storefront.menu.itemImage")}
              </label>
              <ImageUpload
                value={newItemImageUrl}
                onChange={setNewItemImageUrl}
                disabled={isSubmittingItem}
                aspectRatio="1/1"
                maxSize={2}
                compact
                className="mx-auto w-[160px]"
              />
              <p className="text-muted-foreground text-xs">{t("storefront.menu.imageGuide")}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {t("storefront.menu.itemName") || "Item Name"}
              </label>
              <Input
                autoFocus
                placeholder={t("storefront.menu.itemNamePlaceholder") || "e.g. Nasi Goreng Spesial"}
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="hover:border-foreground/30 focus-visible:ring-foreground/20 transition-all focus-visible:ring-1"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Description (optional)
              </label>
              <Input
                placeholder="e.g. orange, jasmine, espresso"
                value={newItemDescription}
                onChange={(e) => setNewItemDescription(e.target.value)}
                className="hover:border-foreground/30 focus-visible:ring-foreground/20 transition-all focus-visible:ring-1"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {t("storefront.menu.itemPrice") || "Selling Price"}
              </label>
              <div className="relative">
                <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm font-medium">
                  {getCurrencySymbol(currency)}
                </span>
                <DecimalInput
                  decimals={2}
                  min={0}
                  className="hover:border-foreground/30 focus-visible:ring-foreground/20 pl-9 font-mono transition-all focus-visible:ring-1"
                  placeholder="25000"
                  value={newItemPrice}
                  onChange={setNewItemPrice}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm leading-none font-medium">{t("common.department")}</label>
              <Select
                value={newItemDepartment ?? "none"}
                onValueChange={(v) =>
                  setNewItemDepartment(v === "none" ? undefined : (v as "KITCHEN" | "BAR"))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="KITCHEN">{t("common.departmentKitchen")}</SelectItem>
                  <SelectItem value="BAR">{t("common.departmentBar")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm leading-none font-medium">
                {t("storefront.menu.modifiers")}
              </label>
              <p className="text-muted-foreground text-xs">{t("storefront.menu.modifiersDesc")}</p>
              <OptionGroupsEditor
                storeId={storeId}
                value={newItemModifiers}
                onChange={setNewItemModifiers}
              />
            </div>
          </div>
        </FormDialogLayout>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog
        open={!!editItemDialog?.open}
        onOpenChange={(open) => !open && setEditItemDialog(null)}
      >
        <FormDialogLayout
          title={t("storefront.menu.editItem")}
          description={t("storefront.menu.editItemDesc")}
          footer={
            <>
              <Button
                variant="outline"
                onClick={() => setEditItemDialog(null)}
                className="transition-transform active:scale-[0.98]"
              >
                {t("actions.cancel")}
              </Button>
              <Button
                disabled={
                  !editItemName.trim() || editItemPrice === undefined || isSubmittingEditItem
                }
                onClick={handleUpdateItem}
                className="transition-transform active:scale-[0.98]"
              >
                {isSubmittingEditItem ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Settings2 className="mr-2 h-4 w-4" />
                )}
                {t("storefront.menu.updateItem")}
              </Button>
            </>
          }
        >
          <div className="grid gap-5 py-4">
            <div className="space-y-2">
              <label className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {t("storefront.menu.itemImage")}
              </label>
              <ImageUpload
                value={editItemImageUrl}
                onChange={setEditItemImageUrl}
                disabled={isSubmittingEditItem}
                aspectRatio="1/1"
                maxSize={2}
                compact
                className="mx-auto w-[160px]"
              />
              <p className="text-muted-foreground text-xs">{t("storefront.menu.imageGuide")}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {t("storefront.menu.itemName")}
              </label>
              <Input
                autoFocus
                value={editItemName}
                onChange={(e) => setEditItemName(e.target.value)}
                className="hover:border-foreground/30 focus-visible:ring-foreground/20 transition-all focus-visible:ring-1"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Description (optional)
              </label>
              <Input
                placeholder="e.g. orange, jasmine, espresso"
                value={editItemDescription}
                onChange={(e) => setEditItemDescription(e.target.value)}
                className="hover:border-foreground/30 focus-visible:ring-foreground/20 transition-all focus-visible:ring-1"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {t("storefront.menu.itemPrice")}
              </label>
              <div className="relative">
                <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm font-medium">
                  {getCurrencySymbol(currency)}
                </span>
                <DecimalInput
                  decimals={2}
                  min={0}
                  className="hover:border-foreground/30 focus-visible:ring-foreground/20 pl-9 font-mono transition-all focus-visible:ring-1"
                  value={editItemPrice}
                  onChange={setEditItemPrice}
                />
              </div>
            </div>

            {editItemDialog?.item?.productId && (
              <p className="bg-muted/50 text-muted-foreground rounded-md border p-2 text-xs">
                {t("storefront.menu.inheritsProductOptions")}
              </p>
            )}

            <div className="space-y-2">
              <label className="text-sm leading-none font-medium">{t("common.department")}</label>
              <Select
                value={editItemDepartment ?? "none"}
                onValueChange={(v) =>
                  setEditItemDepartment(v === "none" ? undefined : (v as "KITCHEN" | "BAR"))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="KITCHEN">{t("common.departmentKitchen")}</SelectItem>
                  <SelectItem value="BAR">{t("common.departmentBar")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm leading-none font-medium">
                {t("storefront.menu.modifiers")}
              </label>
              <p className="text-muted-foreground text-xs">{t("storefront.menu.modifiersDesc")}</p>
              <OptionGroupsEditor
                storeId={storeId}
                value={editItemModifiers}
                onChange={setEditItemModifiers}
              />
            </div>
          </div>
        </FormDialogLayout>
      </Dialog>

      {/* Delete Category Dialog */}
      <CategoryDeleteDialog
        // Remount per category so the destructive "delete" choice never carries
        // over as the default when the user moves on to a different category.
        key={pendingDeleteCategory?.id}
        open={pendingDeleteCategory !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteCategory(null);
        }}
        title={
          t("storefront.menu.deleteConfirm")?.replace(
            "{category}",
            pendingDeleteCategory?.name ?? ""
          ) || t("storefront.menu.deleteConfirm")
        }
        onConfirm={handleConfirmDeleteCategory}
        isSubmitting={isDeletingCategory}
        uncategorizeLabel={t("storefront.menu.deleteMoveLabel")}
        uncategorizeDescription={
          t("storefront.menu.deleteMoveDescription")?.replace(
            "{count}",
            String(pendingDeleteCategory?.itemCount ?? 0)
          ) || ""
        }
        deleteLabel={t("storefront.menu.deleteItemsLabel")}
        deleteDescription={
          t("storefront.menu.deleteItemsDescription")?.replace(
            "{count}",
            String(pendingDeleteCategory?.itemCount ?? 0)
          ) || ""
        }
        confirmText={t("actions.delete")}
        cancelText={t("actions.cancel")}
      />
      {confirmDialog}
    </div>
  );
}
