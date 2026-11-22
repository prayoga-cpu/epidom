import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("cafe-pos-system-th");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="cafe-pos-system-th" locale={await routeLocale(params)} />;
}
