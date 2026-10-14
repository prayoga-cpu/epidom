import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("aplikasi-kasir-offline");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="aplikasi-kasir-offline" locale={await routeLocale(params)} />;
}
