"use client";

import { useParams } from "next/navigation";
import Loading from "@/components/loading";
import Link from "next/link";
import UserEditForm from "@/components/admin/UserEditForm";
import { useAdminUserById } from "@/hooks/reactQuery/useAdminUsersQuery";

export default function UserEditPage() {
  const { id } = useParams();
  const { user, isLoading, isError, error } = useAdminUserById(id as string);

  if (isLoading) return <Loading />;
  if (isError) return <p>Error: {String(error)}</p>;
  if (!user) return <p>User not found.</p>;

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
