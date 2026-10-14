import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("calcul-cout-de-revient");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="calcul-cout-de-revient" locale={await routeLocale(params)} />;
}
