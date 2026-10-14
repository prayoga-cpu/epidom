import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("caisse-hors-ligne");

export default function Page() {
  return <LandingRoute slug="caisse-hors-ligne" />;
}
