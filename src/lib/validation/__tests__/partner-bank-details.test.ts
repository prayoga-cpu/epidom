import { describe, it, expect } from "vitest";
import { partnerBankDetailsSchema } from "../partner.schemas";

describe("partner bank details", () => {
  it("accepts an IBAN or a local account number, normalised", () => {
    expect(
      partnerBankDetailsSchema.parse({
        accountHolder: " Aaron Vichard ",
        bankName: "BNP Paribas",
        accountNumber: "fr76  3000 6000 0112 3456 7890 189",
        swift: "bnpa frpp",
      })
    ).toEqual({
      accountHolder: "Aaron Vichard",
      bankName: "BNP Paribas",
      accountNumber: "FR76 3000 6000 0112 3456 7890 189",
      swift: "BNPAFRPP",
    });
    expect(
      partnerBankDetailsSchema.safeParse({
        accountHolder: "Budi",
        bankName: "BCA",
        accountNumber: "1234567890",
        swift: "",
      }).success
    ).toBe(true);
  });

  it("rejects what can't be a bank account, with an i18n key as the message", () => {
    const bad = partnerBankDetailsSchema.safeParse({
      accountHolder: "A",
      bankName: "",
      accountNumber: "<script>",
      swift: "ABC",
    });
    expect(bad.success).toBe(false);
    const messages = bad.success ? [] : bad.error.issues.map((i) => i.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        "partnerPortal.bankErrHolder",
        "partnerPortal.bankErrBank",
        "partnerPortal.bankErrNumber",
        "partnerPortal.bankErrSwift",
      ])
    );
  });
});
