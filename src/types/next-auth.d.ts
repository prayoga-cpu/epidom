import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      currency?: string;
      locale?: string;
      timezone?: string;
      phone?: string | null;
      subscriptionStatus?: string | null;
    } & DefaultSession["user"];
    currency?: string; // For session updates
    locale?: string;
    timezone?: string;
    phone?: string | null;
    image?: string | null;
    name?: string | null;
  }
  interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    currency?: string;
    locale?: string;
    timezone?: string;
    phone?: string | null;
    subscriptionStatus?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    currency?: string;
    locale?: string;
    timezone?: string;
    phone?: string | null;
    subscriptionStatus?: string | null;
  }
}
