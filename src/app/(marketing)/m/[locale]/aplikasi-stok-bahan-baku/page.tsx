import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("aplikasi-stok-bahan-baku");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="aplikasi-stok-bahan-baku" locale={await routeLocale(params)} />;
}
