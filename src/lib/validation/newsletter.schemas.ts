import { z } from "zod";
import { NEWSLETTER_AUDIENCES, NEWSLETTER_LANGUAGES } from "@/lib/newsletter/constants";
import { hasNewsletterContent } from "@/lib/newsletter/render";
import { isValidTimezone } from "@/lib/onboarding/markets";

export const newsletterSubscribeSchema = z.object({
  email: z.string().email().max(200).trim().toLowerCase(),
  source: z.enum(["footer", "sales_page_footer"]),
  page: z.string().max(40).optional(),
  locale: z.enum(["fr", "en", "id"]).default("fr"),
});

export type NewsletterSubscribeInput = z.infer<typeof newsletterSubscribeSchema>;

/** How far in the past a "scheduled" time may be (clock drift, a slow click). */
const SCHEDULE_SLACK_MS = 60_000;

/**
 * A campaign as the editor saves it (create, and every later save: the whole
 * editable state each time). A draft may be unfinished; scheduling needs a
 * subject, content, at least one audience and a time to come.
 */
export const newsletterCampaignInputSchema = z
  .object({
    subject: z.string().trim().max(200).default(""),
    previewText: z.string().trim().max(200).nullish(),
    contentMode: z.enum(["rich", "html"]).default("rich"),
    contentHtml: z.string().max(500_000).default(""),
    audiences: z.array(z.enum(NEWSLETTER_AUDIENCES)).max(NEWSLETTER_AUDIENCES.length).default([]),
    language: z.enum(NEWSLETTER_LANGUAGES).default("all"),
    status: z.enum(["DRAFT", "SCHEDULED"]).default("DRAFT"),
    scheduledAt: z.string().datetime({ offset: true }).nullish(),
    timezone: z
      .string()
      .refine((tz) => isValidTimezone(tz), "Unknown time zone")
      .default("Europe/Paris"),
  })
  .superRefine((value, ctx) => {
    if (value.status !== "SCHEDULED") return;
    if (!value.subject) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["subject"], message: "Add a subject" });
    }
    if (!hasNewsletterContent(value.contentHtml)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contentHtml"],
        message: "Write the newsletter",
      });
    }
    if (value.audiences.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["audiences"],
        message: "Pick an audience",
      });
    }
    if (!value.scheduledAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduledAt"],
        message: "Pick a date and time",
      });
    } else if (new Date(value.scheduledAt).getTime() < Date.now() - SCHEDULE_SLACK_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduledAt"],
        message: "Pick a time in the future",
      });
    }
  });

export type NewsletterCampaignInput = z.infer<typeof newsletterCampaignInputSchema>;

/** "Send now" needs the same as scheduling, minus the time. */
export function readyToSendIssues(campaign: {
  subject: string;
  contentHtml: string;
  audiences: readonly string[];
}): string[] {
  const issues: string[] = [];
  if (!campaign.subject.trim()) issues.push("Add a subject");
  if (!hasNewsletterContent(campaign.contentHtml)) issues.push("Write the newsletter");
  if (campaign.audiences.length === 0) issues.push("Pick an audience");
  return issues;
}

export const newsletterTestSendSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  subject: z.string().trim().min(1).max(200),
  previewText: z.string().trim().max(200).nullish(),
  contentMode: z.enum(["rich", "html"]),
  contentHtml: z.string().min(1).max(500_000),
  /** Which language's footer to show in the test. */
  locale: z.enum(["fr", "en", "id"]).default("fr"),
});

export const newsletterAudienceQuerySchema = z.object({
  language: z.enum(NEWSLETTER_LANGUAGES).default("all"),
  audiences: z
    .string()
    .optional()
    .transform((raw) => (raw ? raw.split(",").filter(Boolean) : []))
    .pipe(z.array(z.enum(NEWSLETTER_AUDIENCES))),
});

export const newsletterUnsubscribeSchema = z.object({
  token: z.string().min(10).max(600),
});
