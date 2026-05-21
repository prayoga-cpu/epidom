/**
 * POST /api/webhooks/email
 *
 * Inbound email webhook — compatible with Resend inbound email format.
 * Merchants forward aggregator order emails to orders@epidom.id.
 * The subject must contain their store slug so we can route to the right store.
 *
 * Expected subject format: "[slug] Original subject…"
 * e.g. "[@warung-bahagia] GoFood — Pesanan Baru #12345"
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import { z } from "zod";

const inboundEmailSchema = z.object({
  from: z.string(),
  to: z.string(),
  subject: z.string(),
  text: z.string().optional().default(""),
  html: z.string().optional(),
});

function detectPlatform(from: string, subject: string) {
  const text = `${from} ${subject}`.toLowerCase();
  if (text.includes("gofood") || text.includes("go-food")) return "GOFOOD";
  if (text.includes("grabfood") || text.includes("grab")) return "GRABFOOD";
  if (text.includes("shopeefood") || text.includes("shopee")) return "SHOPEEFOOD";
  if (text.includes("tokopedia")) return "TOKOPEDIA";
  return null;
}

export async function POST(request: Request) {
  // Validate shared secret if configured
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (secret) {
    const sig = request.headers.get("x-webhook-secret");
    if (sig !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = inboundEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { from, subject, text, html } = parsed.data;

  // Extract store slug from subject: "[@slug] rest of subject"
  const slugMatch = subject.match(/^\[@([a-z0-9-]+)\]/i);
  if (!slugMatch) {
    return NextResponse.json({ error: "No store slug in subject. Format: [@your-slug] Subject" }, { status: 422 });
  }

  const slug = slugMatch[1].toLowerCase();
  const storefront = await prisma.storefront.findUnique({
    where: { slug },
    select: { storeId: true },
  });

  if (!storefront) {
    return NextResponse.json({ error: `No storefront found for slug: ${slug}` }, { status: 404 });
  }

  const { storeId } = storefront;
  const platform = detectPlatform(from, subject) as "GOFOOD" | "GRABFOOD" | "SHOPEEFOOD" | "TOKOPEDIA" | null;

  const emailRecord = await prisma.aggregatorEmail.create({
    data: {
      storeId,
      fromAddress: from,
      subject,
      bodyText: text,
      bodyHtml: html,
      platform: platform ?? undefined,
      parseStatus: "pending",
    },
  });

  // Trigger Inngest to parse asynchronously
  await inngest.send({
    name: "aggregator/email.received",
    data: { aggregatorEmailId: emailRecord.id, storeId },
  }).catch(() => {
    // Inngest not configured — email stored for manual review
  });

  return NextResponse.json({ received: true, emailId: emailRecord.id });
}
