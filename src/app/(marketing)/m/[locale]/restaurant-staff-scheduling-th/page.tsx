import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("restaurant-staff-scheduling-th");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="restaurant-staff-scheduling-th" locale={await routeLocale(params)} />;
}
