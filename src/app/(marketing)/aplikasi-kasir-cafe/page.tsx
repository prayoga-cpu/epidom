import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("aplikasi-kasir-cafe");

export default function Page() {
  return <LandingRoute slug="aplikasi-kasir-cafe" />;
}
