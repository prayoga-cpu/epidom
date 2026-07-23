import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { LoginInput, RegisterInput } from "../validation/auth.schemas";
import { authClient } from "@/lib/auth-client";
import { trackMetaPixelEvent, trackEvent, trackConversion } from "@/lib/analytics";

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
    onSuccess: () => {
      // Standard GA4 event name — recurring usage, not an ad conversion, so
      // it's analytics-gated (trackEvent) rather than marketing-gated.
      trackEvent("login", { method: "email" });
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

      // Return email for redirect
      return { session, email: data.email };
    },
    onSuccess: (data) => {
      // Standard Meta event — lets Meta optimize ad campaigns against actual
      // signups natively, instead of a custom conversion. content_name/status
      // are Meta's documented CompleteRegistration params; no value/currency
      // since a free signup has no monetary amount yet (added downstream at
      // begin_checkout/Subscribe once a real plan/price is chosen).
      trackMetaPixelEvent("CompleteRegistration", {
        content_name: "Signup",
        status: true,
      });
      // Standard GA4 event — real signup funnel conversion, marketing-gated
      // so it also feeds Google Ads conversion tracking if/when linked.
      trackConversion("sign_up", { event_label: "email", method: "email" });

      // Redirect to verify-email-sent page with email parameter
      router.push(`/verify-email-sent?email=${encodeURIComponent(data.email)}`);
    },
  });
}
