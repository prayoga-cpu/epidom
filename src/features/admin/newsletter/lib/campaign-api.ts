import type { NewsletterAudience } from "@prisma/client";
import type { NewsletterLanguage } from "@/lib/newsletter/constants";
import type { Campaign, CampaignSummary } from "./campaign-display";

/** Fetch wrappers for /api/admin/newsletter/*: the data, or an Error with the API's message. */

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message || `Request failed (${res.status})`);
  return json.data as T;
}

/** The editor's whole state, as PATCH and POST take it. */
export interface CampaignInput {
  subject: string;
  previewText: string | null;
  contentMode: "rich" | "html";
  contentHtml: string;
  audiences: NewsletterAudience[];
  language: NewsletterLanguage;
  status: "DRAFT" | "SCHEDULED";
  scheduledAt: string | null;
  timezone: string;
}

export function toInput(campaign: Campaign): CampaignInput {
  return {
    subject: campaign.subject,
    previewText: campaign.previewText,
    contentMode: campaign.contentMode,
    contentHtml: campaign.contentHtml,
    audiences: campaign.audiences,
    language: campaign.language,
    status: campaign.status === "SCHEDULED" ? "SCHEDULED" : "DRAFT",
    scheduledAt: campaign.scheduledAt,
    timezone: campaign.timezone,
  };
}

export const campaignApi = {
  list: () =>
    call<{ campaigns: CampaignSummary[] }>("/api/admin/newsletter/campaigns").then(
      (d) => d.campaigns
    ),
  get: (id: string) =>
    call<{ campaign: Campaign }>(`/api/admin/newsletter/campaigns/${id}`).then((d) => d.campaign),
  create: (input: CampaignInput) =>
    call<{ campaign: Campaign }>("/api/admin/newsletter/campaigns", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((d) => d.campaign),
  update: (id: string, input: CampaignInput) =>
    call<{ campaign: Campaign }>(`/api/admin/newsletter/campaigns/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }).then((d) => d.campaign),
  remove: (id: string) =>
    call<unknown>(`/api/admin/newsletter/campaigns/${id}`, { method: "DELETE" }),
  duplicate: (id: string) =>
    call<{ campaign: Campaign }>(`/api/admin/newsletter/campaigns/${id}/duplicate`, {
      method: "POST",
    }).then((d) => d.campaign),
  sendNow: (id: string) =>
    call<{ via: "queued" | "dispatcher" }>(`/api/admin/newsletter/campaigns/${id}/send-now`, {
      method: "POST",
    }),
  retry: (id: string) =>
    call<{ via: "queued" | "dispatcher" }>(`/api/admin/newsletter/campaigns/${id}/retry`, {
      method: "POST",
    }),
  /** Back to draft, from the list (which doesn't hold the content). */
  unschedule: async (id: string) => {
    const campaign = await campaignApi.get(id);
    return campaignApi.update(id, { ...toInput(campaign), status: "DRAFT" });
  },
  test: (input: {
    email: string;
    subject: string;
    previewText: string | null;
    contentMode: "rich" | "html";
    contentHtml: string;
    locale: "fr" | "en" | "id";
  }) =>
    call<unknown>("/api/admin/newsletter/test", { method: "POST", body: JSON.stringify(input) }),
  audience: (audiences: NewsletterAudience[], language: NewsletterLanguage) =>
    call<{ byAudience: Record<NewsletterAudience, number>; total: number }>(
      `/api/admin/newsletter/audience?audiences=${audiences.join(",")}&language=${language}`
    ),
};
