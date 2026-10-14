import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("gestion-stock-restaurant");

export default function Page() {
  return <LandingRoute slug="gestion-stock-restaurant" />;
}
