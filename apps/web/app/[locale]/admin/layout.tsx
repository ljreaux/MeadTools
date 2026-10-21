"use client";
import AdminNav from "@/components/admin/Nav";
import Loading from "@/components/loading";
import { useAdminRoute } from "@/hooks/useAdminRoute";
import { PagePanel } from "@/components/PagePanel";

function AdminDashboard({ children }: { children: React.ReactNode }) {
  const loading = useAdminRoute();

  if (loading) return <Loading />;

  return (
    <section className="flex w-full justify-center pb-12 pt-24 sm:pt-28">
      <PagePanel className="relative flex w-11/12 max-w-[1200px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 md:p-12">
        <AdminNav />
        <main>{children}</main>
      </PagePanel>
    </section>
  );
}

export default AdminDashboard;
