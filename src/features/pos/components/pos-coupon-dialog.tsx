"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiClientError } from "@/lib/api/client";
import type { CouponRejectionDto, CouponValidationDto } from "@/types/api/cashier";
import { usePosCart } from "../hooks/use-pos-cart";
import { useValidateCoupon } from "../hooks/use-coupon";
import { itemsTotalOf } from "../lib/cart-format";

export const COUPON_CODE_MAX = 32;

/** Codes are stored UPPERCASE as `[A-Z0-9_-]`, so typing is normalised to that
 * rather than letting a stray space or lowercase letter cause a NOT_FOUND. */
export function normalizeCouponCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, COUPON_CODE_MAX);
}

interface PosCouponDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
}

/**
 * Enter a coupon code → the server prices it against the bill's item total and
 * says whether it applies. A valid one becomes the bill's primary discount
 * (replacing a manual/preset one — only one at a time); a rejected one shows a
 * plain-language reason.
 *
 * The check is advisory: the order transaction re-validates and spends the
 * use atomically, so a preview here never guarantees the last redemption.
 */
export function PosCouponDialog({ open, onOpenChange, storeId }: PosCouponDialogProps) {
  const { t } = useI18n();
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);

  const items = usePosCart((s) => s.items);
  const discountSource = usePosCart((s) => s.discountSource);
  const primaryDiscount = usePosCart((s) => s.primaryDiscountAmount);
  const setDiscountSource = usePosCart((s) => s.setDiscountSource);

  const validate = useValidateCoupon(storeId);
  const [code, setCode] = useState("");
  const [rejection, setRejection] = useState<CouponRejectionDto | "ERROR" | "FORBIDDEN" | null>(
    null
  );

  useEffect(() => {
    if (open) {
      setCode("");
      setRejection(null);
      validate.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const applied = discountSource?.kind === "coupon" ? discountSource : null;

  const handleApply = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (code.length < 2 || validate.isPending) return;
    setRejection(null);

    let result: CouponValidationDto;
    try {
      // The ITEM total (sum of lines) — the same base the server prices and
      // checks the coupon's minimum against — not the post-tax bill total.
      result = await validate.mutateAsync({ code, itemsTotal: itemsTotalOf(items) });
    } catch (error) {
      setRejection(error instanceof ApiClientError && error.status === 403 ? "FORBIDDEN" : "ERROR");
      return;
    }

    if (!result.valid || !result.coupon) {
      setRejection(result.reason ?? "NOT_FOUND");
      return;
    }

    setDiscountSource({
      kind: "coupon",
      couponId: result.coupon.id,
      code: result.coupon.code,
      type: result.coupon.type,
      value: result.coupon.value,
      // The validation payload doesn't (yet) carry the coupon's minimum; read
      // it if present so the cart drops the coupon when the bill shrinks under
      // it. Null is safe: the server re-checks the minimum at checkout.
      minSubtotal: (result.coupon as { minSubtotal?: number | null }).minSubtotal ?? null,
    });
    setCode("");
  };

  const replacing = !applied && discountSource !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={t("cashierCart.couponDialog.title")}
        maxWidth="sm"
        footer={
          <>
            {applied && (
              <Button
                type="button"
                variant="outline"
                className="text-destructive h-11 touch-manipulation"
                onClick={() => setDiscountSource(null)}
              >
                {t("common.actions.remove")}
              </Button>
            )}
            <Button
              type="button"
              variant={applied ? "default" : "outline"}
              className="h-11 touch-manipulation"
              onClick={() => onOpenChange(false)}
            >
              {applied ? t("cashierCart.couponDialog.done") : t("common.actions.close")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {applied && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">
                  {t("cashierCart.couponDialog.applied").replace("{code}", applied.code)}
                </div>
                <div className="text-muted-foreground">
                  {applied.type === "PERCENT" ? `${applied.value}%` : formatPrice(applied.value)}
                  {" · "}
                  <span className="text-foreground font-medium tabular-nums">
                    -{formatPrice(primaryDiscount)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleApply} className="space-y-2" noValidate>
            <Label htmlFor="pos-coupon-code">{t("cashierCart.couponDialog.code")}</Label>
            <div className="flex gap-2">
              <Input
                id="pos-coupon-code"
                autoFocus
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="h-11 min-w-0 flex-1 font-mono tracking-wide uppercase"
                placeholder={t("cashierCart.couponDialog.codePlaceholder")}
                value={code}
                onChange={(e) => {
                  setCode(normalizeCouponCode(e.target.value));
                  if (rejection) setRejection(null);
                }}
              />
              <Button
                type="submit"
                className="h-11 shrink-0 touch-manipulation"
                disabled={code.length < 2 || validate.isPending}
              >
                {validate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("common.actions.apply")}
              </Button>
            </div>
            {replacing && (
              <p className="text-muted-foreground text-xs">
                {t("cashierCart.couponDialog.replaces")}
              </p>
            )}
            {rejection && (
              <p role="alert" className="text-destructive text-sm font-medium">
                {t(`cashierCart.couponDialog.reason.${rejection}`)}
              </p>
            )}
          </form>
        </div>
      </FormDialogLayout>
    </Dialog>
  );
}
