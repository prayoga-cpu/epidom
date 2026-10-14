import { describe, it, expect, vi } from "vitest";

// The page body is covered by contact-page-client.test.tsx; only the exported
// metadata is under test here, so keep the client component out of the import graph.
vi.mock("@/features/marketing/contact/components/contact-page-client", () => ({
  ContactPageClient: () => null,
}));

import { generateMetadata } from "@/app/(marketing)/m/[locale]/contact/page";

// The metadata is per-locale: the page reads its language from its route segment.
async function metadataFor(locale: "fr" | "id" | "en") {
  return generateMetadata({ params: Promise.resolve({ locale }) });
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
