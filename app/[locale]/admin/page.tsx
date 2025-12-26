"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function AdminDashboard() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/yeasts");
  }, [router]);

  return null;
}

export default AdminDashboard;
