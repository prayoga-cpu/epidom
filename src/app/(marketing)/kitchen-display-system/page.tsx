import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("kitchen-display-system");

export default function Page() {
  return <LandingRoute slug="kitchen-display-system" />;
}
