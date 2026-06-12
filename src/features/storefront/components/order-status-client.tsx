"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ArrowLeft,
  MessageCircle,
  RefreshCw,
  ChefHat,
  PackageCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";

type OrderStatus = "PENDING" | "CONFIRMED" | "IN_PRODUCTION" | "READY" | "DELIVERED" | "CANCELLED";
type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED";
type OrderType = "DINE_IN" | "TAKEAWAY" | "DELIVERY";
type PaymentMethod =
  | "CASH"
  | "QRIS"
  | "GOPAY"
  | "OVO"
  | "DANA"
  | "SHOPEEPAY"
  | "BANK_TRANSFER"
  | "STRIPE_CARD";

interface OrderItem {
  id: string;
  name: string;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface OrderStatusClientProps {
  storefront: {
    slug: string;
    displayName: string;
    themeColor: string;
    whatsappNumber: string | null;
  };
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    paymentMethod: PaymentMethod;
    customerName: string;
    orderType: OrderType;
    tableNumber: string | null;
    notes: string | null;
    total: number;
    currency: string;
    createdAt: string;
    paymentQrString?: string | null;
    items: OrderItem[];
  };
}

const STATUS_CONFIG: Record<
  OrderStatus,
  { icon: React.ReactNode; label: string; color: string; description: string }
> = {
  PENDING: {
    icon: <Clock className="size-8" />,
    label: "Menunggu Konfirmasi",
    color: "text-amber-500",
    description: "Pesanan kamu sedang menunggu konfirmasi dari penjual.",
  },
  CONFIRMED: {
    icon: <CheckCircle2 className="size-8" />,
    label: "Dikonfirmasi",
    color: "text-blue-500",
    description: "Pesanan kamu sudah dikonfirmasi dan sedang diproses.",
  },
  IN_PRODUCTION: {
    icon: <ChefHat className="size-8" />,
    label: "Sedang Dibuat",
    color: "text-orange-500",
    description: "Pesanan kamu sedang disiapkan oleh dapur.",
  },
  READY: {
    icon: <PackageCheck className="size-8" />,
    label: "Siap",
    color: "text-green-500",
    description: "Pesanan kamu sudah siap! Silahkan ambil pesananmu.",
  },
  DELIVERED: {
    icon: <CheckCircle2 className="size-8" />,
    label: "Selesai",
    color: "text-green-600",
    description: "Pesanan telah selesai. Selamat menikmati!",
  },
  CANCELLED: {
    icon: <XCircle className="size-8" />,
    label: "Dibatalkan",
    color: "text-red-500",
    description: "Pesanan ini telah dibatalkan.",
  },
};

const PAYMENT_STATUS_CONFIG: Record<
  PaymentStatus,
  { label: string; color: string }
> = {
  PENDING: { label: "Menunggu Pembayaran", color: "text-amber-600 bg-amber-50 border-amber-200" },
  PAID: { label: "Lunas", color: "text-green-700 bg-green-50 border-green-200" },
  FAILED: { label: "Gagal", color: "text-red-700 bg-red-50 border-red-200" },
  EXPIRED: { label: "Kedaluwarsa", color: "text-slate-600 bg-slate-50 border-slate-200" },
  REFUNDED: { label: "Dikembalikan", color: "text-purple-700 bg-purple-50 border-purple-200" },
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  GOPAY: "GoPay",
  OVO: "OVO",
  DANA: "DANA",
  SHOPEEPAY: "ShopeePay",
  BANK_TRANSFER: "Transfer Bank",
  STRIPE_CARD: "Kartu Kredit/Debit",
};

export function OrderStatusClient({ storefront, order }: OrderStatusClientProps) {
  const [currentStatus, setCurrentStatus] = useState(order.status);
  const [currentPaymentStatus, setCurrentPaymentStatus] = useState(order.paymentStatus);
  const [isPolling, setIsPolling] = useState(true);
  const [lastPollAt, setLastPollAt] = useState<Date>(new Date());

  const themeStyle = {
    "--store-theme": storefront.themeColor,
  } as React.CSSProperties;

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: order.currency,
      minimumFractionDigits: 0,
    }).format(amount);

  // Poll for status updates every 10 seconds if order is in a non-terminal state
  useEffect(() => {
    const isTerminal =
      currentStatus === "DELIVERED" ||
      currentStatus === "CANCELLED" ||
      currentPaymentStatus === "FAILED" ||
      currentPaymentStatus === "EXPIRED";

    if (isTerminal) {
      setIsPolling(false);
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/public/orders/${order.id}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.data) {
            setCurrentStatus(data.data.status);
            setCurrentPaymentStatus(data.data.paymentStatus);
            setLastPollAt(new Date());
          }
        }
      } catch {
        // silently ignore poll errors
      }
    }, 2_000);

    return () => clearInterval(interval);
  }, [currentStatus, currentPaymentStatus, order.id]);

  const statusInfo = STATUS_CONFIG[currentStatus];
  const paymentInfo = PAYMENT_STATUS_CONFIG[currentPaymentStatus];

  const whatsappContactUrl = storefront.whatsappNumber
    ? `https://wa.me/${storefront.whatsappNumber.replace(/\D/g, "").replace(/^0/, "62")}?text=${encodeURIComponent(
        `Halo! Saya ingin tanya mengenai pesanan ${order.orderNumber}.`
      )}`
    : null;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50" style={themeStyle}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link
          href={`/@${storefront.slug}`}
          className="p-1 rounded-full hover:bg-slate-100 transition"
        >
          <ArrowLeft className="size-5 text-slate-700" />
        </Link>
        <h1 className="font-bold text-slate-800 text-base flex-1 truncate">Status Pesanan</h1>
        <span className="text-xs text-slate-400 font-mono">{order.orderNumber}</span>
      </header>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-5">
        {/* Status Card */}
        <div className="bg-white rounded-2xl border shadow-sm p-6 text-center space-y-3">
          <div className={`flex justify-center ${statusInfo.color}`}>
            {statusInfo.icon}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{statusInfo.label}</h2>
            <p className="text-sm text-slate-500 mt-1">{statusInfo.description}</p>
          </div>

          {/* Payment status badge */}
          <span
            className={`inline-block text-xs font-medium px-3 py-1 rounded-full border ${paymentInfo.color}`}
          >
            Pembayaran: {paymentInfo.label}
          </span>
        </div>

        {/* Polling indicator */}
        {isPolling && (
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <RefreshCw className="size-3 animate-spin" />
            <span>Update otomatis tiap 2 detik</span>
          </div>
        )}

        {/* QR Code Section for QRIS */}
        {order.paymentMethod === "QRIS" && currentPaymentStatus === "PENDING" && order.paymentQrString && (
          <div className="bg-white rounded-2xl border shadow-sm p-6 text-center space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Scan untuk Membayar</h3>
              <p className="text-sm text-slate-500 mt-1">Gunakan aplikasi e-wallet atau m-banking kamu (GoPay, OVO, Dana, BCA, dll).</p>
            </div>
            <div className="flex justify-center p-4 bg-white rounded-xl border-2 border-slate-100 mx-auto w-fit">
              <QRCodeSVG
                value={order.paymentQrString}
                size={200}
                level="M"
                includeMargin={false}
              />
            </div>
            <p className="text-xs text-slate-400 font-medium">QRIS otomatis diperbarui setelah dibayar</p>
          </div>
        )}

        {/* Order Details */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h3 className="font-semibold text-slate-800">Detail Pesanan</h3>
          </div>
          <div className="px-4 py-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Pemesan</span>
              <span className="font-medium">{order.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Metode</span>
              <span className="font-medium">
                {order.orderType === "DINE_IN"
                  ? `Dine In${order.tableNumber ? ` - Meja ${order.tableNumber}` : ""}`
                  : order.orderType === "TAKEAWAY"
                  ? "Takeaway"
                  : "Delivery"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Pembayaran</span>
              <span className="font-medium">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</span>
            </div>
            {order.notes && (
              <div className="flex justify-between">
                <span className="text-slate-500">Catatan</span>
                <span className="font-medium text-right max-w-[60%]">{order.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h3 className="font-semibold text-slate-800">Item Pesanan</h3>
          </div>
          <ul className="divide-y">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-sm text-slate-500 font-medium w-5">{item.quantity}×</span>
                <span className="flex-1 text-sm font-medium text-slate-800">{item.name}</span>
                <span className="text-sm font-semibold tabular-nums text-slate-800">
                  {formatPrice(item.total)}
                </span>
              </li>
            ))}
          </ul>
          <div className="px-4 py-3 border-t bg-slate-50 flex justify-between items-center">
            <span className="font-semibold text-slate-700">Total</span>
            <span className="text-lg font-bold text-slate-900">{formatPrice(order.total)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {whatsappContactUrl && (
            <a href={whatsappContactUrl} target="_blank" rel="noopener noreferrer" className="block">
              <Button
                variant="outline"
                className="w-full flex items-center gap-2 py-3"
              >
                <MessageCircle className="size-4 text-green-600" />
                Hubungi {storefront.displayName}
              </Button>
            </a>
          )}

          <Link href={`/@${storefront.slug}/menu`} className="block">
            <Button
              className="w-full py-3 text-white"
              style={{ backgroundColor: "var(--store-theme)" }}
            >
              Pesan Lagi
            </Button>
          </Link>
        </div>

        <p className="text-center text-xs text-slate-400">
          Dipesan pada{" "}
          {new Intl.DateTimeFormat("id-ID", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(order.createdAt))}
        </p>
      </div>
    </div>
  );
}
