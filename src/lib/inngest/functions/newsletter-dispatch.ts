import { inngest, type NewsletterCampaignSendEventData } from "../client";
import { NEWSLETTER_BATCH_SIZE, NEWSLETTER_SEND_EVENT } from "@/lib/newsletter/constants";
import {
  claimDueCampaigns,
  finalizeCampaign,
  markCampaignFailed,
  prepareCampaignDeliveries,
  reclaimStalledCampaigns,
  sendNextBatch,
} from "@/lib/services/newsletter-campaign.service";

/**
 * Every 5 minutes: claim the newsletters whose time has come (SCHEDULED →
 * SENDING) and hand each to sendNewsletterCampaign. Cron runs in UTC; the
 * campaign's own scheduledAt is already a UTC instant.
 */
export const dispatchDueNewsletters = inngest.createFunction(
  { id: "dispatch-due-newsletters", retries: 2, triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => {
    const due = await step.run("claim-due", () => claimDueCampaigns(new Date()));
    const stalled = await step.run("reclaim-stalled", () => reclaimStalledCampaigns(new Date()));
    const campaignIds = [...due, ...stalled];
    if (campaignIds.length > 0) {
      await step.sendEvent(
        "send-campaigns",
        campaignIds.map((campaignId) => ({ name: NEWSLETTER_SEND_EVENT, data: { campaignId } }))
      );
    }
    return { dispatched: campaignIds };
  }
);

/**
 * Send one campaign: snapshot its recipients, then one step per batch of 100,
 * so a retry resumes at the failed batch instead of starting over. One run
 * per campaign at a time.
 */
export const sendNewsletterCampaign = inngest.createFunction(
  {
    id: "send-newsletter-campaign",
    retries: 4,
    concurrency: [{ key: "event.data.campaignId", limit: 1 }],
    triggers: [{ event: NEWSLETTER_SEND_EVENT }],
    onFailure: async ({ event, error }) => {
      const { campaignId } = event.data.event.data as NewsletterCampaignSendEventData;
      await markCampaignFailed(campaignId, error.message);
    },
  },
  async ({ event, step }) => {
    const { campaignId } = event.data as NewsletterCampaignSendEventData;
    const recipients = await step.run("prepare", () => prepareCampaignDeliveries(campaignId));

    // Bounded, in case a batch ever stops making progress.
    const maxBatches = Math.ceil(recipients / NEWSLETTER_BATCH_SIZE) + 5;
    for (let i = 0; i < maxBatches; i++) {
      const batch = await step.run(`batch-${i}`, () => sendNextBatch(campaignId));
      if (batch.remaining === 0) break;
    }

    return step.run("finalize", () => finalizeCampaign(campaignId));
  }
);
