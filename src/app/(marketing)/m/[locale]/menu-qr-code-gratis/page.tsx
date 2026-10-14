import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("menu-qr-code-gratis");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="menu-qr-code-gratis" locale={await routeLocale(params)} />;
}
