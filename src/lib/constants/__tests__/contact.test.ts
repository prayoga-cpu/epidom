import { describe, it, expect } from "vitest";
import {
  SUPPORT_EMAIL_ADDRESSES,
  SUPPORT_EMAIL_DISPLAY,
  SUPPORT_EMAIL_PRIMARY,
  SUPPORT_MAILTO,
  supportMailto,
  getWhatsAppOptions,
  whatsappHref,
} from "../contact";

describe("support email constants", () => {
  it("addresses the mailto to every support recipient", () => {
    expect(SUPPORT_MAILTO).toBe(`mailto:${SUPPORT_EMAIL_ADDRESSES.join(",")}`);
  });

  it("lists the addresses for visible text", () => {
    expect(SUPPORT_EMAIL_DISPLAY).toBe(SUPPORT_EMAIL_ADDRESSES.join(", "));
  });

  it("keeps the single-address form inside the recipient list", () => {
    expect(SUPPORT_EMAIL_ADDRESSES).toContain(SUPPORT_EMAIL_PRIMARY);
  });

  it("encodes a subject into the mailto", () => {
    const href = supportMailto("Partner enquiry & more");
    expect(href.startsWith(SUPPORT_MAILTO)).toBe(true);
    expect(href).toContain("?subject=Partner%20enquiry%20%26%20more");
  });
});

describe("WhatsApp options", () => {
  it("offers France only for fr, Indonesia only for id, both (France first) for en", () => {
    expect(getWhatsAppOptions("fr").map((o) => o.label)).toEqual(["France"]);
    expect(getWhatsAppOptions("id").map((o) => o.label)).toEqual(["Indonesia"]);
    expect(getWhatsAppOptions("en").map((o) => o.label)).toEqual(["France", "Indonesia"]);
  });

  it("builds a wa.me link with an encoded prefilled message", () => {
    expect(whatsappHref("123", "Hi there")).toBe("https://wa.me/123?text=Hi%20there");
    expect(whatsappHref("123")).toBe("https://wa.me/123");
  });
});
