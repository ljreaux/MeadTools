"use client";
import { useParams } from "next/navigation";
import Loading from "@/components/loading";
import Link from "next/link";
import { User } from "@/types/admin";
import UserEditForm from "@/components/admin/UserEditForm";
import { useAdminFetchData } from "@/hooks/useAdminFetchData";

export default function UserEditPage() {
  const { id } = useParams();
  const {
    data: user,
    loading,
    error,
  } = useAdminFetchData<User>(`/api/users/${id}`);

  if (loading) return <Loading />;
  if (error) return <p>Error: {error.message}</p>;
  if (!user) return null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold mb-6">Edit User</h2>
        <Link href={"/admin/users"}>Back to All Users</Link>
      </div>
      <UserEditForm user={user} />
    </div>
  );
}
