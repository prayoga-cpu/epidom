import { describe, it, expect } from "vitest";
import { getStaffInviteUi } from "../staff-invite-ui";

const base = {
  email: "jane@example.com",
  savedEmail: "jane@example.com",
  emailError: null,
  isActive: true,
  allowedPages: ["/pos", "/pos/orders"],
  hasPendingInvite: false,
};

describe("getStaffInviteUi", () => {
  it("a saved email, a POS page, active: can send, with the plain hint", () => {
    expect(getStaffInviteUi(base)).toEqual({ canSend: true, hint: "default", isResend: false });
  });

  it("no email: nothing to send to", () => {
    expect(getStaffInviteUi({ ...base, email: "", savedEmail: null })).toMatchObject({
      canSend: false,
      hint: "needEmail",
    });
  });

  it("an invalid email blocks sending even though it's saved-looking", () => {
    expect(getStaffInviteUi({ ...base, emailError: "Invalid email" }).canSend).toBe(false);
  });

  it("an UNSAVED email edit blocks sending — the invite goes to the saved address, not what's typed", () => {
    expect(getStaffInviteUi({ ...base, email: "new@example.com" })).toMatchObject({
      canSend: false,
      hint: "saveFirst",
    });
  });

  it("a brand-new address on a row that had none is unsaved too", () => {
    expect(getStaffInviteUi({ ...base, savedEmail: null })).toMatchObject({
      canSend: false,
      hint: "saveFirst",
    });
  });

  it("a back-office-only grant (Admin/Finance) can't be invited: accounts are POS-only for now", () => {
    expect(getStaffInviteUi({ ...base, allowedPages: ["/dashboard", "/finance"] })).toMatchObject({
      canSend: false,
      hint: "posOnly",
    });
    expect(getStaffInviteUi({ ...base, allowedPages: [] })).toMatchObject({ canSend: false, hint: "posOnly" });
  });

  it("a deactivated staffer can't be invited", () => {
    expect(getStaffInviteUi({ ...base, isActive: false }).canSend).toBe(false);
  });

  it("an invite already out flips the button to re-send and says so", () => {
    expect(getStaffInviteUi({ ...base, hasPendingInvite: true })).toEqual({
      canSend: true,
      hint: "pending",
      isResend: true,
    });
  });

  it("names the FIRST obstacle: no email outranks everything, unsaved outranks POS-only", () => {
    expect(
      getStaffInviteUi({ ...base, email: "", savedEmail: null, allowedPages: [], isActive: false }).hint
    ).toBe("needEmail");
    expect(
      getStaffInviteUi({ ...base, email: "other@example.com", allowedPages: [] }).hint
    ).toBe("saveFirst");
  });
});
