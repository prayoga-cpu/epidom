"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Check, Lock, Pencil, Plus, Power, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { getCurrencySymbol } from "@/lib/utils/formatting";
import { generateSku } from "@/lib/utils/sku-generator";
import { useSubscriptionStatus } from "@/features/stores/stores/hooks/use-subscription-status";
import { useUpgradeGate } from "@/features/billing/upgrade/upgrade-modal";
import { planHasFeature, type PlanTier } from "@/lib/plans/entitlements";
import { BaseItemCard, ItemCardGrid } from "../../components/base-item-card";
import {
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  type Product,
} from "../../products/hooks/use-products";
import { useCustomProducts } from "../hooks/use-custom-products";
import {
  useCustomProductsSettings,
  useUpdateCustomProductsSettings,
} from "../hooks/use-custom-products-settings";

interface CustomProductsSectionProps {
  storeId: string;
}

interface ItemFormState {
  name: string;
  category: string;
  costPrice: string;
  sellingPrice: string;
  // false = a service or otherwise unlimited offering (a haircut never runs
  // out); true = a real countable good whose stock is deducted per order.
  // See Product.trackStock.
  trackStock: boolean;
  stockQty: string;
}

const EMPTY_FORM: ItemFormState = {
  name: "",
  category: "",
  costPrice: "",
  sellingPrice: "",
  // Services are the common case for this product line, so default to
  // untracked — the owner opts into counting stock, not out of it.
  trackStock: false,
  stockQty: "0",
};

export function CustomProductsSection({ storeId }: CustomProductsSectionProps) {
  const { t } = useI18n();
  const { data: subData } = useSubscriptionStatus();
  const { openUpgrade } = useUpgradeGate();
  const currentPlan = (subData?.subscription?.plan as PlanTier) ?? "FREE";
  const hasAccess = planHasFeature(currentPlan, "customProducts");

  const { data: settings, isLoading: isLoadingSettings } = useCustomProductsSettings(storeId);
  const updateSettings = useUpdateCustomProductsSettings(storeId);

  const enabled = settings?.customProductsEnabled ?? false;
  const label = settings?.customProductsLabel ?? "";
  const [labelDraft, setLabelDraft] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Pre-fill the (editable) name field from whatever was last saved — even
  // while disabled, so turning the feature off never reads as "the name is
  // gone," just paused. Skipped while actively renaming so an in-flight
  // background refetch can't clobber what the owner is mid-typing.
  useEffect(() => {
    if (!renaming) setLabelDraft(settings?.customProductsLabel ?? "");
  }, [settings?.customProductsLabel, renaming]);

  const handleEnable = async () => {
    if (!labelDraft.trim()) return;
    try {
      await updateSettings.mutateAsync({
        customProductsEnabled: true,
        customProductsLabel: labelDraft.trim(),
      });
      toast.success(t("data.customProducts.enabledToast"));
    } catch {
      toast.error(t("data.customProducts.settingsUpdateFailed"));
    }
  };

  const handleDisable = async () => {
    try {
      await updateSettings.mutateAsync({ customProductsEnabled: false });
      toast.success(t("data.customProducts.disabledToast"));
    } catch {
      toast.error(t("data.customProducts.settingsUpdateFailed"));
    }
  };

  const handleSaveLabel = async () => {
    if (!labelDraft.trim()) return;
    try {
      await updateSettings.mutateAsync({ customProductsLabel: labelDraft.trim() });
      toast.success(t("data.customProducts.renameSaved"));
      setRenaming(false);
    } catch {
      toast.error(t("data.customProducts.renameFailed"));
    }
  };

  if (isLoadingSettings) {
    return (
      <Card className="min-h-[calc(100vh-150px)]">
        <CardHeader className="border-b">
          <Skeleton className="h-7 w-48" />
        </CardHeader>
        <CardContent className="pt-6">
          <Skeleton className="h-40 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (!enabled) {
    return (
      <Card className="min-h-[calc(100vh-150px)]">
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="bg-muted rounded-full p-4">
            <Sparkles className="text-muted-foreground h-8 w-8" />
          </div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            {t("data.customProducts.explainerTitle")}
            {!hasAccess && (
              <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 align-middle text-[10px] font-semibold tracking-wide uppercase">
                <Lock className="h-2.5 w-2.5" /> Operations
              </span>
            )}
          </h2>
          <p className="text-muted-foreground max-w-md text-sm">
            {t("data.customProducts.explainerDescription")}
          </p>
          {hasAccess ? (
            <div className="w-full max-w-xs space-y-2">
              <Input
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                placeholder={t("data.customProducts.labelPlaceholder")}
              />
              <Button
                onClick={handleEnable}
                disabled={!labelDraft.trim() || updateSettings.isPending}
                className="w-full"
              >
                {updateSettings.isPending
                  ? t("data.customProducts.enabling")
                  : t("data.customProducts.enableButton")}
              </Button>
            </div>
          ) : (
            <Button
              onClick={() =>
                openUpgrade("OPERATIONS", "Custom Products is an Operations plan feature.")
              }
            >
              Upgrade to Operations
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <CustomProductsEnabled
      storeId={storeId}
      label={label}
      renaming={renaming}
      labelDraft={labelDraft}
      onStartRename={() => {
        setLabelDraft(label);
        setRenaming(true);
      }}
      onCancelRename={() => setRenaming(false)}
      onLabelDraftChange={setLabelDraft}
      onSaveLabel={handleSaveLabel}
      onDisable={handleDisable}
      savingSettings={updateSettings.isPending}
    />
  );
}

interface CustomProductsEnabledProps {
  storeId: string;
  label: string;
  renaming: boolean;
  labelDraft: string;
  onStartRename: () => void;
  onCancelRename: () => void;
  onLabelDraftChange: (value: string) => void;
  onSaveLabel: () => void;
  onDisable: () => void;
  savingSettings: boolean;
}

function CustomProductsEnabled({
  storeId,
  label,
  renaming,
  labelDraft,
  onStartRename,
  onCancelRename,
  onLabelDraftChange,
  onSaveLabel,
  onDisable,
  savingSettings,
}: CustomProductsEnabledProps) {
  const { t } = useI18n();
  const { formatPrice, convertToBase, convertPrice, currency } = useCurrency();
  const { data, isLoading } = useCustomProducts(storeId);
  const createProduct = useCreateProduct(storeId);
  const deleteProduct = useDeleteProduct(storeId);

  const [addOpen, setAddOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const products = data?.products ?? [];

  const handleDelete = async () => {
    if (!deletingProduct) return;
    setDeleting(true);
    try {
      await deleteProduct.mutateAsync(deletingProduct.id);
      toast.success(t("data.customProducts.toasts.deleted"));
      setDeletingProduct(null);
    } catch {
      toast.error(t("data.customProducts.toasts.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="min-h-[calc(100vh-150px)] overflow-hidden shadow-md">
      <CardHeader className="border-b">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {renaming ? (
            <div className="flex items-center gap-2">
              <Input
                value={labelDraft}
                onChange={(e) => onLabelDraftChange(e.target.value)}
                className="h-9 w-56"
                autoFocus
              />
              <Button size="icon" variant="ghost" className="h-9 w-9" onClick={onSaveLabel}>
                <Check className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-9 w-9" onClick={onCancelRename}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">{label}</CardTitle>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onStartRename}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button onClick={() => setAddOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              {t("data.customProducts.addButton")}
            </Button>
            <div className="flex items-center gap-2">
              <Power className="text-muted-foreground h-4 w-4" />
              <Switch checked={true} onCheckedChange={onDisable} disabled={savingSettings} />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {isLoading ? (
          <ItemCardGrid columns={{ mobile: 1, tablet: 2, desktop: 3, large: 4 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </ItemCardGrid>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="font-medium">{t("data.customProducts.emptyTitle")}</p>
            <p className="text-muted-foreground text-sm">
              {t("data.customProducts.emptyDescription")}
            </p>
          </div>
        ) : (
          <ItemCardGrid columns={{ mobile: 1, tablet: 2, desktop: 3, large: 4 }}>
            {products.map((product) => {
              const selling = Number(product.sellingPrice) || 0;
              const cost = Number(product.costPrice) || 0;
              const profit = selling > 0 ? ((selling - cost) / selling) * 100 : 0;
              return (
                <BaseItemCard key={product.id}>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{product.name}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {t("common.sku")}: {product.sku}
                      </p>
                    </div>
                    {product.category && (
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {product.category}
                      </Badge>
                    )}
                  </div>
                  <div className="bg-border my-2 h-px" />
                  <div className="my-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("common.price")}</span>
                      <span>{formatPrice(selling)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("common.cost")}</span>
                      <span>{formatPrice(cost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("common.profit")}</span>
                      <span
                        className={
                          profit >= 50
                            ? "text-emerald-600"
                            : profit >= 30
                              ? "text-amber-600"
                              : "text-red-600"
                        }
                      >
                        {profit.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("common.stock")}</span>
                      <span>
                        {product.trackStock
                          ? Number(product.currentStock) || 0
                          : t("data.customProducts.unlimited")}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setEditingProduct(product)}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      {t("common.actions.edit")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive w-full"
                      onClick={() => setDeletingProduct(product)}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      {t("common.actions.delete")}
                    </Button>
                  </div>
                </BaseItemCard>
              );
            })}
          </ItemCardGrid>
        )}
      </CardContent>

      <CustomProductFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title={t("data.customProducts.addDialogTitle")}
        currency={currency}
        onSubmit={async (form) => {
          const costPrice = convertToBase(Number(form.costPrice));
          const sellingPrice = convertToBase(Number(form.sellingPrice));
          const promise = createProduct.mutateAsync({
            storeId,
            sku: generateSku(form.name, form.category || undefined),
            name: form.name,
            category: form.category || undefined,
            department: "KITCHEN",
            productLine: "CUSTOM",
            costPrice,
            sellingPrice,
            trackStock: form.trackStock,
            currentStock: form.trackStock ? Number(form.stockQty) || 0 : 0,
            unit: "piece",
            minStock: 0,
            maxStock: 1000,
          });
          toast.promise(promise, {
            loading: t("data.customProducts.toasts.adding"),
            success: t("data.customProducts.toasts.added"),
            error: t("data.customProducts.toasts.addFailed"),
          });
          await promise;
          setAddOpen(false);
        }}
      />

      {editingProduct && (
        <CustomProductEditDialog
          storeId={storeId}
          product={editingProduct}
          currency={currency}
          convertPrice={convertPrice}
          convertToBase={convertToBase}
          onOpenChange={(open) => !open && setEditingProduct(null)}
        />
      )}

      <ConfirmationDialog
        open={!!deletingProduct}
        onOpenChange={(open) => !open && setDeletingProduct(null)}
        title={t("data.customProducts.deleteConfirmTitle")}
        description={t("data.customProducts.deleteConfirmDescription")}
        confirmText={t("common.actions.delete")}
        cancelText={t("common.actions.cancel")}
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </Card>
  );
}

interface CustomProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  currency: string;
  initial?: ItemFormState;
  onSubmit: (form: ItemFormState) => Promise<void>;
}

function CustomProductFormDialog({
  open,
  onOpenChange,
  title,
  currency,
  initial,
  onSubmit,
}: CustomProductFormDialogProps) {
  const { t } = useI18n();
  const [form, setForm] = useState<ItemFormState>(initial ?? EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const isValid =
    form.name.trim().length > 0 &&
    Number(form.costPrice) >= 0 &&
    Number(form.sellingPrice) > 0 &&
    Number(form.sellingPrice) >= Number(form.costPrice || 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setForm(initial ?? EMPTY_FORM);
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t("data.customProducts.explainerTitle")}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 space-y-3 overflow-y-auto py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("data.customProducts.form.name")}</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t("data.customProducts.form.namePlaceholder")}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t("data.customProducts.form.category")}
            </label>
            <Input
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder={t("data.customProducts.form.categoryPlaceholder")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t("data.customProducts.form.costPrice")} ({getCurrencySymbol(currency)})
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.costPrice}
                onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t("data.customProducts.form.sellingPrice")} ({getCurrencySymbol(currency)})
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.sellingPrice}
                onChange={(e) => setForm((f) => ({ ...f, sellingPrice: e.target.value }))}
              />
            </div>
          </div>
          {/* Stock: off for services (a haircut never runs out), on for real
              countable goods like merchandise — see Product.trackStock. */}
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{t("data.customProducts.form.trackStock")}</p>
                <p className="text-muted-foreground text-xs">
                  {form.trackStock
                    ? t("data.customProducts.form.trackStockOnHint")
                    : t("data.customProducts.form.trackStockOffHint")}
                </p>
              </div>
              <Switch
                checked={form.trackStock}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, trackStock: checked }))}
              />
            </div>
            {form.trackStock && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {t("data.customProducts.form.stockQty")}
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.stockQty}
                  onChange={(e) => setForm((f) => ({ ...f, stockQty: e.target.value }))}
                />
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.actions.cancel")}
          </Button>
          <Button
            disabled={!isValid || submitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onSubmit(form);
                setForm(EMPTY_FORM);
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {t("common.actions.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CustomProductEditDialogProps {
  storeId: string;
  product: Product;
  currency: string;
  onOpenChange: (open: boolean) => void;
  convertPrice: (valueInBaseCurrency: number, fromCurrency?: string) => number;
  convertToBase: (valueInUserCurrency: number, toCurrency?: string) => number;
}

function CustomProductEditDialog({
  storeId,
  product,
  currency,
  onOpenChange,
  convertPrice,
  convertToBase,
}: CustomProductEditDialogProps) {
  const { t } = useI18n();
  const updateProduct = useUpdateProduct(storeId, product.id);

  const storedCost = Number(product.costPrice) || 0;
  const storedSelling = Number(product.sellingPrice) || 0;

  return (
    <CustomProductFormDialog
      open
      onOpenChange={onOpenChange}
      title={t("data.customProducts.editDialogTitle")}
      currency={currency}
      initial={{
        name: product.name,
        category: product.category ?? "",
        // Product.costPrice/sellingPrice are stored in the platform base
        // currency (IDR) — must convert to the store's display currency for
        // this field, exactly like edit-product-dialog.tsx does, or a EUR
        // store shows the raw IDR number here.
        costPrice: storedCost > 0 ? String(convertPrice(storedCost)) : "0",
        sellingPrice: storedSelling > 0 ? String(convertPrice(storedSelling)) : "0",
        trackStock: product.trackStock,
        stockQty: String(Number(product.currentStock) || 0),
      }}
      onSubmit={async (form) => {
        const promise = updateProduct.mutateAsync({
          name: form.name,
          category: form.category || undefined,
          costPrice: convertToBase(Number(form.costPrice)),
          sellingPrice: convertToBase(Number(form.sellingPrice)),
          trackStock: form.trackStock,
          // Only meaningful while tracked — left untouched when it isn't, so
          // toggling tracking off and back on doesn't silently zero a real count.
          ...(form.trackStock && { currentStock: Number(form.stockQty) || 0 }),
        });
        toast.promise(promise, {
          loading: t("common.actions.saving"),
          success: t("data.customProducts.toasts.updated"),
          error: t("data.customProducts.toasts.updateFailed"),
        });
        await promise;
        onOpenChange(false);
      }}
    />
  );
}
