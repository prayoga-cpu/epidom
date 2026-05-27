"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { storefrontApi } from "@/lib/api";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, GripVertical, Settings2, Trash2, ArrowRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils/formatting";
import { useCurrency } from "@/components/providers/currency-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
  const { currency } = useCurrency();
  const router = useRouter();
  const [newCatName, setNewCatName] = useState("");
  const [isAddingCat, setIsAddingCat] = useState(false);

  // Add item dialog state
  const [addItemDialog, setAddItemDialog] = useState<{ open: boolean; categoryId: string } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [addingItemId, setAddingItemId] = useState<string | null>(null);

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setIsAddingCat(true);
    try {
      await storefrontApi.createCategory(storeId, { name: newCatName, displayOrder: 0 });
      setNewCatName("");
      onSuccess();
      toast.success(t("storefront.menu.categoryAdded"));
    } catch {
      toast.error(t("storefront.menu.categoryAddFailed"));
    } finally {
      setIsAddingCat(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm(t("storefront.menu.deleteConfirm"))) return;
    try {
      await storefrontApi.deleteCategory(storeId, categoryId);
      onSuccess();
      toast.success(t("storefront.menu.categoryDeleted"));
    } catch {
      toast.error(t("storefront.menu.categoryDeleteFailed"));
    }
  };

  const openAddItemDialog = async (categoryId: string) => {
    setAddItemDialog({ open: true, categoryId });
    setLoadingProducts(true);
    try {
      const res = await apiClient.get<{ products: Product[] }>(`/stores/${storeId}/products`);
      setProducts(res.products ?? []);
    } catch {
      toast.error("Failed to load products");
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleAddItemFromProduct = async (product: Product) => {
    if (!addItemDialog) return;
    setAddingItemId(product.id);
    try {
      await storefrontApi.createItem(storeId, {
        name: product.name,
        price: product.sellingPrice,
        categoryId: addItemDialog.categoryId,
        productId: product.id,
        isAvailable: true,
      } as any);
      onSuccess();
      toast.success(`"${product.name}" added to menu`);
      setAddItemDialog(null);
    } catch {
      toast.error("Failed to add item to menu");
    } finally {
      setAddingItemId(null);
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
          <div className="flex items-center gap-3 mb-6">
            <Input
              placeholder={t("storefront.menu.addCategoryPlaceholder")}
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              className="max-w-xs"
            />
            <Button onClick={handleAddCategory} disabled={isAddingCat || !newCatName.trim()}>
              <Plus className="size-4 mr-2" />
              {t("storefront.menu.addCategory")}
            </Button>
          </div>

          {categories.length === 0 ? (
            <div className="text-center py-12 bg-muted/40 rounded-lg border border-dashed text-muted-foreground">
              <p>{t("storefront.menu.noCategories")}</p>
              <p className="text-sm">{t("storefront.menu.noCategoriesDesc")}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {categories.map((category) => (
                <div key={category.id} className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
                  <div className="bg-muted/60 px-4 py-3 flex items-center justify-between border-b border-border">
                    <div className="flex items-center gap-3">
                      <GripVertical className="size-4 text-muted-foreground cursor-grab" />
                      <h4 className="font-bold text-foreground">{category.name}</h4>
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                        {category.items?.length || 0} {t("storefront.menu.itemsCount")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => handleDeleteCategory(category.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    {category.items?.length === 0 ? (
                      <div className="text-center py-6 text-sm text-muted-foreground">
                        {t("storefront.menu.noItemsInCategory")}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {category.items?.map((item: any) => (
                          <div key={item.id} className="flex items-center justify-between p-3 border border-border rounded-lg hover:border-border/80 transition group bg-background">
                            <div className="flex items-center gap-4">
                              <GripVertical className="size-4 text-muted-foreground/50 cursor-grab group-hover:text-muted-foreground" />
                              <div className="size-12 bg-muted rounded flex items-center justify-center shrink-0 overflow-hidden">
                                {item.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                                ) : (
                                  <span className="text-[10px] text-muted-foreground font-medium">{t("storefront.menu.imageAlt")}</span>
                                )}
                              </div>
                              <div>
                                <h5 className="font-semibold text-sm text-foreground">{item.name}</h5>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">{formatCurrency(Number(item.price), currency)}</span>
                                  {item.isAvailable ? (
                                    <span className="text-emerald-600">{t("storefront.menu.available")}</span>
                                  ) : (
                                    <span className="text-rose-500">{t("storefront.menu.unavailable")}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button variant="outline" size="sm" className="h-8 text-xs">
                              <Settings2 className="size-3 mr-1" /> {t("storefront.menu.editItem")}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    <Button
                      variant="outline"
                      className="w-full mt-2 border-dashed text-muted-foreground"
                      onClick={() => openAddItemDialog(category.id)}
                    >
                      <Plus className="size-4 mr-2" />
                      {t("storefront.menu.addItem")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Item Dialog — select from Products */}
      <Dialog open={!!addItemDialog?.open} onOpenChange={(open) => !open && setAddItemDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Menu Item</DialogTitle>
            <DialogDescription>
              Select a product from your stock to add to this category.
            </DialogDescription>
          </DialogHeader>

          {loadingProducts ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground">
                No products found. Create your products in{" "}
                <strong>Data &gt; Products</strong> first, then come back to add them to your menu.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setAddItemDialog(null);
                  router.push(`/store/${storeId}/data`);
                }}
              >
                Go to Data
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {products.map((product) => (
                <button
                  key={product.id}
                  className="w-full flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/50 transition text-left disabled:opacity-50"
                  disabled={addingItemId === product.id}
                  onClick={() => handleAddItemFromProduct(product)}
                >
                  <div>
                    <p className="text-sm font-semibold">{product.name}</p>
                    {product.category && (
                      <p className="text-xs text-muted-foreground">{product.category}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-primary">
                      {formatCurrency(Number(product.sellingPrice), currency)}
                    </span>
                    {addingItemId === product.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
