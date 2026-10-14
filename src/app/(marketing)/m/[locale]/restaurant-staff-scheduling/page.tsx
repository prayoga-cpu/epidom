import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("restaurant-staff-scheduling");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="restaurant-staff-scheduling" locale={await routeLocale(params)} />;
}
