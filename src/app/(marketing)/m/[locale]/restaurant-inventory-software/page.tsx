import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("restaurant-inventory-software");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="restaurant-inventory-software" locale={await routeLocale(params)} />;
}
