import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("imprimante-ticket-caisse");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="imprimante-ticket-caisse" locale={await routeLocale(params)} />;
}
