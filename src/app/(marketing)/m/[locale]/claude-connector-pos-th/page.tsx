import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("claude-connector-pos-th");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="claude-connector-pos-th" locale={await routeLocale(params)} />;
}
