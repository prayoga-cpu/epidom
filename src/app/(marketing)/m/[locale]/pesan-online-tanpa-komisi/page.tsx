import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("pesan-online-tanpa-komisi");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="pesan-online-tanpa-komisi" locale={await routeLocale(params)} />;
}
