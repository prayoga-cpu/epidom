"use client";

import { useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/components/lang/i18n-provider";
import type { CouponDto } from "@/types/api/cashier";
import { useUpdateCoupon } from "../hooks/use-coupons";
import { usePromotionFormat } from "../hooks/use-promotion-format";
import { couponStatus, type CouponStatus } from "../lib/promotion-utils";
import { CouponDialog } from "./coupon-dialog";
import { PromotionBlock, PromotionBlockState } from "./promotion-block";

interface CouponsCardProps {
  storeId: string;
  query: UseQueryResult<CouponDto[], Error>;
}

const STATUS_BADGE_VARIANT: Record<
  CouponStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  inactive: "outline",
  scheduled: "secondary",
  expired: "destructive",
  usedUp: "secondary",
};

export function CouponsCard({ storeId, query }: CouponsCardProps) {
  const { t, formatDateTime } = useI18n();
  const { formatDiscount, formatMoney } = usePromotionFormat();
  const updateCoupon = useUpdateCoupon(storeId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CouponDto | null>(null);

  const coupons = query.data ?? [];
  // One clock reading per render, so every row is judged against the same instant.
  const now = new Date();

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (coupon: CouponDto) => {
    setEditing(coupon);
    setDialogOpen(true);
  };

  // Coupons are never deleted (an order keeps a link to the one it used), so
  // switching one off is how it is retired. Applies immediately, optimistically.
  const toggleActive = (coupon: CouponDto, isActive: boolean) => {
    updateCoupon.mutate(
      { id: coupon.id, body: { isActive } },
      {
        onError: (error) =>
          toast.error(t("common.error"), {
            description: error.message || t("promotions.toasts.updateFailed"),
          }),
      }
    );
  };

  const statusLabel = (status: CouponStatus) => t(`promotions.status.${status}`);

  const validityLines = (coupon: CouponDto): string[] => {
    const lines: string[] = [];
    if (coupon.validFrom) {
      lines.push(
        t("promotions.coupons.validFrom").replace("{date}", formatDateTime(coupon.validFrom))
      );
    }
    if (coupon.validUntil) {
      lines.push(
        t("promotions.coupons.validUntil").replace("{date}", formatDateTime(coupon.validUntil))
      );
    }
    return lines.length > 0 ? lines : [t("promotions.coupons.validAlways")];
  };

  return (
    <>
      <PromotionBlock
        title={t("promotions.coupons.title")}
        description={t("promotions.coupons.description")}
        action={
          <Button size="sm" className="h-10 w-full sm:w-auto" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t("promotions.coupons.add")}
          </Button>
        }
      >
        {query.isLoading ? (
          <PromotionBlockState>
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" aria-hidden />
          </PromotionBlockState>
        ) : query.isError ? (
          <PromotionBlockState>
            <p className="text-destructive text-sm">
              {query.error.message || t("promotions.coupons.loadFailed")}
            </p>
            <Button variant="outline" size="sm" className="h-10" onClick={() => query.refetch()}>
              {t("common.actions.retry")}
            </Button>
          </PromotionBlockState>
        ) : coupons.length === 0 ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed px-4 py-8 text-center">
            <Ticket className="text-muted-foreground/50 mb-3 h-10 w-10" aria-hidden />
            <h4 className="mb-1 text-base font-semibold">{t("promotions.coupons.empty.title")}</h4>
            <p className="text-muted-foreground mb-4 max-w-md text-sm">
              {t("promotions.coupons.empty.description")}
            </p>
            <Button size="sm" className="h-10" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t("promotions.coupons.add")}
            </Button>
          </div>
        ) : (
          <>
            <div className="-mx-4 overflow-x-auto sm:mx-0">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("promotions.coupons.columns.code")}</TableHead>
                    <TableHead>{t("promotions.coupons.columns.discount")}</TableHead>
                    <TableHead>{t("promotions.coupons.columns.minSubtotal")}</TableHead>
                    <TableHead>{t("promotions.coupons.columns.usage")}</TableHead>
                    <TableHead>{t("promotions.coupons.columns.validity")}</TableHead>
                    <TableHead>{t("promotions.coupons.columns.status")}</TableHead>
                    <TableHead className="text-right">
                      {t("promotions.coupons.columns.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((coupon) => {
                    const status = couponStatus(coupon, now);
                    const togglePending =
                      updateCoupon.isPending && updateCoupon.variables?.id === coupon.id;
                    return (
                      <TableRow key={coupon.id}>
                        <TableCell>
                          <p className="font-mono text-sm font-semibold tracking-wide">
                            {coupon.code}
                          </p>
                          {coupon.name && (
                            <p
                              className="text-muted-foreground max-w-48 truncate text-xs"
                              title={coupon.name}
                            >
                              {coupon.name}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="font-medium tabular-nums">
                          {formatDiscount(coupon)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {coupon.minSubtotal !== null ? (
                            formatMoney(coupon.minSubtotal)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {coupon.usedCount} / {coupon.maxUses ?? "∞"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {validityLines(coupon).map((line) => (
                            <p key={line}>{line}</p>
                          ))}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_BADGE_VARIANT[status]}>
                            {statusLabel(status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {/* The label makes the whole 40px cell tappable, not just
                                the 32px switch track. */}
                            <label
                              htmlFor={`coupon-toggle-${coupon.id}`}
                              className="flex h-10 min-w-10 cursor-pointer items-center justify-center"
                            >
                              <Switch
                                id={`coupon-toggle-${coupon.id}`}
                                checked={coupon.isActive}
                                disabled={togglePending}
                                onCheckedChange={(checked) => toggleActive(coupon, checked)}
                                aria-label={t("promotions.coupons.toggle").replace(
                                  "{code}",
                                  coupon.code
                                )}
                              />
                            </label>
                            <Button
                              variant="ghost"
                              size="icon-lg"
                              onClick={() => openEdit(coupon)}
                              aria-label={t("promotions.coupons.edit").replace(
                                "{code}",
                                coupon.code
                              )}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {/* Why there is no delete button, so its absence isn't read as a gap. */}
            <p className="text-muted-foreground text-xs">{t("promotions.coupons.noDeleteHint")}</p>
          </>
        )}
      </PromotionBlock>

      <CouponDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        storeId={storeId}
        coupon={editing}
      />
    </>
  );
}
