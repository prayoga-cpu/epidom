import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../client", () => ({
  inngest: {
    createFunction: (config: unknown, handler: unknown) => ({ config, handler }),
  },
}));

const claimDueCampaigns = vi.fn();
const reclaimStalledCampaigns = vi.fn();
const prepareCampaignDeliveries = vi.fn();
const sendNextBatch = vi.fn();
const finalizeCampaign = vi.fn();
const markCampaignFailed = vi.fn();
vi.mock("@/lib/services/newsletter-campaign.service", () => ({
  claimDueCampaigns: (...a: unknown[]) => claimDueCampaigns(...a),
  reclaimStalledCampaigns: (...a: unknown[]) => reclaimStalledCampaigns(...a),
  prepareCampaignDeliveries: (...a: unknown[]) => prepareCampaignDeliveries(...a),
  sendNextBatch: (...a: unknown[]) => sendNextBatch(...a),
  finalizeCampaign: (...a: unknown[]) => finalizeCampaign(...a),
  markCampaignFailed: (...a: unknown[]) => markCampaignFailed(...a),
}));

import { dispatchDueNewsletters, sendNewsletterCampaign } from "../newsletter-dispatch";

type Fn = {
  config: { onFailure: (ctx: unknown) => Promise<void>; concurrency: unknown };
  handler: (ctx: unknown) => Promise<unknown>;
};
const dispatch = dispatchDueNewsletters as unknown as Fn;
const send = sendNewsletterCampaign as unknown as Fn;

function fakeStep() {
  const names: string[] = [];
  const sent: unknown[] = [];
  return {
    names,
    sent,
    step: {
      run: async (name: string, fn: () => unknown) => {
        names.push(name);
        return fn();
      },
      sendEvent: async (name: string, events: unknown) => {
        names.push(name);
        sent.push(events);
      },
    },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("dispatchDueNewsletters", () => {
  it("sends one event per claimed or stalled campaign", async () => {
    claimDueCampaigns.mockResolvedValue(["c1", "c2"]);
    reclaimStalledCampaigns.mockResolvedValue(["c9"]);
    const { step, sent } = fakeStep();

    await expect(dispatch.handler({ step })).resolves.toEqual({ dispatched: ["c1", "c2", "c9"] });
    expect(sent[0]).toEqual([
      { name: "newsletter/campaign.send", data: { campaignId: "c1" } },
      { name: "newsletter/campaign.send", data: { campaignId: "c2" } },
      { name: "newsletter/campaign.send", data: { campaignId: "c9" } },
    ]);
  });

  it("sends nothing when nothing is due", async () => {
    claimDueCampaigns.mockResolvedValue([]);
    reclaimStalledCampaigns.mockResolvedValue([]);
    const { step, names } = fakeStep();
    await dispatch.handler({ step });
    expect(names).toEqual(["claim-due", "reclaim-stalled"]);
  });
});

describe("sendNewsletterCampaign", () => {
  it("runs one step per batch until nobody is left, then finalizes", async () => {
    prepareCampaignDeliveries.mockResolvedValue(250);
    sendNextBatch
      .mockResolvedValueOnce({ remaining: 150 })
      .mockResolvedValueOnce({ remaining: 50 })
      .mockResolvedValueOnce({ remaining: 0 });
    finalizeCampaign.mockResolvedValue({ status: "SENT" });
    const { step, names } = fakeStep();

    await expect(send.handler({ event: { data: { campaignId: "c1" } }, step })).resolves.toEqual({
      status: "SENT",
    });
    expect(names).toEqual(["prepare", "batch-0", "batch-1", "batch-2", "finalize"]);
  });

  it("stops looping even if a batch never empties the queue", async () => {
    prepareCampaignDeliveries.mockResolvedValue(100);
    sendNextBatch.mockResolvedValue({ remaining: 1 });
    finalizeCampaign.mockResolvedValue({ status: "SENT" });
    const { step, names } = fakeStep();
    await send.handler({ event: { data: { campaignId: "c1" } }, step });
    expect(names.filter((n) => n.startsWith("batch-"))).toHaveLength(6);
  });

  it("runs one send per campaign at a time", () => {
    expect(send.config.concurrency).toEqual([{ key: "event.data.campaignId", limit: 1 }]);
  });

  it("records the error on the campaign when retries run out", async () => {
    await send.config.onFailure({
      event: { data: { event: { data: { campaignId: "c1" } } } },
      error: new Error("Resend batch failed: domain not verified"),
    });
    expect(markCampaignFailed).toHaveBeenCalledWith("c1", "Resend batch failed: domain not verified");
  });
});
