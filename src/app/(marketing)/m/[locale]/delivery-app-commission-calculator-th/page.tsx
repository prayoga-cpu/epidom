import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("delivery-app-commission-calculator-th");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="delivery-app-commission-calculator-th" locale={await routeLocale(params)} />;
}
