"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Search, X, Plus, Minus, Check, ChevronRight, ShoppingCart, MessageSquare, Loader2, QrCode, CreditCard, Wallet, Banknote, Utensils, ShoppingBag, Bike } from "lucide-react";
import { getPremiumTheme } from "@/lib/utils/color";

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

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: React.ReactNode; isImage?: boolean }[] = [
  { value: "CASH", label: "Tunai", icon: <Banknote className="size-5" /> },
  { value: "QRIS", label: "QRIS", icon: <img src="/payment-logos/qris.svg" alt="QRIS" className="w-[50px] h-5 object-contain" />, isImage: true },
  { value: "GOPAY", label: "GoPay", icon: <img src="/payment-logos/gopay.svg" alt="GoPay" className="w-[50px] h-5 object-contain" />, isImage: true },
  { value: "OVO", label: "OVO", icon: <img src="/payment-logos/ovo.svg" alt="OVO" className="w-[50px] h-5 object-contain" />, isImage: true },
  { value: "DANA", label: "DANA", icon: <img src="/payment-logos/dana.svg" alt="DANA" className="w-[50px] h-5 object-contain" />, isImage: true },
  { value: "SHOPEEPAY", label: "ShopeePay", icon: <img src="/payment-logos/shopeepay.svg" alt="ShopeePay" className="w-[50px] h-5 object-contain" />, isImage: true },
  { value: "BANK_TRANSFER", label: "Transfer Bank", icon: <img src="/payment-logos/bank-transfer.svg" alt="Transfer Bank" className="w-[50px] h-5 object-contain" />, isImage: true },
  { value: "STRIPE_CARD", label: "Stripe (Card/Wallets)", icon: <img src="/payment-logos/stripe.svg" alt="Stripe" className="w-[50px] h-5 object-contain" />, isImage: true },
];

type VABankCode = "BNI" | "BRI" | "MANDIRI" | "PERMATA";

const VA_BANKS: { code: VABankCode; label: string; color: string }[] = [
  { code: "BNI", label: "BNI", color: "#FF6600" },
  { code: "BRI", label: "BRI", color: "#00529C" },
  { code: "MANDIRI", label: "Mandiri", color: "#003D79" },
  { code: "PERMATA", label: "Permata", color: "#E31E25" },
];

export function PublicMenu({ storefront, menuCategories }: PublicMenuProps) {
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

  // Check URL query parameters on mount to open cart
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("openCart") === "true") {
        setIsCartOpen(true);
        // Clean URL to prevent reopening on reload
        const newUrl = window.location.pathname;
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
    "--store-theme-light-bg": `color-mix(in srgb, ${safeTheme} 8%, white)`,
    "--store-theme-gradient": `linear-gradient(135deg, ${safeTheme}, color-mix(in srgb, ${safeTheme} 40%, black))`,
    fontFamily: storefront.fontFamily === "Mono" ? "monospace" : "var(--font-sans)",
  } as React.CSSProperties;

  // Flattened items for searching
  const allItems = useMemo(() => {
    return menuCategories.flatMap(cat => cat.items);
  }, [menuCategories]);

  // Filter categories and items based on search and selected tab
  const filteredCategories = useMemo(() => {
    return menuCategories.map(category => {
      const items = category.items.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesSearch;
      });
      return { ...category, items };
    }).filter(category => category.items.length > 0);
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
      maximumFractionDigits: 0
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
    modGroups.forEach(group => {
      initialModifiers[group.name] = [];
    });
    setSelectedModifiers(initialModifiers);
  };

  // Toggle modifier option selection
  const handleModifierChange = (groupName: string, option: ModifierOption, group: ModifierGroup) => {
    const currentSelected = selectedModifiers[groupName] || [];
    const isSelected = currentSelected.some(o => o.name === option.name);
    
    let newSelected: ModifierOption[];
    
    if (group.maxSelections === 1) {
      // Single select (radio button behavior)
      newSelected = isSelected ? [] : [option];
    } else {
      // Multi-select up to maxSelections
      if (isSelected) {
        newSelected = currentSelected.filter(o => o.name !== option.name);
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
      if (group.isRequired && (!selectedModifiers[group.name] || selectedModifiers[group.name].length === 0)) {
        alert(`Please select an option for "${group.name}"`);
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
      .map(g => `${g.groupName}:${g.options.map(o => o.name).sort().join(",")}`)
      .sort()
      .join("|");
    const uniqueId = `${activeItem.id}-${modifierKey}`;

    const existingIndex = cart.findIndex(item => item.uniqueId === uniqueId);
    
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
      setCheckoutError("Nama pelanggan wajib diisi.");
      return;
    }

    if (orderMethod === "DELIVERY" && !deliveryAddress.trim()) {
      setCheckoutError("Alamat pengantaran wajib diisi.");
      return;
    }

    if (orderMethod === "DINE_IN" && !tableNumber.trim()) {
      setCheckoutError("Nomor meja wajib diisi.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formattedItems = cart.map((i) => {
        // Flatten modifiers for API
        const modifierSelections: Array<{modifierName: string, optionName: string, priceAdd: number}> = [];
        i.selectedModifiers.forEach(group => {
          group.options.forEach(opt => {
            modifierSelections.push({
              modifierName: group.groupName,
              optionName: opt.name,
              priceAdd: opt.priceAdd
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
        setCheckoutError(data?.error?.message ?? "Gagal membuat pesanan.");
        setIsSubmitting(false);
        return;
      }

      // Clear cart
      setCart([]);
      setIsCheckoutOpen(false);
      setIsCartOpen(false);

      const { orderId, paymentUrl } = data.data;

      // Redirect to payment URL if applicable, then status page
      if (paymentUrl && paymentMethod !== "CASH") {
        window.location.href = paymentUrl;
      } else {
        router.push(`/@${storefront.slug}/order/${orderId}`);
      }
    } catch {
      setCheckoutError("Terjadi kesalahan. Silakan coba lagi.");
      setIsSubmitting(false);
    }
  };
  const updateCartQuantity = (uniqueId: string, delta: number) => {
    const updated = cart.map(item => {
      if (item.uniqueId === uniqueId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean) as CartItem[];
    setCart(updated);
  };

  return (
    <div className="flex flex-col min-h-screen" style={themeStyle}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <Link href={`/@${storefront.slug}`} className="p-1 rounded-full hover:bg-slate-100 transition">
          <ArrowLeft className="size-5 text-slate-700" />
        </Link>
        <h1 className="font-extrabold text-slate-800 text-base max-w-[200px] truncate">
          {storefront.displayName}
        </h1>
        <button 
          onClick={() => cart.length > 0 && setIsCartOpen(true)}
          className={`relative p-2 rounded-full transition ${cart.length > 0 ? "bg-[var(--store-theme-light-bg)] text-[var(--store-theme)]" : "text-slate-400"}`}
        >
          <ShoppingCart className="size-5" />
          {cartTotals.totalCount > 0 && (
            <span 
              className="absolute -top-1 -right-1 size-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shadow-md animate-bounce"
              style={{ backgroundColor: "var(--store-theme)" }}
            >
              {cartTotals.totalCount}
            </span>
          )}
        </button>
      </header>

      {/* Two-column wrapper: menu items left, cart sidebar right on desktop */}
      <div className="flex flex-1 min-h-0">
      <div className="flex flex-col flex-1 min-w-0 pb-24 md:pb-4 overflow-y-auto">

      {/* Hero Mini Banner */}
      <div className="px-6 py-8 text-white relative overflow-hidden" style={{ background: "var(--store-theme-gradient)" }}>
        <div className="absolute right-0 bottom-0 opacity-10">
          <Utensils className="size-32 opacity-20" />
        </div>
        <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-full uppercase tracking-wider">
          Menu & Order
        </span>
        <h2 className="text-2xl font-black mt-2 tracking-tight">Daftar Menu Makanan</h2>
        <p className="text-xs text-white/80 mt-1">Pilih menu favorit Anda dan selesaikan pesanan via WhatsApp.</p>
      </div>

      {/* Search Bar */}
      <div className="px-4 mt-4">
        <div className="relative">
          <Search className="text-slate-400 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari makanan atau minuman..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 border rounded-full pl-9 pr-4 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--store-theme)] border-slate-200 transition"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Categories Tabs */}
      {filteredCategories.length > 0 && (
        <div className="scrollbar-none flex gap-2 overflow-x-auto px-4 py-3 sticky top-[53px] z-20 bg-white border-b">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors shrink-0 ${
              selectedCategory === "all"
                ? "bg-[var(--store-theme)] text-white border-transparent shadow-sm"
                : "bg-slate-50 text-slate-600 border-slate-200"
            }`}
          >
            Semua ({allItems.length})
          </button>
          {filteredCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors shrink-0 ${
                selectedCategory === cat.id
                  ? "bg-[var(--store-theme)] text-white border-transparent shadow-sm"
                  : "bg-slate-50 text-slate-600 border-slate-200"
              }`}
            >
              {cat.name} ({cat.items.length})
            </button>
          ))}
        </div>
      )}

      {/* Menu Items Grid */}
      <div className="px-4 mt-4 space-y-8 flex-1">
        {filteredCategories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Utensils className="size-10 mb-2 stroke-1" />
            <p className="text-sm font-medium">Menu tidak ditemukan</p>
          </div>
        ) : (
          filteredCategories
            .filter(cat => selectedCategory === "all" || cat.id === selectedCategory)
            .map(category => (
              <div key={category.id} className="space-y-3">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest border-l-4 border-[var(--store-theme)] pl-2">
                  {category.name}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {category.items.map(item => (
                    <div 
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={`flex gap-3 p-3 border rounded-xl bg-white shadow-sm transition active:scale-[0.99] cursor-pointer ${
                        item.isAvailable ? "hover:border-slate-300" : "opacity-60 hover:border-transparent select-none"
                      }`}
                    >
                      {/* Image */}
                      <div className="size-20 bg-slate-100 rounded-lg overflow-hidden shrink-0 relative flex items-center justify-center">
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img 
                            src={item.imageUrl} 
                            alt={item.name} 
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Utensils className="size-6 text-slate-300" />
                        )}
                        {!item.isAvailable && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider px-1 py-0.5 rounded">
                              Habis
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start gap-1">
                            <h4 className="font-bold text-sm text-slate-800 line-clamp-1">{item.name}</h4>
                            {item.isFeatured && (
                              <span className="text-[9px] font-extrabold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                Fav
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="font-extrabold text-sm text-slate-800">
                            {formatPrice(Number(item.price))}
                          </span>
                          {item.isAvailable && (
                            <div className="size-7 rounded-full bg-slate-50 border flex items-center justify-center hover:bg-[var(--store-theme-light-bg)] hover:border-[var(--store-theme)] transition">
                              <Plus className="size-4 text-slate-600" />
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

      </div>{/* end scrollable menu column */}

      {/* Desktop cart sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-80 md:border-l md:bg-slate-50/50 md:sticky md:top-[57px] md:h-[calc(100vh-57px)] md:overflow-y-auto md:shrink-0">
        <div className="p-4 border-b bg-white flex items-center gap-2">
          <ShoppingCart className="size-4 text-[var(--store-theme)]" />
          <span className="font-black text-slate-800 text-sm">Pesanan Anda</span>
          {cartTotals.totalCount > 0 && (
            <span className="ml-auto text-xs font-bold text-[var(--store-theme)]">
              {cartTotals.totalCount} item
            </span>
          )}
        </div>
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-slate-400 py-12">
            <ShoppingCart className="size-10 stroke-1" />
            <p className="text-sm font-medium">Keranjang kosong</p>
            <p className="text-xs text-center px-4">Pilih menu di sebelah kiri untuk menambahkan pesanan</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map((item) => {
                const modsCost = item.selectedModifiers.reduce((s, g) => s + g.options.reduce((oSum, o) => oSum + o.priceAdd, 0), 0);
                const singleTotal = item.price + modsCost;
                return (
                  <div key={item.uniqueId} className="flex justify-between items-start gap-3 pb-3 border-b last:border-0">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xs text-slate-800 truncate">{item.name}</h4>
                      <p className="font-extrabold text-xs text-[var(--store-theme)] mt-0.5">{formatPrice(singleTotal)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 border rounded-full px-2 py-1 bg-white shadow-sm shrink-0">
                      <button onClick={() => updateCartQuantity(item.uniqueId, -1)} className="p-0.5 text-slate-400 hover:text-rose-500">
                        <Minus className="size-3" />
                      </button>
                      <span className="text-xs font-bold text-slate-800 min-w-[16px] text-center">{item.quantity}</span>
                      <button onClick={() => updateCartQuantity(item.uniqueId, 1)} className="p-0.5 text-slate-400 hover:text-[var(--store-theme)]">
                        <Plus className="size-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-4 border-t bg-white space-y-3">
              <div className="flex justify-between text-sm font-extrabold text-slate-800">
                <span>Subtotal</span>
                <span>{formatPrice(cartTotals.subtotal)}</span>
              </div>
              <button
                onClick={() => {
                  setIsCartOpen(false);
                  setIsCheckoutOpen(true);
                }}
                className="w-full py-3 rounded-xl font-bold text-white shadow-md text-sm transition-transform active:scale-[0.98]"
                style={{ backgroundColor: "var(--store-theme)" }}
              >
                Lanjutkan ke Checkout
              </button>
            </div>
          </>
        )}
      </aside>

      </div>{/* end two-column wrapper */}

      {/* Sticky Floating Cart Bar — mobile only */}
      {cart.length > 0 && !isCartOpen && (
        <div className="md:hidden fixed bottom-4 left-4 right-4 max-w-md mx-auto z-40">
          <div 
            onClick={() => setIsCartOpen(true)}
            className="flex items-center justify-between w-full p-4 rounded-2xl shadow-xl text-white transition-transform active:scale-[0.98] cursor-pointer"
            style={{ backgroundColor: "var(--store-theme)" }}
          >
            <div className="flex items-center gap-3">
              <div className="relative p-2 rounded-lg bg-white/20">
                <ShoppingCart className="size-5" />
                <span className="absolute -top-1.5 -right-1.5 size-5 bg-white text-[var(--store-theme)] rounded-full text-[10px] font-bold flex items-center justify-center">
                  {cartTotals.totalCount}
                </span>
              </div>
              <div className="text-left">
                <p className="text-[10px] text-white/80 font-bold uppercase tracking-wider">Keranjang Belanja</p>
                <p className="text-sm font-black">{formatPrice(cartTotals.subtotal)}</p>
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); setIsCheckoutOpen(true); }} className="flex items-center gap-1 font-bold text-xs bg-white/20 px-3 py-1.5 rounded-lg z-10">
              <span>Checkout</span>
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Cart Drawer — mobile only (desktop uses sidebar) */}
      {isCartOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <ShoppingCart className="size-5 text-[var(--store-theme)]" />
                <h3 className="font-black text-slate-800 text-sm">Pesanan Anda</h3>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="p-1 rounded-full hover:bg-slate-200 transition text-slate-400"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {cart.map((item) => {
                const modsCost = item.selectedModifiers.reduce((s, g) => s + g.options.reduce((oSum, o) => oSum + o.priceAdd, 0), 0);
                const singleTotal = item.price + modsCost;

                return (
                  <div key={item.uniqueId} className="flex justify-between items-start gap-4 pb-4 border-b last:border-0 last:pb-0">
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-slate-800">{item.name}</h4>
                      {item.selectedModifiers.map((group, gIdx) => (
                        <p key={gIdx} className="text-[10px] text-slate-400 mt-0.5">
                          <span className="font-semibold">{group.groupName}:</span>{" "}
                          {group.options.map(o => `${o.name} (+${formatPrice(o.priceAdd)})`).join(", ")}
                        </p>
                      ))}
                      <p className="font-extrabold text-xs text-slate-700 mt-1">
                        {formatPrice(singleTotal)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 border rounded-full px-2 py-1 bg-slate-50 shadow-inner">
                      <button 
                        onClick={() => updateCartQuantity(item.uniqueId, -1)}
                        className="p-1 text-slate-500 hover:text-rose-500 transition"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="text-xs font-bold text-slate-800 min-w-[20px] text-center">
                        {item.quantity}
                      </span>
                      <button 
                        onClick={() => updateCartQuantity(item.uniqueId, 1)}
                        className="p-1 text-slate-500 hover:text-[var(--store-theme)] transition"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Summary */}
            <div className="p-4 border-t bg-slate-50 space-y-4">
              <div className="flex justify-between items-center text-sm font-extrabold text-slate-800">
                <span>Subtotal</span>
                <span>{formatPrice(cartTotals.subtotal)}</span>
              </div>
              <button
                onClick={() => {
                  setIsCartOpen(false);
                  setIsCheckoutOpen(true);
                }}
                className="w-full py-3.5 rounded-xl font-bold text-white shadow-md text-center transition-transform active:scale-[0.98]"
                style={{ backgroundColor: "var(--store-theme)" }}
              >
                Lanjutkan ke Informasi Pemesan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Drawer */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-5 text-[var(--store-theme)]" />
                <h3 className="font-black text-slate-800 text-sm">Informasi Pemesan</h3>
              </div>
              <button 
                onClick={() => setIsCheckoutOpen(false)}
                className="p-1 rounded-full hover:bg-slate-200 transition text-slate-400"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {checkoutError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg text-sm font-semibold">
                  {checkoutError}
                </div>
              )}

              {/* Customer Name */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest pl-1">Nama Anda *</label>
                <input
                  type="text"
                  placeholder="Masukkan nama lengkap..."
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full h-12 bg-slate-50/50 border border-slate-200 rounded-xl px-4 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--store-theme)] focus:border-transparent transition-all"
                  required
                />
              </div>

              {/* Customer Phone */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest pl-1">Nomor WhatsApp</label>
                <input
                  type="tel"
                  placeholder="Contoh: 08123456789 (Opsional)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full h-12 bg-slate-50/50 border border-slate-200 rounded-xl px-4 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--store-theme)] focus:border-transparent transition-all"
                />
              </div>

              {/* Order Method */}
              <div className="space-y-2 pt-2">
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest pl-1">Metode Pesanan *</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { key: "DINE_IN", label: "Makan Sini", icon: <Utensils className="size-4 mb-1.5" /> },
                    { key: "TAKEAWAY", label: "Bungkus", icon: <ShoppingBag className="size-4 mb-1.5" /> },
                    { key: "DELIVERY", label: "Delivery", icon: <Bike className="size-4 mb-1.5" /> }
                  ].map(method => (
                    <button
                      key={method.key}
                      onClick={() => setOrderMethod(method.key as any)}
                      className={`relative flex flex-col items-center justify-center p-3 border rounded-xl transition-all duration-200 active:scale-[0.96] ${
                        orderMethod === method.key
                          ? "border-[var(--store-theme)] text-[var(--store-theme)] bg-[var(--store-theme-light-bg)] shadow-sm"
                          : "border-slate-200 text-slate-500 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {method.icon}
                      <span className="text-[11px] font-bold">{method.label}</span>
                      
                      {orderMethod === method.key && (
                        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[var(--store-theme)] rounded-full flex items-center justify-center shadow-sm">
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
                    <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest pl-1">Nomor Meja *</label>
                    <input
                      type="text"
                      placeholder="Contoh: Meja 4, Meja A2..."
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      className="w-full h-12 bg-slate-50/50 border border-slate-200 rounded-xl px-4 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--store-theme)] focus:border-transparent transition-all"
                      required
                    />
                  </div>
                )}

                {orderMethod === "DELIVERY" && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest pl-1">Alamat Lengkap *</label>
                    <textarea
                      placeholder="Tulis alamat pengantaran lengkap dengan patokan..."
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      rows={3}
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-xl p-4 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--store-theme)] focus:border-transparent transition-all resize-none"
                      required
                    />
                  </div>
                )}
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-3 pt-2">
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest pl-1">Metode Pembayaran *</label>
                
                <div className="space-y-4">
                  {[
                    { title: "Bayar di Kasir", methods: ["CASH"] },
                    { title: "Instant & E-Wallet", methods: ["QRIS", "GOPAY", "OVO", "DANA", "SHOPEEPAY"] },
                    { title: "Virtual Account", methods: ["BANK_TRANSFER"] },
                    { title: "Kartu Kredit / Debit", methods: ["STRIPE_CARD"] }
                  ].map((group) => (
                    <div key={group.title} className="space-y-2">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">{group.title}</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {group.methods.map((methodValue) => {
                          const option = PAYMENT_OPTIONS.find(o => o.value === methodValue);
                          if (!option) return null;
                          const isSelected = paymentMethod === option.value;
                          
                          return (
                            <button
                              key={option.value}
                              onClick={() => setPaymentMethod(option.value as PaymentMethod)}
                              className={`flex items-center gap-2.5 px-3 py-2.5 border rounded-xl transition-all duration-200 active:scale-[0.97] ${
                                isSelected
                                  ? "border-[var(--store-theme)] bg-[var(--store-theme-light-bg)] text-[var(--store-theme)] shadow-sm"
                                  : "border-slate-200 text-slate-700 bg-white hover:border-slate-300"
                              }`}
                            >
                              <div className={`p-1 rounded-md flex items-center justify-center min-w-[32px] ${option.isImage ? "bg-white border shadow-[0_1px_3px_rgba(0,0,0,0.05)]" : isSelected ? "bg-[var(--store-theme)] text-white" : "bg-slate-100 text-slate-500"}`}>
                                {option.icon}
                              </div>
                              <span className="text-xs font-bold whitespace-nowrap">{option.label}</span>
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
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pilih Bank *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {VA_BANKS.map((bank) => (
                      <button
                        key={bank.code}
                        onClick={() => setSelectedBankCode(bank.code)}
                        className={`flex items-center gap-2.5 px-3 py-3 border rounded-lg transition-all ${
                          selectedBankCode === bank.code
                            ? "border-[var(--store-theme)] bg-[var(--store-theme-light-bg)] shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-md flex items-center justify-center text-white text-[10px] font-black shrink-0"
                          style={{ backgroundColor: bank.color }}
                        >
                          {bank.label.slice(0, 3)}
                        </div>
                        <span className={`text-sm font-bold ${selectedBankCode === bank.code ? "text-[var(--store-theme)]" : "text-slate-700"}`}>
                          {bank.label}
                        </span>
                        {selectedBankCode === bank.code && (
                          <div className="ml-auto w-4 h-4 rounded-full bg-[var(--store-theme)] flex items-center justify-center">
                            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 fill-white"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400">Nomor Virtual Account akan ditampilkan setelah pesanan dibuat.</p>
                </div>
              )}

              {/* Order Notes */}
              <div className="space-y-1.5 pt-2">
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest pl-1">Catatan Tambahan (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: Es batu sedikit, pedas sedang..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full h-12 bg-slate-50/50 border border-slate-200 rounded-xl px-4 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--store-theme)] focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-slate-50 space-y-4">
              <div className="flex justify-between items-center text-sm font-extrabold text-slate-800">
                <span>Subtotal ({cartTotals.totalCount} Menu)</span>
                <span>{formatPrice(cartTotals.subtotal)}</span>
              </div>
              <button
                onClick={handleSendOrder}
                disabled={isSubmitting}
                className="w-full py-4 rounded-xl font-bold text-white shadow-md flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
                style={{ backgroundColor: "var(--store-theme)" }}
              >
                {isSubmitting ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <>
                    <MessageSquare className="size-5" />
                    <span>Bayar & Proses Pesanan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Detail / Modifier Selection Drawer */}
      {activeItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            {/* Image (if exists) */}
            <div className="relative h-44 w-full bg-slate-100 shrink-0">
              {activeItem.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={activeItem.imageUrl} 
                  alt={activeItem.name} 
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-slate-300">
                  <Utensils className="size-12 stroke-1" />
                </div>
              )}
              <button 
                onClick={() => setActiveItem(null)}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-black/55 hover:bg-black/70 text-white transition"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Title / Description */}
            <div className="p-4 border-b bg-slate-50">
              <h3 className="font-extrabold text-slate-800 text-lg leading-tight">{activeItem.name}</h3>
              <p className="font-black text-[var(--store-theme)] text-sm mt-1">{formatPrice(Number(activeItem.price))}</p>
              {activeItem.description && (
                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">{activeItem.description}</p>
              )}
            </div>

            {/* Modifiers List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {((activeItem.modifiers as ModifierGroup[]) || []).map((group, groupIdx) => (
                <div key={groupIdx} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-sm text-slate-800">
                      {group.name}
                      {group.isRequired && <span className="text-rose-500 ml-1 font-black">*</span>}
                    </h4>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                      {group.isRequired ? "Wajib" : "Opsional"}
                    </span>
                  </div>
                  
                  <div className="grid gap-2">
                    {group.options.map((option, optIdx) => {
                      const isSelected = (selectedModifiers[group.name] || []).some(o => o.name === option.name);
                      
                      return (
                        <div 
                          key={optIdx}
                          onClick={() => handleModifierChange(group.name, option, group)}
                          className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition ${
                            isSelected 
                              ? "border-[var(--store-theme)] bg-[var(--store-theme-light-bg)]" 
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {/* Custom Checkbox/Radio styling */}
                            <div className={`size-5 rounded-md border flex items-center justify-center transition-colors ${
                              isSelected 
                                ? "bg-[var(--store-theme)] border-transparent" 
                                : "border-slate-300"
                            }`}>
                              {isSelected && <Check className="size-3.5 text-white stroke-[3px]" />}
                            </div>
                            <span className="text-xs font-semibold text-slate-700">{option.name}</span>
                          </div>
                          <span className="text-xs font-bold text-slate-500">
                            {option.priceAdd > 0 ? `+${formatPrice(option.priceAdd)}` : "Gratis"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Quantity Selector & Add to Cart button */}
            <div className="p-4 border-t bg-slate-50 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Jumlah Pesanan</span>
                <div className="flex items-center gap-3 border rounded-full px-3 py-1 bg-white shadow-sm">
                  <button 
                    onClick={() => itemQuantity > 1 && setItemQuantity(itemQuantity - 1)}
                    className="p-1 text-slate-400 hover:text-slate-600 transition"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="text-sm font-bold text-slate-800 min-w-[24px] text-center">
                    {itemQuantity}
                  </span>
                  <button 
                    onClick={() => setItemQuantity(itemQuantity + 1)}
                    className="p-1 text-slate-400 hover:text-slate-600 transition"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>
              
              <button
                onClick={handleAddToCart}
                className="w-full py-3.5 rounded-xl font-bold text-white shadow-md text-center transition-transform active:scale-[0.98]"
                style={{ backgroundColor: "var(--store-theme)" }}
              >
                Tambahkan ke Keranjang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
