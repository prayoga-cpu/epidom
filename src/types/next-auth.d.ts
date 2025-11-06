import NextAuth from "next-auth";

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
    };
    currency?: string; // For session updates
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
  }
}
