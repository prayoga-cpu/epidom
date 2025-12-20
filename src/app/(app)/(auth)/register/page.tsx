import { RegisterForm } from "@/features/auth/register/components/register-form";
import { AuthVisual } from "@/features/auth/components/auth-visual";
import Image from "next/image";

export default function RegisterPage() {
  return (
    <div className="grid h-screen w-full grid-cols-1 overflow-hidden bg-white md:grid-cols-2">
      {/* Left: Form Area */}
      {/* Removed justify-center to allow scroll on overflow */}
      <div className="scrollbar-hide animate-in fade-in slide-in-from-left-4 relative flex h-full flex-col items-center overflow-y-auto p-8 duration-700">
        {/* Main Content - my-auto handles safe centering */}
        <div className="my-auto w-full max-w-[380px]">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <div className="relative h-8 w-32">
              <Image
                src="/images/logo-black.png"
                alt="Epidom"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          <RegisterForm />
        </div>

        {/* Footer - In flow */}
        <div className="mt-8 w-full shrink-0 text-center">
          <p className="text-xs text-gray-400">© 2025 Epidom. All rights reserved.</p>
        </div>
      </div>

      {/* Right: Visual Area */}
      <div className="hidden h-full md:block">
        <AuthVisual />
      </div>
    </div>
  );
}
