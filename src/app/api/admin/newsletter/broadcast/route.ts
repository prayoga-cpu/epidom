import { NextResponse } from "next/server";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { requireAdminApi } from "@/lib/auth/require-admin-api";
import { createBroadcast, sendBroadcast } from "@/lib/services/newsletter.service";
import { z } from "zod";

const broadcastSchema = z.object({
  subject: z.string().min(1).max(200),
  html: z.string().min(1),
  from: z.string().email().optional(),
  /** When present, send individually to these addresses instead of using a Resend broadcast. */
  recipients: z.array(z.string().email()).max(500).optional(),
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

    const { subject, html, from, recipients } = parsed.data;

    if (recipients && recipients.length > 0) {
      const fromAddr = from ?? process.env.EMAIL_FROM ?? "Epidom <hello@epidom.fr>";
      const results = await Promise.allSettled(
        recipients.map((to) =>
          fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ from: fromAddr, to, subject, html }),
          }).then(async (r) => {
            if (!r.ok) throw new Error(await r.text());
            return r.json();
          })
        )
      );
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        console.error("[NEWSLETTER_INDIVIDUAL_SEND_ERRORS]", failed);
      }
      const sent = results.filter((r) => r.status === "fulfilled").length;
      return NextResponse.json(createSuccessResponse({ sent, failed: failed.length }));
    }

    const { id } = await createBroadcast({ subject, html, from });
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
