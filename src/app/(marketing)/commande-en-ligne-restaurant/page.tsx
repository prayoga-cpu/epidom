import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("commande-en-ligne-restaurant");

export default function Page() {
  return <LandingRoute slug="commande-en-ligne-restaurant" />;
}
