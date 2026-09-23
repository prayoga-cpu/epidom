/**
 * How a call-out number reads on screen: "#12", or an en dash when the order has
 * none (it predates the counter, or it is an aggregator import). Never "#0" or
 * "#null" — a missing number is a blank, not a number.
 */
export function formatQueueNumber(queueNumber: number | null | undefined): string {
  return queueNumber == null ? "–" : `#${queueNumber}`;
}
