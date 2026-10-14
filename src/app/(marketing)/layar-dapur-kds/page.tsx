import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("layar-dapur-kds");

export default function Page() {
  return <LandingRoute slug="layar-dapur-kds" />;
}
