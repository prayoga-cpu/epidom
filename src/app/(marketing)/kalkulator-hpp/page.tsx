import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("kalkulator-hpp");

export default function Page() {
  return <LandingRoute slug="kalkulator-hpp" />;
}
