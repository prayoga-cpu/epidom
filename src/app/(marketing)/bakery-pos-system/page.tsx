import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("bakery-pos-system");

export default function Page() {
  return <LandingRoute slug="bakery-pos-system" />;
}
