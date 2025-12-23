"use client";

// Better-auth doesn't need a session provider wrapper in client components
// Session is managed through the authClient hooks
export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
