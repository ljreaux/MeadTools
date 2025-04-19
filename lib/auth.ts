import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "@/lib/prisma";
import { createUser } from "./db/users";

// Extend Session and JWT types for TypeScript
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      role: string;
    };
    accessToken?: string; // Add accessToken to the session
  }

  interface User {
    id: string;
    email: string;
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    role: string;
    accessToken?: string; // Add accessToken to the JWT
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      let existingUser = await prisma.users.findUnique({
        where: { email: user.email },
      });

      if (!existingUser) {
        existingUser = await createUser({
          email: user.email!,
          google_id: profile?.sub,
          role: "user", // or set a default role
        });
      } else if (account?.provider === "google" && !existingUser.google_id) {
        await prisma.users.update({
          where: { email: user.email },
          data: { google_id: profile?.sub },
        });
      }

      return true;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          id: token.id,
          email: token.email,
          role: token.role || "user",
        };
        session.accessToken = token.accessToken; // Attach the accessToken
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.role = user.role || "user";
      }

      if (account?.access_token) {
        token.accessToken = account.access_token; // Store access token from provider
      }

      return token;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt", // Use JWTs for session management
  },
};
