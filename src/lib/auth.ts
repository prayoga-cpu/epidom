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
          return null;
        }
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  cookies: {
    sessionToken: {
      name: `${process.env.NEXTAUTH_URL?.startsWith("https") ? "__Secure-" : ""}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NEXTAUTH_URL?.startsWith("https") ?? false,
      },
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.image = user.image;
        token.currency = user.currency;
        token.locale = user.locale;
        token.timezone = user.timezone;
        token.phone = user.phone;

        // Fetch subscription status on initial sign in
        try {
          const subscription = await prisma.subscription.findUnique({
            where: { userId: user.id },
            select: { status: true },
          });
          token.subscriptionStatus = subscription?.status || null;
        } catch (error) {
          token.subscriptionStatus = null;
        }
      }

      // Update token on session update (e.g., when user changes currency in profile)
      if (trigger === "update" && session) {
        if (session.currency !== undefined) {
          token.currency = session.currency;
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
        }
        // Allow updating subscription status via session update if needed
        if (session.subscriptionStatus !== undefined) {
          token.subscriptionStatus = session.subscriptionStatus;
        }
      }

      // Refresh token from database if fields are missing (for existing sessions)
      if (!token.currency || !token.locale || token.subscriptionStatus === undefined) {
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

          // Also fetch subscription status
          const subscription = await prisma.subscription.findUnique({
            where: { userId: token.id as string },
            select: { status: true },
          });

          if (dbUser) {
            token.currency = dbUser.currency;
            token.locale = dbUser.locale;
            token.timezone = dbUser.timezone;
            token.phone = dbUser.phone;
            token.name = dbUser.name;
            token.image = dbUser.image;
            token.subscriptionStatus = subscription?.status || null;
          }
        } catch (error) {}
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
        session.user.subscriptionStatus = token.subscriptionStatus as string | null;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET || process.env.NEXT_AUTH_TOKEN_SECRET,
  // Only enable debug in development when explicitly enabled via environment variable
  // This prevents the DEBUG_ENABLED warning in production
  debug: process.env.NODE_ENV === "development" && process.env.NEXTAUTH_DEBUG === "true",
};

export default authOptions;
