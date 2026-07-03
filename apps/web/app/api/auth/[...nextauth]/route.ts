import { authOptions } from "@/lib/auth";
import NextAuth from "next-auth";

// Use the NextAuth function for both GET and POST
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
