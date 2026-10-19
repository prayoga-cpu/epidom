import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

var mockPrisma: any;
vi.mock("@/lib/prisma", () => {
  mockPrisma = { signupAttribution: { create: vi.fn() } };
  return { prisma: mockPrisma };
});
const resolveSignupPartner = vi.fn();
vi.mock("@/lib/services/partner.service", () => ({
  resolveSignupPartner: (...a: unknown[]) => resolveSignupPartner(...a),
}));

import { recordSignupAttribution, requestIp } from "../signup-attribution.service";

const AT = 1792380000;
const user = { id: "u_new", email: "cafe@example.com" };

describe("recordSignupAttribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.signupAttribution.create.mockResolvedValue({});
  });

  it("stores where the account came from and credits the partner with their deal", async () => {
    resolveSignupPartner.mockResolvedValue({
      partnerId: "p_bob",
      commissionRate: new Prisma.Decimal(30),
      commissionMonths: 3,
      discountPercent: new Prisma.Decimal(10),
      selfReferralFlag: false,
    });

    await recordSignupAttribution(user, `epidom_source=ref.BOB.${AT}`, "1.2.3.4");

    expect(resolveSignupPartner).toHaveBeenCalledWith(
      expect.objectContaining({ source: "REFERRAL_LINK", refCode: "BOB" }),
      user,
      "1.2.3.4"
    );
    const data = mockPrisma.signupAttribution.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      userId: "u_new",
      source: "REFERRAL_LINK",
      refCode: "BOB",
      partnerId: "p_bob",
      commissionMonths: 3,
      selfReferralFlag: false,
    });
    expect(Number(data.discountPercent)).toBe(10);
  });

  it("still records the sign-up when no partner matches, or the lookup fails", async () => {
    resolveSignupPartner.mockResolvedValueOnce(null);
    await recordSignupAttribution(user, "epidom_sales_page=sales-page-2.fr");
    expect(mockPrisma.signupAttribution.create.mock.calls[0][0].data).toMatchObject({
      source: "SALES_PAGE",
      salesPage: "sales-page-2",
    });
    expect(mockPrisma.signupAttribution.create.mock.calls[0][0].data).not.toHaveProperty(
      "partnerId"
    );

    resolveSignupPartner.mockRejectedValueOnce(new Error("db"));
    await recordSignupAttribution(user, null);
    expect(mockPrisma.signupAttribution.create).toHaveBeenCalledTimes(2);
  });

  it("never throws: a sign-up must not fail on tracking", async () => {
    resolveSignupPartner.mockResolvedValue(null);
    mockPrisma.signupAttribution.create.mockRejectedValue(new Error("unique"));
    await expect(recordSignupAttribution(user, null)).resolves.toBeUndefined();
  });
});

describe("requestIp", () => {
  it("reads the platform's client IP headers", () => {
    expect(requestIp(new Headers({ "x-real-ip": "1.1.1.1" }))).toBe("1.1.1.1");
    expect(requestIp(new Headers({ "x-forwarded-for": "2.2.2.2, 10.0.0.1" }))).toBe("2.2.2.2");
    expect(requestIp(new Headers())).toBeNull();
    expect(requestIp(null)).toBeNull();
  });
});
