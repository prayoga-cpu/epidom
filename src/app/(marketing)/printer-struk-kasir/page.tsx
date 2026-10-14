import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("printer-struk-kasir");

export default function Page() {
  return <LandingRoute slug="printer-struk-kasir" />;
}
