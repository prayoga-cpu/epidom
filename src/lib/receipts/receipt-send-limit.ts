import { prisma } from "@/lib/prisma";

/**
 * How many receipt sends one order may ever trigger, across every channel.
 *
 * A receipt send is an outbound message to an arbitrary address or number that
 * a staff member types in, so without a ceiling one paid order is a free relay:
 * the same receipt can be blasted to a hundred recipients, at the store's
 * Fonnte/Resend cost and from the store's sender reputation. Ten covers every
 * honest case — resend after a failure, a corrected number, one copy to the
 * customer and one to whoever is paying — with room to spare.
 *
 * Counted per ORDER rather than per recipient on purpose: it is the "send this
 * to someone" action being bounded, not any one destination.
 */
export const MAX_RECEIPT_SENDS_PER_ORDER = 10;

/** True once this order has used up its send allowance. */
export async function isReceiptSendLimitReached(orderId: string): Promise<boolean> {
  const sends = await prisma.orderReceiptSend.count({ where: { orderId } });
  return sends >= MAX_RECEIPT_SENDS_PER_ORDER;
}

/** The `reason` both send paths return when the cap is hit, and both routes map to 429. */
export const RECEIPT_SEND_LIMIT_REASON = "send_limit_reached";
