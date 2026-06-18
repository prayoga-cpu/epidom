"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Minus, Check, ShoppingCart, Utensils } from "lucide-react";
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
  price: any;
  currency: string;
  imageUrl: string | null;
  isAvailable: boolean;
  isFeatured: boolean;
  modifiers: any;
}

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
}

export function PublicItemDetail({ storefront, item }: PublicItemDetailProps) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, ModifierOption[]>>({});
  
  // Theme styling
  const safeTheme = getPremiumTheme(storefront.themeColor || "#FF6B35");
  const themeStyle = {
    "--store-theme": safeTheme,
    "--store-theme-light-bg": `color-mix(in srgb, ${safeTheme} 8%, white)`,
    fontFamily: storefront.fontFamily === "Mono" ? "monospace" : "var(--font-sans)",
  } as React.CSSProperties;

  // Format price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  // Initialize modifiers
  useEffect(() => {
    const initialModifiers: Record<string, ModifierOption[]> = {};
    const modGroups = (item.modifiers as ModifierGroup[]) || [];
    modGroups.forEach(group => {
      initialModifiers[group.name] = [];
    });
    setSelectedModifiers(initialModifiers);
  }, [item]);

  // Handle modifier selection
  const handleModifierChange = (groupName: string, option: ModifierOption, group: ModifierGroup) => {
    const currentSelected = selectedModifiers[groupName] || [];
    const isSelected = currentSelected.some(o => o.name === option.name);
    
    let newSelected: ModifierOption[];
    
    if (group.maxSelections === 1) {
      newSelected = isSelected ? [] : [option];
    } else {
      if (isSelected) {
        newSelected = currentSelected.filter(o => o.name !== option.name);
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
    const modGroups = (item.modifiers as ModifierGroup[]) || [];
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

    // Create unique key
    const modifierKey = formattedModifiers
      .map(g => `${g.groupName}:${g.options.map(o => o.name).sort().join(",")}`)
      .sort()
      .join("|");
    const uniqueId = `${item.id}-${modifierKey}`;

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

    const existingIndex = localCart.findIndex(cartItem => cartItem.uniqueId === uniqueId);
    
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
    <div className="flex flex-col min-h-screen pb-24" style={themeStyle}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <Link href={`/@${storefront.slug}/menu`} className="p-1 rounded-full hover:bg-slate-100 transition">
          <ArrowLeft className="size-5 text-slate-700" />
        </Link>
        <span className="font-extrabold text-slate-800 text-sm">
          Detail Menu
        </span>
        <div className="size-8" /> {/* Spacer */}
      </header>

      {/* Main image */}
      <div className="relative h-64 w-full bg-slate-100 flex items-center justify-center">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img 
            src={item.imageUrl} 
            alt={item.name} 
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-slate-300">
            <Utensils className="size-16 stroke-1" />
          </div>
        )}
      </div>

      {/* Item info */}
      <div className="p-4 border-b bg-white">
        <div className="flex justify-between items-start gap-2">
          <h1 className="text-xl font-extrabold text-slate-800 leading-tight">{item.name}</h1>
          {item.isFeatured && (
            <span className="text-[10px] font-extrabold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Favorit
            </span>
          )}
        </div>
        <p className="font-black text-[var(--store-theme)] text-base mt-1">
          {formatPrice(Number(item.price))}
        </p>
        {item.description && (
          <p className="text-xs text-slate-500 mt-3 leading-relaxed">
            {item.description}
          </p>
        )}
      </div>

      {/* Modifiers Selection */}
      <div className="p-4 space-y-6 flex-1 bg-slate-50/50">
        {((item.modifiers as ModifierGroup[]) || []).map((group, groupIdx) => (
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
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
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

      {/* Floating purchase action bar */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t p-4 z-40 shadow-lg">
        <div className="flex items-center justify-between gap-4">
          {/* Quantity Selector */}
          <div className="flex items-center gap-3 border rounded-full px-3 py-1.5 bg-slate-50">
            <button 
              onClick={() => quantity > 1 && setQuantity(quantity - 1)}
              className="p-1 text-slate-400 hover:text-slate-600 transition"
            >
              <Minus className="size-4" />
            </button>
            <span className="text-sm font-bold text-slate-800 min-w-[24px] text-center">
              {quantity}
            </span>
            <button 
              onClick={() => setQuantity(quantity + 1)}
              className="p-1 text-slate-400 hover:text-slate-600 transition"
            >
              <Plus className="size-4" />
            </button>
          </div>

          {/* Add Button */}
          <button
            onClick={handleAddToCart}
            className="flex-1 py-3.5 rounded-full font-bold text-white shadow-md flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
            style={{ backgroundColor: "var(--store-theme)" }}
          >
            <ShoppingCart className="size-5" />
            <span>Masukkan Keranjang</span>
          </button>
        </div>
      </div>
    </div>
  );
}
