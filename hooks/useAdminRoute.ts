import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "./use-toast";

export const useAdminRoute = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  useEffect(() => {
    const checkAdmin = async () => {
      setLoading(true);
      let isAdmin = false;

      const storedToken = localStorage.getItem("accessToken");
      if (storedToken) {
        const res = await fetch("/api/auth/account-info", {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        const data = await res.json();

        isAdmin = data.user.role === "admin";
      }

      if (!isAdmin) {
        toast({
          title: "Unauthorized",
          description: "You are not authorized to use this dashboard",
          variant: "destructive",
        });
        router.push("/");
      }

      setLoading(false);
    };

    checkAdmin();
  }, []);

  return loading;
};
