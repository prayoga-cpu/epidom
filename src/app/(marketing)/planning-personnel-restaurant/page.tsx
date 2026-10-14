import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("planning-personnel-restaurant");

export default function Page() {
  return <LandingRoute slug="planning-personnel-restaurant" />;
}
