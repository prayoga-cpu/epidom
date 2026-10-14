import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("ecran-cuisine-kds");

export default function Page() {
  return <LandingRoute slug="ecran-cuisine-kds" />;
}
