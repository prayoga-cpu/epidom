"use client";
import { useSession } from "next-auth/react";

export function useUser() {
  const { data: session, status } = useSession();

  // Removed console.log to reduce Fast Refresh triggers
  // Session data is available via the returned object

  return {
    user: session?.user,
    loading: status === "loading",
  };
}
