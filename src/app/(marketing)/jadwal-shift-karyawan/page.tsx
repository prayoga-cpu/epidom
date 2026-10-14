import { LandingRoute, landingMetadata } from "@/features/marketing/landing/render-landing-page";

export const generateMetadata = landingMetadata("jadwal-shift-karyawan");

export default function Page() {
  return <LandingRoute slug="jadwal-shift-karyawan" />;
}
