"use client";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

export function useUser() {
  const { data: session, status } = useSession();

  useEffect(() => {
    console.log("[useUser] Session status:", status);
    console.log("[useUser] Session data:", session);
    if (session?.user) {
      console.log("[useUser] Current session user:", {
        email: session.user.email,
        currency: session.user.currency,
        locale: session.user.locale,
      });
    }
  }, [session, status]);

  return {
    user: session?.user,
    loading: status === "loading",
  };
}
