/**
 * PATCH /api/stores/[id]/pos/orders/[orderId]/customer
 *
 * Persists a customer phone number captured after the fact (e.g. the
 * cashier types it in from Order History or the printer menu's "Reprint
 * Last Order" panel to unlock the "Send via WhatsApp" action). Deliberately
 * its own endpoint rather than folded into the order-status PATCH — that
 * one has side effects (stock deduction, freeing a table) tied to status
 * transitions that a contact-info edit has no business triggering.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateOrderCustomerSchema } from "@/lib/validation/pos.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

export const PATCH = withApiHandler(
  async (request, { storeId, params }) => {
    const { orderId } = params;

    const body = await request.json();
    const parsed = updateOrderCustomerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.INVALID_INPUT,
          "Invalid phone number",
          parsed.error.flatten()
        ),
        { status: 400 }
      );
    }

    const existing = await prisma.order.findFirst({
      where: { id: orderId, storeId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Order not found"), {
        status: 404,
      });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { customerPhone: parsed.data.customerPhone },
      select: { id: true, customerPhone: true },
    });

    return NextResponse.json(createSuccessResponse(updated));
  },
  { rateLimitEndpoint: "/api/stores/[id]/pos/orders/[orderId]/customer", requireStoreAuth: true }
);
