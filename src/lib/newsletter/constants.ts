import type { NewsletterAudience } from "@prisma/client";

/** Shared by the API, the send pipeline and the admin editor (no server imports). */

export const NEWSLETTER_AUDIENCES = [
  "SUBSCRIBERS",
  "LEADS",
  "FREE",
  "TRIAL",
  "PAID",
] as const satisfies readonly NewsletterAudience[];

export const NEWSLETTER_LANGUAGES = ["all", "fr", "en", "id"] as const;
export type NewsletterLanguage = (typeof NEWSLETTER_LANGUAGES)[number];

/** A campaign can be changed, rescheduled or deleted only in these states. */
export const EDITABLE_CAMPAIGN_STATUSES = ["DRAFT", "SCHEDULED"] as const;

/** Recipients per Resend batch call (Resend's maximum). */
export const NEWSLETTER_BATCH_SIZE = 100;

/** The Inngest event that sends one campaign. */
export const NEWSLETTER_SEND_EVENT = "newsletter/campaign.send";
