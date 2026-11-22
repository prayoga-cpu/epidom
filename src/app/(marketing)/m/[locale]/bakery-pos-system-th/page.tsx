import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("bakery-pos-system-th");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="bakery-pos-system-th" locale={await routeLocale(params)} />;
}
