"use client";
import { BacksweeteningProvider } from "@/components/providers/BacksweeteningProvider";
import { ReactNode } from "react";

function Layout({ children }: { children: ReactNode }) {
  return <BacksweeteningProvider>{children}</BacksweeteningProvider>;
}

export default Layout;
