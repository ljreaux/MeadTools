"use client";
import { ThemeProvider } from "./theme-provider";
import { SessionProvider } from "next-auth/react";
import { AuthProvider } from "./AuthProvider";
import { TooltipProvider } from "../ui/tooltip";
import ReactQueryProvider from "./ReactQueryProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ReactQueryProvider>
        <TooltipProvider>
          <SessionProvider>
            <AuthProvider>{children}</AuthProvider>
          </SessionProvider>
        </TooltipProvider>
      </ReactQueryProvider>
    </ThemeProvider>
  );
}
