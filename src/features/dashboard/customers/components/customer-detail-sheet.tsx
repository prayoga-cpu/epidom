"use client";

import { AlertCircle, Mail, Pencil, Phone, X } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getOrderStatusBadgeClass } from "@/features/pos/lib/order-status-display";
import { cn } from "@/lib/utils";
import type { CustomerRowDto, LoyaltyEntryDto } from "@/types/api/cashier";
import { useCustomerFormatters } from "../hooks/use-customer-formatters";
import { useCustomerDetail } from "../hooks/use-customer-queries";
import { AdjustPointsForm } from "./adjust-points-form";

interface CustomerDetailSheetProps {
  storeId: string;
  /** The row that was opened; null until something has been picked. */
  customer: CustomerRowDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Owner / manager: may edit and adjust points. Everyone else reads. */
  canManage: boolean;
  /** Points, member-since and the ledger exist only with a loyalty program. */
  loyaltyEnabled: boolean;
  onEdit: () => void;
}

// OrderStatus values -> keys under customers.status.
const STATUS_KEYS: Record<string, string> = {
  CONFIRMED: "confirmed",
  IN_PRODUCTION: "inProduction",
  READY: "ready",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  HELD: "held",
};

const LEDGER_BADGE_CLASS: Record<LoyaltyEntryDto["type"], string> = {
  EARN: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  REDEEM: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400",
  ADJUST: "border-transparent bg-secondary text-secondary-foreground",
  REVERSAL: "border-transparent bg-destructive/15 text-destructive",
};

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 min-w-0 rounded-lg border p-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 truncate text-base font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold">{children}</h3>;
}

function ListSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} className="h-12 w-full" />
      ))}
    </div>
  );
}

/**
 * Right-hand drawer with the full picture of one customer. It opens instantly
 * from the list row it was given (so the header and stat tiles are never empty)
 * and swaps in the detail response — which adds the last 20 orders and 30 ledger
 * entries — when that lands.
 */
export function CustomerDetailSheet({
  storeId,
  customer,
  open,
  onOpenChange,
  canManage,
  loyaltyEnabled,
  onEdit,
}: CustomerDetailSheetProps) {
  const { t } = useI18n();
  const fmt = useCustomerFormatters();
  const { currency, formatPrice: rawFormatPrice } = useCurrency();
  const detail = useCustomerDetail(storeId, customer?.id ?? null);

  // Literal amounts in the store's display currency — see customers-table.tsx.
  const formatPrice = (value: number) => rawFormatPrice(value, currency);

  const view = detail.data ?? customer;

  const statusLabel = (status: string) => {
    const key = STATUS_KEYS[status];
    return key ? t(`customers.status.${key}`) : status;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* dvh / --app-zoom: iOS Safari sizes vh as if its toolbar were hidden,
          and CSS zoom on <html> doesn't scale viewport units (AGENTS.md §6).
          The primitive's built-in close icon is a 16px target, so it is hidden
          here in favour of the 40px SheetClose in the header. */}
      <SheetContent className="flex h-[calc(100dvh/var(--app-zoom,1))] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg [&>button.absolute]:hidden">
        {view && (
          <>
            <SheetHeader className="shrink-0 gap-3 border-b">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <SheetTitle className="min-w-0 text-lg break-words">{view.name}</SheetTitle>
                    {loyaltyEnabled && view.memberSince && (
                      <Badge variant="secondary">{t("customers.detail.memberBadge")}</Badge>
                    )}
                  </div>
                  <SheetDescription>
                    {t("customers.detail.customerSince").replace(
                      "{date}",
                      fmt.date(view.createdAt)
                    )}
                  </SheetDescription>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {canManage && (
                    <Button type="button" variant="outline" className="h-10" onClick={onEdit}>
                      <Pencil className="size-4" />
                      {t("customers.detail.edit")}
                    </Button>
                  )}
                  <SheetClose asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-lg"
                      aria-label={t("customers.detail.close")}
                    >
                      <X className="size-5" />
                    </Button>
                  </SheetClose>
                </div>
              </div>

              <ul className="space-y-0.5 text-sm">
                {view.phone && (
                  <li>
                    <a
                      href={`tel:${view.phone}`}
                      className="hover:text-foreground text-muted-foreground inline-flex min-h-10 min-w-0 items-center gap-2"
                    >
                      <Phone className="size-4 shrink-0" />
                      <span className="truncate">{view.phone}</span>
                    </a>
                  </li>
                )}
                {view.email && (
                  <li>
                    <a
                      href={`mailto:${view.email}`}
                      className="hover:text-foreground text-muted-foreground inline-flex min-h-10 min-w-0 items-center gap-2"
                    >
                      <Mail className="size-4 shrink-0" />
                      <span className="truncate">{view.email}</span>
                    </a>
                  </li>
                )}
                {!view.phone && !view.email && (
                  <li className="text-muted-foreground">{t("customers.detail.noContact")}</li>
                )}
              </ul>
            </SheetHeader>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {/* Notes live in the scrolling pane, not the pinned header: up to 500
                  characters of free text would otherwise eat a phone's screen. */}
              {view.notes && (
                <div>
                  <p className="text-muted-foreground mb-1 text-xs">
                    {t("customers.detail.notes")}
                  </p>
                  <p className="bg-muted/40 rounded-md border p-3 text-sm break-words whitespace-pre-wrap">
                    {view.notes}
                  </p>
                </div>
              )}

              <dl className="grid grid-cols-2 gap-2">
                <StatTile
                  label={t("customers.detail.lifetimeSpend")}
                  value={formatPrice(view.lifetimeSpend)}
                />
                <StatTile
                  label={t("customers.detail.orders")}
                  value={fmt.number(view.orderCount)}
                />
                <StatTile
                  label={t("customers.detail.lastVisit")}
                  value={fmt.date(view.lastOrderAt)}
                />
                {loyaltyEnabled && (
                  <>
                    <StatTile
                      label={t("customers.detail.points")}
                      value={fmt.number(view.points)}
                    />
                    <StatTile
                      label={t("customers.detail.memberSince")}
                      value={fmt.date(view.memberSince)}
                    />
                  </>
                )}
              </dl>

              {detail.isError && (
                <div
                  role="alert"
                  className="border-destructive/40 bg-destructive/5 flex items-center gap-3 rounded-lg border p-3 text-sm"
                >
                  <AlertCircle className="text-destructive size-4 shrink-0" />
                  <span className="min-w-0 flex-1">{t("customers.detail.loadFailed")}</span>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10"
                    onClick={() => detail.refetch()}
                  >
                    {t("customers.detail.retry")}
                  </Button>
                </div>
              )}

              {loyaltyEnabled && canManage && (
                <section className="space-y-3">
                  <div>
                    <SectionTitle>{t("customers.adjust.title")}</SectionTitle>
                    <p className="text-muted-foreground text-xs">
                      {t("customers.adjust.description")}
                    </p>
                  </div>
                  {/* keyed: opening another customer must not inherit a half-typed adjustment. */}
                  <AdjustPointsForm
                    key={view.id}
                    storeId={storeId}
                    customerId={view.id}
                    balance={view.points}
                  />
                </section>
              )}

              <section className="space-y-2">
                <SectionTitle>{t("customers.detail.recentOrders")}</SectionTitle>
                {detail.isPending ? (
                  <ListSkeleton />
                ) : detail.data && detail.data.orders.length > 0 ? (
                  <ul className="divide-y rounded-lg border">
                    {detail.data.orders.map((order) => (
                      <li key={order.id} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{order.orderNumber}</p>
                          <p className="text-muted-foreground text-xs">
                            {fmt.dateTime(order.orderDate)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-sm font-medium tabular-nums">
                            {formatPrice(order.total)}
                          </span>
                          <Badge className={getOrderStatusBadgeClass(order.status)}>
                            {statusLabel(order.status)}
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : detail.data ? (
                  <p className="text-muted-foreground text-sm">{t("customers.detail.noOrders")}</p>
                ) : null}
              </section>

              {loyaltyEnabled && (
                <section className="space-y-2">
                  <SectionTitle>{t("customers.detail.pointsHistory")}</SectionTitle>
                  {detail.isPending ? (
                    <ListSkeleton />
                  ) : detail.data && detail.data.loyaltyEntries.length > 0 ? (
                    <ul className="divide-y rounded-lg border">
                      {detail.data.loyaltyEntries.map((entry) => (
                        <li key={entry.id} className="flex items-center gap-3 px-3 py-2.5">
                          <div className="min-w-0 flex-1 space-y-1">
                            <Badge className={LEDGER_BADGE_CLASS[entry.type]}>
                              {t(`customers.ledger.${entry.type.toLowerCase()}`)}
                            </Badge>
                            {entry.note && (
                              <p className="text-muted-foreground text-xs break-words">
                                {entry.note}
                              </p>
                            )}
                            <p className="text-muted-foreground text-xs">
                              {fmt.dateTime(entry.createdAt)}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 text-sm font-semibold tabular-nums",
                              entry.points > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-destructive"
                            )}
                          >
                            {fmt.signed(entry.points)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : detail.data ? (
                    <p className="text-muted-foreground text-sm">
                      {t("customers.detail.noPointsHistory")}
                    </p>
                  ) : null}
                </section>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
