import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("printer-struk-kasir");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="printer-struk-kasir" locale={await routeLocale(params)} />;
}
