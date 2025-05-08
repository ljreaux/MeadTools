"use client";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";

function AdminDashboard() {
  const router = useRouter();

  useEffect(() => router.push("/admin/yeasts"));

  return <div></div>;
}

export default AdminDashboard;
