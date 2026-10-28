import { describe, it, expect } from "vitest";
import {
  newsletterAudienceQuerySchema,
  newsletterCampaignInputSchema,
  readyToSendIssues,
} from "../newsletter.schemas";

const inAnHour = () => new Date(Date.now() + 3_600_000).toISOString();

const scheduled = {
  subject: "October news",
  contentHtml: "<p>Hello</p>",
  audiences: ["SUBSCRIBERS", "PAID"],
  language: "fr",
  status: "SCHEDULED",
  scheduledAt: inAnHour(),
  timezone: "Europe/Paris",
};

describe("newsletterCampaignInputSchema", () => {
  it("accepts an unfinished draft", () => {
    const parsed = newsletterCampaignInputSchema.parse({});
    expect(parsed).toMatchObject({
      status: "DRAFT",
      subject: "",
      audiences: [],
      language: "all",
      contentMode: "rich",
    });
  });

  it("accepts a complete schedule", () => {
    expect(newsletterCampaignInputSchema.safeParse(scheduled).success).toBe(true);
  });

  it.each([
    ["subject", { subject: "" }],
    ["contentHtml", { contentHtml: "<p></p>" }],
    ["audiences", { audiences: [] }],
    ["scheduledAt", { scheduledAt: null }],
    ["scheduledAt", { scheduledAt: new Date(Date.now() - 3_600_000).toISOString() }],
  ])("refuses to schedule without %s", (field, change) => {
    const result = newsletterCampaignInputSchema.safeParse({ ...scheduled, ...change });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0])).toContain(field);
  });

  it("rejects an unknown audience, language or time zone", () => {
    expect(newsletterCampaignInputSchema.safeParse({ audiences: ["VIP"] }).success).toBe(false);
    expect(newsletterCampaignInputSchema.safeParse({ language: "de" }).success).toBe(false);
    expect(newsletterCampaignInputSchema.safeParse({ timezone: "Mars/Olympus" }).success).toBe(false);
  });
});

describe("readyToSendIssues", () => {
  it("lists what a send-now still needs", () => {
    expect(readyToSendIssues({ subject: " ", contentHtml: "", audiences: [] })).toEqual([
      "Add a subject",
      "Write the newsletter",
      "Pick an audience",
    ]);
    expect(readyToSendIssues({ subject: "S", contentHtml: "<p>x</p>", audiences: ["FREE"] })).toEqual([]);
  });
});

describe("newsletterAudienceQuerySchema", () => {
  it("splits the audience list", () => {
    expect(newsletterAudienceQuerySchema.parse({ audiences: "FREE,TRIAL" })).toEqual({
      audiences: ["FREE", "TRIAL"],
      language: "all",
    });
    expect(newsletterAudienceQuerySchema.parse({})).toEqual({ audiences: [], language: "all" });
    expect(newsletterAudienceQuerySchema.safeParse({ audiences: "FREE,NOPE" }).success).toBe(false);
  });
});
