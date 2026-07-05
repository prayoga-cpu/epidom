import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { RegisterForm } from "@/features/auth/register/components/register-form";
import { AuthVisual } from "@/features/auth/components/auth-visual";
import { EpidomLogo } from "@/features/marketing/shared/components/epidom-logo";

export default async function RegisterPage() {
  // Already signed in? Any CTA that lands here bounces the user to their stores.
  const session = await getSession();
  if (session?.user) redirect("/stores");

  return (
    <div
      className="grid h-screen w-full grid-cols-1 overflow-hidden md:grid-cols-2"
      style={{ background: "var(--epi-navy-900)" }}
    >
      {/* Left: Form Area */}
      {/* Removed justify-center to allow scroll on overflow */}
      <div className="scrollbar-hide animate-in fade-in slide-in-from-left-4 relative flex h-full flex-col items-center overflow-y-auto p-8 duration-700">
        {/* Main Content - my-auto handles safe centering */}
        <div className="my-auto w-full max-w-[380px]">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <EpidomLogo size={28} href="/" />
          </div>

          <RegisterForm />
        </div>

        {/* Footer - In flow */}
        <div className="mt-8 w-full shrink-0 text-center">
          <p className="text-xs" style={{ color: "rgba(251,249,228,0.4)" }}>
            © 2025 Epidom. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right: Visual Area */}
      <div className="hidden h-full md:block">
        <AuthVisual />
      </div>
    </div>
  );
}
