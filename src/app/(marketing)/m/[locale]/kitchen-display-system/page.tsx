import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("kitchen-display-system");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="kitchen-display-system" locale={await routeLocale(params)} />;
}
