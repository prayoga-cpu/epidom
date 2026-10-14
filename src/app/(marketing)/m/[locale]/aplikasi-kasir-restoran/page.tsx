import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("aplikasi-kasir-restoran");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="aplikasi-kasir-restoran" locale={await routeLocale(params)} />;
}
