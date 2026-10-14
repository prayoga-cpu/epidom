import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("imprimante-ticket-caisse");

export default function Page() {
  return <LandingRoute slug="imprimante-ticket-caisse" />;
}
