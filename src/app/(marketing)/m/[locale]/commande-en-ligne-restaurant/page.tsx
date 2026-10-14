import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("commande-en-ligne-restaurant");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="commande-en-ligne-restaurant" locale={await routeLocale(params)} />;
}
