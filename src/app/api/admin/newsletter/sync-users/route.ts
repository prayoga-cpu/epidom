import { NextResponse } from "next/server";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { requireAdminApi } from "@/lib/auth/require-admin-api";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  void request;
  try {
    const admin = await requireAdminApi({ section: "newsletter" });
    if (admin instanceof NextResponse) return admin;

    const audienceId = process.env.RESEND_NEWSLETTER_AUDIENCE_ID;
    const apiKey = process.env.RESEND_API_KEY;
    if (!audienceId || !apiKey) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Resend not configured"),
        { status: 503 }
      );
    }

    const users = await prisma.user.findMany({
      select: { email: true, name: true },
    });

    const emails = users;

    let synced = 0;
    let failed = 0;

    // Resend has no bulk contacts endpoint — send in concurrent batches of 10.
    const BATCH = 10;
    for (let i = 0; i < emails.length; i += BATCH) {
      const chunk = emails.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        chunk.map(({ email, name }) =>
          fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              first_name: name?.split(" ")[0] ?? undefined,
              last_name: name?.split(" ").slice(1).join(" ") || undefined,
              unsubscribed: false,
            }),
          }).then(async (r) => {
            if (!r.ok) throw new Error(await r.text());
          })
        )
      );
      for (const r of results) {
        r.status === "fulfilled" ? synced++ : failed++;
      }
    }

    return NextResponse.json(createSuccessResponse({ total: emails.length, synced, failed }));
  } catch (error) {
    console.error("[NEWSLETTER_SYNC_USERS_ERROR]", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, String(error)),
      { status: 500 }
    );
  }
}
