import { NextResponse } from "next/server";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { requireAdminApi } from "@/lib/auth/require-admin-api";
import { createBroadcast, sendBroadcast } from "@/lib/services/newsletter.service";
import { z } from "zod";

const broadcastSchema = z.object({
  subject: z.string().min(1).max(200),
  html: z.string().min(1),
  from: z.string().email().optional(),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdminApi({ section: "newsletter" });
    if (admin instanceof NextResponse) return admin;

    const body = await request.json().catch(() => ({}));
    const parsed = broadcastSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid broadcast payload"),
        { status: 400 }
      );
    }

    const { id } = await createBroadcast(parsed.data);
    await sendBroadcast(id);

    return NextResponse.json(createSuccessResponse({ id }));
  } catch (error) {
    console.error("[NEWSLETTER_BROADCAST_ERROR]", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, String(error)),
      { status: 500 }
    );
  }
}
