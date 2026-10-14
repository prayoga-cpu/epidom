import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("pesan-online-tanpa-komisi");

export default function Page() {
  return <LandingRoute slug="pesan-online-tanpa-komisi" />;
}
