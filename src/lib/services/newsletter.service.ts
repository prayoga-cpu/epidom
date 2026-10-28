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
  // Signing up again is a fresh yes: lift an earlier unsubscribe.
  await prisma.newsletterUnsubscribe.deleteMany({ where: { email: input.email.toLowerCase() } });

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

/**
 * Stop newsletters to this address, whatever list it is on (sign-ups, leads,
 * accounts). Idempotent: a second click keeps the first record.
 */
export async function unsubscribeFromNewsletter(
  email: string,
  source: "link" | "one_click"
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  await prisma.newsletterUnsubscribe.upsert({
    where: { email: normalized },
    update: {},
    create: { email: normalized, source },
  });
}
