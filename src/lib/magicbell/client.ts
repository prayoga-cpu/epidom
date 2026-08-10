import { prisma } from "@/lib/prisma";

/**
 * Merchant-facing operational alerts (new order, low/critical stock) via
 * MagicBell — replaces the old direct VAPID push / Fonnte WhatsApp calls for
 * these two events. Mirrors src/lib/push/send.ts's conventions: fire-and-forget,
 * never throws, graceful no-op until configured (AGENTS.md "Graceful Degradation").
 */

const MAGICBELL_API_URL = "https://api.magicbell.com/notifications";

let warnedOnce = false;

export function isMagicBellConfigured(): boolean {
  return Boolean(process.env.MAGICBELL_API_KEY && process.env.MAGICBELL_API_SECRET);
}

export type MerchantAlertCategory = "new-order" | "low-stock";

export interface MerchantAlertPayload {
  recipientEmail: string;
  recipientExternalId: string;
  title: string;
  content: string;
  category: MerchantAlertCategory;
  actionUrl?: string;
}

export function sendMerchantAlert(payload: MerchantAlertPayload): void {
  if (!isMagicBellConfigured()) {
    if (!warnedOnce && process.env.NODE_ENV === "development") {
      warnedOnce = true;
      console.warn(
        "[magicbell] MAGICBELL_API_KEY/MAGICBELL_API_SECRET not set — merchant alerts disabled. See docs/ENVIRONMENT.md."
      );
    }
    return;
  }

  void deliver(payload).catch((err) => {
    console.error(`[magicbell] delivery failed for ${payload.category}:`, err);
  });
}

async function deliver(payload: MerchantAlertPayload): Promise<void> {
  const res = await fetch(MAGICBELL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-magicbell-api-key": process.env.MAGICBELL_API_KEY!,
      "x-magicbell-api-secret": process.env.MAGICBELL_API_SECRET!,
    },
    body: JSON.stringify({
      notification: {
        title: payload.title,
        content: payload.content,
        category: payload.category,
        action_url: payload.actionUrl,
        recipients: [{ email: payload.recipientEmail, external_id: payload.recipientExternalId }],
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`MagicBell API returned ${res.status}: ${body.slice(0, 300)}`);
  }
}

/** The store's owning user — MagicBell recipient identity for that store's alerts. */
export async function getStoreOwnerContact(
  storeId: string
): Promise<{ email: string; externalId: string } | null> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { business: { select: { user: { select: { id: true, email: true } } } } },
  });
  const user = store?.business.user;
  if (!user) return null;
  return { email: user.email, externalId: user.id };
}
