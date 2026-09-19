"use client";

import { useState } from "react";
import { Check, Minus, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/shared/decimal-input";
import { cn } from "@/lib/utils";
import { getCurrencySymbol } from "@/lib/utils/formatting";
import { nanoid } from "@/lib/utils/nanoid";
import { MAX_TENDERS, type TenderMethod } from "@/lib/finance/order-payments";
import { splitEqually } from "../lib/split-bill";
import { mapPaymentMethodLabel, orderPaymentMethodGroups } from "../lib/order-status-display";
import type { DraftTender } from "../types/pos.types";

/** "Split equally between N" is offered for 2–10 people (10 is also the most tenders one order takes). */
export const EQUAL_SPLIT_MIN = 2;
export const EQUAL_SPLIT_MAX = Math.min(10, MAX_TENDERS);

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The methods a store accepts, flattened in the order checkout lists them (the
 * market matching the UI language leads). Never empty: before the store's
 * settings load — or if none are enabled — Cash is offered, since a till that
 * can't take money at all is worse than one that offers the default.
 */
export function resolveTenderMethods(
  enabled: readonly string[] | undefined,
  locale: string
): TenderMethod[] {
  const accepted = new Set(enabled ?? []);
  const flat = orderPaymentMethodGroups(locale)
    .flatMap((group) => group.methods)
    .filter((method) => accepted.has(method)) as TenderMethod[];
  return flat.length > 0 ? flat : ["CASH"];
}

export function makeDraftTender(method: TenderMethod, amount: number | null = null): DraftTender {
  return { id: nanoid(), method, amount, amountTendered: null, note: "" };
}

/** What is still owed after the rows entered so far. Negative means over-paid. */
export function tendersRemaining(
  total: number,
  tenders: Array<Pick<DraftTender, "amount">>
): number {
  const remaining = round2(total - tenders.reduce((sum, t) => sum + (t.amount ?? 0), 0));
  // Float subtraction can land on -0 (0.3 − (0.1 + 0.2)); callers compare with Object.is-style equality.
  return remaining === 0 ? 0 : remaining;
}

/**
 * N equal rows for "Split equally". Existing rows keep their method (and OTHER
 * label) by position so re-splitting doesn't wipe what the cashier already
 * picked; extra rows take `defaultMethod`. The last share absorbs rounding —
 * see splitEqually. Cash hand-over is cleared: it was typed against the old
 * amount and would now be stale.
 */
export function equalSplitTenders(args: {
  total: number;
  parts: number;
  decimals: number;
  existing: DraftTender[];
  defaultMethod: TenderMethod;
}): DraftTender[] {
  const shares = splitEqually(args.total, args.parts, args.decimals);
  return shares.map((amount, i) => {
    const prior = args.existing[i];
    return {
      id: prior?.id ?? nanoid(),
      method: prior?.method ?? args.defaultMethod,
      amount,
      amountTendered: null,
      note: prior?.note ?? "",
    };
  });
}

interface PosTenderListProps {
  total: number;
  tenders: DraftTender[];
  onChange: (next: DraftTender[]) => void;
  /** Methods this store accepts, in display order. "OTHER" is always offered too. */
  methods: TenderMethod[];
  currency: string;
  /** Real fraction digits of the currency (0 for IDR) — what one equal share rounds to. */
  decimals: number;
  /** Literal-currency formatter (two-arg formatPrice) — nothing here is IDR-converted. */
  formatPrice: (value: number) => string;
}

/**
 * The split-payment rows: which method, how much, and for cash how much was
 * handed over. A live "Remaining" figure has to reach zero before the checkout
 * will submit — the order is only ever created fully paid, so there is no
 * partially-paid state to leave behind.
 *
 * Every control is a 44px target (iPad is the primary till). The method picker
 * is a native <select> on purpose: on iPad it opens the system wheel, which is
 * far easier to hit than a small custom popover, and it needs no extra JS.
 */
export function PosTenderList({
  total,
  tenders,
  onChange,
  methods,
  currency,
  decimals,
  formatPrice,
}: PosTenderListProps) {
  const { t } = useI18n();
  const [parts, setParts] = useState(() =>
    Math.min(Math.max(tenders.length, EQUAL_SPLIT_MIN), EQUAL_SPLIT_MAX)
  );

  const methodOptions: TenderMethod[] = [...methods.filter((m) => m !== "OTHER"), "OTHER"];
  const labelOf = (method: TenderMethod) =>
    method === "OTHER" ? t("pos.checkout.other") : mapPaymentMethodLabel(t, method);

  const remaining = tendersRemaining(total, tenders);
  const settled = Math.abs(remaining) < 0.005;
  const over = remaining < -0.005;

  const updateRow = (id: string, patch: Partial<DraftTender>) =>
    onChange(tenders.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const addRow = () => {
    // Prefer a method not already on the list, so the second row is a different
    // way of paying rather than a second cash line.
    const used = new Set(tenders.map((r) => r.method));
    const method = methodOptions.find((m) => !used.has(m)) ?? methodOptions[0];
    onChange([...tenders, makeDraftTender(method, remaining > 0.005 ? remaining : null)]);
  };

  const removeRow = (id: string) => onChange(tenders.filter((row) => row.id !== id));

  const applyEqual = () =>
    onChange(
      equalSplitTenders({
        total,
        parts,
        decimals,
        existing: tenders,
        defaultMethod: methodOptions[0],
      })
    );

  const shares = total > 0 ? splitEqually(total, parts, decimals) : [];
  const firstShare = shares[0];
  const lastShare = shares[shares.length - 1];

  return (
    <div className="space-y-3">
      <div
        aria-live="polite"
        className={cn(
          "flex items-center justify-between gap-3 rounded-md border px-3 py-2.5",
          settled && "border-emerald-500/40 bg-emerald-500/10",
          over && "border-destructive/40 bg-destructive/10"
        )}
      >
        <span className="text-sm font-medium">
          {over ? t("cashierCheckout.tender.over") : t("cashierCheckout.tender.remaining")}
        </span>
        <span
          className={cn(
            "flex items-center gap-1.5 text-lg font-semibold tabular-nums",
            settled && "text-emerald-600 dark:text-emerald-400",
            over && "text-destructive"
          )}
        >
          {settled && <Check className="size-4" aria-hidden />}
          {formatPrice(Math.abs(remaining))}
        </span>
      </div>

      <ul className="space-y-2">
        {tenders.map((row, index) => {
          const change =
            row.method === "CASH" && row.amountTendered != null && row.amount != null
              ? Math.max(0, round2(row.amountTendered - row.amount))
              : null;
          const cashShort =
            row.method === "CASH" &&
            row.amountTendered != null &&
            row.amount != null &&
            row.amountTendered < row.amount;
          const rowNo = index + 1;
          // A row whose method the store has since stopped accepting must still
          // show what it is, not a blank select.
          const options = methodOptions.includes(row.method)
            ? methodOptions
            : [...methodOptions, row.method];

          return (
            <li
              key={row.id}
              data-testid="tender-row"
              className="bg-muted/20 space-y-2 rounded-md border p-2.5"
            >
              <div className="flex items-center gap-2">
                <select
                  aria-label={`${t("cashierCheckout.tender.method")} ${rowNo}`}
                  value={row.method}
                  onChange={(e) => {
                    const method = e.target.value as TenderMethod;
                    updateRow(row.id, {
                      method,
                      // Cash hand-over only means something on a cash row.
                      amountTendered: method === "CASH" ? row.amountTendered : null,
                    });
                  }}
                  className="border-input bg-background focus-visible:ring-ring/50 h-11 min-w-0 flex-1 rounded-md border px-3 text-base shadow-xs outline-none focus-visible:ring-[3px] md:text-sm"
                >
                  {options.map((m) => (
                    <option key={m} value={m}>
                      {labelOf(m)}
                    </option>
                  ))}
                </select>

                <div className="relative w-36 shrink-0">
                  <span className="text-muted-foreground pointer-events-none absolute top-3 left-3 text-sm">
                    {getCurrencySymbol(currency)}
                  </span>
                  <DecimalInput
                    aria-label={`${t("cashierCheckout.tender.amount")} ${rowNo}`}
                    decimals={decimals}
                    min={0}
                    placeholder="0"
                    className="h-11 pl-9 text-base font-medium"
                    value={row.amount ?? undefined}
                    onChange={(value) => updateRow(row.id, { amount: value ?? null })}
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 shrink-0 touch-manipulation"
                  aria-label={`${t("cashierCheckout.tender.remove")} ${rowNo}`}
                  disabled={tenders.length <= 1}
                  onClick={() => removeRow(row.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              {row.method === "OTHER" && (
                <Input
                  aria-label={`${t("cashierCheckout.tender.otherLabel")} ${rowNo}`}
                  placeholder={t("pos.checkout.customPaymentMethodPlaceholder")}
                  className="h-11"
                  value={row.note}
                  maxLength={200}
                  onChange={(e) => updateRow(row.id, { note: e.target.value })}
                />
              )}

              {row.method === "CASH" && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {t("cashierCheckout.tender.cashReceived")}
                    </span>
                    <div className="relative min-w-0 flex-1">
                      <span className="text-muted-foreground pointer-events-none absolute top-3 left-3 text-sm">
                        {getCurrencySymbol(currency)}
                      </span>
                      <DecimalInput
                        aria-label={`${t("cashierCheckout.tender.cashReceived")} ${rowNo}`}
                        decimals={decimals}
                        min={0}
                        placeholder={t("cashierCheckout.tender.cashReceivedHint")}
                        aria-invalid={cashShort || undefined}
                        className="h-11 pl-9 text-base"
                        value={row.amountTendered ?? undefined}
                        onChange={(value) => updateRow(row.id, { amountTendered: value ?? null })}
                      />
                    </div>
                  </div>
                  {cashShort ? (
                    <p className="text-destructive text-xs font-medium">
                      {t("cashierCheckout.tender.cashShort")}
                    </p>
                  ) : (
                    change != null && (
                      <p className="text-muted-foreground flex justify-between text-xs">
                        <span>{t("pos.checkout.change")}</span>
                        <span className="font-medium tabular-nums">{formatPrice(change)}</span>
                      </p>
                    )
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full touch-manipulation gap-2"
        disabled={tenders.length >= MAX_TENDERS}
        onClick={addRow}
      >
        <Plus className="size-4" />
        {t("cashierCheckout.tender.add")}
      </Button>

      <div className="space-y-2 rounded-md border border-dashed p-2.5">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 text-sm font-medium">
            {t("cashierCheckout.tender.splitEquallyLabel")}
          </span>
          <div className="bg-muted/50 flex items-center rounded-md border">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 touch-manipulation rounded-sm"
              aria-label={t("cashierCheckout.tender.fewerPeople")}
              disabled={parts <= EQUAL_SPLIT_MIN}
              onClick={() => setParts((n) => Math.max(EQUAL_SPLIT_MIN, n - 1))}
            >
              <Minus className="size-4" />
            </Button>
            <span
              aria-live="polite"
              className="w-8 text-center text-sm font-semibold tabular-nums"
              data-testid="equal-split-parts"
            >
              {parts}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 touch-manipulation rounded-sm"
              aria-label={t("cashierCheckout.tender.morePeople")}
              disabled={parts >= EQUAL_SPLIT_MAX}
              onClick={() => setParts((n) => Math.min(EQUAL_SPLIT_MAX, n + 1))}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="h-11 w-full touch-manipulation"
          disabled={total <= 0}
          onClick={applyEqual}
        >
          {t("cashierCheckout.tender.splitEqually").replace("{count}", String(parts))}
        </Button>
        {firstShare !== undefined && (
          <p className="text-muted-foreground text-xs">
            {t("cashierCheckout.tender.eachShare").replace("{amount}", formatPrice(firstShare))}
            {lastShare !== firstShare &&
              ` · ${t("cashierCheckout.tender.lastShare").replace("{amount}", formatPrice(lastShare))}`}
          </p>
        )}
      </div>
    </div>
  );
}
