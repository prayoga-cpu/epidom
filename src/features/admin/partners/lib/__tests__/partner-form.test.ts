import { describe, it, expect } from "vitest";
import {
  DEFAULT_DEAL,
  createPartnerFormSchema,
  suggestReferralCode,
  toCreatePayload,
} from "../partner-form";

const base = {
  ...DEFAULT_DEAL,
  displayName: "Aaron",
  who: "user" as const,
  userId: "u1",
  inviteEmail: "",
};

describe("new referral partner form", () => {
  it("a referral link needs a code; a sales page doesn't", () => {
    expect(createPartnerFormSchema.safeParse({ ...base, referralCode: "" }).success).toBe(false);
    expect(
      createPartnerFormSchema.safeParse({
        ...base,
        referralCode: "",
        referralLanding: "sales-page-2",
      }).success
    ).toBe(true);
  });

  it("needs a picked user, or a valid email to invite", () => {
    expect(
      createPartnerFormSchema.safeParse({ ...base, referralCode: "A1B", userId: "" }).success
    ).toBe(false);
    expect(
      createPartnerFormSchema.safeParse({
        ...base,
        referralCode: "A1B",
        who: "invite",
        inviteEmail: "nope",
      }).success
    ).toBe(false);
    expect(
      createPartnerFormSchema.safeParse({
        ...base,
        referralCode: "A1B",
        who: "invite",
        inviteEmail: "a@b.co",
      }).success
    ).toBe(true);
  });

  it("a sales page becomes ownership from the date, with no code and no discount", () => {
    const payload = toCreatePayload({
      ...base,
      referralCode: "AARON",
      referralLanding: "sales-page-2",
      creditFrom: "2026-10-20",
    });
    expect(payload).toMatchObject({
      userId: "u1",
      referralCode: null,
      referralLanding: "REGISTER",
      customerDiscountPercent: 0,
      salesPage: { page: "sales-page-2", creditFrom: "2026-10-20T00:00:00Z" },
    });
    expect(payload).not.toHaveProperty("inviteEmail");
  });

  it("a referral link keeps its code, landing and discount; an invite sends the email", () => {
    const payload = toCreatePayload({
      ...base,
      who: "invite",
      inviteEmail: " Bob@X.com ",
      referralCode: "bob",
      referralLanding: "HOME",
    });
    expect(payload).toMatchObject({
      inviteEmail: "bob@x.com",
      referralCode: "BOB",
      referralLanding: "HOME",
      customerDiscountPercent: 10,
      salesPage: null,
    });
    expect(payload).not.toHaveProperty("userId");
  });

  it("suggests a code from the name", () => {
    expect(suggestReferralCode("Aaron Vichard")).toBe("AARONVICHARD");
    expect(suggestReferralCode("Élodie")).toBe("ELODIE");
  });
});
