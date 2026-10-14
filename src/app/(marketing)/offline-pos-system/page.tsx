import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("offline-pos-system");

export default function Page() {
  return <LandingRoute slug="offline-pos-system" />;
}
