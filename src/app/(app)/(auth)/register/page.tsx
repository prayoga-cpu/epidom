import { RegisterForm } from "@/features/auth/register/components/register-form";
import { AuthVisual } from "@/features/auth/components/auth-visual";

export default function RegisterPage() {
  return (
    <div className="grid h-screen w-full grid-cols-1 md:grid-cols-2 overflow-hidden bg-white">
       {/* Left: Form Area */}
       <div className="flex flex-col overflow-y-auto px-6 py-12 sm:px-12 lg:px-24 xl:px-32 scrollbar-hide animate-slide-up">
        <div className="mb-auto"></div>

        <div className="w-full max-w-sm mx-auto">
          <RegisterForm />
        </div>

        <div className="mt-auto pt-10 text-center md:text-left">
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
