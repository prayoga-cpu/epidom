import { NextResponse } from "next/server";
import { Prisma, type OrderStatus, type OrderType, type PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import type { CreatePosOrderInput } from "@/lib/validation/pos.schemas";
import {
  computeOrderCharges,
  type OrderCharges,
  type ResolvedFinanceSettings,
} from "@/lib/finance/order-charges";
import {
  computeTendersProcessingFee,
  legacyToTenders,
  normalizeTenders,
  resolveOrderPaymentMethod,
  type NormalizedTender,
  type TenderInput,
  type TenderMethod,
} from "@/lib/finance/order-payments";
import type { PosOrderCreatedDto } from "@/types/api/cashier";
// Imported from the module, not the "@/lib/services" barrel: the barrel pulls
// in every service (and could later re-export this file), which is exactly the
// kind of import cycle that turns into an undefined-at-runtime function.
import { resolveFinanceSettingsForOrder } from "./finance-settings.service";
import {
  OrderBuildError,
  resolveSettledOrderStatus,
  validateAndBuildOrderItems,
  type BuiltOrderItem,
} from "./pos-order-builder";
import {
  resolveOrderDiscount,
  PromotionsPlanError,
  type ResolvedOrderDiscount,
} from "./pos-discount.service";
import {
  consumeCouponUse,
  earnPointsForOrder,
  redeemPointsForOrder,
  reverseLoyaltyForOrder,
  LoyaltyConflictError,
} from "./loyalty.service";
import { claimOrderTransition, claimOrderTransitions } from "./order-status.helpers";

/**
 * The one shared settlement path behind POST /pos/orders and
 * /pos/orders/[orderId]/finalize.
 *
 * Those two routes were near-identical copies of the same pricing → discount →
 * payment → persist logic, which is how they drifted apart before. Everything
 * that decides WHAT gets written lives here; the routes keep only what is
 * genuinely theirs (idempotency lookup, create-vs-update, table/shift handling,
 * the after() side effects and the Inngest event).
 *
 * Money stays `Decimal` all the way to Prisma; `Number()` only appears at the
 * response edge. Amounts are literal in the store's display currency.
 */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Interactive-transaction budget for a checkout. Prisma's default is 5s, and
 * the settlement transaction is now ~11 statements (claim, item/payment
 * replace, the order write, the table, coupon, points, earn) on what is the
 * busiest path in the product — a cold connection or a slow Neon round trip
 * would abort a sale that had already taken the customer's money.
 */
export const POS_ORDER_TX_TIMEOUT_MS = 15_000;

/** A settlement failure the caller turns straight into an HTTP response. */
export class SettlementError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: ApiErrorCode = ApiErrorCode.INVALID_INPUT
  ) {
    super(message);
  }
}

/** Only the store flags settlement actually branches on. */
export interface SettlementStore {
  kitchenDisplayEnabled: boolean;
  payLaterEnabled: boolean;
}

export interface SettlementCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

export interface PosSettlement {
  orderItems: BuiltOrderItem[];
  subtotal: number;
  /** processingFee/processingFeeRate are the TENDER-derived values. */
  charges: OrderCharges;
  /** Empty for PAY_LATER and for a fully-discounted (zero) bill. */
  tenders: NormalizedTender[];
  /** SPLIT only when two or more tenders settled the bill. */
  paymentMethod: PaymentMethod;
  paymentStatus: "PAID" | "PENDING";
  discount: ResolvedOrderDiscount;
  customer: SettlementCustomer | null;
  /** The snapshot written to Order.customerName. */
  customerName: string;
  /** Cash change owed across all CASH tenders; null when none was tendered. */
  change: number | null;
  settledStatus: OrderStatus;
  immediatelyDelivered: boolean;
  /** Degradations recorded on an offline replay; appended to Order.notes. */
  warnings: string[];
  /** True when the request carried a clientRequestId (offline replay). */
  tolerant: boolean;
}

/**
 * Price and validate a checkout submission. Does every READ and all the pure
 * math, and writes nothing — so the caller's `$transaction` stays as short as
 * it was before.
 */
export async function buildPosSettlement(args: {
  storeId: string;
  store: SettlementStore;
  input: CreatePosOrderInput;
}): Promise<PosSettlement> {
  const { storeId, store, input } = args;

  // An offline replay is a sale the customer ALREADY paid for on a
  // disconnected till. The queue deletes an entry after 5 failed attempts, so
  // from here on nothing may 4xx over a coupon/customer/points problem — see
  // resolveOrderDiscount's `tolerant`.
  //
  // DELIBERATE: `tolerant` is keyed on clientRequestId alone, which means an
  // offline payload's own `discountAmount` is trusted as the manual discount.
  // That is not an oversight and must not be "hardened" away — the pre-2.88.0
  // routes already trusted it (it is the staff discount field), and the only
  // alternative for a sale that was rung up on a disconnected till is to
  // reject money the customer has already handed over.
  const tolerant = !!input.clientRequestId;

  // `payments[]` overrides the legacy single-method fields entirely, so a
  // body carrying both is a tendered sale, never a Pay Later.
  const isPayLater = !input.payments?.length && input.paymentMethod === "PAY_LATER";

  // Defense in depth — the client only shows "Pay Later" as a checkout option
  // when the store has enabled it, but never trust that a request actually
  // came from a client that enforced it.
  if (isPayLater && !store.payLaterEnabled) {
    throw new SettlementError("Pay Later is not enabled for this store", 422);
  }

  // Independent reads (both only need storeId) — run concurrently instead of
  // two sequential round trips on the critical checkout path.
  const [built, financeSettings] = await Promise.all([
    validateAndBuildOrderItems(storeId, input.items),
    resolveFinanceSettingsForOrder(storeId),
  ]);
  const { orderItems, subtotal } = built;

  const warnings: string[] = [];

  let customer: SettlementCustomer | null = null;
  if (input.customerId) {
    customer = await prisma.customer.findFirst({
      where: { id: input.customerId, storeId },
      select: { id: true, name: true, phone: true, email: true },
    });
    if (!customer) {
      if (!tolerant) throw new SettlementError("Customer not found", 422);
      warnings.push("Customer not found; the sale was recorded without it");
    }
  }

  const discount = await resolveOrderDiscount({
    storeId,
    itemsTotal: subtotal,
    discountAmount: input.discountAmount,
    discountReason: input.discountReason,
    presetId: input.presetId,
    couponCode: input.couponCode,
    // Points can only burn against a resolved customer's balance.
    redeemPoints: customer ? input.redeemPoints : undefined,
    customerId: customer?.id,
    tolerant,
  });
  warnings.push(...discount.warnings);

  // ONE precedence rule for "which method did the cashier pick", used both for
  // the fee basis and for the method stored on a zero-total bill — they must
  // never disagree about the same request. `payments[]` wins because it
  // overrides the legacy fields entirely.
  const requestedMethod: PaymentMethod = (input.payments?.[0]?.method ??
    input.paymentMethod ??
    "CASH") as PaymentMethod;

  // computeOrderCharges prices exactly ONE payment method's processing fee.
  // For a single tender that is already the right answer (and keeps ordinary
  // orders byte-identical); for several it is replaced below by the per-tender
  // sum. The customer's total never depends on it either way — the fee is a
  // merchant cost recorded alongside the order, not a line on the bill.
  const feeMethodForCharges: PaymentMethod = isPayLater ? "PAY_LATER" : requestedMethod;

  const baseCharges = computeOrderCharges({
    itemsTotal: subtotal,
    discountAmount: discount.discountAmount,
    paymentMethod: feeMethodForCharges,
    settings: financeSettings,
  });

  let tenders: NormalizedTender[] = [];
  let paymentMethod: PaymentMethod;
  let charges = baseCharges;

  if (isPayLater) {
    paymentMethod = "PAY_LATER";
  } else if (baseCharges.total <= 0 && !input.payments?.length) {
    // A fully discounted bill (e.g. a 100% preset) settled the legacy way: no
    // money changes hands, so there is nothing to tender and normalizeTenders
    // would rightly reject a zero-amount row. Record the cashier's chosen
    // method and write no OrderPayment rows — readers already fall back to
    // Order.paymentMethod.
    //
    // Narrowed to the no-`payments[]` case on purpose: a client that SENT
    // positive tenders against a server-priced total of zero disagrees with
    // the server about the bill, and silently dropping those rows would make a
    // cash receipt vanish from the drawer. That falls through to
    // normalizeTenders below and comes back as a SUM_MISMATCH the cashier can
    // actually see.
    paymentMethod = requestedMethod;
  } else {
    const tenderInputs: TenderInput[] = input.payments?.length
      ? input.payments.map((p) => ({
          method: p.method as TenderMethod,
          amount: p.amount,
          amountTendered: p.amountTendered ?? null,
          note: p.note ?? null,
        }))
      : legacyToTenders(
          {
            paymentMethod: input.paymentMethod as TenderMethod,
            amountTendered: input.amountTendered ?? null,
            paymentNote: input.paymentNote ?? null,
          },
          baseCharges.total
        );

    const normalized = normalizeTenders(baseCharges.total, tenderInputs);
    if (!normalized.ok) {
      // Keep the exact pre-multi-tender wording for the one case a legacy
      // client can hit, so nothing downstream that matched on it breaks.
      const message =
        normalized.error.code === "CASH_UNDERPAID"
          ? "Amount tendered is less than the order total"
          : normalized.error.message;
      throw new SettlementError(message, 422);
    }

    tenders = normalized.tenders;
    paymentMethod = resolveOrderPaymentMethod(tenders);

    const fee = computeTendersProcessingFee({
      tenders,
      enabled: financeSettings.processingFeeEnabled,
      overrides: financeSettings.processingFeeOverrides,
    });
    charges = { ...baseCharges, processingFee: fee.fee, processingFeeRate: fee.rate };
  }

  const change = tenders.some((t) => t.change != null)
    ? round2(tenders.reduce((sum, t) => sum + (t.change ?? 0), 0))
    : null;

  const settledStatus = resolveSettledOrderStatus(paymentMethod, store.kitchenDisplayEnabled);

  return {
    orderItems,
    subtotal,
    charges,
    tenders,
    paymentMethod,
    paymentStatus: isPayLater ? "PENDING" : "PAID",
    discount,
    customer,
    customerName: customer?.name ?? input.customerName ?? "Walk-in",
    change,
    settledStatus,
    immediatelyDelivered: settledStatus === "DELIVERED",
    warnings,
    tolerant,
  };
}

/** Order lines as Prisma nested-create rows. Shared with the hold route. */
export function buildOrderItemCreateData(items: BuiltOrderItem[]) {
  return items.map((i) => ({
    menuItemId: i.menuItemId,
    name: i.name,
    quantity: new Prisma.Decimal(i.quantity),
    unit: i.unit,
    unitPrice: new Prisma.Decimal(i.unitPrice),
    total: new Prisma.Decimal(i.total),
    notes: i.notes,
    selectedOptions: i.selectedOptions as Prisma.InputJsonValue | undefined,
    status: i.initialStatus,
    // Only ever true/non-null for a Custom Item; ordinary lines keep the
    // column defaults so nothing about an existing order's shape changes.
    isCustom: i.isCustom,
    department: i.department,
  }));
}

/**
 * The warnings an offline replay degraded on, folded into Order.notes — the
 * only place a cashier will ever see that the coupon they scanned offline
 * didn't actually get consumed.
 */
function composeOrderNotes(notes: string | undefined, warnings: string[]): string | undefined {
  if (!warnings.length) return notes;
  return [notes?.trim(), ...warnings].filter(Boolean).join(" · ");
}

/**
 * The Order columns both routes write. Returned as a plain object so each
 * route can spread it into its own `create`/`update` alongside the few fields
 * that really are route-specific (orderNumber, storeId, source, shiftId…).
 */
export function buildSettlementOrderData(args: {
  settlement: PosSettlement;
  input: CreatePosOrderInput;
  /** Used when neither a Customer record nor input.customerName is present. */
  fallbackCustomerName?: string;
  /** Finalize only: the HELD row's pax count, so a takeaway switch can't wipe it. */
  existingGuestCount?: number | null;
  /**
   * Finalize only: the customer the HOLD already attached. Kept when the
   * checkout body OMITS customerId, because the failure modes are not
   * symmetric — an extra attached customer is visible and fixable, a silently
   * dropped one means the sale never earns its loyalty points and never shows
   * up in that customer's lifetime spend. To actually detach one, the client
   * sends `customerId: null` explicitly (the schema allows it); that is
   * distinguishable from "omitted" and clears the column.
   */
  existingCustomerId?: string | null;
}) {
  const { settlement: s, input } = args;
  const { charges } = s;

  return {
    customerName: s.customer?.name ?? input.customerName ?? args.fallbackCustomerName ?? "Walk-in",
    customerPhone: s.customer?.phone ?? input.customerPhone,
    // The email receipt needs Order.customerEmail. A Customer record's own
    // address wins; failing that, one the customer typed on the customer-facing
    // screen without being saved as a customer (input.customerEmail).
    ...((s.customer?.email ?? input.customerEmail)
      ? { customerEmail: s.customer?.email ?? input.customerEmail }
      : {}),
    orderType: input.orderType as OrderType,
    // Only DINE_IN carries a pax count — see the schema comment on
    // Order.guestCount. Takeaway stays null rather than being coerced to 1.
    guestCount:
      input.orderType === "DINE_IN" ? (input.guestCount ?? args.existingGuestCount ?? null) : null,
    tableNumber: input.tableNumber,
    tableId: input.tableId,
    paymentMethod: s.paymentMethod,
    paymentStatus: s.paymentStatus,
    paymentNote: input.paymentNote,
    status: s.settledStatus,
    ...(s.immediatelyDelivered && { deliveredDate: new Date() }),
    notes: composeOrderNotes(input.notes, s.warnings),
    subtotal: new Prisma.Decimal(charges.subtotal),
    tax: new Prisma.Decimal(charges.tax),
    delivery: new Prisma.Decimal(0),
    total: new Prisma.Decimal(charges.total),
    discountAmount: new Prisma.Decimal(charges.discountAmount),
    // `null`, never `undefined`: on the finalize UPDATE path `undefined` is a
    // Prisma no-op, so a bill whose discount the cashier removed kept the old
    // "Coupon: SAVE20" reason next to a zero discount.
    discountReason: charges.discountAmount > 0 ? (s.discount.discountReason ?? null) : null,
    serviceCharge: new Prisma.Decimal(charges.serviceCharge),
    processingFee: new Prisma.Decimal(charges.processingFee),
    taxRate: new Prisma.Decimal(charges.taxRate),
    serviceChargeRate: new Prisma.Decimal(charges.serviceChargeRate),
    processingFeeRate: new Prisma.Decimal(charges.processingFeeRate),
    // `null` in the body means "detach"; `undefined` means "leave whatever the
    // hold recorded" — see existingCustomerId above.
    customerId:
      s.customer?.id ?? (input.customerId === null ? null : (args.existingCustomerId ?? null)),
    couponId: s.discount.couponId,
    pointsRedeemed: s.discount.pointsRedeemed,
    splitGroupId: input.splitGroupId ?? null,
    items: { create: buildOrderItemCreateData(s.orderItems) },
    payments: {
      create: s.tenders.map((t) => ({
        method: t.method as PaymentMethod,
        amount: new Prisma.Decimal(t.amount),
        amountTendered: t.amountTendered != null ? new Prisma.Decimal(t.amountTendered) : null,
        change: t.change != null ? new Prisma.Decimal(t.change) : null,
        note: t.note,
      })),
    },
  };
}

/**
 * The customer/coupon/points bookkeeping that must commit with the order —
 * hence `tx`, not the after() block: a coupon use that outlives a rolled-back
 * order is a use nobody got.
 *
 * On an offline replay a lost race (coupon fully used since, points already
 * spent) is degraded instead of thrown: the order keeps the money the customer
 * was actually charged, but drops the claim to a coupon/points it never
 * consumed.
 */
export async function applySettlementBookkeeping(
  tx: Prisma.TransactionClient,
  args: {
    orderId: string;
    storeId: string;
    settlement: PosSettlement;
    /** Whatever was just written to Order.notes, so a degradation appends to it. */
    currentNotes?: string;
  }
): Promise<{ pointsEarned: number; warnings: string[] }> {
  const { orderId, storeId, settlement: s } = args;
  const warnings: string[] = [];
  let couponFailed = false;
  let pointsFailed = false;

  if (s.discount.couponId) {
    try {
      await consumeCouponUse(
        { couponId: s.discount.couponId, storeId, maxUses: s.discount.couponMaxUses },
        tx
      );
    } catch (err) {
      if (!s.tolerant || !(err instanceof LoyaltyConflictError)) throw err;
      couponFailed = true;
      warnings.push("Coupon could not be redeemed on replay");
    }
  }

  if (s.discount.pointsRedeemed > 0 && s.customer) {
    try {
      await redeemPointsForOrder(
        {
          customerId: s.customer.id,
          storeId,
          orderId,
          points: s.discount.pointsRedeemed,
          note: "POS order",
        },
        tx
      );
    } catch (err) {
      if (!s.tolerant || !(err instanceof LoyaltyConflictError)) throw err;
      pointsFailed = true;
      warnings.push("Points could not be redeemed on replay");
    }
  }

  if (couponFailed || pointsFailed) {
    await tx.order.update({
      where: { id: orderId },
      data: {
        ...(couponFailed ? { couponId: null } : {}),
        ...(pointsFailed ? { pointsRedeemed: 0 } : {}),
        notes: composeOrderNotes(args.currentNotes, warnings),
      },
    });
  }

  // Points are EARNED on the PAID transition only — a PAY_LATER order earns
  // later, from the mark-paid PATCH or the Xendit webhook, via the same
  // idempotent helper.
  const pointsEarned = s.paymentStatus === "PAID" ? await earnPointsForOrder(orderId, tx) : 0;

  return { pointsEarned, warnings };
}

// ─── Guarded transaction bodies ──────────────────────────────────────────────
// Everything below runs INSIDE a caller's $transaction and starts with an
// atomic claim (see claimOrderTransition). They live here, rather than inline
// in the route handlers, purely so the races they exist to close are
// unit-testable against a mocked tx — a route handler is not.

/**
 * Finalize's write-claim. Flips the HELD row straight to its settled status
 * and returns only for the caller that actually did it.
 *
 * MUST be the first statement in the finalize transaction. The pre-flight
 * `status === "HELD"` check the route does outside the transaction is a
 * courtesy 409, not a guard: two tills finalizing the same saved bill both
 * pass it, and without this claim both would go on to consume the coupon and
 * burn the points a second time.
 */
export async function claimHeldOrderForSettlement(
  tx: Prisma.TransactionClient,
  args: { orderId: string; storeId: string; settledStatus: OrderStatus }
): Promise<void> {
  const won = await claimOrderTransition(tx, {
    orderId: args.orderId,
    storeId: args.storeId,
    guard: { status: "HELD" },
    data: { status: args.settledStatus },
  });
  if (!won) {
    throw new SettlementError("Order is no longer held", 409, ApiErrorCode.CONFLICT);
  }
}

/**
 * "Mark as Paid" on a PENDING order: claim the PAID transition, and only for
 * the winner write the single tender row and credit loyalty points.
 *
 * Without the claim, two concurrent PATCHes each wrote a full-total
 * OrderPayment, which doubles the cash drawer's expected cash and every
 * by-method breakdown built on those rows.
 *
 * `tenderMethod` is null when nothing real can be named (PAY_LATER / SPLIT
 * with no explicit method) — then no row is written and readers fall back to
 * Order.paymentMethod/total, as they do for every pre-2.88.0 order.
 */
export async function settlePendingOrderInTx(
  tx: Prisma.TransactionClient,
  args: {
    orderId: string;
    storeId: string;
    tenderMethod: PaymentMethod | null;
    paymentNote?: string | null;
    /** True when the order already carries tender rows (never write a second set). */
    hasExistingPayments: boolean;
  }
): Promise<{ settled: boolean; pointsEarned: number }> {
  const won = await claimOrderTransition(tx, {
    orderId: args.orderId,
    storeId: args.storeId,
    guard: { paymentStatus: { not: "PAID" } },
    data: { paymentStatus: "PAID" },
  });
  if (!won) return { settled: false, pointsEarned: 0 };

  if (args.tenderMethod && !args.hasExistingPayments) {
    const order = await tx.order.findUnique({
      where: { id: args.orderId },
      select: { total: true },
    });
    if (order) {
      await tx.orderPayment.create({
        data: {
          orderId: args.orderId,
          method: args.tenderMethod,
          // A settle-up covers the whole bill; there is no partial-payment
          // state in this system. `amount` never includes cash change.
          amount: new Prisma.Decimal(order.total),
          note: args.paymentNote?.trim() ? args.paymentNote.trim() : null,
        },
      });
    }
  }

  // Points are earned on the PAID transition, wherever it happens. Idempotent
  // on its own (Order.pointsEarned), but gated on the claim anyway so the
  // loser does no work at all.
  const pointsEarned = await earnPointsForOrder(args.orderId, tx);
  return { settled: true, pointsEarned };
}

/**
 * Cancel claim. Only the caller that actually moved the order to CANCELLED
 * unwinds its loyalty — reverseLoyaltyForOrder's coupon release is explicitly
 * at-most-once-per-transition, so two concurrent cancels would otherwise hand
 * the same coupon use back twice.
 */
export async function cancelOrderInTx(
  tx: Prisma.TransactionClient,
  args: { orderId: string; storeId: string }
): Promise<boolean> {
  const won = await claimOrderTransition(tx, {
    orderId: args.orderId,
    storeId: args.storeId,
    guard: { status: { not: "CANCELLED" } },
    data: { status: "CANCELLED" },
  });
  if (!won) return false;

  await reverseLoyaltyForOrder(args.orderId, 1, tx);
  return true;
}

export interface MergeSourceOrder {
  id: string;
  notes: string | null;
  tableId: string | null;
}

/**
 * The whole merge, as one guarded transaction body.
 *
 * Both claims come first: the target must still be a saved unpaid bill, and
 * EVERY source must still be HELD at the moment we take them. Without that,
 * a bill the other till finalized (and the customer paid for) in between could
 * be re-parented and then cancelled out from under them.
 *
 * Sources are CANCELLED, never deleted — Order is an immutable ledger, and
 * CANCELLED is already out of every revenue report via NON_REVENUE_STATUSES.
 */
export async function mergeHeldOrdersInTx(
  tx: Prisma.TransactionClient,
  args: {
    storeId: string;
    target: { id: string; orderNumber: string; discountAmount: unknown; tableId: string | null };
    sources: MergeSourceOrder[];
    financeSettings: ResolvedFinanceSettings;
  }
): Promise<{ id: string; orderNumber: string; total: number }> {
  const { storeId, target, sources, financeSettings } = args;
  const sourceIds = sources.map((s) => s.id);

  // 1. Claim the target. The no-op status write is what takes the row lock, so
  //    a concurrent finalize either blocks and then wins (and our claim fails)
  //    or loses — never both.
  const targetClaimed = await claimOrderTransition(tx, {
    orderId: target.id,
    storeId,
    guard: { status: "HELD", paymentStatus: { not: "PAID" } },
    data: { status: "HELD" },
  });
  if (!targetClaimed) {
    throw new SettlementError("The target bill is no longer saved", 409, ApiErrorCode.CONFLICT);
  }

  // 2. Claim every source, all or nothing.
  const sourcesClaimed = await claimOrderTransitions(tx, {
    orderIds: sourceIds,
    storeId,
    guard: { status: "HELD", paymentStatus: { not: "PAID" } },
    data: { status: "CANCELLED" },
  });
  if (!sourcesClaimed) {
    throw new SettlementError("Every merged bill must still be saved", 409, ApiErrorCode.CONFLICT);
  }

  // 3. Re-parent the lines rather than recreating them: the frozen
  //    selectedOptions / isCustom / department / KDS status on each row are
  //    exactly what a recreate would have to duplicate by hand.
  await tx.orderItem.updateMany({
    where: { orderId: { in: sourceIds } },
    data: { orderId: target.id },
  });

  const items = await tx.orderItem.findMany({
    where: { orderId: target.id },
    select: { total: true },
  });
  const itemsTotal = items.reduce((sum, i) => sum + Number(i.total), 0);

  // Same charge basis a hold uses: a HELD bill has no payment method yet, so
  // the processing fee can't be priced and is forced off. The target's own
  // discount carries over as a flat amount (computeOrderCharges re-clamps it
  // against the new, larger item total); the sources' discounts are dropped,
  // which is what the dialog warns about.
  const charges = computeOrderCharges({
    itemsTotal,
    discountAmount: Number(target.discountAmount),
    paymentMethod: "CASH",
    settings: { ...financeSettings, processingFeeEnabled: false },
  });

  const updated = await tx.order.update({
    where: { id: target.id },
    data: {
      subtotal: new Prisma.Decimal(charges.subtotal),
      tax: new Prisma.Decimal(charges.tax),
      total: new Prisma.Decimal(charges.total),
      discountAmount: new Prisma.Decimal(charges.discountAmount),
      serviceCharge: new Prisma.Decimal(charges.serviceCharge),
      processingFee: new Prisma.Decimal(charges.processingFee),
      taxRate: new Prisma.Decimal(charges.taxRate),
      serviceChargeRate: new Prisma.Decimal(charges.serviceChargeRate),
      processingFeeRate: new Prisma.Decimal(charges.processingFeeRate),
    },
    select: { id: true, orderNumber: true, total: true },
  });

  // 4. Label the cancelled sources. HELD bills never consumed a coupon or
  //    burned points (see the hold route), so there is nothing to reverse.
  for (const source of sources) {
    await tx.order.update({
      where: { id: source.id },
      data: {
        notes: [source.notes?.trim(), `Merged into #${target.orderNumber}`]
          .filter(Boolean)
          .join(" · "),
      },
    });
  }

  // 5. A cancelled bill must not leave its table occupied forever — same rule
  //    the cancel PATCH applies. The target's own table is left alone.
  const freedTableIds = [
    ...new Set(
      sources.map((s) => s.tableId).filter((id): id is string => !!id && id !== target.tableId)
    ),
  ];
  if (freedTableIds.length) {
    await tx.table.updateMany({
      where: { id: { in: freedTableIds }, storeId },
      data: { status: "AVAILABLE" },
    });
  }

  return { id: updated.id, orderNumber: updated.orderNumber, total: Number(updated.total) };
}

/** The additive response both routes return (PosOrderCreatedDto + legacy fields). */
export function buildPosOrderCreatedResponse(
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    paymentStatus: string;
    queueNumber?: number | null;
  },
  s: PosSettlement,
  pointsEarned: number
): PosOrderCreatedDto & { status: OrderStatus; paymentStatus: string } {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    queueNumber: order.queueNumber ?? null,
    // Kept alongside the new DTO fields: existing clients read these two.
    status: order.status,
    paymentStatus: order.paymentStatus,
    total: s.charges.total,
    discountAmount: s.charges.discountAmount,
    paymentMethod: s.paymentMethod,
    change: s.change,
    pointsEarned,
    payments: s.tenders.map((t) => ({
      method: t.method,
      amount: t.amount,
      amountTendered: t.amountTendered,
      change: t.change,
      note: t.note,
    })),
  };
}

/**
 * Map a settlement failure to the response the routes used to build inline.
 * Returns null for anything unrecognised so the caller rethrows into its own
 * 500 handler rather than swallowing a real bug.
 */
export function mapSettlementError(error: unknown): NextResponse | null {
  if (error instanceof SettlementError) {
    return NextResponse.json(createErrorResponse(error.code, error.message), {
      status: error.status,
    });
  }
  if (error instanceof OrderBuildError) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.INVALID_INPUT, error.message), {
      status: 422,
    });
  }
  if (error instanceof PromotionsPlanError) {
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.SUBSCRIPTION_FEATURE_LOCKED, error.message, {
        upgradeRequired: true,
      }),
      { status: 403 }
    );
  }
  if (error instanceof LoyaltyConflictError) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.CONFLICT, error.message), {
      status: 409,
    });
  }
  return null;
}
