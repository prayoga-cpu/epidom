import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("restaurant-inventory-software");

export default function Page() {
  return <LandingRoute slug="restaurant-inventory-software" />;
}
