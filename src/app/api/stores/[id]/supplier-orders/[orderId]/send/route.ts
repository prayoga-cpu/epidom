import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getStorageAdapter } from "@/lib/storage";
import { sendSupplierOrderEmail } from "@/lib/services/email.service";
import { sendFonnteWhatsApp, isFonnteAvailable } from "@/lib/notifications/providers/fonnte";
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
 * Sends a supplier order's PDF detail to the supplier — via email (Resend,
 * as an attachment), WhatsApp (Fonnte, as a document link), or both. The PDF
 * itself is generated client-side (same jsPDF pipeline as every other export
 * in the app) and uploaded here as multipart form data alongside the chosen
 * channel; the local "download instead" path is the separate print page, not
 * this route.
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

    const order = await prisma.supplierOrder.findFirst({
      where: { id: orderId, storeId },
      include: { supplier: true, store: { select: { name: true } } },
    });

    if (!order) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Order not found"), {
        status: 404,
      });
    }

    const needsEmail = channel === "email" || channel === "both";
    const needsWhatsapp = channel === "whatsapp" || channel === "both";

    if (needsEmail && !order.supplier.email) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.VALIDATION_ERROR, "Supplier has no email on file"),
        { status: 400 }
      );
    }
    if (needsWhatsapp && !order.supplier.phone) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.VALIDATION_ERROR, "Supplier has no phone on file"),
        { status: 400 }
      );
    }
    if (needsWhatsapp && !isFonnteAvailable()) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.VALIDATION_ERROR, "WhatsApp sending is not configured"),
        { status: 400 }
      );
    }

    const pdfBuffer = Buffer.from(await file.arrayBuffer());

    const results: { email?: ChannelResult; whatsapp?: ChannelResult } = {};

    if (needsEmail) {
      const emailResult = await sendSupplierOrderEmail(
        order.supplier.email!,
        order.store.name,
        order.orderNumber,
        pdfBuffer
      );
      results.email = { success: emailResult.success, error: emailResult.error };
    }

    if (needsWhatsapp) {
      try {
        const uploaded = await getStorageAdapter().upload(file, {
          path: "supplier-orders",
          access: "public",
        });
        await sendFonnteWhatsApp({
          to: order.supplier.phone!,
          message: `Purchase Order ${order.orderNumber} from ${order.store.name}`,
          fileUrl: uploaded.url,
        });
        results.whatsapp = { success: true };
      } catch (error) {
        results.whatsapp = {
          success: false,
          error: error instanceof Error ? error.message : "Failed to send via WhatsApp",
        };
      }
    }

    return NextResponse.json(createSuccessResponse(results));
  },
  { rateLimitEndpoint: "/api/stores/[id]/supplier-orders/[orderId]/send", requireStoreAuth: true }
);
