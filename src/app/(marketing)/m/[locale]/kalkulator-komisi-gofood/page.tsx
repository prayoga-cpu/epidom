import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("kalkulator-komisi-gofood");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="kalkulator-komisi-gofood" locale={await routeLocale(params)} />;
}
