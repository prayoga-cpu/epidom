import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("konektor-claude-kasir");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="konektor-claude-kasir" locale={await routeLocale(params)} />;
}
