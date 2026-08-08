import { describe, it, expect } from "vitest";
import { updateReceiptSettingsSchema } from "../receipt-settings.schemas";

describe("updateReceiptSettingsSchema", () => {
  it("accepts a fully empty payload (all fields optional)", () => {
    const result = updateReceiptSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a valid partial update", () => {
    const result = updateReceiptSettingsSchema.safeParse({
      footerMessage: "Terima kasih!\nSilakan datang kembali",
      showSocialLinks: false,
      autoSendWhatsappReceipt: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a footer message that is too long", () => {
    const result = updateReceiptSettingsSchema.safeParse({
      footerMessage: "x".repeat(301),
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-boolean values for the toggle fields", () => {
    const result = updateReceiptSettingsSchema.safeParse({
      showSocialLinks: "yes" as unknown as boolean,
    });
    expect(result.success).toBe(false);
  });
});
