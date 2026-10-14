import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("free-qr-code-menu");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="free-qr-code-menu" locale={await routeLocale(params)} />;
}
