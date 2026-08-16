"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Minus, Check, ShoppingCart, Utensils } from "lucide-react";
import { getPremiumTheme } from "@/lib/utils/color";
import { formatCurrency } from "@/lib/utils/formatting";
import { useI18n } from "@/components/lang/i18n-provider";
import { StorefrontControls } from "@/features/storefront/components/storefront-controls";
import { getMergedOptionGroups } from "@/lib/utils/menu-item-options";
import { usePublicStorefrontMenu, type PublicMenuItem } from "../hooks/use-public-menu";
import { useTrackPageView } from "../hooks/use-track-storefront-event";

interface ModifierOption {
  name: string;
  priceAdd: number;
  materialId?: string;
  materialQty?: number;
}

interface ModifierGroup {
  name: string;
  isRequired?: boolean;
  maxSelections?: number;
  options: ModifierOption[];
}

// Reuses the polling hook's shape exactly — see public-menu.tsx's identical
// choice, and usePublicStorefrontMenu's own doc comment.
type MenuItem = PublicMenuItem;

/** Same conversion as public-menu.tsx's getItemModifierGroups — kept local
 * rather than shared since the two files' ModifierGroup shapes are declared
 * independently. */
const getItemModifierGroups = (item: MenuItem): ModifierGroup[] =>
  getMergedOptionGroups(item, item.product).map((group) => ({
    name: group.name,
    isRequired: group.isRequired,
    maxSelections: group.maxSelections,
    options: group.options.map((option) => ({
      name: option.name,
      priceAdd: option.priceAdjustment,
      materialId: option.materialId,
      materialQty: option.materialQty,
    })),
  }));

interface PublicItemDetailProps {
  storefront: {
    id: string;
    slug: string;
    displayName: string;
    themeColor: string;
    fontFamily: string;
  };
  item: MenuItem;
}

interface CartItem {
  id: string;
  uniqueId: string;
  name: string;
  price: number;
  quantity: number;
  selectedModifiers: {
    groupName: string;
    options: ModifierOption[];
  }[];
  notes?: string;
}

export function PublicItemDetail({ storefront, item: initialItem }: PublicItemDetailProps) {
  const router = useRouter();
  const { t } = useI18n();
  useTrackPageView(storefront.slug, "ITEM_VIEW", {
    menuItemId: initialItem.id,
    menuItemName: initialItem.name,
  });
  // Polls the live menu (shared with public-menu.tsx) and swaps in this
  // item's fresh price/availability/options once loaded, so a merchant's
  // change shows up while a customer already has this page open.
  const { data: menuCategories } = usePublicStorefrontMenu(storefront.slug);
  const item = useMemo(() => {
    const live = menuCategories?.flatMap((c) => c.items).find((i) => i.id === initialItem.id);
    return live ?? initialItem;
  }, [menuCategories, initialItem]);
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, ModifierOption[]>>({});
  const [noteText, setNoteText] = useState("");

  // Theme styling
  const safeTheme = getPremiumTheme(storefront.themeColor || "#FF6B35");
  const themeStyle = {
    "--store-theme": safeTheme,
    "--store-theme-light-bg": `color-mix(in srgb, ${safeTheme} 8%, var(--card))`,
    fontFamily: storefront.fontFamily === "Mono" ? "monospace" : "var(--font-sans)",
  } as React.CSSProperties;

  // Format price
  const formatPrice = (price: number) => formatCurrency(price, item.currency);

  // Initialize modifiers
  useEffect(() => {
    const initialModifiers: Record<string, ModifierOption[]> = {};
    const modGroups = getItemModifierGroups(item);
    modGroups.forEach((group) => {
      initialModifiers[group.name] = [];
    });
    setSelectedModifiers(initialModifiers);
    setNoteText("");
  }, [item]);

  // Handle modifier selection
  const handleModifierChange = (
    groupName: string,
    option: ModifierOption,
    group: ModifierGroup
  ) => {
    const currentSelected = selectedModifiers[groupName] || [];
    const isSelected = currentSelected.some((o) => o.name === option.name);

    let newSelected: ModifierOption[];

    if (group.maxSelections === 1) {
      newSelected = isSelected ? [] : [option];
    } else {
      if (isSelected) {
        newSelected = currentSelected.filter((o) => o.name !== option.name);
      } else {
        const max = group.maxSelections || 999;
        if (currentSelected.length < max) {
          newSelected = [...currentSelected, option];
        } else {
          newSelected = [...currentSelected.slice(1), option];
        }
      }
    }

    setSelectedModifiers({
      ...selectedModifiers,
      [groupName]: newSelected,
    });
  };

  // Add to cart and save to localStorage
  const handleAddToCart = () => {
    // Check if required modifiers are selected
    const modGroups = getItemModifierGroups(item);
    for (const group of modGroups) {
      if (
        group.isRequired &&
        (!selectedModifiers[group.name] || selectedModifiers[group.name].length === 0)
      ) {
        alert(t("publicOrder.itemDetail.selectOptionAlert") + ' "' + group.name + '"');
        return;
      }
    }

    // Format chosen modifiers
    const formattedModifiers = Object.entries(selectedModifiers)
      .filter(([_, options]) => options.length > 0)
      .map(([groupName, options]) => ({
        groupName,
        options,
      }));

    // Create unique key
    const modifierKey = formattedModifiers
      .map(
        (g) =>
          `${g.groupName}:${g.options
            .map((o) => o.name)
            .sort()
            .join(",")}`
      )
      .sort()
      .join("|");
    const trimmedNote = noteText.trim();
    const uniqueId = `${item.id}-${modifierKey}-note:${trimmedNote}`;

    // Read cart from localStorage
    let localCart: CartItem[] = [];
    try {
      const savedCart = localStorage.getItem(`cart_${storefront.slug}`);
      if (savedCart) {
        localCart = JSON.parse(savedCart);
      }
    } catch (e) {
      console.error(e);
    }

    const existingIndex = localCart.findIndex((cartItem) => cartItem.uniqueId === uniqueId);

    if (existingIndex > -1) {
      localCart[existingIndex].quantity += quantity;
    } else {
      const newItem: CartItem = {
        id: item.id,
        uniqueId,
        name: item.name,
        price: Number(item.price),
        quantity: quantity,
        selectedModifiers: formattedModifiers,
        notes: trimmedNote || undefined,
      };
      localCart.push(newItem);
    }

    // Save cart back to localStorage
    try {
      localStorage.setItem(`cart_${storefront.slug}`, JSON.stringify(localCart));
    } catch (e) {
      console.error(e);
    }

    // Redirect to menu page and tell it to open cart
    router.push(`/@${storefront.slug}/menu?openCart=true`);
  };

  return (
    <div className="flex min-h-[calc(100vh/var(--app-zoom,1))] flex-col pb-24" style={themeStyle}>
      {/* Header */}
      <header className="bg-card/90 sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 shadow-sm backdrop-blur-md">
        <Link
          href={`/@${storefront.slug}/menu`}
          className="hover:bg-muted rounded-full p-1 transition"
        >
          <ArrowLeft className="text-foreground size-5" />
        </Link>
        <span className="text-foreground text-sm font-extrabold">
          {t("publicOrder.itemDetail.pageTitle")}
        </span>
        <StorefrontControls />
      </header>

      {/* Main image */}
      <div className="bg-muted relative flex h-64 w-full items-center justify-center">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <div className="text-muted-foreground/50 flex h-full w-full items-center justify-center">
            <Utensils className="size-16 stroke-1" />
          </div>
        )}
      </div>

      {/* Item info */}
      <div className="bg-card border-b p-4">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-foreground text-xl leading-tight font-extrabold">{item.name}</h1>
          {item.isFeatured && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-amber-800 uppercase dark:bg-amber-400/15 dark:text-amber-300">
              {t("publicOrder.itemDetail.favorite")}
            </span>
          )}
        </div>
        <p className="mt-1 text-base font-black text-[var(--store-theme)]">
          {formatPrice(Number(item.price))}
        </p>
        {item.description && (
          <p className="text-muted-foreground mt-3 text-xs leading-relaxed">{item.description}</p>
        )}
      </div>

      {/* Modifiers Selection */}
      <div className="bg-muted/50 flex-1 space-y-6 p-4">
        {getItemModifierGroups(item).map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-foreground text-sm font-bold">
                {group.name}
                {group.isRequired && <span className="text-destructive ml-1 font-black">*</span>}
              </h4>
              <span className="text-muted-foreground bg-muted rounded px-2 py-0.5 text-[10px] font-bold">
                {group.isRequired
                  ? t("publicOrder.itemDetail.required")
                  : t("publicOrder.itemDetail.optional")}
              </span>
            </div>

            <div className="grid gap-2">
              {group.options.map((option, optIdx) => {
                const isSelected = (selectedModifiers[group.name] || []).some(
                  (o) => o.name === option.name
                );

                return (
                  <div
                    key={optIdx}
                    onClick={() => handleModifierChange(group.name, option, group)}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition ${
                      isSelected
                        ? "border-[var(--store-theme)] bg-[var(--store-theme-light-bg)]"
                        : "border-border bg-card hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex size-5 items-center justify-center rounded-md border transition-colors ${
                          isSelected
                            ? "border-transparent bg-[var(--store-theme)]"
                            : "border-muted-foreground/30"
                        }`}
                      >
                        {isSelected && <Check className="size-3.5 stroke-[3px] text-white" />}
                      </div>
                      <span className="text-foreground text-xs font-semibold">{option.name}</span>
                    </div>
                    <span className="text-muted-foreground text-xs font-bold">
                      {option.priceAdd > 0
                        ? `+${formatPrice(option.priceAdd)}`
                        : t("publicOrder.itemDetail.free")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="space-y-1.5">
          <label className="text-foreground text-sm font-bold">
            {t("publicOrder.itemDetail.noteLabel")}
          </label>
          <textarea
            placeholder={t("publicOrder.itemDetail.notePlaceholder")}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={2}
            className="bg-card border-border w-full resize-none rounded-xl border p-3 text-sm transition-all focus:ring-2 focus:ring-[var(--store-theme)] focus:outline-none"
          />
        </div>
      </div>

      {/* Floating purchase action bar */}
      <div className="bg-card fixed right-0 bottom-0 left-0 z-40 mx-auto max-w-md border-t p-4 shadow-lg">
        <div className="flex items-center justify-between gap-4">
          {/* Quantity Selector */}
          <div className="bg-muted flex items-center gap-3 rounded-full border px-3 py-1.5">
            <button
              onClick={() => quantity > 1 && setQuantity(quantity - 1)}
              className="text-muted-foreground hover:text-foreground p-1 transition"
            >
              <Minus className="size-4" />
            </button>
            <span className="text-foreground min-w-[24px] text-center text-sm font-bold">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="text-muted-foreground hover:text-foreground p-1 transition"
            >
              <Plus className="size-4" />
            </button>
          </div>

          {/* Add Button */}
          <button
            onClick={handleAddToCart}
            className="flex flex-1 items-center justify-center gap-2 rounded-full py-3.5 font-bold text-white shadow-md transition-transform active:scale-[0.98]"
            style={{ backgroundColor: "var(--store-theme)" }}
          >
            <ShoppingCart className="size-5" />
            <span>{t("publicOrder.itemDetail.addToCartShort")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
