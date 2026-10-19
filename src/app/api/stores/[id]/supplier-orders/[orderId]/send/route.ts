import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getStorageAdapter } from "@/lib/storage";
import { sendSupplierOrderEmail } from "@/lib/services/email.service";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

const sendChannelSchema = z.enum(["email", "whatsapp", "both"]);

interface ChannelResult {
  success: boolean;
  error?: string;
}

/**
 * POST /api/stores/[id]/supplier-orders/[orderId]/send
 *
 * Sends a supplier order's PDF detail to the supplier via email (Resend,
 * as an attachment). The PDF is generated client-side and uploaded here as
 * multipart form data.
 *
 * The "whatsapp" and "both" channels now return 400 — the Fonnte integration
 * that powered WhatsApp sending for supplier orders has been removed.
 */
export const POST = withApiHandler(
  async (request, { storeId, params }) => {
    const { orderId } = params;

    const formData = await request.formData();
    const file = formData.get("file");
    const channelRaw = formData.get("channel");

    if (!(file instanceof File)) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.VALIDATION_ERROR, "No PDF file provided"), {
        status: 400,
      });
    }

    const parsedChannel = sendChannelSchema.safeParse(channelRaw);
    if (!parsedChannel.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.VALIDATION_ERROR, "Invalid channel"),
        { status: 400 }
      );
    }
    const channel = parsedChannel.data;

    if (channel === "whatsapp" || channel === "both") {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.VALIDATION_ERROR, "WhatsApp sending is not available"),
        { status: 400 }
      );
    }

    const order = await prisma.supplierOrder.findFirst({
      where: { id: orderId, storeId },
      include: { supplier: true, store: { select: { name: true } } },
    });

    if (!order) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Order not found"), {
        status: 404,
      });
    }

    if (!order.supplier.email) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.VALIDATION_ERROR, "Supplier has no email on file"),
        { status: 400 }
      );
    }

    const pdfBuffer = Buffer.from(await file.arrayBuffer());

    const results: { email?: ChannelResult } = {};

    const emailResult = await sendSupplierOrderEmail(
      order.supplier.email,
      order.store.name,
      order.orderNumber,
      pdfBuffer
    );
    results.email = { success: emailResult.success, error: emailResult.error };

    return NextResponse.json(createSuccessResponse(results));
  },
  { rateLimitEndpoint: "/api/stores/[id]/supplier-orders/[orderId]/send", requireStoreAuth: true }
);
