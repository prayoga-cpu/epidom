import { NextResponse } from "next/server";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { requireAdminApi } from "@/lib/auth/require-admin-api";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  void request;
  try {
    const admin = await requireAdminApi({ section: "newsletter" });
    if (admin instanceof NextResponse) return admin;

    const sends = await prisma.newsletterSend.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(createSuccessResponse({ sends }));
  } catch (error) {
    console.error("[NEWSLETTER_HISTORY_ERROR]", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, String(error)),
      { status: 500 }
    );
  }
}
