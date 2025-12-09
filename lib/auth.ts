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
          prompt: "select_account"
        }
      }
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Only care about Google sign-ins
      const isGoogle = account?.provider === "google";

      // Safely grab the Google picture, if any
      const googleImage =
        (profile as any)?.picture || (user as any)?.image || null;

      let existingUser = await prisma.users.findUnique({
        where: { email: user.email! }
      });

      if (!existingUser) {
        // Make sure createUser accepts google_avatar_url + show_google_avatar
        existingUser = await createUser({
          email: user.email!,
          google_id: isGoogle ? (profile as any)?.sub : undefined,
          role: "user",
          google_avatar_url: googleImage,
          // Leave opt-in false by default
          show_google_avatar: false
        });
      } else {
        // Keep custom user row in sync when they log in with Google
        const updateData: any = {};

        if (isGoogle && !existingUser.google_id) {
          updateData.google_id = (profile as any)?.sub;
        }

        // Always refresh stored avatar if we got a picture
        if (googleImage) {
          updateData.google_avatar_url = googleImage;
        }

        if (Object.keys(updateData).length > 0) {
          existingUser = await prisma.users.update({
            where: { email: user.email! },
            data: updateData
          });
        }
      }

      return true;
    },

    async session({ session, token }) {
      if (token) {
        session.user = {
          id: token.id,
          email: token.email,
          role: token.role || "user"
        };
        session.accessToken = token.accessToken;
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
        token.accessToken = account.access_token;
      }

      return token;
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt" // Use JWTs for session management
  }
};
