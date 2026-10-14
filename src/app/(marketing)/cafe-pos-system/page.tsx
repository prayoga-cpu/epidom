import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("cafe-pos-system");

export default function Page() {
  return <LandingRoute slug="cafe-pos-system" />;
}
