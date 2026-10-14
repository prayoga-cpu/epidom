import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("recipe-cost-calculator");

export default function Page() {
  return <LandingRoute slug="recipe-cost-calculator" />;
}
