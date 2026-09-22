"use client";
import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "../ui/tooltip";
import ReactQueryProvider from "./ReactQueryProvider";
import { BannerProvider } from "../ui/banner";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ReactQueryProvider>
      <TooltipProvider>
        <BannerProvider>
          <SessionProvider>{children}</SessionProvider>
        </BannerProvider>
      </TooltipProvider>
    </ReactQueryProvider>
  );
}
