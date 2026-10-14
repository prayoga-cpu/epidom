import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("bakery-pos-system");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="bakery-pos-system" locale={await routeLocale(params)} />;
}
