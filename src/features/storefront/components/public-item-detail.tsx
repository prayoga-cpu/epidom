"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Minus, ShoppingCart, Utensils, Layers } from "lucide-react";
import { getPremiumTheme } from "@/lib/utils/color";
import { formatCurrency } from "@/lib/utils/formatting";
import { useI18n } from "@/components/lang/i18n-provider";
import { StorefrontControls } from "@/features/storefront/components/storefront-controls";
import {
  firstMissingRequiredGroup,
  getMergedOptionGroups,
  toggleOptionSelection,
} from "@/lib/utils/menu-item-options";
import {
  StorefrontOptionPicker,
  type StorefrontModifierGroup,
  type StorefrontModifierOption,
} from "./storefront-option-picker";
import { usePublicStorefrontMenu, type PublicMenuItem } from "../hooks/use-public-menu";
import { useTrackPageView } from "../hooks/use-track-storefront-event";

// Name and price only, as in public-menu.tsx: the order route re-reads each
// option (and its stock link) from the menu.
type ModifierOption = StorefrontModifierOption;
type ModifierGroup = StorefrontModifierGroup;

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
  // The required step the customer skipped, highlighted and scrolled to.
  const [missingGroup, setMissingGroup] = useState<string | null>(null);
  const groupRefs = useRef<Record<string, HTMLElement | null>>({});

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
    setMissingGroup(null);
  }, [item]);

  // Handle modifier selection (shared rule: toggleOptionSelection)
  const handleModifierChange = (group: ModifierGroup, option: ModifierOption) => {
    const newSelected = toggleOptionSelection(
      selectedModifiers[group.name] || [],
      option,
      (a, b) => a.name === b.name,
      group.maxSelections || 999,
      { capAtMax: item.buildYourOwn }
    );
    setSelectedModifiers({ ...selectedModifiers, [group.name]: newSelected });
    if (missingGroup === group.name) setMissingGroup(null);
  };

  // What the button charges: base + chosen add-ons, times quantity.
  const total =
    (Number(item.price) +
      Object.values(selectedModifiers)
        .flat()
        .reduce((sum, o) => sum + o.priceAdd, 0)) *
    quantity;

  // Add to cart and save to localStorage
  const handleAddToCart = () => {
    // A skipped required step is highlighted and scrolled to, not alerted.
    const missing = firstMissingRequiredGroup(getItemModifierGroups(item), selectedModifiers);
    if (missing) {
      setMissingGroup(missing);
      groupRefs.current[missing]?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
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
          {item.buildYourOwn
            ? t("publicOrder.menu.fromPrice").replace("{price}", formatPrice(Number(item.price)))
            : formatPrice(Number(item.price))}
        </p>
        {item.buildYourOwn && (
          <span className="mt-2 inline-flex items-center gap-1 rounded bg-[var(--store-theme-light-bg)] px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-[var(--store-theme)] uppercase">
            <Layers className="size-3" />
            {t("publicOrder.menu.buildYourOwn")}
          </span>
        )}
        {item.description && (
          <p className="text-muted-foreground mt-3 text-xs leading-relaxed">{item.description}</p>
        )}
      </div>

      {/* Modifiers Selection */}
      <div className="bg-muted/50 flex-1 space-y-6 p-4">
        <StorefrontOptionPicker
          groups={getItemModifierGroups(item)}
          selected={selectedModifiers}
          onToggle={handleModifierChange}
          buildYourOwn={item.buildYourOwn}
          missingGroup={missingGroup}
          formatPrice={formatPrice}
          groupRefs={groupRefs}
          surface="page"
        />

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
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--store-theme)] py-3.5 font-bold text-white shadow-md transition-transform active:scale-[0.98]"
          >
            <ShoppingCart className="size-5" />
            <span>{t("publicOrder.itemDetail.addToCartShort")}</span>
            <span className="tabular-nums opacity-90">· {formatPrice(total)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
