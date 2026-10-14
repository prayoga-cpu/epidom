import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("kalkulator-hpp");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="kalkulator-hpp" locale={await routeLocale(params)} />;
}
