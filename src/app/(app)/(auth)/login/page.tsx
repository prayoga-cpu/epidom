import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthPage } from "@/features/auth/components/auth-page";

export default async function LoginPage() {
  // Already signed in? Any CTA that lands here bounces the user to their stores.
  const session = await getSession();
  if (session?.user) redirect("/stores");

  return <AuthPage initialMode="login" />;
}
