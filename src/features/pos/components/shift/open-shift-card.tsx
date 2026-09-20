"use client";

import { Banknote, Loader2, Wallet } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DecimalInput } from "@/components/shared/decimal-input";
import { useI18n } from "@/components/lang/i18n-provider";
import { ApiClientError } from "@/lib/api/client";
import { openShiftSchema, type OpenShiftInput } from "@/lib/validation/operations.schemas";
import { useOpenShift } from "../../hooks/use-active-shift";

interface OpenShiftCardProps {
  storeId: string;
  staffMemberId: string;
  onCashMovement: () => void;
}

/** No shift open: count the float into the drawer and start one. */
export function OpenShiftCard({ storeId, staffMemberId, onCashMovement }: OpenShiftCardProps) {
  const { t } = useI18n();
  const openShift = useOpenShift(storeId);

  const form = useForm<OpenShiftInput>({
    resolver: zodResolver(openShiftSchema),
    // No PIN: the staff session already proves who this is (see
    // isStaffAuthenticated on the route), so asking again would be theatre.
    defaultValues: { staffId: staffMemberId, pin: "", openingCash: 0 },
  });

  return (
    <section
      aria-label={t("pos.shift.noShiftTitle")}
      className="bg-card mx-auto flex w-full max-w-md flex-col gap-4 rounded-2xl border p-5 shadow-sm"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="bg-muted flex size-16 items-center justify-center rounded-full border">
          <Wallet className="text-muted-foreground size-7" aria-hidden />
        </div>
        <h2 className="text-lg font-bold">{t("pos.shift.noShiftTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("pos.shift.noShiftDesc")}</p>
      </div>

      <form
        onSubmit={form.handleSubmit((values) =>
          openShift.mutate(
            { ...values, staffId: staffMemberId },
            {
              onSuccess: () => toast.success(t("pos.shift.opened")),
              // 409: somebody else opened the store's shift first (another tablet, or
              // another account on this one). Not a failure to retry — the page is about
              // to show the shift that is running, so say that instead.
              onError: (error) =>
                toast.error(
                  error instanceof ApiClientError && error.status === 409
                    ? t("pos.shift.alreadyOpen")
                    : t("pos.shift.openFailed")
                ),
            }
          )
        )}
        className="space-y-4"
      >
        <div className="space-y-1">
          <Label htmlFor="shift-opening-cash">{t("pages.openingCash")}</Label>
          <Controller
            control={form.control}
            name="openingCash"
            render={({ field }) => (
              <DecimalInput
                id="shift-opening-cash"
                className="h-12 text-lg"
                decimals={2}
                min={0}
                value={field.value}
                onChange={(v) => field.onChange(v ?? 0)}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
        </div>

        <Button type="submit" className="h-12 w-full text-base" disabled={openShift.isPending}>
          {openShift.isPending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
          {t("pos.shift.open")}
        </Button>
      </form>

      {/* Cash can move before the first shift too (topping up the float) — the
          API accepts a movement with no till attached on purpose. */}
      <Button variant="outline" className="h-11 w-full" onClick={onCashMovement}>
        <Banknote className="mr-2 size-4" aria-hidden />
        {t("pages.cashMovementTitle")}
      </Button>
    </section>
  );
}
