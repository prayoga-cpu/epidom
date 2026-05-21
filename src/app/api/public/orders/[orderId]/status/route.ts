import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, paymentStatus: true },
  });

  if (!order) {
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.NOT_FOUND, "Order not found"),
      { status: 404 }
    );
  }

  return NextResponse.json(
    createSuccessResponse({
      status: order.status,
      paymentStatus: order.paymentStatus,
    })
  );
}
