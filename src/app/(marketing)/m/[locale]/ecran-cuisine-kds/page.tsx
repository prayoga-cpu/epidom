import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("ecran-cuisine-kds");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="ecran-cuisine-kds" locale={await routeLocale(params)} />;
}
