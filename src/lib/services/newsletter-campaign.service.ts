import { Resend, type CreateEmailOptions } from "resend";
import type { NewsletterCampaign, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import {
  EDITABLE_CAMPAIGN_STATUSES,
  NEWSLETTER_BATCH_SIZE,
  NEWSLETTER_SEND_EVENT,
  type NewsletterLanguage,
} from "@/lib/newsletter/constants";
import {
  newsletterLocale,
  renderNewsletterEmail,
  type NewsletterContentMode,
} from "@/lib/newsletter/render";
import { oneClickUnsubscribeUrl, unsubscribePageUrl } from "@/lib/newsletter/unsubscribe-token";
import {
  loadNewsletterContacts,
  selectRecipients,
} from "@/lib/services/newsletter-audience.service";
import type { NewsletterCampaignInput } from "@/lib/validation/newsletter.schemas";

/**
 * Newsletter campaigns: the admin's drafts and schedule, and the send
 * pipeline the Inngest functions in src/lib/inngest/functions/newsletter-dispatch.ts
 * drive (claim → snapshot recipients → batches of 100 → finalize).
 */

/** A run that started this long ago and is still SENDING is treated as lost and sent again. */
const STALLED_AFTER_MS = 30 * 60_000;

let resendClient: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  resendClient ??= new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

/** NEWSLETTER_FROM lets marketing mail use its own sender; else the app's sender. */
function fromAddress(): string {
  return process.env.NEWSLETTER_FROM || process.env.EMAIL_FROM || "EPIDOM <onboarding@resend.dev>";
}

type CampaignContent = Pick<
  NewsletterCampaign,
  "subject" | "previewText" | "contentMode" | "contentHtml"
>;

function buildEmail(campaign: CampaignContent, to: string, locale: string): CreateEmailOptions {
  return {
    from: fromAddress(),
    to,
    subject: campaign.subject,
    html: renderNewsletterEmail({
      subject: campaign.subject,
      previewText: campaign.previewText,
      contentMode: campaign.contentMode as NewsletterContentMode,
      contentHtml: campaign.contentHtml,
      locale,
      unsubscribeUrl: unsubscribePageUrl(to, locale),
    }),
    headers: {
      "List-Unsubscribe": `<${oneClickUnsubscribeUrl(to)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

// ── Admin: drafts and schedule ──────────────────────────────────────────────

export type CampaignWriteResult =
  | { ok: true; campaign: NewsletterCampaign }
  | { ok: false; reason: "not_found" | "locked" };

function campaignData(input: NewsletterCampaignInput) {
  return {
    subject: input.subject,
    previewText: input.previewText || null,
    contentMode: input.contentMode,
    contentHtml: input.contentHtml,
    audiences: input.audiences,
    language: input.language,
    status: input.status,
    scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
    timezone: input.timezone,
  } satisfies Prisma.NewsletterCampaignUpdateInput;
}

export async function createCampaign(
  input: NewsletterCampaignInput,
  adminEmail: string
): Promise<NewsletterCampaign> {
  return prisma.newsletterCampaign.create({
    data: { ...campaignData(input), createdBy: adminEmail, updatedBy: adminEmail },
  });
}

/** Why a write that matched nothing failed: the campaign is gone, or it has started sending. */
async function missReason(id: string): Promise<"not_found" | "locked"> {
  const exists = await prisma.newsletterCampaign.count({ where: { id } });
  return exists ? "locked" : "not_found";
}

/**
 * Save the editor's state. Conditional on the campaign still being a draft
 * or scheduled, so a save that lands as the dispatcher claims it fails
 * instead of changing a newsletter that is already going out.
 */
export async function updateCampaign(
  id: string,
  input: NewsletterCampaignInput,
  adminEmail: string
): Promise<CampaignWriteResult> {
  const { count } = await prisma.newsletterCampaign.updateMany({
    where: { id, status: { in: [...EDITABLE_CAMPAIGN_STATUSES] } },
    data: { ...campaignData(input), updatedBy: adminEmail, lastError: null },
  });
  if (count === 0) return { ok: false, reason: await missReason(id) };
  const campaign = await prisma.newsletterCampaign.findUniqueOrThrow({ where: { id } });
  return { ok: true, campaign };
}

export async function deleteCampaign(
  id: string
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "locked" }> {
  const { count } = await prisma.newsletterCampaign.deleteMany({
    where: { id, status: { in: [...EDITABLE_CAMPAIGN_STATUSES] } },
  });
  if (count === 0) return { ok: false, reason: await missReason(id) };
  return { ok: true };
}

/** A new draft with the same content and audience, no date. */
export async function duplicateCampaign(
  id: string,
  adminEmail: string
): Promise<NewsletterCampaign | null> {
  const source = await prisma.newsletterCampaign.findUnique({ where: { id } });
  if (!source) return null;
  return prisma.newsletterCampaign.create({
    data: {
      subject: source.subject,
      previewText: source.previewText,
      contentMode: source.contentMode,
      contentHtml: source.contentHtml,
      audiences: source.audiences,
      language: source.language,
      timezone: source.timezone,
      status: "DRAFT",
      createdBy: adminEmail,
      updatedBy: adminEmail,
    },
  });
}

/**
 * Hand a claimed (SENDING) campaign to the sender. When Inngest can't take
 * the event, the campaign goes back to SCHEDULED for now, so the dispatcher
 * picks it up on its next 5-minute run instead of it being stuck.
 */
async function enqueueSend(id: string): Promise<"queued" | "dispatcher"> {
  try {
    await inngest.send({ name: NEWSLETTER_SEND_EVENT, data: { campaignId: id } });
    return "queued";
  } catch (error) {
    console.error("[NEWSLETTER_ENQUEUE_ERROR]", error);
    await prisma.newsletterCampaign.updateMany({
      where: { id, status: "SENDING" },
      data: { status: "SCHEDULED", scheduledAt: new Date(), sendStartedAt: null },
    });
    return "dispatcher";
  }
}

/** Send a draft or scheduled campaign right away. */
export async function sendCampaignNow(
  id: string,
  adminEmail: string
): Promise<
  { ok: true; via: "queued" | "dispatcher" } | { ok: false; reason: "not_found" | "locked" }
> {
  const now = new Date();
  const { count } = await prisma.newsletterCampaign.updateMany({
    where: { id, status: { in: [...EDITABLE_CAMPAIGN_STATUSES] } },
    data: {
      status: "SENDING",
      scheduledAt: now,
      sendStartedAt: now,
      updatedBy: adminEmail,
      lastError: null,
    },
  });
  if (count === 0) return { ok: false, reason: await missReason(id) };
  return { ok: true, via: await enqueueSend(id) };
}

/**
 * Resume a FAILED campaign: its failed recipients go back in the queue and
 * the recipients already sent are not emailed again.
 */
export async function retryCampaign(
  id: string,
  adminEmail: string
): Promise<
  { ok: true; via: "queued" | "dispatcher" } | { ok: false; reason: "not_found" | "locked" }
> {
  const now = new Date();
  const { count } = await prisma.newsletterCampaign.updateMany({
    where: { id, status: "FAILED" },
    data: { status: "SENDING", sendStartedAt: now, updatedBy: adminEmail, lastError: null },
  });
  if (count === 0) return { ok: false, reason: await missReason(id) };
  await prisma.newsletterDelivery.updateMany({
    where: { campaignId: id, status: "FAILED" },
    data: { status: "PENDING", error: null },
  });
  return { ok: true, via: await enqueueSend(id) };
}

// ── Dispatcher ──────────────────────────────────────────────────────────────

/** Claim every due SCHEDULED campaign (→ SENDING). Returns the ids this call won. */
export async function claimDueCampaigns(now: Date = new Date()): Promise<string[]> {
  const due = await prisma.newsletterCampaign.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now } },
    select: { id: true },
    orderBy: { scheduledAt: "asc" },
    take: 20,
  });
  const claimed: string[] = [];
  for (const { id } of due) {
    const { count } = await prisma.newsletterCampaign.updateMany({
      where: { id, status: "SCHEDULED", scheduledAt: { lte: now } },
      data: { status: "SENDING", sendStartedAt: now, lastError: null },
    });
    if (count === 1) claimed.push(id);
  }
  return claimed;
}

/**
 * SENDING campaigns whose run looks lost (an event Inngest never got).
 * Re-stamped so each is re-sent at most every 30 minutes; a second run is
 * harmless, since batches only take PENDING recipients.
 */
export async function reclaimStalledCampaigns(now: Date = new Date()): Promise<string[]> {
  const stalled = await prisma.newsletterCampaign.findMany({
    where: { status: "SENDING", sendStartedAt: { lt: new Date(now.getTime() - STALLED_AFTER_MS) } },
    select: { id: true },
    take: 20,
  });
  if (stalled.length === 0) return [];
  const ids = stalled.map((c) => c.id);
  await prisma.newsletterCampaign.updateMany({
    where: { id: { in: ids }, status: "SENDING" },
    data: { sendStartedAt: now },
  });
  return ids;
}

// ── Sender ──────────────────────────────────────────────────────────────────

/**
 * Take the recipient snapshot: one PENDING delivery per address, written in
 * one transaction so a crash leaves all or nothing. A retry finds the
 * snapshot already there and keeps it. Returns the recipient count.
 */
export async function prepareCampaignDeliveries(campaignId: string): Promise<number> {
  const existing = await prisma.newsletterDelivery.count({ where: { campaignId } });
  if (existing > 0) return existing;

  const campaign = await prisma.newsletterCampaign.findUnique({
    where: { id: campaignId },
    select: { audiences: true, language: true },
  });
  if (!campaign) return 0;

  const recipients = selectRecipients(
    await loadNewsletterContacts(),
    campaign.audiences,
    campaign.language as NewsletterLanguage
  );
  const chunks: Prisma.NewsletterDeliveryCreateManyInput[][] = [];
  for (let i = 0; i < recipients.length; i += 1000) {
    chunks.push(
      recipients.slice(i, i + 1000).map((r) => ({
        campaignId,
        email: r.email,
        locale: newsletterLocale(r.locale),
      }))
    );
  }
  await prisma.$transaction([
    ...chunks.map((data) => prisma.newsletterDelivery.createMany({ data, skipDuplicates: true })),
    prisma.newsletterCampaign.update({
      where: { id: campaignId },
      data: { recipientCount: recipients.length },
    }),
  ]);
  return recipients.length;
}

export interface BatchResult {
  sent: number;
  failed: number;
  skipped: number;
  remaining: number;
}

/**
 * Send the next batch of PENDING recipients. A Resend error throws, so the
 * Inngest step retries it; the idempotency key stops a retried call from
 * emailing a batch twice.
 */
export async function sendNextBatch(campaignId: string): Promise<BatchResult> {
  const campaign = await prisma.newsletterCampaign.findUnique({
    where: { id: campaignId },
    select: {
      subject: true,
      previewText: true,
      contentMode: true,
      contentHtml: true,
      status: true,
    },
  });
  if (!campaign || campaign.status !== "SENDING")
    return { sent: 0, failed: 0, skipped: 0, remaining: 0 };

  const batch = await prisma.newsletterDelivery.findMany({
    where: { campaignId, status: "PENDING" },
    orderBy: { id: "asc" },
    take: NEWSLETTER_BATCH_SIZE,
    select: { id: true, email: true, locale: true },
  });
  if (batch.length === 0) return { sent: 0, failed: 0, skipped: 0, remaining: 0 };

  // Someone may have unsubscribed since the snapshot.
  const unsubscribed = new Set(
    (
      await prisma.newsletterUnsubscribe.findMany({
        where: { email: { in: batch.map((d) => d.email) } },
        select: { email: true },
      })
    ).map((u) => u.email)
  );
  const skipped = batch.filter((d) => unsubscribed.has(d.email));
  const toSend = batch.filter((d) => !unsubscribed.has(d.email));
  if (skipped.length > 0) {
    await prisma.newsletterDelivery.updateMany({
      where: { id: { in: skipped.map((d) => d.id) } },
      data: { status: "SKIPPED" },
    });
  }

  let sent = 0;
  let failed = 0;
  if (toSend.length > 0) {
    const now = new Date();
    const resend = getResend();
    if (!resend) {
      // No Resend key (local dev): log and count as sent, like the other emails.
      console.info(
        `[NEWSLETTER_DEV] would send "${campaign.subject}" to ${toSend.length} recipients`
      );
      await prisma.newsletterDelivery.updateMany({
        where: { id: { in: toSend.map((d) => d.id) } },
        data: { status: "SENT", resendId: "dev-mode", sentAt: now },
      });
      sent = toSend.length;
    } else {
      const { data, error } = await resend.batch.send(
        toSend.map((d) => buildEmail(campaign, d.email, d.locale)),
        {
          idempotencyKey: `newsletter-${campaignId}-${toSend[0].id}`,
          batchValidation: "permissive",
        }
      );
      if (error || !data)
        throw new Error(`Resend batch failed: ${error?.message ?? "no response"}`);

      // Permissive mode: rejected addresses come back by index, the rest get ids in order.
      const rejected = new Map(data.errors.map((e) => [e.index, e.message]));
      let nextId = 0;
      await prisma.$transaction(
        toSend.map((delivery, index) => {
          const message = rejected.get(index);
          if (message !== undefined) {
            failed += 1;
            return prisma.newsletterDelivery.update({
              where: { id: delivery.id },
              data: { status: "FAILED", error: message.slice(0, 500) },
            });
          }
          sent += 1;
          return prisma.newsletterDelivery.update({
            where: { id: delivery.id },
            data: { status: "SENT", resendId: data.data[nextId++]?.id ?? null, sentAt: now },
          });
        })
      );
    }
  }

  const remaining = await prisma.newsletterDelivery.count({
    where: { campaignId, status: "PENDING" },
  });
  return { sent, failed, skipped: skipped.length, remaining };
}

async function deliveryCounts(campaignId: string) {
  const rows = await prisma.newsletterDelivery.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: { _all: true },
  });
  const of = (status: string) => rows.find((r) => r.status === status)?._count._all ?? 0;
  return {
    sent: of("SENT"),
    failed: of("FAILED"),
    total: rows.reduce((n, r) => n + r._count._all, 0),
  };
}

/** Close a finished run: SENT, or FAILED when nobody could be emailed. */
export async function finalizeCampaign(campaignId: string): Promise<{ status: "SENT" | "FAILED" }> {
  const counts = await deliveryCounts(campaignId);
  const lastError =
    counts.total === 0
      ? "Nobody matched this audience and language when it was due."
      : counts.sent === 0
        ? "Every email was rejected. See the recipients' errors."
        : null;
  const status = lastError ? "FAILED" : "SENT";
  await prisma.newsletterCampaign.updateMany({
    where: { id: campaignId, status: "SENDING" },
    data: {
      status,
      sentAt: new Date(),
      sentCount: counts.sent,
      failedCount: counts.failed,
      lastError,
    },
  });
  return { status };
}

/** Inngest ran out of retries: record why, keep what was sent. */
export async function markCampaignFailed(campaignId: string, message: string): Promise<void> {
  const counts = await deliveryCounts(campaignId);
  await prisma.newsletterCampaign.updateMany({
    where: { id: campaignId, status: "SENDING" },
    data: {
      status: "FAILED",
      sentCount: counts.sent,
      failedCount: counts.failed,
      lastError: message.slice(0, 500),
    },
  });
}

// ── Test send ───────────────────────────────────────────────────────────────

export async function sendNewsletterTest(input: {
  email: string;
  subject: string;
  previewText?: string | null;
  contentMode: NewsletterContentMode;
  contentHtml: string;
  locale: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const email = buildEmail(
    { ...input, subject: `[TEST] ${input.subject}`, previewText: input.previewText ?? null },
    input.email,
    input.locale
  );
  const resend = getResend();
  if (!resend) {
    console.info(`[NEWSLETTER_DEV] would send test "${email.subject}" to ${input.email}`);
    return { success: true };
  }
  const { error } = await resend.emails.send(email);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
