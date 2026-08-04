export function getOrderStatusBadgeVariant(
  status: string
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "PENDING":
      return "secondary";
    case "CONFIRMED":
      return "default";
    case "IN_PRODUCTION":
      return "outline";
    case "READY":
      return "default";
    case "HELD":
      return "secondary";
    default:
      return "outline";
  }
}

export function getOrderSourceBadgeVariant(source: string): "default" | "secondary" | "outline" {
  switch (source) {
    case "POS":
      return "default";
    case "STOREFRONT":
      return "secondary";
    default:
      return "outline";
  }
}

export function mapOrderStatusLabel(t: (key: string) => string, status: string): string {
  const key = status === "IN_PRODUCTION" ? "inProduction" : status.toLowerCase();
  return t(`pos.status.${key}`);
}

/** A Pay Later order that hasn't been settled yet — the case the "Unpaid" badge and payment alerts key off. */
export function isAwaitingPayment(order: { paymentMethod: string; paymentStatus: string }): boolean {
  return order.paymentMethod === "PAY_LATER" && order.paymentStatus === "PENDING";
}

// Low-opacity left-border accent so a busy queue can be scanned by status at
// a glance — same color family as the status filter tiles in the toolbar.
export function getOrderStatusAccentClass(status: string): string {
  switch (status) {
    case "PENDING":
      return "border-l-2 border-l-amber-500 bg-amber-500/[0.04]";
    case "CONFIRMED":
      return "border-l-2 border-l-blue-500 bg-blue-500/[0.04]";
    case "IN_PRODUCTION":
      return "border-l-2 border-l-orange-500 bg-orange-500/[0.04]";
    case "READY":
      return "border-l-2 border-l-emerald-500 bg-emerald-500/[0.04]";
    case "HELD":
      return "border-l-2 border-l-slate-500 bg-slate-500/[0.04]";
    default:
      return "";
  }
}
