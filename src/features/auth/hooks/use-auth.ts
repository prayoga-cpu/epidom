import { useMutation } from "@tanstack/react-query";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LoginInput, RegisterInput } from "../validation/auth.schemas";

/**
 * Login mutation hook
 */
export function useLogin() {
  return useMutation({
    mutationFn: async (data: LoginInput) => {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error("Invalid email or password");
      }

      if (!result?.ok) {
        throw new Error("Login failed. Please try again.");
      }

      return result;
    },
  });
}

/**
 * Register mutation hook
 *
 * After successful registration:
 * 1. Auto-login the user
 * 2. Redirect to onboarding (card validation)
 */
export function useRegister() {
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: RegisterInput) => {
      // Step 1: Register the user
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
          businessName: data.businessName,
          address: data.address,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle specific error codes
        if (result.error?.code === "EMAIL_ALREADY_EXISTS" || response.status === 409) {
          throw new Error("An account with this email already exists");
        }

        if (result.error?.code === "VALIDATION_ERROR" && result.error?.details) {
          const errors = Array.isArray(result.error.details)
            ? result.error.details.map((d: any) => d.message).join(", ")
            : result.error.message;
          throw new Error(errors);
        }

        throw new Error(result.error?.message || "Registration failed. Please try again.");
      }

      // Step 2: Auto-login the user
      const loginResult = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (loginResult?.error) {
        // Registration succeeded but login failed
        // Redirect to login page instead
        throw new Error("Account created! Please log in to continue.");
      }

      return result;
    },
    onSuccess: () => {
      // Redirect to onboarding page for card validation
      router.push("/onboarding");
    },
  });
}
