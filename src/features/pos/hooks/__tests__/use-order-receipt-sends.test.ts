import { describe, it, expect } from "vitest";
import { deriveEmailReceiptStatus, type OrderReceiptSendRecord } from "../use-order-receipt-sends";

const send = (over: Partial<OrderReceiptSendRecord> = {}): OrderReceiptSendRecord => ({
  id: "s1",
  channel: "EMAIL",
  recipientPhone: null,
  recipientEmail: "alice@example.com",
  status: "SENT",
  fonnteMessageId: null,
  errorMessage: null,
  sentAt: "2026-09-19T21:57:00.000Z",
  ...over,
});

// The log is most-recent-first, exactly as GET .../send-receipt returns it.
describe("deriveEmailReceiptStatus", () => {
  it("is 'not sent' with no log yet, an empty log, or only WhatsApp sends", () => {
    expect(deriveEmailReceiptStatus(undefined)).toEqual({ state: "not_sent" });
    expect(deriveEmailReceiptStatus([])).toEqual({ state: "not_sent" });
    expect(deriveEmailReceiptStatus([send({ channel: "WHATSAPP", recipientEmail: null })])).toEqual(
      { state: "not_sent" }
    );
  });

  it("is 'sent', to whom and when", () => {
    expect(deriveEmailReceiptStatus([send()])).toEqual({
      state: "sent",
      recipient: "alice@example.com",
      at: "2026-09-19T21:57:00.000Z",
    });
  });

  it("is 'failed', with the reason, when the only attempts failed", () => {
    expect(
      deriveEmailReceiptStatus([send({ status: "FAILED", errorMessage: "Rejected" })])
    ).toEqual({
      state: "failed",
      recipient: "alice@example.com",
      at: "2026-09-19T21:57:00.000Z",
      error: "Rejected",
    });
  });

  it("reports the MOST RECENT failure when there are several", () => {
    const status = deriveEmailReceiptStatus([
      send({
        id: "s3",
        status: "FAILED",
        errorMessage: "second",
        sentAt: "2026-09-19T22:10:00.000Z",
      }),
      send({
        id: "s2",
        status: "FAILED",
        errorMessage: "first",
        sentAt: "2026-09-19T22:00:00.000Z",
      }),
    ]);
    expect(status).toMatchObject({ state: "failed", error: "second" });
  });

  it("a success wins over a failure — before it or after it", () => {
    // A failed resend on top of a delivered receipt doesn't un-deliver it.
    expect(
      deriveEmailReceiptStatus([send({ id: "s2", status: "FAILED" }), send({ id: "s1" })]).state
    ).toBe("sent");
    // A failure followed by a successful retry is delivered.
    expect(
      deriveEmailReceiptStatus([send({ id: "s2" }), send({ id: "s1", status: "FAILED" })]).state
    ).toBe("sent");
  });

  it("reports the latest success when it went to more than one address", () => {
    const status = deriveEmailReceiptStatus([
      send({ id: "s2", recipientEmail: "corrected@example.com" }),
      send({ id: "s1", recipientEmail: "typo@exmaple.com" }),
    ]);
    expect(status).toMatchObject({ state: "sent", recipient: "corrected@example.com" });
  });
});
