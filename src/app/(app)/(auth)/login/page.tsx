import { LoginForm } from "@/features/auth/login/components/login-form";
import { LoginImage } from "@/features/auth/login/components/login-image";

export default function LoginPage() {
  return (
    <div className="grid h-screen grid-cols-1 md:grid-cols-2 overflow-hidden">
      <div className="overflow-y-auto p-6 sm:p-8 scrollbar-hide animate-slide-up">
        <div className="flex min-h-full items-center justify-center">
          <LoginForm />
        </div>
      </div>
      <div className="h-full">
        <LoginImage />
      </div>
    </div>
  );
}
