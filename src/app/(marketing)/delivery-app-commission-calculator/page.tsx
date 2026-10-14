import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("delivery-app-commission-calculator");

export default function Page() {
  return <LandingRoute slug="delivery-app-commission-calculator" />;
}
