import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("receipt-printer-pos");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="receipt-printer-pos" locale={await routeLocale(params)} />;
}
