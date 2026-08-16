import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** P2034 = "Transaction failed due to a write conflict or a deadlock". */
function isSerializationFailure(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
    return true;
  }
  if (typeof err !== "object" || err === null) return false;
  const message = String((err as { message?: unknown }).message ?? "");
  return message.includes("could not serialize access") || message.includes("deadlock detected");
}

/**
 * Run a Serializable transaction with bounded retry and jittered backoff.
 *
 * Before the two-tier release, material rows were almost never written (the
 * dead `isDefault` filter matched nothing), so a 40001 serialization failure
 * was a theoretical concern. Now every MADE_TO_ORDER sale writes the store's
 * shared staples, so a lunch rush can contend a dozen concurrent deliveries on
 * one "cooking oil" row.
 *
 * Prisma does not retry these, and BOTH deduction callers swallow the throw
 * (the POS order PATCH route and pos-order-builder) and return 200 after the
 * receipt has already printed. Without retry, the busiest orders of the day
 * would move no stock AND record no cost snapshot — i.e. get booked at 100%
 * margin, which is precisely the failure this release exists to end.
 */
export async function runSerializable<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  attempts = 4
): Promise<T> {
  let lastErr: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: "Serializable",
        maxWait: 10_000,
        timeout: 20_000,
      });
    } catch (err) {
      if (!isSerializationFailure(err)) throw err;
      lastErr = err;
      if (attempt < attempts - 1) {
        const backoff = 25 * 2 ** attempt + Math.random() * 50;
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
  }

  throw lastErr;
}
