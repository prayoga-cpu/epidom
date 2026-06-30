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
import { useI18n } from "@/components/lang/i18n-provider";
import { StorefrontControls } from "@/features/storefront/components/storefront-controls";

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

const STATUS_CONFIG: Record<OrderStatus, { icon: React.ReactNode; color: string }> = {
  PENDING: {
    icon: <Clock className="size-8" />,
    color: "text-amber-500",
  },
  CONFIRMED: {
    icon: <CheckCircle2 className="size-8" />,
    color: "text-blue-500",
  },
  IN_PRODUCTION: {
    icon: <ChefHat className="size-8" />,
    color: "text-orange-500",
  },
  READY: {
    icon: <PackageCheck className="size-8" />,
    color: "text-green-500",
  },
  DELIVERED: {
    icon: <CheckCircle2 className="size-8" />,
    color: "text-green-600",
  },
  CANCELLED: {
    icon: <XCircle className="size-8" />,
    color: "text-red-500",
  },
};

const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { color: string }> = {
  PENDING: { color: "text-amber-600 bg-amber-50 border-amber-200" },
  PAID: { color: "text-green-700 bg-green-50 border-green-200" },
  FAILED: { color: "text-destructive bg-destructive/10 border-destructive/30" },
  EXPIRED: { color: "text-muted-foreground bg-muted border-border" },
  REFUNDED: { color: "text-purple-700 bg-purple-50 border-purple-200" },
};

const PAYMENT_STATUS_KEY: Record<PaymentStatus, string> = {
  PENDING: "publicOrder.orderStatus.paymentPending",
  PAID: "publicOrder.orderStatus.paymentPaid",
  FAILED: "publicOrder.orderStatus.paymentFailed",
  EXPIRED: "publicOrder.orderStatus.paymentExpired",
  REFUNDED: "publicOrder.orderStatus.paymentRefunded",
};

export function OrderStatusClient({ storefront, order }: OrderStatusClientProps) {
  const { t } = useI18n();
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
        t("publicOrder.orderStatus.whatsappMessage").replace("{orderNumber}", order.orderNumber)
      )}`
    : null;

  return (
    <div className="flex flex-col min-h-screen bg-muted" style={themeStyle}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card border-b px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link
          href={`/@${storefront.slug}`}
          className="p-1 rounded-full hover:bg-muted transition"
        >
          <ArrowLeft className="size-5 text-foreground" />
        </Link>
        <h1 className="font-bold text-foreground text-base flex-1 truncate">
          {t("publicOrder.orderStatus.title")}
        </h1>
        <span className="text-xs text-muted-foreground font-mono">{order.orderNumber}</span>
        <StorefrontControls />
      </header>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-5">
        {/* Status Card */}
        <div className="bg-card rounded-2xl border shadow-sm p-6 text-center space-y-3">
          <div className={`flex justify-center ${statusInfo.color}`}>
            {statusInfo.icon}
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {t("publicOrder.orderStatus." + currentStatus)}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("publicOrder.orderStatus.desc." + currentStatus)}
            </p>
          </div>

          {/* Payment status badge */}
          <span
            className={`inline-block text-xs font-medium px-3 py-1 rounded-full border ${paymentInfo.color}`}
          >
            {t("publicOrder.orderStatus.paymentLabel")}: {t(PAYMENT_STATUS_KEY[currentPaymentStatus])}
          </span>
        </div>

        {/* Polling indicator */}
        {isPolling && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="size-3 animate-spin" />
          </div>
        )}

        {/* QR Code Section for QRIS */}
        {order.paymentMethod === "QRIS" && currentPaymentStatus === "PENDING" && order.paymentQrString && (
          <div className="bg-card rounded-2xl border shadow-sm p-6 text-center space-y-4">
            <div>
              <h3 className="font-bold text-foreground text-lg">{t("publicOrder.orderStatus.qrisTitle")}</h3>
              <p className="text-sm text-muted-foreground mt-1">{t("publicOrder.orderStatus.qrisDesc")}</p>
            </div>
            <div className="flex justify-center p-4 bg-card rounded-xl border-2 border-border mx-auto w-fit">
              <QRCodeSVG
                value={order.paymentQrString}
                size={200}
                level="M"
                includeMargin={false}
              />
            </div>
            <p className="text-xs text-muted-foreground font-medium">{t("publicOrder.orderStatus.qrisAutoUpdate")}</p>
          </div>
        )}

        {/* Instructions for OVO */}
        {order.paymentMethod === "OVO" && currentPaymentStatus === "PENDING" && (
          <div className="bg-card rounded-2xl border shadow-sm p-6 text-center space-y-4">
            <div>
              <h3 className="font-bold text-foreground text-lg">{t("publicOrder.orderStatus.ovoTitle")}</h3>
              <p className="text-sm text-muted-foreground mt-1">{t("publicOrder.orderStatus.ovoDesc")}</p>
            </div>
          </div>
        )}

        {/* Instructions for Bank Transfer (using qrString to store VA number) */}
        {order.paymentMethod === "BANK_TRANSFER" && currentPaymentStatus === "PENDING" && order.paymentQrString && (() => {
          // Format stored as "BANK_CODE:ACCOUNT_NUMBER" e.g. "BNI:8808999949742598"
          const parts = order.paymentQrString.split(":");
          const bankName = parts.length === 2 ? parts[0] : "Bank";
          const accountNumber = parts.length === 2 ? parts[1] : order.paymentQrString;
          return (
            <div className="bg-card rounded-2xl border shadow-sm p-6 text-center space-y-4">
              <div>
                <h3 className="font-bold text-foreground text-lg">
                  {t("publicOrder.orderStatus.vaTitle").replace("{bank}", bankName)}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("publicOrder.orderStatus.vaDesc").replace("{bank}", bankName)}
                </p>
              </div>
              <div className="bg-muted p-4 rounded-xl border-2 border-border space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  {t("publicOrder.orderStatus.vaNumberLabel").replace("{bank}", bankName)}
                </p>
                <p className="font-mono text-2xl font-bold text-foreground tracking-widest">{accountNumber}</p>
              </div>
              <p className="text-xs text-muted-foreground font-medium">{t("publicOrder.orderStatus.vaAutoUpdate")}</p>
            </div>
          );
        })()}

        {/* Instructions for E-Wallets */}
        {["GOPAY", "DANA", "SHOPEEPAY"].includes(order.paymentMethod) && currentPaymentStatus === "PENDING" && (
          <div className="bg-card rounded-2xl border shadow-sm p-6 text-center space-y-4">
            <div>
              <h3 className="font-bold text-foreground text-lg">{t("publicOrder.orderStatus.ewalletTitle")}</h3>
              <p className="text-sm text-muted-foreground mt-1">{t("publicOrder.orderStatus.ewalletDesc")}</p>
            </div>
          </div>
        )}

        {/* Order Details */}
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h3 className="font-semibold text-foreground">{t("publicOrder.orderDetails")}</h3>
          </div>
          <div className="px-4 py-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("publicOrder.orderStatus.customerLabel")}</span>
              <span className="font-medium">{order.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("publicOrder.orderStatus.methodLabel")}</span>
              <span className="font-medium">
                {order.orderType === "DINE_IN"
                  ? `${t("publicOrder.dineIn")}${order.tableNumber ? ` - ${t("publicOrder.orderStatus.tableWord")} ${order.tableNumber}` : ""}`
                  : order.orderType === "TAKEAWAY"
                  ? t("publicOrder.takeaway")
                  : t("publicOrder.delivery")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("publicOrder.orderStatus.paymentMethodLabel")}</span>
              <span className="font-medium">{t("publicOrder.paymentMethods." + order.paymentMethod)}</span>
            </div>
            {order.notes && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("publicOrder.orderStatus.notesLabel")}</span>
                <span className="font-medium text-right max-w-[60%]">{order.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h3 className="font-semibold text-foreground">{t("publicOrder.orderStatus.orderItems")}</h3>
          </div>
          <ul className="divide-y">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-sm text-muted-foreground font-medium w-5">{item.quantity}×</span>
                <span className="flex-1 text-sm font-medium text-foreground">{item.name}</span>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {formatPrice(item.total)}
                </span>
              </li>
            ))}
          </ul>
          <div className="px-4 py-3 border-t bg-muted flex justify-between items-center">
            <span className="font-semibold text-foreground">{t("publicOrder.total")}</span>
            <span className="text-lg font-bold text-foreground">{formatPrice(order.total)}</span>
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
                {t("publicOrder.orderStatus.contactStore").replace("{name}", storefront.displayName)}
              </Button>
            </a>
          )}

          <Link href={`/@${storefront.slug}/menu`} className="block">
            <Button
              className="w-full py-3 text-white"
              style={{ backgroundColor: "var(--store-theme)" }}
            >
              {t("publicOrder.orderStatus.orderAgain")}
            </Button>
          </Link>
        </div>

        <p className="text-center text-xs text-muted-foreground" suppressHydrationWarning>
          {t("publicOrder.orderStatus.orderedOn")}{" "}
          {new Intl.DateTimeFormat("id-ID", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(order.createdAt))}
        </p>
      </div>
    </div>
  );
}
