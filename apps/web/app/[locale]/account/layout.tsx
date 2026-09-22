"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Loading from "@/components/loading";
import { useAuth } from "@/hooks/auth/useAuth"; // ← update this path
import { ReactNode } from "react";

function AccountGuard({ children }: { children: ReactNode }) {
  const { isLoggedIn, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      const queryString = searchParams.toString();
      const next = `${pathname}${queryString ? `?${queryString}` : ""}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [loading, isLoggedIn, pathname, router, searchParams]);

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

function Account({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Loading />}>
      <AccountGuard>{children}</AccountGuard>
    </Suspense>
  );
}

export default Account;
