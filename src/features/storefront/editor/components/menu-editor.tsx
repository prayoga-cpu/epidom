"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { storefrontApi } from "@/lib/api";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  GripVertical,
  Settings2,
  Trash2,
  ArrowRight,
  Loader2,
  Link2,
  Unlink2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const UNCATEGORIZED_VALUE = "__uncategorized__";

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

interface SortableItemRowProps {
  item: any;
  t: (key: string) => string;
  formatPrice: (value: number | null | undefined) => string;
  onEdit: (item: any) => void;
  onDelete: (item: any) => void;
}

/** One draggable menu item row within a category's item list. */
function SortableItemRow({ item, t, formatPrice, onEdit, onDelete }: SortableItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border-border hover:border-border/80 group bg-background flex items-center justify-between rounded-lg border p-3 transition"
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={t("storefront.menu.dragToReorder")}
          className="text-muted-foreground/50 group-hover:text-muted-foreground -ml-2 flex size-10 shrink-0 touch-none cursor-grab items-center justify-center active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        <div className="bg-muted flex size-12 shrink-0 items-center justify-center overflow-hidden rounded">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-muted-foreground text-[10px] font-medium">
              {t("storefront.menu.imageAlt")}
            </span>
          )}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h5 className="text-foreground text-sm font-semibold">{item.name}</h5>
            {item.productId && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="border-blue-200 bg-blue-50 text-[10px] text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                  >
                    <Link2 className="mr-1 size-2.5" />
                    {t("storefront.menu.fromProductBadge")}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("storefront.menu.fromProductTooltip")}</p>
                </TooltipContent>
              </Tooltip>
            )}
            {/* The complement of the badge above. An unlinked menu item is a
                supported configuration (MenuItem.productId is optional on
                purpose — AGENTS.md §7 rule 4), but it means selling it moves
                no stock at all, which reads as "the POS isn't deducting"
                unless we say so. Informational, not an error. */}
            {!item.productId && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-muted-foreground text-[10px]">
                    <Unlink2 className="mr-1 size-2.5" />
                    {t("storefront.menu.noStockBadge")}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("storefront.menu.noStockTooltip")}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          {item.description && (
            <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
              {item.description}
            </p>
          )}
          <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
            <span className="text-foreground font-medium">{formatPrice(Number(item.price))}</span>
            {item.isAvailable ? (
              <span className="text-emerald-600">{t("storefront.menu.available")}</span>
            ) : (
              <span className="text-rose-500">{t("storefront.menu.unavailable")}</span>
            )}
            {item.department && (
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  item.department === "KITCHEN" ? "text-amber-600" : "text-blue-600"
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
          onClick={() => onEdit(item)}
        >
          <Settings2 className="mr-1 size-3" /> {t("storefront.menu.editItem")}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground h-8 w-8 hover:text-red-500"
          title={
            item.productId
              ? t("storefront.menu.removeFromMenuTooltip")
              : t("storefront.menu.deleteItem")
          }
          onClick={() => onDelete(item)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

interface SortableCategoryCardProps {
  category: any;
  t: (key: string) => string;
  formatPrice: (value: number | null | undefined) => string;
  onDeleteCategory: (category: any) => void;
  onAddItem: (categoryId: string) => void;
  onEditItem: (item: any) => void;
  onDeleteItem: (item: any) => void;
  onItemDragEnd: (categoryId: string, event: DragEndEvent) => void;
}

/** One draggable category card, containing its own nested drag-to-reorder item list. */
function SortableCategoryCard({
  category,
  t,
  formatPrice,
  onDeleteCategory,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onItemDragEnd,
}: SortableCategoryCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  // A single-category item list only ever needs to reorder within itself —
  // no cross-category drag — so each card gets its own independent sensors
  // + DndContext rather than sharing one across the whole page.
  const itemSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border-border bg-card overflow-hidden rounded-xl border shadow-sm"
    >
      <div className="bg-muted/60 border-border flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={t("storefront.menu.dragToReorder")}
            className="text-muted-foreground -ml-2 flex size-10 shrink-0 touch-none cursor-grab items-center justify-center active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
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
            onClick={() => onDeleteCategory(category)}
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
          <DndContext
            sensors={itemSensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => onItemDragEnd(category.id, event)}
          >
            <SortableContext
              items={(category.items ?? []).map((i: any) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {category.items?.map((item: any) => (
                  <SortableItemRow
                    key={item.id}
                    item={item}
                    t={t}
                    formatPrice={formatPrice}
                    onEdit={onEditItem}
                    onDelete={onDeleteItem}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <Button
          variant="outline"
          className="text-muted-foreground mt-2 w-full border-dashed"
          onClick={() => onAddItem(category.id)}
        >
          <Plus className="mr-2 size-4" />
          {t("storefront.menu.addItem")}
        </Button>
      </div>
    </div>
  );
}

export function MenuEditor({ storeId, storefrontId, categories, onSuccess }: MenuEditorProps) {
  const { t } = useI18n();
  const { confirm, confirmDialog } = useConfirm();
  // MenuItem.price is literal in the store's display currency, never IDR —
  // passing `currency` skips formatPrice's default base-currency conversion
  // (matches how it's entered/saved below, with no conversion either way).
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);
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
    // Keeps the Data > Products page's "in POS menu" icon in sync — editing
    // or deleting a product-linked item here changes that status too, and
    // this cache isn't covered by onSuccess()'s storefront refetch above.
    queryClient.invalidateQueries({ queryKey: ["storefront-items-linked", storeId] });
    queryClient.invalidateQueries({ queryKey: ["storefront-items-unlinked", storeId] });
  };

  // Local mirror of the `categories` prop that drag-and-drop reorders
  // optimistically before the PATCH calls resolve and refreshMenu() brings
  // back the authoritative order.
  const [orderedCategories, setOrderedCategories] = useState<any[]>(categories);
  useEffect(() => {
    setOrderedCategories(categories);
  }, [categories]);

  const categorySensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const persistCategoryOrder = async (reordered: any[]) => {
    const updates = reordered
      .map((cat, index) => ({ cat, index }))
      .filter(({ cat, index }) => cat.displayOrder !== index);
    if (updates.length === 0) return;
    try {
      await Promise.all(
        updates.map(({ cat, index }) =>
          storefrontApi.updateCategory(storeId, cat.id, { displayOrder: index })
        )
      );
      refreshMenu();
    } catch {
      toast.error(t("storefront.menu.reorderFailed"));
      setOrderedCategories(categories);
    }
  };

  const handleCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrderedCategories((prev) => {
      const oldIndex = prev.findIndex((c) => c.id === active.id);
      const newIndex = prev.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const reordered = arrayMove(prev, oldIndex, newIndex);
      persistCategoryOrder(reordered);
      return reordered;
    });
  };

  const persistItemOrder = async (reorderedItems: any[]) => {
    const updates = reorderedItems
      .map((item, index) => ({ item, index }))
      .filter(({ item, index }) => item.displayOrder !== index);
    if (updates.length === 0) return;
    try {
      await Promise.all(
        updates.map(({ item, index }) =>
          storefrontApi.updateItem(storeId, item.id, { displayOrder: index })
        )
      );
      refreshMenu();
    } catch {
      toast.error(t("storefront.menu.reorderFailed"));
      setOrderedCategories(categories);
    }
  };

  const handleItemDragEnd = (categoryId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrderedCategories((prev) =>
      prev.map((cat) => {
        if (cat.id !== categoryId) return cat;
        const items = cat.items ?? [];
        const oldIndex = items.findIndex((i: any) => i.id === active.id);
        const newIndex = items.findIndex((i: any) => i.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return cat;
        const reorderedItems = arrayMove(items, oldIndex, newIndex);
        persistItemOrder(reorderedItems);
        return { ...cat, items: reorderedItems };
      })
    );
  };

  const [newCatName, setNewCatName] = useState("");
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [pendingDeleteCategory, setPendingDeleteCategory] = useState<{
    id: string;
    name: string;
    itemCount: number;
    hasLinkedItems: boolean;
  } | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  // Add item dialog state
  const [addItemDialog, setAddItemDialog] = useState<{ open: boolean; categoryId: string } | null>(
    null
  );
  const [newItemName, setNewItemName] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemPrice, setNewItemPrice] = useState<number | undefined>(undefined);
  const [newItemDepartment, setNewItemDepartment] = useState<"KITCHEN" | "BAR">("KITCHEN");
  const [newItemImageUrl, setNewItemImageUrl] = useState<string | undefined>(undefined);
  const [newItemModifiers, setNewItemModifiers] = useState<ProductOptionGroupInput[]>([]);
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);

  // Edit item dialog state
  const [editItemDialog, setEditItemDialog] = useState<{ open: boolean; item: any } | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemDescription, setEditItemDescription] = useState("");
  const [editItemPrice, setEditItemPrice] = useState<number | undefined>(undefined);
  const [editItemDepartment, setEditItemDepartment] = useState<"KITCHEN" | "BAR">("KITCHEN");
  const [editItemImageUrl, setEditItemImageUrl] = useState<string | undefined>(undefined);
  const [editItemModifiers, setEditItemModifiers] = useState<ProductOptionGroupInput[]>([]);
  // The MenuCategory this item currently sits under — holds either an
  // existing category's id, UNCATEGORIZED_VALUE, or freeform text typed into
  // the creatable combobox (a name not matching any existing category id,
  // which handleUpdateItem treats as "create this category first"). Product-
  // linked items don't expose the Category field in the UI, but this still
  // gets initialized from the item's current category so re-submitting a
  // linked item's other fields never silently moves it to Uncategorized.
  const [editItemCategoryId, setEditItemCategoryId] = useState<string>(UNCATEGORIZED_VALUE);
  const [isSubmittingEditItem, setIsSubmittingEditItem] = useState(false);

  const categoryOptions = categories.map((c) => ({ value: c.id as string, label: c.name as string }));
  const isEditingLinkedItem = !!editItemDialog?.item?.productId;

  const redirectToProductEdit = (productId: string) => {
    setEditItemDialog(null);
    router.push(`/store/${storeId}/data?tab=products&editProduct=${productId}`);
  };

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
      hasLinkedItems: !!category.items?.some((i: any) => !!i.productId),
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
    setNewItemDepartment("KITCHEN");
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
    setEditItemDepartment(item.department ?? "KITCHEN");
    const currentCategory = categories.find((c) =>
      c.items?.some((i: any) => i.id === item.id)
    );
    setEditItemCategoryId(currentCategory?.id ?? UNCATEGORIZED_VALUE);
    setEditItemDialog({ open: true, item });
  };

  const handleUpdateItem = async () => {
    if (!editItemDialog || !editItemName || editItemPrice === undefined) return;
    setIsSubmittingEditItem(true);
    try {
      // A categoryId that isn't UNCATEGORIZED_VALUE and doesn't match any
      // existing category was typed fresh into the creatable combobox —
      // create that category first so items move there instead of forcing
      // a delete-and-recreate of the item to change its group. (Not reached
      // for product-linked items — their Category field isn't rendered, so
      // editItemCategoryId stays at its initialized value below.)
      let categoryId: string | null = null;
      if (editItemCategoryId !== UNCATEGORIZED_VALUE) {
        const existing = categories.find((c) => c.id === editItemCategoryId);
        if (existing) {
          categoryId = existing.id;
        } else {
          const created = await storefrontApi.createCategory(storeId, {
            name: editItemCategoryId,
            displayOrder: categories.length,
          });
          categoryId = created.id;
        }
      }

      await storefrontApi.updateItem(storeId, editItemDialog.item.id, {
        name: editItemName,
        description: editItemDescription || "",
        price: editItemPrice,
        department: editItemDepartment,
        imageUrl: editItemImageUrl || "",
        categoryId,
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
    const isLinked = !!item.productId;
    const ok = await confirm({
      title: isLinked
        ? t("storefront.menu.removeItemConfirm")
        : t("storefront.menu.itemDeleteConfirm"),
      description: isLinked ? t("storefront.menu.removeItemConfirmDesc") : item.name,
      variant: "destructive",
      confirmText: isLinked ? t("storefront.menu.removeFromMenuTooltip") : t("actions.delete"),
      cancelText: t("actions.cancel"),
    });
    if (!ok) return;
    try {
      await storefrontApi.deleteItem(storeId, item.id);
      refreshMenu();
      toast.success(
        isLinked ? t("storefront.menu.itemRemovedFromMenu") : t("storefront.menu.itemDeleted")
      );
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

          {orderedCategories.length === 0 ? (
            <div className="bg-muted/40 text-muted-foreground rounded-lg border border-dashed py-12 text-center">
              <p>{t("storefront.menu.noCategories")}</p>
              <p className="text-sm">{t("storefront.menu.noCategoriesDesc")}</p>
            </div>
          ) : (
            <DndContext
              sensors={categorySensors}
              collisionDetection={closestCenter}
              onDragEnd={handleCategoryDragEnd}
            >
              <SortableContext
                items={orderedCategories.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-6">
                  {orderedCategories.map((category) => (
                    <SortableCategoryCard
                      key={category.id}
                      category={category}
                      t={t}
                      formatPrice={formatPrice}
                      onDeleteCategory={handleDeleteCategoryClick}
                      onAddItem={openAddItemDialog}
                      onEditItem={openEditItemDialog}
                      onDeleteItem={handleDeleteItem}
                      onItemDragEnd={handleItemDragEnd}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
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
                value={newItemDepartment}
                onValueChange={(v) => setNewItemDepartment(v as "KITCHEN" | "BAR")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KITCHEN">{t("common.departmentKitchenDetailed")}</SelectItem>
                  <SelectItem value="BAR">{t("common.departmentBarDetailed")}</SelectItem>
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

            {isEditingLinkedItem && (
              <div className="space-y-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs dark:border-blue-800 dark:bg-blue-900/20">
                <p className="flex items-center gap-1.5 font-medium text-blue-700 dark:text-blue-400">
                  <Link2 className="size-3.5" />
                  {t("storefront.menu.fromProductTooltip")}
                </p>
                <p className="text-muted-foreground">{t("storefront.menu.inheritsProductOptions")}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => redirectToProductEdit(editItemDialog!.item.productId)}
                >
                  {t("storefront.menu.editInProducts")}
                  <ArrowRight className="ml-1 size-3" />
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {t("storefront.menu.itemName")}
              </label>
              <Input
                autoFocus={!isEditingLinkedItem}
                value={editItemName}
                onChange={(e) => setEditItemName(e.target.value)}
                disabled={isEditingLinkedItem}
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
                  disabled={isEditingLinkedItem}
                  className="hover:border-foreground/30 focus-visible:ring-foreground/20 pl-9 font-mono transition-all focus-visible:ring-1"
                  value={editItemPrice}
                  onChange={setEditItemPrice}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm leading-none font-medium">{t("common.department")}</label>
              <Select
                value={editItemDepartment}
                onValueChange={(v) => setEditItemDepartment(v as "KITCHEN" | "BAR")}
                disabled={isEditingLinkedItem}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KITCHEN">{t("common.departmentKitchenDetailed")}</SelectItem>
                  <SelectItem value="BAR">{t("common.departmentBarDetailed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category and Modifiers are only meaningful for manually-added
                items — a product-linked item's category/option groups live
                on the Product itself (Product.category, Product.optionGroups)
                and are edited there, not duplicated here. */}
            {!isEditingLinkedItem && (
              <>
                <div className="space-y-2">
                  <label className="text-sm leading-none font-medium">
                    {t("storefront.menu.categoryLabel")}
                  </label>
                  <p className="text-muted-foreground text-xs">
                    {t("storefront.menu.categoryMoveHint")}
                  </p>
                  <Combobox
                    creatable
                    options={[
                      { value: UNCATEGORIZED_VALUE, label: t("storefront.menu.uncategorized") },
                      ...categoryOptions,
                    ]}
                    value={editItemCategoryId}
                    onChange={setEditItemCategoryId}
                    placeholder={t("storefront.menu.categoryPlaceholder")}
                    searchPlaceholder={t("storefront.menu.categorySearchPlaceholder")}
                    createLabel={(v) => t("storefront.menu.createCategory").replace("{value}", v)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm leading-none font-medium">
                    {t("storefront.menu.modifiers")}
                  </label>
                  <p className="text-muted-foreground text-xs">
                    {t("storefront.menu.modifiersDesc")}
                  </p>
                  <OptionGroupsEditor
                    storeId={storeId}
                    value={editItemModifiers}
                    onChange={setEditItemModifiers}
                  />
                </div>
              </>
            )}
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
        deleteLabel={
          pendingDeleteCategory?.hasLinkedItems
            ? t("storefront.menu.deleteItemsLabelLinked")
            : t("storefront.menu.deleteItemsLabel")
        }
        deleteDescription={
          (pendingDeleteCategory?.hasLinkedItems
            ? t("storefront.menu.deleteItemsDescriptionLinked")
            : t("storefront.menu.deleteItemsDescription")
          )?.replace("{count}", String(pendingDeleteCategory?.itemCount ?? 0)) || ""
        }
        confirmText={t("actions.delete")}
        cancelText={t("actions.cancel")}
      />
      {confirmDialog}
    </div>
  );
}
