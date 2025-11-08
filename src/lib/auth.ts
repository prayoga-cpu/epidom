import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          if (!user) {
            return null;
          }

          const isValid = await compare(credentials.password, user.password);

          if (!isValid) {
            return null;
          }

          console.log("[NextAuth Authorize] User from DB:", {
            id: user.id,
            email: user.email,
            currency: user.currency,
            locale: user.locale,
            timezone: user.timezone,
          });

          // Return user object with all fields needed
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            currency: user.currency,
            locale: user.locale,
            timezone: user.timezone,
            phone: user.phone,
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        console.log("[NextAuth JWT] Initial user login:", user);
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.image = user.image;
        token.currency = user.currency;
        token.locale = user.locale;
        token.timezone = user.timezone;
        token.phone = user.phone;
      }

      // Update token on session update (e.g., when user changes currency in profile)
      if (trigger === "update" && session) {
        console.log("[NextAuth JWT] Session update triggered with:", session);

        if (session.currency !== undefined) {
          token.currency = session.currency;
          console.log("[NextAuth JWT] Updated token.currency to:", token.currency);
        }
        if (session.locale !== undefined) {
          token.locale = session.locale;
        }
        if (session.timezone !== undefined) {
          token.timezone = session.timezone;
        }
        if (session.name !== undefined) {
          token.name = session.name;
        }
        if (session.phone !== undefined) {
          token.phone = session.phone;
        }
        if (session.image !== undefined) {
          // Allow null to remove image
          token.image = session.image === "" ? null : session.image;
          console.log("[NextAuth JWT] Updated token.image to:", token.image);
        }
      }

      // Refresh token from database if fields are missing (for existing sessions)
      if (!token.currency || !token.locale) {
        console.log("[NextAuth JWT] Missing fields in token, refreshing from database...");
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: {
              currency: true,
              locale: true,
              timezone: true,
              phone: true,
              name: true,
              image: true,
            },
          });

          if (dbUser) {
            token.currency = dbUser.currency;
            token.locale = dbUser.locale;
            token.timezone = dbUser.timezone;
            token.phone = dbUser.phone;
            token.name = dbUser.name;
            token.image = dbUser.image;
            console.log("[NextAuth JWT] Token refreshed from DB with currency:", token.currency);
          }
        } catch (error) {
          console.error("[NextAuth JWT] Error refreshing token from DB:", error);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string | null;
        session.user.image = token.image as string | null;
        session.user.currency = token.currency as string;
        session.user.locale = token.locale as string;
        session.user.timezone = token.timezone as string;
        session.user.phone = token.phone as string;
      }

      console.log("[NextAuth Session] Returning session with currency:", session.user?.currency);
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET || process.env.NEXT_AUTH_TOKEN_SECRET,
  debug: process.env.NODE_ENV === "development",
};

export default authOptions;
