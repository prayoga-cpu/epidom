import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("calcul-cout-de-revient");

export default function Page() {
  return <LandingRoute slug="calcul-cout-de-revient" />;
}
