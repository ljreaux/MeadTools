"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/auth/useAuth";
import { useToast } from "@/hooks/use-toast";

export const useAdminRoute = () => {
  const { toast } = useToast();
  const router = useRouter();

  // React Query + next-auth–driven auth state
  const { user, isLoggedIn, loading } = useAuth();

  useEffect(() => {
    // Don't do anything until auth state has finished loading
    if (loading) return;

    const isAdmin = isLoggedIn && user && user.role === "admin";

    if (!isAdmin) {
      toast({
        title: "Unauthorized",
        description: "You are not authorized to use this dashboard",
        variant: "destructive"
      });

      router.push("/");
    }
  }, [loading, isLoggedIn, user, router, toast]);

  // Layout only cares if we're still "checking / redirecting"
  if (loading) return true;
  if (!isLoggedIn || !user || user.role !== "admin") return true;

  // User is confirmed admin
  return false;
};
