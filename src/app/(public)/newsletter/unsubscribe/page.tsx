import type { Metadata } from "next";
import { SeededI18nProvider } from "@/components/lang/seeded-i18n-provider";
import { NewsletterUnsubscribeClient } from "@/features/newsletter/newsletter-unsubscribe-client";
import { newsletterLocale } from "@/lib/newsletter/render";
import { verifyUnsubscribeToken } from "@/lib/newsletter/unsubscribe-token";

export const metadata: Metadata = {
  title: "Newsletter - EPIDOM",
  robots: { index: false, follow: false },
  // The token is in this page's URL: never leak it in a Referer.
  referrer: "no-referrer",
};

/**
 * Where a newsletter's footer link lands. It asks before unsubscribing (the
 * button POSTs), because link scanners open every URL in an email. Served in
 * the language the newsletter was sent in (`?l=`).
 */
export default async function NewsletterUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[]; l?: string | string[] }>;
}) {
  const { t, l } = await searchParams;
  const token = typeof t === "string" ? t : null;
  const email = verifyUnsubscribeToken(token);
  return (
    <SeededI18nProvider locale={newsletterLocale(typeof l === "string" ? l : null)}>
      <NewsletterUnsubscribeClient token={email ? token : null} email={email} />
    </SeededI18nProvider>
  );
}
