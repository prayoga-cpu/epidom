import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("layar-dapur-kds");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="layar-dapur-kds" locale={await routeLocale(params)} />;
}
