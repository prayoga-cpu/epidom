import React from "react";
import { CheckCircle2, Clock, XCircle, ChefHat, PackageCheck } from "lucide-react";

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PRODUCTION"
  | "READY"
  | "DELIVERED"
  | "CANCELLED";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED";

export const STATUS_CONFIG: Record<OrderStatus, { icon: React.ReactNode; color: string }> = {
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

export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { color: string }> = {
  PENDING: { color: "text-amber-600 bg-amber-50 border-amber-200" },
  PAID: { color: "text-green-700 bg-green-50 border-green-200" },
  FAILED: { color: "text-destructive bg-destructive/10 border-destructive/30" },
  EXPIRED: { color: "text-muted-foreground bg-muted border-border" },
  REFUNDED: { color: "text-purple-700 bg-purple-50 border-purple-200" },
};

export const PAYMENT_STATUS_KEY: Record<PaymentStatus, string> = {
  PENDING: "publicOrder.orderStatus.paymentPending",
  PAID: "publicOrder.orderStatus.paymentPaid",
  FAILED: "publicOrder.orderStatus.paymentFailed",
  EXPIRED: "publicOrder.orderStatus.paymentExpired",
  REFUNDED: "publicOrder.orderStatus.paymentRefunded",
};
