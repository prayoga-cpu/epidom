import { RegisterForm } from "@/features/auth/register/components/register-form";
import { RegisterImage } from "@/features/auth/register/components/register-image";

export default function RegisterPage() {
  return (
    <div className="grid h-screen grid-cols-1 md:grid-cols-2 overflow-hidden">
      <div className="overflow-y-auto p-6 sm:p-8 scrollbar-hide animate-slide-up">
        <div className="flex min-h-full items-center justify-center">
          <RegisterForm />
        </div>
      </div>
      <div className="h-full">
        <RegisterImage />
      </div>
    </div>
  );
}
