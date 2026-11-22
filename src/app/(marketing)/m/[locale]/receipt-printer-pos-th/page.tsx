import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("receipt-printer-pos-th");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="receipt-printer-pos-th" locale={await routeLocale(params)} />;
}
