import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("recipe-cost-calculator");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="recipe-cost-calculator" locale={await routeLocale(params)} />;
}
