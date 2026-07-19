"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  X,
  Plus,
  Minus,
  Check,
  ChevronRight,
  ShoppingCart,
  MessageSquare,
  Loader2,
  QrCode,
  CreditCard,
  Wallet,
  Banknote,
  Utensils,
  ShoppingBag,
  Bike,
  ReceiptText,
} from "lucide-react";
import { getPremiumTheme } from "@/lib/utils/color";
import { useI18n } from "@/components/lang/i18n-provider";
import { StorefrontControls } from "@/features/storefront/components/storefront-controls";
import { appendLocalOrder } from "../lib/local-orders";

interface ModifierOption {
  name: string;
  priceAdd: number;
}

interface ModifierGroup {
  name: string;
  isRequired?: boolean;
  maxSelections?: number;
  options: ModifierOption[];
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: any; // Decimal
  currency: string;
  imageUrl: string | null;
  isAvailable: boolean;
  isFeatured: boolean;
  modifiers: any; // ModifierGroup[]
}

interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

interface PublicMenuProps {
  storefront: {
    id: string;
    slug: string;
    displayName: string;
    whatsappNumber: string | null;
    themeColor: string;
    fontFamily: string;
    acceptsReservations: boolean;
  };
  menuCategories: MenuCategory[];
}

interface CartItem {
  id: string;
  uniqueId: string; // unique key combining item ID and selected modifiers
  name: string;
  price: number;
  quantity: number;
  selectedModifiers: {
    groupName: string;
    options: ModifierOption[];
  }[];
}

type PaymentMethod =
  | "CASH"
  | "QRIS"
  | "GOPAY"
  | "OVO"
  | "DANA"
  | "SHOPEEPAY"
  | "BANK_TRANSFER"
  | "STRIPE_CARD";

const PAYMENT_OPTIONS: {
  value: PaymentMethod;
  label: string;
  icon: React.ReactNode;
  isImage?: boolean;
}[] = [
  { value: "CASH", label: "Tunai", icon: <Banknote className="size-5" /> },
  {
    value: "QRIS",
    label: "QRIS",
    icon: <img src="/payment-logos/qris.svg" alt="QRIS" className="h-5 w-[50px] object-contain" />,
    isImage: true,
  },
  {
    value: "GOPAY",
    label: "GoPay",
    icon: (
      <img src="/payment-logos/gopay.svg" alt="GoPay" className="h-5 w-[50px] object-contain" />
    ),
    isImage: true,
  },
  {
    value: "OVO",
    label: "OVO",
    icon: <img src="/payment-logos/ovo.svg" alt="OVO" className="h-5 w-[50px] object-contain" />,
    isImage: true,
  },
  {
    value: "DANA",
    label: "DANA",
    icon: <img src="/payment-logos/dana.svg" alt="DANA" className="h-5 w-[50px] object-contain" />,
    isImage: true,
  },
  {
    value: "SHOPEEPAY",
    label: "ShopeePay",
    icon: (
      <img
        src="/payment-logos/shopeepay.svg"
        alt="ShopeePay"
        className="h-5 w-[50px] object-contain"
      />
    ),
    isImage: true,
  },
  {
    value: "BANK_TRANSFER",
    label: "Transfer Bank",
    icon: (
      <img
        src="/payment-logos/bank-transfer.svg"
        alt="Transfer Bank"
        className="h-5 w-[50px] object-contain"
      />
    ),
    isImage: true,
  },
  {
    value: "STRIPE_CARD",
    label: "Stripe (Card/Wallets)",
    icon: (
      <img src="/payment-logos/stripe.svg" alt="Stripe" className="h-5 w-[50px] object-contain" />
    ),
    isImage: true,
  },
];

type VABankCode = "BNI" | "BRI" | "MANDIRI" | "PERMATA";

const VA_BANKS: { code: VABankCode; label: string; color: string }[] = [
  { code: "BNI", label: "BNI", color: "#FF6600" },
  { code: "BRI", label: "BRI", color: "#00529C" },
  { code: "MANDIRI", label: "Mandiri", color: "#003D79" },
  { code: "PERMATA", label: "Permata", color: "#E31E25" },
];

export function PublicMenu({ storefront, menuCategories }: PublicMenuProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Checkout form state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderMethod, setOrderMethod] = useState<"DINE_IN" | "TAKEAWAY" | "DELIVERY">("DINE_IN");
  const [tableNumber, setTableNumber] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [selectedBankCode, setSelectedBankCode] = useState<VABankCode>("BNI");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const router = useRouter();

  // Sync cart with localStorage
  React.useEffect(() => {
    try {
      const savedCart = localStorage.getItem(`cart_${storefront.slug}`);
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
    } catch (e) {
      console.error("Failed to load cart from localStorage", e);
    }
  }, [storefront.slug]);

  React.useEffect(() => {
    try {
      if (cart.length > 0) {
        localStorage.setItem(`cart_${storefront.slug}`, JSON.stringify(cart));
      } else {
        localStorage.removeItem(`cart_${storefront.slug}`);
      }
    } catch (e) {
      console.error("Failed to save cart to localStorage", e);
    }
  }, [cart, storefront.slug]);

  // Check URL query parameters on mount to open cart / pre-fill a table (e.g. scanned from a table's QR code)
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const table = params.get("table");
      if (table) {
        setTableNumber(decodeURIComponent(table));
        setOrderMethod("DINE_IN");
      }
      if (params.get("openCart") === "true") {
        setIsCartOpen(true);
        // Clean URL to prevent reopening on reload (table stays if present, so a refresh keeps it)
        const newUrl = table
          ? `${window.location.pathname}?table=${encodeURIComponent(table)}`
          : window.location.pathname;
        window.history.replaceState({}, "", newUrl);
      }
    }
  }, []);

  // Active item detail modal state
  const [activeItem, setActiveItem] = useState<MenuItem | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, ModifierOption[]>>({});
  const [itemQuantity, setItemQuantity] = useState(1);

  // Theme variable
  const safeTheme = getPremiumTheme(storefront.themeColor || "#FF6B35");
  const themeStyle = {
    "--store-theme": safeTheme,
    "--store-theme-light": `color-mix(in srgb, ${safeTheme} 15%, transparent)`,
    "--store-theme-light-bg": `color-mix(in srgb, ${safeTheme} 8%, var(--card))`,
    "--store-theme-gradient": `linear-gradient(135deg, ${safeTheme}, color-mix(in srgb, ${safeTheme} 40%, black))`,
    fontFamily: storefront.fontFamily === "Mono" ? "monospace" : "var(--font-sans)",
  } as React.CSSProperties;

  // Flattened items for searching
  const allItems = useMemo(() => {
    return menuCategories.flatMap((cat) => cat.items);
  }, [menuCategories]);

  // Filter categories and items based on search and selected tab
  const filteredCategories = useMemo(() => {
    return menuCategories
      .map((category) => {
        const items = category.items.filter((item) => {
          const matchesSearch =
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.description &&
              item.description.toLowerCase().includes(searchQuery.toLowerCase()));
          return matchesSearch;
        });
        return { ...category, items };
      })
      .filter((category) => category.items.length > 0);
  }, [menuCategories, searchQuery]);

  // Cart helper calculations
  const cartTotals = useMemo(() => {
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.reduce((sum, item) => {
      const modifiersCost = item.selectedModifiers.reduce((modSum, mGroup) => {
        return modSum + mGroup.options.reduce((optSum, opt) => optSum + opt.priceAdd, 0);
      }, 0);
      return sum + (item.price + modifiersCost) * item.quantity;
    }, 0);
    return { totalCount, subtotal };
  }, [cart]);

  // Format currency helper
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Open item details for customization
  const handleItemClick = (item: MenuItem) => {
    if (!item.isAvailable) return;
    setActiveItem(item);
    setItemQuantity(1);

    // Set default empty arrays for modifier selections
    const initialModifiers: Record<string, ModifierOption[]> = {};
    const modGroups = (item.modifiers as ModifierGroup[]) || [];
    modGroups.forEach((group) => {
      initialModifiers[group.name] = [];
    });
    setSelectedModifiers(initialModifiers);
  };

  // Toggle modifier option selection
  const handleModifierChange = (
    groupName: string,
    option: ModifierOption,
    group: ModifierGroup
  ) => {
    const currentSelected = selectedModifiers[groupName] || [];
    const isSelected = currentSelected.some((o) => o.name === option.name);

    let newSelected: ModifierOption[];

    if (group.maxSelections === 1) {
      // Single select (radio button behavior)
      newSelected = isSelected ? [] : [option];
    } else {
      // Multi-select up to maxSelections
      if (isSelected) {
        newSelected = currentSelected.filter((o) => o.name !== option.name);
      } else {
        const max = group.maxSelections || 999;
        if (currentSelected.length < max) {
          newSelected = [...currentSelected, option];
        } else {
          // Replace first selection if exceeding max
          newSelected = [...currentSelected.slice(1), option];
        }
      }
    }

    setSelectedModifiers({
      ...selectedModifiers,
      [groupName]: newSelected,
    });
  };

  // Add customized item to cart
  const handleAddToCart = () => {
    if (!activeItem) return;

    // Check if required modifiers are selected
    const modGroups = (activeItem.modifiers as ModifierGroup[]) || [];
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

    // Create a unique key for the cart items (so same item with different modifiers is split)
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
    const uniqueId = `${activeItem.id}-${modifierKey}`;

    const existingIndex = cart.findIndex((item) => item.uniqueId === uniqueId);

    if (existingIndex > -1) {
      // Update quantity
      const newCart = [...cart];
      newCart[existingIndex].quantity += itemQuantity;
      setCart(newCart);
    } else {
      // Add new item
      const newItem: CartItem = {
        id: activeItem.id,
        uniqueId,
        name: activeItem.name,
        price: Number(activeItem.price),
        quantity: itemQuantity,
        selectedModifiers: formattedModifiers,
      };
      setCart([...cart, newItem]);
    }

    setActiveItem(null);
  };

  // Submit order via API
  const handleSendOrder = async () => {
    setCheckoutError(null);

    if (!customerName.trim()) {
      setCheckoutError(t("publicOrder.nameRequired"));
      return;
    }

    if (orderMethod === "DELIVERY" && !deliveryAddress.trim()) {
      setCheckoutError(t("publicOrder.checkoutForm.addressRequired"));
      return;
    }

    // Table number is only required when the store uses table reservations.
    if (orderMethod === "DINE_IN" && storefront.acceptsReservations && !tableNumber.trim()) {
      setCheckoutError(t("publicOrder.checkoutForm.tableRequired"));
      return;
    }

    setIsSubmitting(true);

    try {
      const formattedItems = cart.map((i) => {
        // Flatten modifiers for API
        const modifierSelections: Array<{
          modifierName: string;
          optionName: string;
          priceAdd: number;
        }> = [];
        i.selectedModifiers.forEach((group) => {
          group.options.forEach((opt) => {
            modifierSelections.push({
              modifierName: group.groupName,
              optionName: opt.name,
              priceAdd: opt.priceAdd,
            });
          });
        });

        return {
          menuItemId: i.id,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.price,
          modifierSelections,
        };
      });

      const res = await fetch("/api/public/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storefrontSlug: storefront.slug,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim() || undefined,
          orderType: orderMethod,
          tableNumber: tableNumber.trim() || undefined,
          paymentMethod,
          bankCode: paymentMethod === "BANK_TRANSFER" ? selectedBankCode : undefined,
          notes: notes.trim() || undefined,
          items: formattedItems,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setCheckoutError(data?.error?.message ?? t("publicOrder.checkoutForm.orderCreateFailed"));
        setIsSubmitting(false);
        return;
      }

      const { orderId, orderNumber, paymentUrl } = data.data;

      // Remember the order locally so the customer can find it again
      appendLocalOrder(storefront.slug, {
        orderId,
        orderNumber,
        createdAt: new Date().toISOString(),
        total: cartTotals.subtotal,
        storeSlug: storefront.slug,
      });

      // Clear cart
      setCart([]);
      setIsCheckoutOpen(false);
      setIsCartOpen(false);

      // Redirect to payment URL if applicable, then status page
      if (paymentUrl && paymentMethod !== "CASH") {
        window.location.href = paymentUrl;
      } else {
        router.push(`/@${storefront.slug}/order/${orderId}`);
      }
    } catch {
      setCheckoutError(t("publicOrder.checkoutForm.genericError"));
      setIsSubmitting(false);
    }
  };
  const updateCartQuantity = (uniqueId: string, delta: number) => {
    const updated = cart
      .map((item) => {
        if (item.uniqueId === uniqueId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      })
      .filter(Boolean) as CartItem[];
    setCart(updated);
  };

  return (
    <div className="flex min-h-screen flex-col" style={themeStyle}>
      {/* Header */}
      <header className="bg-card/90 sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 shadow-sm backdrop-blur-md">
        <Link href={`/@${storefront.slug}`} className="hover:bg-muted rounded-full p-1 transition">
          <ArrowLeft className="text-foreground size-5" />
        </Link>
        <h1 className="text-foreground max-w-[200px] truncate text-base font-extrabold">
          {storefront.displayName}
        </h1>
        <div className="flex items-center gap-2">
          <StorefrontControls />
          <Link
            href={`/@${storefront.slug}/orders`}
            aria-label={t("publicOrder.myOrders.title")}
            className="text-muted-foreground hover:bg-muted rounded-full p-2 transition"
          >
            <ReceiptText className="size-5" />
          </Link>
          <button
            onClick={() => cart.length > 0 && setIsCartOpen(true)}
            className={`relative rounded-full p-2 transition ${cart.length > 0 ? "bg-[var(--store-theme-light-bg)] text-[var(--store-theme)]" : "text-muted-foreground"}`}
          >
            <ShoppingCart className="size-5" />
            {cartTotals.totalCount > 0 && (
              <span
                className="absolute -top-1 -right-1 flex size-5 animate-bounce items-center justify-center rounded-full text-[10px] font-bold text-white shadow-md"
                style={{ backgroundColor: "var(--store-theme)" }}
              >
                {cartTotals.totalCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Two-column wrapper: menu items left, cart sidebar right on desktop */}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto pb-24 md:pb-4">
          {/* Hero Mini Banner */}
          <div
            className="relative overflow-hidden px-6 py-8 text-white"
            style={{ background: "var(--store-theme-gradient)" }}
          >
            <div className="absolute right-0 bottom-0 opacity-10">
              <Utensils className="size-32 opacity-20" />
            </div>
            <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold tracking-wider uppercase">
              {t("publicOrder.menu.badge")}
            </span>
            <h2 className="mt-2 text-2xl font-black tracking-tight">
              {t("publicOrder.menu.title")}
            </h2>
            <p className="mt-1 text-xs text-white/80">{t("publicOrder.menu.subtitle")}</p>
          </div>

          {/* Search Bar */}
          <div className="mt-4 px-4">
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <input
                type="text"
                placeholder={t("publicOrder.menu.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-muted focus:bg-card border-border h-10 w-full rounded-full border pr-4 pl-9 text-sm transition focus:ring-2 focus:ring-[var(--store-theme)] focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>

          {/* Categories Tabs */}
          {filteredCategories.length > 0 && (
            <div className="scrollbar-none bg-card sticky top-[53px] z-20 flex gap-2 overflow-x-auto border-b px-4 py-3">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold transition-colors ${
                  selectedCategory === "all"
                    ? "border-transparent bg-[var(--store-theme)] text-white shadow-sm"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                {t("publicOrder.menu.allCategory")} ({allItems.length})
              </button>
              {filteredCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold transition-colors ${
                    selectedCategory === cat.id
                      ? "border-transparent bg-[var(--store-theme)] text-white shadow-sm"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {cat.name} ({cat.items.length})
                </button>
              ))}
            </div>
          )}

          {/* Menu Items Grid */}
          <div className="mt-4 flex-1 space-y-8 px-4">
            {filteredCategories.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center justify-center py-12">
                <Utensils className="mb-2 size-10 stroke-1" />
                <p className="text-sm font-medium">{t("publicOrder.menu.notFound")}</p>
              </div>
            ) : (
              filteredCategories
                .filter((cat) => selectedCategory === "all" || cat.id === selectedCategory)
                .map((category) => (
                  <div key={category.id} className="space-y-3">
                    <h3 className="text-foreground border-l-4 border-[var(--store-theme)] pl-2 text-sm font-black tracking-widest uppercase">
                      {category.name}
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {category.items.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleItemClick(item)}
                          className={`bg-card flex cursor-pointer gap-3 rounded-xl border p-3 shadow-sm transition active:scale-[0.99] ${
                            item.isAvailable
                              ? "hover:border-muted-foreground/30"
                              : "opacity-60 select-none hover:border-transparent"
                          }`}
                        >
                          {/* Image */}
                          <div className="bg-muted relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                            {item.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Utensils className="text-muted-foreground/50 size-6" />
                            )}
                            {!item.isAvailable && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                                <span className="rounded px-1 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase">
                                  {t("publicOrder.menu.soldOut")}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex flex-1 flex-col justify-between">
                            <div>
                              <div className="flex items-start justify-between gap-1">
                                <h4 className="text-foreground line-clamp-1 text-sm font-bold">
                                  {item.name}
                                </h4>
                                {item.isFeatured && (
                                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-amber-800 uppercase dark:bg-amber-400/15 dark:text-amber-300">
                                    {t("publicOrder.menu.featured")}
                                  </span>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[11px] leading-snug">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-foreground text-sm font-extrabold">
                                {formatPrice(Number(item.price))}
                              </span>
                              {item.isAvailable && (
                                <div className="bg-muted flex size-7 items-center justify-center rounded-full border transition hover:border-[var(--store-theme)] hover:bg-[var(--store-theme-light-bg)]">
                                  <Plus className="text-muted-foreground size-4" />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
        {/* end scrollable menu column */}

        {/* Desktop cart sidebar */}
        <aside className="md:bg-muted/50 hidden md:sticky md:top-[57px] md:flex md:h-[calc(100vh-57px)] md:w-80 md:shrink-0 md:flex-col md:overflow-y-auto md:border-l">
          <div className="bg-card flex items-center gap-2 border-b p-4">
            <ShoppingCart className="size-4 text-[var(--store-theme)]" />
            <span className="text-foreground text-sm font-black">
              {t("publicOrder.menu.yourOrder")}
            </span>
            {cartTotals.totalCount > 0 && (
              <span className="ml-auto text-xs font-bold text-[var(--store-theme)]">
                {cartTotals.totalCount} {t("publicOrder.menu.itemUnit")}
              </span>
            )}
          </div>
          {cart.length === 0 ? (
            <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 py-12">
              <ShoppingCart className="size-10 stroke-1" />
              <p className="text-sm font-medium">{t("publicOrder.cartEmpty")}</p>
              <p className="px-4 text-center text-xs">{t("publicOrder.menu.cartEmptyHint")}</p>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {cart.map((item) => {
                  const modsCost = item.selectedModifiers.reduce(
                    (s, g) => s + g.options.reduce((oSum, o) => oSum + o.priceAdd, 0),
                    0
                  );
                  const singleTotal = item.price + modsCost;
                  return (
                    <div
                      key={item.uniqueId}
                      className="flex items-start justify-between gap-3 border-b pb-3 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="text-foreground truncate text-xs font-bold">{item.name}</h4>
                        <p className="mt-0.5 text-xs font-extrabold text-[var(--store-theme)]">
                          {formatPrice(singleTotal)}
                        </p>
                      </div>
                      <div className="bg-card flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 shadow-sm">
                        <button
                          onClick={() => updateCartQuantity(item.uniqueId, -1)}
                          className="text-muted-foreground hover:text-destructive p-0.5"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="text-foreground min-w-[16px] text-center text-xs font-bold">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateCartQuantity(item.uniqueId, 1)}
                          className="text-muted-foreground p-0.5 hover:text-[var(--store-theme)]"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="bg-card space-y-3 border-t p-4">
                <div className="text-foreground flex justify-between text-sm font-extrabold">
                  <span>{t("publicOrder.menu.subtotal")}</span>
                  <span>{formatPrice(cartTotals.subtotal)}</span>
                </div>
                <button
                  onClick={() => {
                    setIsCartOpen(false);
                    setIsCheckoutOpen(true);
                  }}
                  className="w-full rounded-xl py-3 text-sm font-bold text-white shadow-md transition-transform active:scale-[0.98]"
                  style={{ backgroundColor: "var(--store-theme)" }}
                >
                  {t("publicOrder.menu.continueToCheckout")}
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
      {/* end two-column wrapper */}

      {/* Sticky Floating Cart Bar — mobile only */}
      {cart.length > 0 && !isCartOpen && (
        <div className="fixed right-4 bottom-4 left-4 z-40 mx-auto max-w-md md:hidden">
          <div
            onClick={() => setIsCartOpen(true)}
            className="flex w-full cursor-pointer items-center justify-between rounded-2xl p-4 text-white shadow-xl transition-transform active:scale-[0.98]"
            style={{ backgroundColor: "var(--store-theme)" }}
          >
            <div className="flex items-center gap-3">
              <div className="relative rounded-lg bg-white/20 p-2">
                <ShoppingCart className="size-5" />
                <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[var(--store-theme)]">
                  {cartTotals.totalCount}
                </span>
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold tracking-wider text-white/80 uppercase">
                  {t("publicOrder.menu.shoppingCart")}
                </p>
                <p className="text-sm font-black">{formatPrice(cartTotals.subtotal)}</p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsCheckoutOpen(true);
              }}
              className="z-10 flex items-center gap-1 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold"
            >
              <span>{t("publicOrder.menu.checkout")}</span>
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Cart Drawer — mobile only (desktop uses sidebar) */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:hidden">
          <div className="bg-card animate-in slide-in-from-bottom flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl duration-200">
            {/* Header */}
            <div className="bg-muted flex items-center justify-between border-b p-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="size-5 text-[var(--store-theme)]" />
                <h3 className="text-foreground text-sm font-black">
                  {t("publicOrder.menu.yourOrder")}
                </h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="hover:bg-muted text-muted-foreground rounded-full p-1 transition"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {cart.map((item) => {
                const modsCost = item.selectedModifiers.reduce(
                  (s, g) => s + g.options.reduce((oSum, o) => oSum + o.priceAdd, 0),
                  0
                );
                const singleTotal = item.price + modsCost;

                return (
                  <div
                    key={item.uniqueId}
                    className="flex items-start justify-between gap-4 border-b pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex-1">
                      <h4 className="text-foreground text-sm font-bold">{item.name}</h4>
                      {item.selectedModifiers.map((group, gIdx) => (
                        <p key={gIdx} className="text-muted-foreground mt-0.5 text-[10px]">
                          <span className="font-semibold">{group.groupName}:</span>{" "}
                          {group.options
                            .map((o) => `${o.name} (+${formatPrice(o.priceAdd)})`)
                            .join(", ")}
                        </p>
                      ))}
                      <p className="text-foreground mt-1 text-xs font-extrabold">
                        {formatPrice(singleTotal)}
                      </p>
                    </div>
                    <div className="bg-muted flex items-center gap-2 rounded-full border px-2 py-1 shadow-inner">
                      <button
                        onClick={() => updateCartQuantity(item.uniqueId, -1)}
                        className="text-muted-foreground hover:text-destructive p-1 transition"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="text-foreground min-w-[20px] text-center text-xs font-bold">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateCartQuantity(item.uniqueId, 1)}
                        className="text-muted-foreground p-1 transition hover:text-[var(--store-theme)]"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Summary */}
            <div className="bg-muted space-y-4 border-t p-4">
              <div className="text-foreground flex items-center justify-between text-sm font-extrabold">
                <span>{t("publicOrder.menu.subtotal")}</span>
                <span>{formatPrice(cartTotals.subtotal)}</span>
              </div>
              <button
                onClick={() => {
                  setIsCartOpen(false);
                  setIsCheckoutOpen(true);
                }}
                className="w-full rounded-xl py-3.5 text-center font-bold text-white shadow-md transition-transform active:scale-[0.98]"
                style={{ backgroundColor: "var(--store-theme)" }}
              >
                {t("publicOrder.menu.continueToOrderInfo")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Drawer */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60">
          <div className="bg-card animate-in slide-in-from-bottom flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl duration-200">
            {/* Header */}
            <div className="bg-muted flex items-center justify-between border-b p-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-5 text-[var(--store-theme)]" />
                <h3 className="text-foreground text-sm font-black">
                  {t("publicOrder.checkoutForm.title")}
                </h3>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="hover:bg-muted text-muted-foreground rounded-full p-1 transition"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Form */}
            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              {checkoutError && (
                <div className="bg-destructive/10 border-destructive/30 text-destructive rounded-lg border p-3 text-sm font-semibold">
                  {checkoutError}
                </div>
              )}

              {/* Customer Name */}
              <div className="space-y-1.5">
                <label className="text-muted-foreground pl-1 text-[11px] font-extrabold tracking-widest uppercase">
                  {t("publicOrder.checkoutForm.nameLabel")} *
                </label>
                <input
                  type="text"
                  placeholder={t("publicOrder.checkoutForm.namePlaceholder")}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="bg-muted/50 border-border focus:bg-card h-12 w-full rounded-xl border px-4 text-sm font-medium transition-all focus:border-transparent focus:ring-2 focus:ring-[var(--store-theme)] focus:outline-none"
                  required
                />
              </div>

              {/* Customer Phone */}
              <div className="space-y-1.5">
                <label className="text-muted-foreground pl-1 text-[11px] font-extrabold tracking-widest uppercase">
                  {t("publicOrder.checkoutForm.whatsappLabel")}
                </label>
                <input
                  type="tel"
                  placeholder={t("publicOrder.checkoutForm.whatsappPlaceholder")}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="bg-muted/50 border-border focus:bg-card h-12 w-full rounded-xl border px-4 text-sm font-medium transition-all focus:border-transparent focus:ring-2 focus:ring-[var(--store-theme)] focus:outline-none"
                />
              </div>

              {/* Order Method */}
              <div className="space-y-2 pt-2">
                <label className="text-muted-foreground pl-1 text-[11px] font-extrabold tracking-widest uppercase">
                  {t("publicOrder.checkoutForm.orderMethodLabel")} *
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    {
                      key: "DINE_IN",
                      label: t("publicOrder.checkoutForm.dineIn"),
                      icon: <Utensils className="mb-1.5 size-4" />,
                    },
                    {
                      key: "TAKEAWAY",
                      label: t("publicOrder.checkoutForm.takeaway"),
                      icon: <ShoppingBag className="mb-1.5 size-4" />,
                    },
                    {
                      key: "DELIVERY",
                      label: t("publicOrder.checkoutForm.delivery"),
                      icon: <Bike className="mb-1.5 size-4" />,
                    },
                  ].map((method) => (
                    <button
                      key={method.key}
                      onClick={() => setOrderMethod(method.key as any)}
                      className={`relative flex flex-col items-center justify-center rounded-xl border p-3 transition-all duration-200 active:scale-[0.96] ${
                        orderMethod === method.key
                          ? "border-[var(--store-theme)] bg-[var(--store-theme-light-bg)] text-[var(--store-theme)] shadow-sm"
                          : "border-border text-muted-foreground bg-card hover:border-muted-foreground/30 hover:bg-muted"
                      }`}
                    >
                      {method.icon}
                      <span className="text-[11px] font-bold">{method.label}</span>

                      {orderMethod === method.key && (
                        <div className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--store-theme)] shadow-sm">
                          <Check className="size-2.5 text-white" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional Fields */}
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                {orderMethod === "DINE_IN" && (
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground pl-1 text-[11px] font-extrabold tracking-widest uppercase">
                      {t("publicOrder.checkoutForm.tableLabel")}
                      {storefront.acceptsReservations ? " *" : ""}
                    </label>
                    <input
                      type="text"
                      placeholder={t("publicOrder.checkoutForm.tablePlaceholder")}
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      className="bg-muted/50 border-border focus:bg-card h-12 w-full rounded-xl border px-4 text-sm font-medium transition-all focus:border-transparent focus:ring-2 focus:ring-[var(--store-theme)] focus:outline-none"
                      required={storefront.acceptsReservations}
                    />
                  </div>
                )}

                {orderMethod === "DELIVERY" && (
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground pl-1 text-[11px] font-extrabold tracking-widest uppercase">
                      {t("publicOrder.checkoutForm.addressLabel")} *
                    </label>
                    <textarea
                      placeholder={t("publicOrder.checkoutForm.addressPlaceholder")}
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      rows={3}
                      className="bg-muted/50 border-border focus:bg-card w-full resize-none rounded-xl border p-4 text-sm font-medium transition-all focus:border-transparent focus:ring-2 focus:ring-[var(--store-theme)] focus:outline-none"
                      required
                    />
                  </div>
                )}
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-3 pt-2">
                <label className="text-muted-foreground pl-1 text-[11px] font-extrabold tracking-widest uppercase">
                  {t("publicOrder.checkoutForm.paymentLabel")} *
                </label>

                <div className="space-y-4">
                  {[
                    { title: t("publicOrder.checkoutForm.groupCashier"), methods: ["CASH"] },
                    {
                      title: t("publicOrder.checkoutForm.groupEwallet"),
                      methods: ["QRIS", "GOPAY", "OVO", "DANA", "SHOPEEPAY"],
                    },
                    { title: t("publicOrder.checkoutForm.groupVa"), methods: ["BANK_TRANSFER"] },
                    { title: t("publicOrder.checkoutForm.groupCard"), methods: ["STRIPE_CARD"] },
                  ].map((group) => (
                    <div key={group.title} className="space-y-2">
                      <h4 className="text-muted-foreground pl-1 text-[10px] font-bold tracking-widest uppercase">
                        {group.title}
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {group.methods.map((methodValue) => {
                          const option = PAYMENT_OPTIONS.find((o) => o.value === methodValue);
                          if (!option) return null;
                          const isSelected = paymentMethod === option.value;

                          return (
                            <button
                              key={option.value}
                              onClick={() => setPaymentMethod(option.value as PaymentMethod)}
                              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all duration-200 active:scale-[0.97] ${
                                isSelected
                                  ? "border-[var(--store-theme)] bg-[var(--store-theme-light-bg)] text-[var(--store-theme)] shadow-sm"
                                  : "border-border text-foreground bg-card hover:border-muted-foreground/30"
                              }`}
                            >
                              <div
                                className={`flex min-w-[32px] items-center justify-center rounded-md p-1 ${option.isImage ? "bg-card border shadow-[0_1px_3px_rgba(0,0,0,0.05)]" : isSelected ? "bg-[var(--store-theme)] text-white" : "bg-muted text-muted-foreground"}`}
                              >
                                {option.icon}
                              </div>
                              <span className="text-xs font-bold whitespace-nowrap">
                                {t("publicOrder.paymentMethods." + option.value)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bank Sub-selector (only when BANK_TRANSFER selected) */}
              {paymentMethod === "BANK_TRANSFER" && (
                <div className="space-y-2">
                  <label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                    {t("publicOrder.checkoutForm.selectBank")} *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {VA_BANKS.map((bank) => (
                      <button
                        key={bank.code}
                        onClick={() => setSelectedBankCode(bank.code)}
                        className={`flex items-center gap-2.5 rounded-lg border px-3 py-3 transition-all ${
                          selectedBankCode === bank.code
                            ? "border-[var(--store-theme)] bg-[var(--store-theme-light-bg)] shadow-sm"
                            : "border-border bg-card hover:border-muted-foreground/30"
                        }`}
                      >
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[10px] font-black text-white"
                          style={{ backgroundColor: bank.color }}
                        >
                          {bank.label.slice(0, 3)}
                        </div>
                        <span
                          className={`text-sm font-bold ${selectedBankCode === bank.code ? "text-[var(--store-theme)]" : "text-foreground"}`}
                        >
                          {bank.label}
                        </span>
                        {selectedBankCode === bank.code && (
                          <div className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-[var(--store-theme)]">
                            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-white">
                              <path
                                d="M2 6l3 3 5-5"
                                stroke="white"
                                strokeWidth="1.5"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-muted-foreground text-[10px]">
                    {t("publicOrder.checkoutForm.vaHint")}
                  </p>
                </div>
              )}

              {/* Order Notes */}
              <div className="space-y-1.5 pt-2">
                <label className="text-muted-foreground pl-1 text-[11px] font-extrabold tracking-widest uppercase">
                  {t("publicOrder.checkoutForm.notesLabel")}
                </label>
                <input
                  type="text"
                  placeholder={t("publicOrder.checkoutForm.notesPlaceholder")}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-muted/50 border-border focus:bg-card h-12 w-full rounded-xl border px-4 text-sm font-medium transition-all focus:border-transparent focus:ring-2 focus:ring-[var(--store-theme)] focus:outline-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="bg-muted space-y-4 border-t p-4">
              <div className="text-foreground flex items-center justify-between text-sm font-extrabold">
                <span>
                  {t("publicOrder.menu.subtotal")} ({cartTotals.totalCount}{" "}
                  {t("publicOrder.checkoutForm.menuUnit")})
                </span>
                <span>{formatPrice(cartTotals.subtotal)}</span>
              </div>
              <button
                onClick={handleSendOrder}
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-4 font-bold text-white shadow-md transition-transform active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
                style={{ backgroundColor: "var(--store-theme)" }}
              >
                {isSubmitting ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <>
                    <MessageSquare className="size-5" />
                    <span>{t("publicOrder.checkoutForm.payAndProcess")}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Detail / Modifier Selection Drawer */}
      {activeItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60">
          <div className="bg-card animate-in slide-in-from-bottom flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl duration-200">
            {/* Image (if exists) */}
            <div className="bg-muted relative h-44 w-full shrink-0">
              {activeItem.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeItem.imageUrl}
                  alt={activeItem.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-muted-foreground/50 flex h-full w-full items-center justify-center">
                  <Utensils className="size-12 stroke-1" />
                </div>
              )}
              <button
                onClick={() => setActiveItem(null)}
                className="absolute top-3 right-3 rounded-full bg-black/55 p-1.5 text-white transition hover:bg-black/70"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Title / Description */}
            <div className="bg-muted border-b p-4">
              <h3 className="text-foreground text-lg leading-tight font-extrabold">
                {activeItem.name}
              </h3>
              <p className="mt-1 text-sm font-black text-[var(--store-theme)]">
                {formatPrice(Number(activeItem.price))}
              </p>
              {activeItem.description && (
                <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
                  {activeItem.description}
                </p>
              )}
            </div>

            {/* Modifiers List */}
            <div className="flex-1 space-y-6 overflow-y-auto p-4">
              {((activeItem.modifiers as ModifierGroup[]) || []).map((group, groupIdx) => (
                <div key={groupIdx} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-foreground text-sm font-bold">
                      {group.name}
                      {group.isRequired && (
                        <span className="text-destructive ml-1 font-black">*</span>
                      )}
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
                              : "border-border hover:border-muted-foreground/30"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {/* Custom Checkbox/Radio styling */}
                            <div
                              className={`flex size-5 items-center justify-center rounded-md border transition-colors ${
                                isSelected
                                  ? "border-transparent bg-[var(--store-theme)]"
                                  : "border-muted-foreground/30"
                              }`}
                            >
                              {isSelected && <Check className="size-3.5 stroke-[3px] text-white" />}
                            </div>
                            <span className="text-foreground text-xs font-semibold">
                              {option.name}
                            </span>
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
            </div>

            {/* Quantity Selector & Add to Cart button */}
            <div className="bg-muted space-y-4 border-t p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  {t("publicOrder.itemDetail.quantityLabel")}
                </span>
                <div className="bg-card flex items-center gap-3 rounded-full border px-3 py-1 shadow-sm">
                  <button
                    onClick={() => itemQuantity > 1 && setItemQuantity(itemQuantity - 1)}
                    className="text-muted-foreground hover:text-foreground p-1 transition"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="text-foreground min-w-[24px] text-center text-sm font-bold">
                    {itemQuantity}
                  </span>
                  <button
                    onClick={() => setItemQuantity(itemQuantity + 1)}
                    className="text-muted-foreground hover:text-foreground p-1 transition"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                className="w-full rounded-xl py-3.5 text-center font-bold text-white shadow-md transition-transform active:scale-[0.98]"
                style={{ backgroundColor: "var(--store-theme)" }}
              >
                {t("publicOrder.itemDetail.addToCart")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
