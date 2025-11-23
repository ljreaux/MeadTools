"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Loading from "@/components/loading";
import { useAuth } from "@/hooks/useAuth"; // ← update this path
import { ReactNode } from "react";

function Account({ children }: { children: ReactNode }) {
  const { isLoggedIn, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      router.replace("/login");
    }
  }, [loading, isLoggedIn, router]);

  if (loading) {
    return <Loading />;
  }

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="w-full flex flex-col justify-center items-center py-[6rem] relative">
      {children}
    </div>
  );
}

export default Account;
