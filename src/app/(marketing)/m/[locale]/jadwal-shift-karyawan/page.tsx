import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";
import { routeLocale, type LocaleParams } from "@/features/marketing/seo/route-locale";

export const generateMetadata = landingMetadata("jadwal-shift-karyawan");

export default async function Page({ params }: LocaleParams) {
  return <LandingRoute slug="jadwal-shift-karyawan" locale={await routeLocale(params)} />;
}
