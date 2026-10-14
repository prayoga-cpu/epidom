import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("calcul-commission-uber-eats");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="calcul-commission-uber-eats" locale={await routeLocale(params)} />;
}
