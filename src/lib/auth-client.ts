"use client";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

export function useUser() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (session?.user) {
      console.log("[useUser] Current session user:", {
        email: session.user.email,
        currency: session.user.currency,
        locale: session.user.locale,
      });
    }
  }, [session?.user?.currency, session?.user?.locale]);

  return {
    user: session?.user,
    loading: status === "loading",
  };
}
