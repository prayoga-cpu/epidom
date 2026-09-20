"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Minus, Plus, Users } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { useFinanceSettings } from "@/features/dashboard/profile/hooks/use-finance-settings";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { nanoid } from "@/lib/utils/nanoid";
import { usePosCart } from "../hooks/use-pos-cart";
import { clearCustomerIntake } from "../hooks/use-customer-display";
import { allocateSplit, splitEqually, type SplitBill } from "../lib/split-bill";
import { getCurrencyDecimals } from "../lib/currency-decimals";
import type { CartItem } from "../types/pos.types";
import { PosCheckoutDialog, type CheckoutBasis } from "./pos-checkout-dialog";
import {
  EQUAL_SPLIT_MAX,
  EQUAL_SPLIT_MIN,
  equalSplitTenders,
  resolveTenderMethods,
} from "./pos-tender-list";

/** Bill 1 … Bill 6. More than six people is what "Equal split" is for. */
const MAX_BILLS = 6;
const MIN_BILLS = 2;

const round2 = (n: number) => Math.round(n * 100) / 100;

interface SplitSession {
  /** Order.splitGroupId shared by every bill of this split. */
  groupId: string;
  /** How many bills of it are already paid. */
  paid: number;
  /** Whether the table's pax already went out on a paid bill. */
  paxSent: boolean;
}

const newSplitSession = (): SplitSession => ({ groupId: nanoid(), paid: 0, paxSent: false });

interface PosSplitBillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName?: string;
  cashierName?: string;
  shiftId?: string;
}

/**
 * Split Bill — two ways to share one cart between several people.
 *
 *  - By items: deal lines (and per-line quantities) onto Bill 1…N. Each bill is
 *    its own Order, paid through the ordinary checkout (`basis`), and its lines
 *    leave the cart the moment it is paid — so a reload half-way through can
 *    neither lose a line nor charge one twice.
 *  - Equal split: ONE order, N payments. It pre-fills the checkout's tender list
 *    and opens it in split-payment mode.
 */
export function PosSplitBillDialog({
  open,
  onOpenChange,
  storeId,
  storeName,
  cashierName,
  shiftId,
}: PosSplitBillDialogProps) {
  const { t, locale } = useI18n();
  // Literal in the store's display currency — never IDR-converted.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);
  const decimals = getCurrencyDecimals(currency);
  const cart = usePosCart();
  const { data: financeSettings } = useFinanceSettings(storeId);
  const tenderMethods = resolveTenderMethods(financeSettings?.enabledPaymentMethods, locale);

  const [tab, setTab] = useState<"items" | "equal">("items");
  const [billCount, setBillCount] = useState(MIN_BILLS);
  const [activeBill, setActiveBill] = useState(0);
  /** CartItem.id → quantity dealt onto each bill (indexed by bill). */
  const [assign, setAssign] = useState<Record<string, number[]>>({});
  const [paidBills, setPaidBills] = useState<number[]>([]);
  const [equalParts, setEqualParts] = useState(EQUAL_SPLIT_MIN);
  // The bill being paid. Its basis is frozen when "Pay" is tapped: the cart can
  // change under an open checkout (another tab, the customer display), and what
  // the cashier confirmed must be what is charged.
  const [bill, setBill] = useState<{ index: number; basis: CheckoutBasis } | null>(null);
  const [billOpen, setBillOpen] = useState(false);
  const [equalOpen, setEqualOpen] = useState(false);

  // Shared by every bill of one split, and carried across closing/reopening this
  // dialog while some of them are already paid. Pax is counted once — on Bill 1.
  // A ref holding ONE object that is reset in place, so the handlers below never
  // close over a stale session; created lazily so nanoid() doesn't run every render.
  const sessionRef = useRef<SplitSession | null>(null);
  if (sessionRef.current === null) sessionRef.current = newSplitSession();
  const session = sessionRef.current;

  useEffect(() => {
    if (!open) return;
    setTab("items");
    setBillCount(MIN_BILLS);
    setActiveBill(0);
    setAssign({});
    setPaidBills([]);
    setEqualParts(EQUAL_SPLIT_MIN);
    setBillOpen(false);
    setEqualOpen(false);
    // A dialog reopened over a cart with nothing paid yet starts a NEW split.
    if (session.paid === 0 || usePosCart.getState().items.length === 0) {
      Object.assign(session, newSplitSession());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const items = cart.items;
  const blockedByPromo = cart.discountSource?.kind === "coupon" || cart.pointsRedeemed > 0;
  // A resumed Saved bill settles through /finalize, which pays ALL of its lines —
  // it cannot pay one bill's worth and leave the rest saved.
  const blockedByResume = !!cart.resumingOrderId;
  const itemsSplitBlocked = blockedByPromo || blockedByResume;

  const allocation = useMemo(
    () =>
      allocateSplit({
        items,
        assignments: Object.entries(assign).map(([lineId, quantities]) => ({ lineId, quantities })),
        billCount,
        discountAmount: cart.discountAmount,
        settings: cart.financeSettings,
      }),
    [items, assign, billCount, cart.discountAmount, cart.financeSettings]
  );
  const result = allocation.ok ? allocation.result : null;

  const isPaid = (index: number) => paidBills.includes(index);
  const currentBill: SplitBill | null =
    result && !isPaid(activeBill) ? (result.bills[activeBill] ?? null) : null;

  const qtyOn = (line: CartItem, index: number) => assign[line.id]?.[index] ?? 0;
  const qtyElsewhere = (line: CartItem, index: number) =>
    (assign[line.id] ?? []).reduce((sum, q, i) => (i === index ? sum : sum + (q ?? 0)), 0);

  const setQty = (line: CartItem, index: number, quantity: number) => {
    setAssign((prev) => {
      const row = [...(prev[line.id] ?? [])];
      while (row.length < billCount) row.push(0);
      row[index] = quantity;
      return { ...prev, [line.id]: row };
    });
  };

  const addBill = () => {
    if (billCount >= MAX_BILLS) return;
    setBillCount(billCount + 1);
    setActiveBill(billCount);
  };

  const removeBill = (index: number) => {
    if (billCount <= MIN_BILLS || isPaid(index)) return;
    setAssign((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([id, row]) => [id, row.filter((_, i) => i !== index)])
      )
    );
    setPaidBills((prev) => prev.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i)));
    setBillCount(billCount - 1);
    setActiveBill((a) => Math.max(0, Math.min(a > index ? a - 1 : a, billCount - 2)));
  };

  const payBill = (billToPay: SplitBill) => {
    const basis: CheckoutBasis = {
      items: billToPay.items,
      subtotal: billToPay.charges.subtotal,
      tax: billToPay.charges.tax,
      serviceCharge: billToPay.charges.serviceCharge,
      discountAmount: billToPay.charges.discountAmount,
      discountReason: cart.discountReason,
      total: billToPay.charges.total,
      splitGroupId: session.groupId,
      // Only Bill 1 carries the table's pax, and only once.
      guestCount: billToPay.index === 0 && !session.paxSent ? cart.guestCount : null,
    };
    setBill({ index: billToPay.index, basis });
    setBillOpen(true);
  };

  // Called by the checkout the instant the bill's order exists.
  const handleBillPaid = () => {
    if (!bill) return;
    const { index, basis } = bill;
    const before = usePosCart.getState();
    const discountBefore = before.discountAmount;
    const reason = before.discountReason;
    const hadDiscount = before.discountSource !== null;

    // The paid lines leave the cart, so nothing here can be paid twice, and a
    // reload right now shows exactly the lines still owed.
    before.removeLines(basis.items.map((line) => ({ lineId: line.id, quantity: line.quantity })));

    if (hadDiscount) {
      // This bill already took its share of the discount. Keep only what is left
      // for the bills still to pay — otherwise a FIXED discount would be applied
      // again in full to the remaining lines.
      const left = round2(discountBefore - basis.discountAmount);
      usePosCart
        .getState()
        .setDiscountSource(
          left > 0.004 ? { kind: "manual", amount: left, reason: reason ?? undefined } : null
        );
    }

    session.paid += 1;
    if (index === 0) session.paxSent = true;
    setPaidBills((prev) => [...prev, index]);
    // Bill `index` is closed: its column no longer holds anything.
    setAssign((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([id, row]) => [id, row.map((q, i) => (i === index ? 0 : q))])
      )
    );
    const next = Array.from({ length: billCount }, (_, i) => i).find(
      (i) => i !== index && !paidBills.includes(i)
    );
    if (next !== undefined) setActiveBill(next);
  };

  // The order-complete screen was dismissed. With nothing left in the cart the
  // whole sale is done: reset it and close.
  const handleDone = () => {
    if (usePosCart.getState().items.length === 0) {
      usePosCart.getState().clearCart();
      clearCustomerIntake();
      Object.assign(session, newSplitSession());
      onOpenChange(false);
    }
  };

  const startEqualSplit = () => {
    cart.setDraftTenders(
      equalSplitTenders({
        total: cart.total,
        parts: equalParts,
        decimals,
        existing: [],
        defaultMethod: tenderMethods.includes("CASH") ? "CASH" : tenderMethods[0],
      })
    );
    setEqualOpen(true);
  };

  const shares = cart.total > 0 ? splitEqually(cart.total, equalParts, decimals) : [];
  const undealtCount = result ? result.remainder.items.reduce((n, i) => n + i.quantity, 0) : 0;
  const cartEmpty = items.length === 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <FormDialogLayout
          title={t("cashierCheckout.split.title")}
          description={t("cashierCheckout.split.description")}
          maxWidth="xl"
          footer={
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => onOpenChange(false)}
            >
              {t("cashierCheckout.split.close")}
            </Button>
          }
        >
          {cartEmpty && paidBills.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {t("cashierCheckout.split.emptyCart")}
            </p>
          ) : cartEmpty ? (
            <p className="py-8 text-center text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {t("cashierCheckout.split.allPaid")}
            </p>
          ) : (
            <Tabs value={tab} onValueChange={(v) => setTab(v as "items" | "equal")}>
              <TabsList className="h-11 w-full">
                <TabsTrigger value="items" className="touch-manipulation">
                  {t("cashierCheckout.split.tabItems")}
                </TabsTrigger>
                <TabsTrigger value="equal" className="touch-manipulation">
                  {t("cashierCheckout.split.tabEqual")}
                </TabsTrigger>
              </TabsList>

              {/* ── By items ─────────────────────────────────────────────── */}
              <TabsContent value="items" className="space-y-4 pt-3">
                {itemsSplitBlocked ? (
                  <div
                    role="alert"
                    className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
                  >
                    {blockedByPromo
                      ? t("cashierCheckout.split.blockedPromo")
                      : t("cashierCheckout.split.blockedResumed")}
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-stretch gap-2">
                      {Array.from({ length: billCount }, (_, i) => {
                        const paid = isPaid(i);
                        const b = result?.bills[i];
                        const active = i === activeBill;
                        return (
                          <button
                            key={i}
                            type="button"
                            disabled={paid}
                            aria-pressed={active}
                            onClick={() => setActiveBill(i)}
                            className={cn(
                              "flex min-h-11 min-w-[6.5rem] touch-manipulation flex-col items-start justify-center rounded-md border px-3 py-1.5 text-left transition-colors",
                              active && !paid
                                ? "border-primary bg-primary/10"
                                : "bg-background hover:border-foreground/40",
                              paid && "border-emerald-500/40 bg-emerald-500/10"
                            )}
                          >
                            <span className="flex items-center gap-1 text-xs font-semibold">
                              {paid && <Check className="size-3 text-emerald-600" />}
                              {t("cashierCheckout.split.billN").replace("{n}", String(i + 1))}
                            </span>
                            <span className="text-sm font-medium tabular-nums">
                              {paid
                                ? t("cashierCheckout.split.paid")
                                : b && b.items.length > 0
                                  ? formatPrice(b.charges.total)
                                  : "—"}
                            </span>
                          </button>
                        );
                      })}
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 touch-manipulation gap-1.5"
                        disabled={billCount >= MAX_BILLS}
                        onClick={addBill}
                      >
                        <Plus className="size-4" />
                        {t("cashierCheckout.split.addBill")}
                      </Button>
                    </div>

                    {/* The lines: tapping − / + deals units onto the SELECTED bill. */}
                    <ul className="divide-y rounded-md border">
                      {items.map((line) => {
                        const here = qtyOn(line, activeBill);
                        const max = line.quantity - qtyElsewhere(line, activeBill);
                        const elsewhere = qtyElsewhere(line, activeBill);
                        return (
                          <li
                            key={line.id}
                            data-testid="split-line"
                            className="flex items-center gap-3 px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{line.name}</p>
                              <p className="text-muted-foreground text-xs tabular-nums">
                                {`×${line.quantity} · ${formatPrice(line.lineTotal)}`}
                                {elsewhere > 0 &&
                                  ` · ${t("cashierCheckout.split.onOtherBills").replace("{count}", String(elsewhere))}`}
                              </p>
                            </div>
                            <div className="bg-muted/50 flex shrink-0 items-center rounded-md border">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11 touch-manipulation rounded-sm"
                                aria-label={`${t("cashierCheckout.split.fewer")} — ${line.name}`}
                                disabled={isPaid(activeBill) || here <= 0}
                                onClick={() => setQty(line, activeBill, here - 1)}
                              >
                                <Minus className="size-4" />
                              </Button>
                              <span
                                data-testid="split-qty"
                                className="w-8 text-center text-sm font-semibold tabular-nums"
                              >
                                {here}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11 touch-manipulation rounded-sm"
                                aria-label={`${t("cashierCheckout.split.more")} — ${line.name}`}
                                disabled={isPaid(activeBill) || here >= max}
                                onClick={() => setQty(line, activeBill, here + 1)}
                              >
                                <Plus className="size-4" />
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    {result && undealtCount > 0 && (
                      <p className="text-muted-foreground text-xs" data-testid="split-remainder">
                        {t("cashierCheckout.split.undealt")
                          .replace("{count}", String(undealtCount))
                          .replace("{amount}", formatPrice(result.remainder.itemsTotal))}
                      </p>
                    )}

                    {!allocation.ok && (
                      <p role="alert" className="text-destructive text-xs font-medium">
                        {t("cashierCheckout.split.overAssigned")}
                      </p>
                    )}

                    {currentBill && (
                      <div className="bg-muted/20 space-y-3 rounded-md border p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">
                            {t("cashierCheckout.split.billN").replace(
                              "{n}",
                              String(currentBill.index + 1)
                            )}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-10 touch-manipulation"
                            disabled={billCount <= MIN_BILLS}
                            onClick={() => removeBill(currentBill.index)}
                          >
                            {t("cashierCheckout.split.removeBill")}
                          </Button>
                        </div>

                        <dl className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">
                              {t("cashierCheckout.split.itemsTotal")}
                            </dt>
                            <dd className="tabular-nums">{formatPrice(currentBill.itemsTotal)}</dd>
                          </div>
                          {currentBill.charges.discountAmount > 0 && (
                            <div className="flex justify-between">
                              <dt className="text-muted-foreground">
                                {t("cashierCheckout.split.discountShare")}
                              </dt>
                              <dd className="tabular-nums">
                                −{formatPrice(currentBill.charges.discountAmount)}
                              </dd>
                            </div>
                          )}
                          {currentBill.charges.serviceCharge > 0 && (
                            <div className="flex justify-between">
                              <dt className="text-muted-foreground">
                                {t("cashierCheckout.split.serviceCharge")}
                              </dt>
                              <dd className="tabular-nums">
                                {formatPrice(currentBill.charges.serviceCharge)}
                              </dd>
                            </div>
                          )}
                          {currentBill.charges.tax > 0 && (
                            <div className="flex justify-between">
                              <dt className="text-muted-foreground">
                                {t("cashierCheckout.split.tax")}
                              </dt>
                              <dd className="tabular-nums">
                                {formatPrice(currentBill.charges.tax)}
                              </dd>
                            </div>
                          )}
                          <div className="flex justify-between border-t pt-1 text-base font-semibold">
                            <dt>{t("cashierCheckout.split.billTotal")}</dt>
                            <dd data-testid="split-bill-total" className="tabular-nums">
                              {formatPrice(currentBill.charges.total)}
                            </dd>
                          </div>
                        </dl>

                        <Button
                          type="button"
                          className="h-12 w-full touch-manipulation text-base font-semibold"
                          disabled={currentBill.items.length === 0}
                          onClick={() => payBill(currentBill)}
                        >
                          {t("cashierCheckout.split.payBill").replace(
                            "{n}",
                            String(currentBill.index + 1)
                          )}
                        </Button>
                        {currentBill.items.length === 0 && (
                          <p className="text-muted-foreground text-center text-xs">
                            {t("cashierCheckout.split.emptyBill")}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              {/* ── Equal split ──────────────────────────────────────────── */}
              <TabsContent value="equal" className="space-y-4 pt-3">
                <p className="text-muted-foreground text-sm">
                  {t("cashierCheckout.split.equalHint")}
                </p>

                <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Users className="size-4" />
                    {t("cashierCheckout.split.people")}
                  </span>
                  <div className="bg-muted/50 flex items-center rounded-md border">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 touch-manipulation rounded-sm"
                      aria-label={t("cashierCheckout.tender.fewerPeople")}
                      disabled={equalParts <= EQUAL_SPLIT_MIN}
                      onClick={() => setEqualParts((n) => Math.max(EQUAL_SPLIT_MIN, n - 1))}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <span
                      data-testid="equal-parts"
                      className="w-8 text-center text-sm font-semibold tabular-nums"
                    >
                      {equalParts}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 touch-manipulation rounded-sm"
                      aria-label={t("cashierCheckout.tender.morePeople")}
                      disabled={equalParts >= EQUAL_SPLIT_MAX}
                      onClick={() => setEqualParts((n) => Math.min(EQUAL_SPLIT_MAX, n + 1))}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>

                {shares.length > 0 && (
                  <p className="text-sm tabular-nums" data-testid="equal-share">
                    {t("cashierCheckout.tender.eachShare").replace(
                      "{amount}",
                      formatPrice(shares[0])
                    )}
                    {shares[shares.length - 1] !== shares[0] &&
                      ` · ${t("cashierCheckout.tender.lastShare").replace("{amount}", formatPrice(shares[shares.length - 1]))}`}
                  </p>
                )}

                <Button
                  type="button"
                  className="h-12 w-full touch-manipulation text-base font-semibold"
                  disabled={cart.total <= 0}
                  onClick={startEqualSplit}
                >
                  {t("cashierCheckout.split.continueToPayment")} · {formatPrice(cart.total)}
                </Button>
              </TabsContent>
            </Tabs>
          )}
        </FormDialogLayout>
      </Dialog>

      {/* One bill of a split-by-items. Stays mounted after it closes: the
          order-complete screen it hosts must outlive the checkout itself. */}
      <PosCheckoutDialog
        open={billOpen}
        onOpenChange={setBillOpen}
        storeId={storeId}
        storeName={storeName}
        cashierName={cashierName}
        shiftId={shiftId}
        basis={bill?.basis}
        title={
          bill
            ? t("cashierCheckout.split.payBillTitle").replace("{n}", String(bill.index + 1))
            : undefined
        }
        onPaid={handleBillPaid}
        onDone={handleDone}
      />

      {/* The whole cart, N tenders: the ordinary checkout, opened in split mode. */}
      <PosCheckoutDialog
        open={equalOpen}
        onOpenChange={setEqualOpen}
        storeId={storeId}
        storeName={storeName}
        cashierName={cashierName}
        shiftId={shiftId}
        onDone={handleDone}
      />
    </>
  );
}
