import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("caisse-hors-ligne");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="caisse-hors-ligne" locale={await routeLocale(params)} />;
}
