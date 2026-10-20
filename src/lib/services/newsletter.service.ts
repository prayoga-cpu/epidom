import { prisma } from "@/lib/prisma";
import type { NewsletterSubscribeInput } from "@/lib/validation/newsletter.schemas";

export async function subscribeToNewsletter(input: NewsletterSubscribeInput): Promise<void> {
  await prisma.newsletterSubscriber.upsert({
    where: { email: input.email },
    update: {},
    create: {
      email: input.email,
      source: input.source,
      page: input.page ?? null,
      locale: input.locale,
    },
  });

  const audienceId = process.env.RESEND_NEWSLETTER_AUDIENCE_ID;
  const apiKey = process.env.RESEND_API_KEY;
  if (audienceId && apiKey) {
    try {
      await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: input.email, unsubscribed: false }),
      });
    } catch {
      // Non-fatal: subscriber already saved to DB.
    }
  }
}

export interface BroadcastInput {
  subject: string;
  html: string;
  from?: string;
}

/** Create a Resend broadcast (draft) and return its id. */
export async function createBroadcast(input: BroadcastInput): Promise<{ id: string }> {
  const audienceId = process.env.RESEND_NEWSLETTER_AUDIENCE_ID;
  const apiKey = process.env.RESEND_API_KEY;
  if (!audienceId || !apiKey) throw new Error("Resend not configured");
  const from = input.from ?? process.env.RESEND_FROM_EMAIL ?? "Epidom <newsletter@epidom.fr>";
  const res = await fetch("https://api.resend.com/broadcasts", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ audience_id: audienceId, from, subject: input.subject, html: input.html }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Resend broadcast create failed: ${JSON.stringify(err)}`);
  }
  const data = await res.json();
  return { id: data.data?.id ?? data.id };
}

/** Send a Resend broadcast that was already created. */
export async function sendBroadcast(broadcastId: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Resend not configured");
  const res = await fetch(`https://api.resend.com/broadcasts/${broadcastId}/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Resend broadcast send failed: ${JSON.stringify(err)}`);
  }
}
