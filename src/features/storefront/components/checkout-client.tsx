"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Loader2,
  QrCode,
  CreditCard,
  Wallet,
  Banknote,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  currency: string;
  modifierSelections?: Array<{
    modifierName: string;
    optionName: string;
    priceAdd: number;
  }>;
}

interface MenuItemData {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  imageUrl: string | null;
  isAvailable: boolean;
  modifiers: unknown;
}

interface MenuCategoryData {
  id: string;
  name: string;
  items: MenuItemData[];
}

interface CheckoutClientProps {
  storefront: {
    id: string;
    slug: string;
    displayName: string;
    themeColor: string;
    fontFamily: string;
    whatsappNumber: string | null;
  };
  menuCategories: MenuCategoryData[];
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

type OrderType = "DINE_IN" | "TAKEAWAY" | "DELIVERY";

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: "CASH", label: "Tunai / Cash", icon: <Banknote className="size-4" /> },
  { value: "QRIS", label: "QRIS", icon: <QrCode className="size-4" /> },
  { value: "GOPAY", label: "GoPay", icon: <Wallet className="size-4" /> },
  { value: "OVO", label: "OVO", icon: <Wallet className="size-4" /> },
  { value: "DANA", label: "DANA", icon: <Wallet className="size-4" /> },
  { value: "SHOPEEPAY", label: "ShopeePay", icon: <Wallet className="size-4" /> },
  { value: "BANK_TRANSFER", label: "Transfer Bank", icon: <CreditCard className="size-4" /> },
  { value: "STRIPE_CARD", label: "Kartu Kredit/Debit", icon: <CreditCard className="size-4" /> },
];

export function CheckoutClient({ storefront, menuCategories }: CheckoutClientProps) {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("DINE_IN");
  const [tableNumber, setTableNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [notes, setNotes] = useState("");

  const themeStyle = {
    "--store-theme": storefront.themeColor,
    fontFamily: storefront.fontFamily === "Mono" ? "monospace" : "var(--font-sans)",
  } as React.CSSProperties;

  // Load cart from localStorage (shared with menu page)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`cart_${storefront.slug}`);
      if (saved) setCart(JSON.parse(saved));
    } catch {
      // ignore
    }
  }, [storefront.slug]);

  // Persist cart
  useEffect(() => {
    try {
      if (cart.length > 0) {
        localStorage.setItem(`cart_${storefront.slug}`, JSON.stringify(cart));
      } else {
        localStorage.removeItem(`cart_${storefront.slug}`);
      }
    } catch {
      // ignore
    }
  }, [cart, storefront.slug]);

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const modTotal = (item.modifierSelections ?? []).reduce(
        (s, m) => s + m.priceAdd,
        0
      );
      return sum + (item.price + modTotal) * item.quantity;
    }, 0);
  }, [cart]);

  const currency = cart[0]?.currency ?? "IDR";

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
    }).format(amount);

  const updateQty = (menuItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.menuItemId === menuItemId
            ? { ...i, quantity: i.quantity + delta }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const addFromMenu = (item: MenuItemData) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
          currency: item.currency,
        },
      ];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (cart.length === 0) {
      setError("Tambahkan minimal 1 item ke keranjang.");
      return;
    }
    if (!customerName.trim()) {
      setError("Nama pelanggan wajib diisi.");
      return;
    }
    if (orderType === "DINE_IN" && !tableNumber.trim()) {
      setError("Nomor meja wajib diisi untuk Dine In.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/public/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storefrontSlug: storefront.slug,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim() || undefined,
          orderType,
          tableNumber: tableNumber.trim() || undefined,
          paymentMethod,
          notes: notes.trim() || undefined,
          items: cart.map((i) => ({
            menuItemId: i.menuItemId,
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.price,
            modifierSelections: i.modifierSelections ?? [],
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error?.message ?? "Gagal membuat pesanan.");
        return;
      }

      // Clear cart
      setCart([]);
      localStorage.removeItem(`cart_${storefront.slug}`);

      const { orderId, paymentUrl, qrString } = data.data;

      // Redirect to payment URL if applicable, then status page
      if (paymentUrl && paymentMethod !== "CASH") {
        window.location.href = paymentUrl;
      } else {
        router.push(`/@${storefront.slug}/order/${orderId}`);
      }
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50" style={themeStyle}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href={`/@${storefront.slug}/menu`} className="p-1 rounded-full hover:bg-slate-100 transition">
          <ArrowLeft className="size-5 text-slate-700" />
        </Link>
        <h1 className="font-bold text-slate-800 text-base flex-1 truncate">Checkout</h1>
        <span className="text-sm text-slate-500 font-medium">{storefront.displayName}</span>
      </header>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-6">
        {/* Cart Items */}
        <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-3 border-b cursor-pointer"
            onClick={() => setShowMenu(!showMenu)}
          >
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <ShoppingCart className="size-4" />
              Keranjang ({cart.length} item)
            </h2>
            {showMenu ? (
              <ChevronUp className="size-4 text-slate-500" />
            ) : (
              <ChevronDown className="size-4 text-slate-500" />
            )}
          </div>

          {cart.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-500 text-sm">
              Keranjang kosong.{" "}
              <Link
                href={`/@${storefront.slug}/menu`}
                className="underline"
                style={{ color: "var(--store-theme)" }}
              >
                Kembali ke menu
              </Link>
            </div>
          ) : (
            <ul className="divide-y">
              {cart.map((item) => (
                <li key={item.menuItemId} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                    <p className="text-xs text-slate-500">{formatPrice(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQty(item.menuItemId, -1)}
                      className="size-7 rounded-full border flex items-center justify-center hover:bg-slate-100 transition"
                    >
                      {item.quantity === 1 ? (
                        <Trash2 className="size-3 text-red-500" />
                      ) : (
                        <Minus className="size-3" />
                      )}
                    </button>
                    <span className="w-5 text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => updateQty(item.menuItemId, 1)}
                      className="size-7 rounded-full flex items-center justify-center text-white transition"
                      style={{ backgroundColor: "var(--store-theme)" }}
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                  <span className="text-sm font-semibold text-slate-800 w-20 text-right tabular-nums">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Add items shortcut */}
          {showMenu && (
            <div className="border-t">
              {menuCategories.map((cat) =>
                cat.items.length === 0 ? null : (
                  <div key={cat.id}>
                    <p className="px-4 pt-3 pb-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {cat.name}
                    </p>
                    {cat.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => addFromMenu(item)}
                        className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50 transition text-left"
                      >
                        <span className="text-sm text-slate-700">{item.name}</span>
                        <span className="text-sm font-medium" style={{ color: "var(--store-theme)" }}>
                          {formatPrice(item.price)}
                        </span>
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </section>

        {/* Order Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="bg-white rounded-xl border shadow-sm p-4 space-y-4">
            <h2 className="font-semibold text-slate-800">Detail Pemesan</h2>

            <div className="space-y-2">
              <Label htmlFor="name">Nama *</Label>
              <Input
                id="name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nama kamu"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">No. WhatsApp (opsional)</Label>
              <Input
                id="phone"
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="08xx-xxxx-xxxx"
              />
            </div>
          </section>

          <section className="bg-white rounded-xl border shadow-sm p-4 space-y-4">
            <h2 className="font-semibold text-slate-800">Metode Pesanan</h2>

            <div className="grid grid-cols-3 gap-2">
              {(["DINE_IN", "TAKEAWAY", "DELIVERY"] as OrderType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setOrderType(type)}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border transition ${
                    orderType === type
                      ? "text-white border-transparent"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}
                  style={
                    orderType === type
                      ? { backgroundColor: "var(--store-theme)", borderColor: "var(--store-theme)" }
                      : {}
                  }
                >
                  {type === "DINE_IN" ? "Dine In" : type === "TAKEAWAY" ? "Takeaway" : "Delivery"}
                </button>
              ))}
            </div>

            {orderType === "DINE_IN" && (
              <div className="space-y-2">
                <Label htmlFor="table">Nomor Meja *</Label>
                <Input
                  id="table"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="Contoh: 5"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Catatan (opsional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Alergi, permintaan khusus, dll."
                rows={2}
                className="resize-none"
              />
            </div>
          </section>

          <section className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
            <h2 className="font-semibold text-slate-800">Metode Pembayaran</h2>

            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPaymentMethod(opt.value)}
                  className={`flex items-center gap-2 py-2 px-3 rounded-lg text-sm border transition ${
                    paymentMethod === opt.value
                      ? "text-white border-transparent"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}
                  style={
                    paymentMethod === opt.value
                      ? { backgroundColor: "var(--store-theme)", borderColor: "var(--store-theme)" }
                      : {}
                  }
                >
                  {opt.icon}
                  <span className="truncate">{opt.label}</span>
                </button>
              ))}
            </div>
          </section>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Order Summary */}
          <div className="bg-white rounded-xl border shadow-sm px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Total Pembayaran</p>
              <p className="text-xl font-bold text-slate-900">{formatPrice(subtotal)}</p>
            </div>
            <Button
              type="submit"
              disabled={isLoading || cart.length === 0}
              className="px-6 py-3 text-white font-semibold rounded-xl transition disabled:opacity-50"
              style={{ backgroundColor: "var(--store-theme)" }}
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Pesan Sekarang"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
