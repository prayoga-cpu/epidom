"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { useI18n } from "@/components/lang/i18n-provider";
import { StorefrontControls } from "@/features/storefront/components/storefront-controls";
import {
  STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  PAYMENT_STATUS_KEY,
  type OrderStatus,
  type PaymentStatus,
} from "../lib/order-status-config";

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
    <div className="bg-muted flex min-h-screen flex-col" style={themeStyle}>
      {/* Header */}
      <header className="bg-card sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 shadow-sm">
        <Link href={`/@${storefront.slug}`} className="hover:bg-muted rounded-full p-1 transition">
          <ArrowLeft className="text-foreground size-5" />
        </Link>
        <h1 className="text-foreground flex-1 truncate text-base font-bold">
          {t("publicOrder.orderStatus.title")}
        </h1>
        <span className="text-muted-foreground font-mono text-xs">{order.orderNumber}</span>
        <StorefrontControls />
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 space-y-5 px-4 py-6">
        {/* Status Card */}
        <div className="bg-card space-y-3 rounded-2xl border p-6 text-center shadow-sm">
          <div className={`flex justify-center ${statusInfo.color}`}>{statusInfo.icon}</div>
          <div>
            <h2 className="text-foreground text-xl font-bold">
              {t("publicOrder.orderStatus." + currentStatus)}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {t("publicOrder.orderStatus.desc." + currentStatus)}
            </p>
          </div>

          {/* Payment status badge */}
          <span
            className={`inline-block rounded-full border px-3 py-1 text-xs font-medium ${paymentInfo.color}`}
          >
            {t("publicOrder.orderStatus.paymentLabel")}:{" "}
            {t(PAYMENT_STATUS_KEY[currentPaymentStatus])}
          </span>
        </div>

        {/* Polling indicator */}
        {isPolling && (
          <div className="text-muted-foreground flex items-center justify-center gap-2 text-xs">
            <RefreshCw className="size-3 animate-spin" />
          </div>
        )}

        {/* QR Code Section for QRIS */}
        {order.paymentMethod === "QRIS" &&
          currentPaymentStatus === "PENDING" &&
          order.paymentQrString && (
            <div className="bg-card space-y-4 rounded-2xl border p-6 text-center shadow-sm">
              <div>
                <h3 className="text-foreground text-lg font-bold">
                  {t("publicOrder.orderStatus.qrisTitle")}
                </h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  {t("publicOrder.orderStatus.qrisDesc")}
                </p>
              </div>
              <div className="bg-card border-border mx-auto flex w-fit justify-center rounded-xl border-2 p-4">
                <QRCodeSVG
                  value={order.paymentQrString}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <p className="text-muted-foreground text-xs font-medium">
                {t("publicOrder.orderStatus.qrisAutoUpdate")}
              </p>
            </div>
          )}

        {/* Instructions for OVO */}
        {order.paymentMethod === "OVO" && currentPaymentStatus === "PENDING" && (
          <div className="bg-card space-y-4 rounded-2xl border p-6 text-center shadow-sm">
            <div>
              <h3 className="text-foreground text-lg font-bold">
                {t("publicOrder.orderStatus.ovoTitle")}
              </h3>
              <p className="text-muted-foreground mt-1 text-sm">
                {t("publicOrder.orderStatus.ovoDesc")}
              </p>
            </div>
          </div>
        )}

        {/* Instructions for Bank Transfer (using qrString to store VA number) */}
        {order.paymentMethod === "BANK_TRANSFER" &&
          currentPaymentStatus === "PENDING" &&
          order.paymentQrString &&
          (() => {
            // Format stored as "BANK_CODE:ACCOUNT_NUMBER" e.g. "BNI:8808999949742598"
            const parts = order.paymentQrString.split(":");
            const bankName = parts.length === 2 ? parts[0] : "Bank";
            const accountNumber = parts.length === 2 ? parts[1] : order.paymentQrString;
            return (
              <div className="bg-card space-y-4 rounded-2xl border p-6 text-center shadow-sm">
                <div>
                  <h3 className="text-foreground text-lg font-bold">
                    {t("publicOrder.orderStatus.vaTitle").replace("{bank}", bankName)}
                  </h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {t("publicOrder.orderStatus.vaDesc").replace("{bank}", bankName)}
                  </p>
                </div>
                <div className="bg-muted border-border space-y-1 rounded-xl border-2 p-4">
                  <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                    {t("publicOrder.orderStatus.vaNumberLabel").replace("{bank}", bankName)}
                  </p>
                  <p className="text-foreground font-mono text-2xl font-bold tracking-widest">
                    {accountNumber}
                  </p>
                </div>
                <p className="text-muted-foreground text-xs font-medium">
                  {t("publicOrder.orderStatus.vaAutoUpdate")}
                </p>
              </div>
            );
          })()}

        {/* Instructions for E-Wallets */}
        {["GOPAY", "DANA", "SHOPEEPAY"].includes(order.paymentMethod) &&
          currentPaymentStatus === "PENDING" && (
            <div className="bg-card space-y-4 rounded-2xl border p-6 text-center shadow-sm">
              <div>
                <h3 className="text-foreground text-lg font-bold">
                  {t("publicOrder.orderStatus.ewalletTitle")}
                </h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  {t("publicOrder.orderStatus.ewalletDesc")}
                </p>
              </div>
            </div>
          )}

        {/* Order Details */}
        <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
          <div className="border-b px-4 py-3">
            <h3 className="text-foreground font-semibold">{t("publicOrder.orderDetails")}</h3>
          </div>
          <div className="space-y-2 px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("publicOrder.orderStatus.customerLabel")}
              </span>
              <span className="font-medium">{order.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("publicOrder.orderStatus.methodLabel")}
              </span>
              <span className="font-medium">
                {order.orderType === "DINE_IN"
                  ? `${t("publicOrder.dineIn")}${order.tableNumber ? ` - ${t("publicOrder.orderStatus.tableWord")} ${order.tableNumber}` : ""}`
                  : order.orderType === "TAKEAWAY"
                    ? t("publicOrder.takeaway")
                    : t("publicOrder.delivery")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("publicOrder.orderStatus.paymentMethodLabel")}
              </span>
              <span className="font-medium">
                {t("publicOrder.paymentMethods." + order.paymentMethod)}
              </span>
            </div>
            {order.notes && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("publicOrder.orderStatus.notesLabel")}
                </span>
                <span className="max-w-[60%] text-right font-medium">{order.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
          <div className="border-b px-4 py-3">
            <h3 className="text-foreground font-semibold">
              {t("publicOrder.orderStatus.orderItems")}
            </h3>
          </div>
          <ul className="divide-y">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-muted-foreground w-5 text-sm font-medium">
                  {item.quantity}×
                </span>
                <span className="text-foreground flex-1 text-sm font-medium">{item.name}</span>
                <span className="text-foreground text-sm font-semibold tabular-nums">
                  {formatPrice(item.total)}
                </span>
              </li>
            ))}
          </ul>
          <div className="bg-muted flex items-center justify-between border-t px-4 py-3">
            <span className="text-foreground font-semibold">{t("publicOrder.total")}</span>
            <span className="text-foreground text-lg font-bold">{formatPrice(order.total)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {whatsappContactUrl && (
            <a
              href={whatsappContactUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button variant="outline" className="flex w-full items-center gap-2 py-3">
                <MessageCircle className="size-4 text-green-600" />
                {t("publicOrder.orderStatus.contactStore").replace(
                  "{name}",
                  storefront.displayName
                )}
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

          <Link href={`/@${storefront.slug}/orders`} className="block">
            <Button variant="outline" className="w-full py-3">
              {t("publicOrder.myOrders.viewAll")}
            </Button>
          </Link>
        </div>

        <p className="text-muted-foreground text-center text-xs" suppressHydrationWarning>
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
