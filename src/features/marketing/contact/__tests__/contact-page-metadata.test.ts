import { describe, it, expect, vi } from "vitest";

// The page body is covered by contact-page-client.test.tsx; only the exported
// metadata is under test here, so keep the client component out of the import graph.
vi.mock("@/features/marketing/contact/components/contact-page-client", () => ({
  ContactPageClient: () => null,
}));

// The metadata is per-locale now: the proxy sets this header on every request.
const mocks = vi.hoisted(() => ({ locale: "en" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-epidom-locale": mocks.locale }),
}));

import { generateMetadata } from "@/app/(marketing)/contact/page";

async function metadataFor(locale: "fr" | "id" | "en") {
  mocks.locale = locale;
  return generateMetadata();
}

describe("/contact metadata", () => {
  it.each(["fr", "id", "en"] as const)("no longer promises a contact form (%s)", async (locale) => {
    // \bform\b so "platform" or "information" cannot trip it.
    expect(JSON.stringify(await metadataFor(locale))).not.toMatch(/\bform\b/i);
  });

  it.each(["fr", "id", "en"] as const)(
    "describes the channels that actually exist (%s)",
    async (locale) => {
      const metadata = await metadataFor(locale);
      expect(metadata.description).toMatch(/WhatsApp/);
      expect(metadata.description).toMatch(/e-?mail/i);
      expect(metadata.openGraph?.description).toMatch(/WhatsApp/);
      expect(metadata.openGraph?.description).toMatch(/e-?mail/i);
    }
  );

  it("keeps the hreflang alternates and canonicalises to the served locale", async () => {
    const paths = {
      fr: "https://epidom.fr/contact",
      id: "https://epidom.fr/id/contact",
      en: "https://epidom.fr/en/contact",
    };
    for (const locale of ["fr", "id", "en"] as const) {
      const metadata = await metadataFor(locale);
      expect(metadata.alternates?.canonical).toBe(paths[locale]);
      expect(metadata.alternates?.languages).toMatchObject(paths);
    }
  });
});
