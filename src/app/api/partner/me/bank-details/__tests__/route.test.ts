import { describe, it, expect, vi, beforeEach } from "vitest";

const getAdminAccess = vi.fn();
vi.mock("@/lib/auth/admin-access", () => ({ getAdminAccess: () => getAdminAccess() }));
const getActiveStaffSession = vi.fn();
vi.mock("@/lib/staff-session", () => ({ getActiveStaffSession: () => getActiveStaffSession() }));
const setPartnerBankDetails = vi.fn();
vi.mock("@/lib/services/partner.service", () => ({
  setPartnerBankDetails: (...a: unknown[]) => setPartnerBankDetails(...a),
}));

import { PUT } from "../route";

const body = {
  accountHolder: "Aaron Vichard",
  bankName: "BNP",
  accountNumber: "FR7630006000011234567890189",
  swift: "",
};
const req = (b: unknown) =>
  new Request("http://localhost/api/partner/me/bank-details", {
    method: "PUT",
    body: JSON.stringify(b),
  });

describe("PUT /api/partner/me/bank-details", () => {
  beforeEach(() => {
    getAdminAccess.mockReset();
    getActiveStaffSession.mockReset();
    getActiveStaffSession.mockResolvedValue(null);
    setPartnerBankDetails.mockReset();
    setPartnerBankDetails.mockResolvedValue({ details: body, updatedAt: "x", unreadable: false });
  });

  it("saves the signed-in partner's own details", async () => {
    getAdminAccess.mockResolvedValue({ partnerId: "p_aaron" });
    const res = await PUT(req(body));
    expect(res.status).toBe(200);
    expect(setPartnerBankDetails).toHaveBeenCalledWith(
      "p_aaron",
      expect.objectContaining({ bankName: "BNP" })
    );
  });

  it("an account that isn't a partner can't set anyone's details", async () => {
    getAdminAccess.mockResolvedValue({ partnerId: null });
    expect((await PUT(req(body))).status).toBe(403);
    expect(setPartnerBankDetails).not.toHaveBeenCalled();
  });

  it("not while a cashier's PIN persona is active, and not invalid input", async () => {
    getAdminAccess.mockResolvedValue({ partnerId: "p_aaron" });
    getActiveStaffSession.mockResolvedValueOnce({ role: "CASHIER" });
    expect((await PUT(req(body))).status).toBe(403);
    expect((await PUT(req({ ...body, accountNumber: "!" }))).status).toBe(400);
    expect(setPartnerBankDetails).not.toHaveBeenCalled();
  });
});
