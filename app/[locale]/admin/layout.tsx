"use client";
import AdminNav from "@/components/admin/Nav";
import Loading from "@/components/loading";
import { useAdminRoute } from "@/hooks/useAdminRoute";

function AdminDashboard({ children }: { children: React.ReactNode }) {
  const loading = useAdminRoute();

  if (loading) return <Loading />;

  return (
    <section className="w-full flex justify-center items-center sm:pt-24 pt-[6rem]">
      <div className="relative flex flex-col md:p-12 py-8 rounded-xl bg-background gap-4 w-11/12 max-w-[1000px]">
        <AdminNav />
        {children}
      </div>
    </section>
  );
}

export default AdminDashboard;
