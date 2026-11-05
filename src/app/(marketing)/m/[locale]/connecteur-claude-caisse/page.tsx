import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("connecteur-claude-caisse");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="connecteur-claude-caisse" locale={await routeLocale(params)} />;
}
