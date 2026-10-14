import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("restaurant-staff-scheduling");

export default function Page() {
  return <LandingRoute slug="restaurant-staff-scheduling" />;
}
