import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("calcul-commission-uber-eats");

export default function Page() {
  return <LandingRoute slug="calcul-commission-uber-eats" />;
}
