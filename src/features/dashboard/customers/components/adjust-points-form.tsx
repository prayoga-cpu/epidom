"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { applyServerFieldErrors } from "@/lib/utils/form-server-errors";
import { cn } from "@/lib/utils";
import { MAX_POINTS_ADJUSTMENT } from "@/lib/validation/customers.schemas";
import { useCustomerFormatters } from "../hooks/use-customer-formatters";
import { useAdjustPoints } from "../hooks/use-customer-mutations";
import {
  createAdjustPointsSchema,
  toSignedPoints,
  type AdjustDirection,
  type AdjustPointsFormValues,
} from "../lib/customer-schemas";

interface AdjustPointsFormProps {
  storeId: string;
  customerId: string;
  /** The balance as currently displayed — only used for the live "balance after" preview. */
  balance: number;
}

const DIRECTIONS: AdjustDirection[] = ["add", "remove"];

/**
 * Manual points correction (owner / manager). The direction is a toggle and the
 * amount a plain positive number: iOS's numeric keypad has no minus key, so a
 * single signed field would be unusable on the very tablets this runs on. The
 * two are combined into the signed `points` the API expects on submit.
 */
export function AdjustPointsForm({ storeId, customerId, balance }: AdjustPointsFormProps) {
  const { t } = useI18n();
  const fmt = useCustomerFormatters();
  const adjustPoints = useAdjustPoints(storeId);
  const [resultingBalance, setResultingBalance] = useState<number | null>(null);

  const maxLabel = fmt.number(MAX_POINTS_ADJUSTMENT);
  const schema = useMemo(() => createAdjustPointsSchema(t, maxLabel), [t, maxLabel]);
  const form = useForm<AdjustPointsFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { direction: "add", points: "", note: "" },
  });

  const [direction, points] = form.watch(["direction", "points"]);
  // A preview, not a check: the balance shown may be a few seconds stale (a sale
  // can land meanwhile), so the SERVER decides whether a removal is allowed and
  // its refusal is shown under the field. This only tells the manager what they
  // are about to do.
  const magnitude = /^\d+$/.test(points) ? Number(points) : 0;
  const previewBalance =
    magnitude > 0 ? balance + (direction === "add" ? magnitude : -magnitude) : null;

  async function onSubmit(values: AdjustPointsFormValues) {
    setResultingBalance(null);
    try {
      const updated = await adjustPoints.mutateAsync({
        customerId,
        body: { points: toSignedPoints(values.direction, values.points), note: values.note },
      });
      setResultingBalance(updated.points);
      form.reset({ direction: values.direction, points: "", note: "" });
    } catch (error) {
      // "This customer only has N points…" comes back pinned to `points`.
      const fieldSummary = applyServerFieldErrors(form, error);
      if (!fieldSummary) {
        toast.error(error instanceof Error ? error.message : t("customers.adjust.failed"));
      }
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-3"
        noValidate
        aria-label={t("customers.adjust.title")}
      >
        <div className="flex flex-wrap items-start gap-3">
          <FormField
            control={form.control}
            name="direction"
            render={({ field }) => (
              <div
                role="group"
                aria-label={t("customers.adjust.direction")}
                className="bg-muted inline-flex shrink-0 gap-1 rounded-lg p-1"
              >
                {DIRECTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={field.value === option}
                    onClick={() => field.onChange(option)}
                    className={cn(
                      "focus-visible:ring-ring h-10 min-w-20 rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                      field.value === option
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground"
                    )}
                  >
                    {/* The sign is decoration; the label already says add/remove. */}
                    <span aria-hidden="true" className="mr-1">
                      {option === "add" ? "+" : "−"}
                    </span>
                    {t(`customers.adjust.${option}`)}
                  </button>
                ))}
              </div>
            )}
          />

          <FormField
            control={form.control}
            name="points"
            render={({ field }) => (
              <FormItem className="min-w-32 flex-1">
                <FormLabel className="sr-only">{t("customers.adjust.amount")}</FormLabel>
                <FormControl>
                  <Input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    className="h-10"
                    aria-label={t("customers.adjust.amount")}
                    placeholder={t("customers.adjust.amountPlaceholder")}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {previewBalance !== null && (
          <p
            className={cn(
              "text-sm tabular-nums",
              previewBalance < 0 ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {t("customers.adjust.balanceAfter").replace("{balance}", fmt.number(previewBalance))}
          </p>
        )}

        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("customers.adjust.reason")}</FormLabel>
              <FormControl>
                <Input
                  className="h-10"
                  autoComplete="off"
                  maxLength={200}
                  placeholder={t("customers.adjust.reasonPlaceholder")}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="h-10 w-full sm:w-auto" disabled={adjustPoints.isPending}>
          {adjustPoints.isPending && <Loader2 className="size-4 animate-spin" />}
          {adjustPoints.isPending ? t("customers.adjust.submitting") : t("customers.adjust.submit")}
        </Button>

        {resultingBalance !== null && (
          <p role="status" className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {t("customers.adjust.balanceNow").replace("{balance}", fmt.number(resultingBalance))}
          </p>
        )}
      </form>
    </Form>
  );
}
