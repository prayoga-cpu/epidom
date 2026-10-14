import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("receipt-printer-pos");

export default function Page() {
  return <LandingRoute slug="receipt-printer-pos" />;
}
