import { getSession } from "@/lib/auth";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { prisma } from "@/lib/prisma";

// SSE endpoint for real-time order updates.
// Clients poll the latest pending/confirmed orders every 5 seconds.
// A proper push implementation (Postgres LISTEN/NOTIFY or WebSockets)
// can replace this in Phase 3 without changing the client contract.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
        try { controller.close(); } catch {}
      };

      const send = (data: unknown) => {
        if (isClosed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          safeClose();
        }
      };

      const poll = async () => {
        if (isClosed) return;
        const orders = await prisma.order.findMany({
          where: {
            storeId,
            // Phase 3: include POS + STOREFRONT orders (not just STOREFRONT)
            status: { in: ["PENDING", "CONFIRMED", "IN_PRODUCTION", "READY"] },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            table: { select: { label: true } },
            items: {
              include: {
                menuItem: { select: { name: true } },
                product: { select: { name: true } },
              },
            },
          },
        });
        send({ type: "orders", orders });
      };

      await poll();

      const interval = setInterval(() => {
          poll().catch(() => {
            clearInterval(interval);
            safeClose();
          });
        }, 5000);

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
      }
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
