import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { LoginInput, RegisterInput } from "../validation/auth.schemas";
import { authClient } from "@/lib/auth-client";

/**
 * Login mutation hook
 */
export function useLogin() {
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: LoginInput) => {
      const { data: session, error } = await authClient.signIn.email({
        email: data.email,
        password: data.password,
      });

      if (error) {
        throw new Error(error.message || "Invalid email or password");
      }

      return session;
    },
  });
}

/**
 * Register mutation hook
 */
export function useRegister() {
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: RegisterInput) => {
      const { data: session, error } = await authClient.signUp.email({
        email: data.email,
        password: data.password,
        name: data.name,
      });

      if (error) {
        throw new Error(error.message || "Registration failed");
      }

<<<<<<< HEAD
      return session;
    },
    onSuccess: () => {
      // Redirect to onboarding page or verify email page
      router.push("/onboarding");
=======
      // Return email for redirect
      return { session, email: data.email };
    },
    onSuccess: (data) => {
      // Redirect to verify-email-sent page with email parameter
      router.push(`/verify-email-sent?email=${encodeURIComponent(data.email)}`);
>>>>>>> dev
    },
  });
}
