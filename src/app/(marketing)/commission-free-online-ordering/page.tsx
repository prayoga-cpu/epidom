import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("commission-free-online-ordering");

export default function Page() {
  return <LandingRoute slug="commission-free-online-ordering" />;
}
