import { getSession } from "@/lib/auth";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { prisma } from "@/lib/prisma";
import { ACTIVE_POS_QUEUE_FILTER } from "@/lib/constants/order-status";
import { serializePosOrders } from "@/lib/server/serialize";

// SSE endpoint for real-time order updates. Only used as a client-side
// fallback when Pusher isn't configured (see usePosOrders) — kept as a
// long-lived connection, so its poll interval directly drives Fluid CPU
// cost for as long as any client is on this path.
// A proper push implementation (Postgres LISTEN/NOTIFY or WebSockets)
// can replace this in Phase 3 without changing the client contract.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: storeId } = await params;

  const session = await getSession();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    await verifyStoreOwnership(storeId, session.user.id);
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const safeClose = () => {
        if (isClosed) return;
        isClosed = true;
        try {
          controller.close();
        } catch {}
      };

      const send = (data: unknown) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          safeClose();
        }
      };

      const poll = async () => {
        if (isClosed) return;

        // Active Queue is off for this store — nothing to report even if an
        // order happens to still be unpaid (see resolveSettledOrderStatus).
        // Re-checked every poll (not just once at connection-open) so an
        // owner flipping the toggle mid-shift is reflected on this long-lived
        // connection without requiring a reconnect.
        const store = await prisma.store.findUnique({
          where: { id: storeId },
          select: { kitchenDisplayEnabled: true },
        });
        if (!store?.kitchenDisplayEnabled) {
          send({ type: "orders", orders: [] });
          return;
        }

        const orders = await prisma.order.findMany({
          where: {
            storeId,
            // Phase 3: include POS + STOREFRONT orders (not just STOREFRONT)
            ...ACTIVE_POS_QUEUE_FILTER,
          },
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            table: { select: { label: true } },
            items: {
              include: {
                menuItem: {
                  select: {
                    name: true,
                    department: true,
                    product: { select: { productLine: true } },
                  },
                },
                product: { select: { name: true } },
              },
            },
            shift: {
              select: {
                staffMember: { select: { id: true, name: true } },
              },
            },
          },
        });
        send({ type: "orders", orders: serializePosOrders(orders) });
      };

      await poll();

      const interval = setInterval(() => {
        poll().catch(() => {
          clearInterval(interval);
          safeClose();
        });
      }, 15000);

      // Clean up when client disconnects
      const cleanup = () => {
        clearInterval(interval);
        clearInterval(keepAlive);
        safeClose();
      };

      // Send keep-alive every 25s to prevent proxy timeouts
      const keepAlive = setInterval(() => {
        if (isClosed) {
          clearInterval(keepAlive);
          return;
        }
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          clearInterval(keepAlive);
          safeClose();
        }
      }, 25000);

      return cleanup;
    },
    cancel() {
      // Stream canceled by client
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
