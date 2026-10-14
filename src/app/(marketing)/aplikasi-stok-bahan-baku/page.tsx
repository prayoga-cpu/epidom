import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("aplikasi-stok-bahan-baku");

export default function Page() {
  return <LandingRoute slug="aplikasi-stok-bahan-baku" />;
}
