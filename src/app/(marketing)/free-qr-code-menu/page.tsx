import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("free-qr-code-menu");

export default function Page() {
  return <LandingRoute slug="free-qr-code-menu" />;
}
