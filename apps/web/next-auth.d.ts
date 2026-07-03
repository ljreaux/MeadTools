import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string; // Ensure id is a string
      email: string; // Ensure email is a string
      role: string; // Ensure role is a string
    };
  }

  interface User {
    id: string;
    email: string;
    role: string;
  }

  interface JWT {
    id: string;
    email: string;
    role: string;
  }
}
