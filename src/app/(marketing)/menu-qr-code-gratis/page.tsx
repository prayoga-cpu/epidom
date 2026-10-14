import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("menu-qr-code-gratis");

export default function Page() {
  return <LandingRoute slug="menu-qr-code-gratis" />;
}
