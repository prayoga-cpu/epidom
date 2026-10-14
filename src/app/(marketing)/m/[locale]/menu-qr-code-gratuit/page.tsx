import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("menu-qr-code-gratuit");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="menu-qr-code-gratuit" locale={await routeLocale(params)} />;
}
