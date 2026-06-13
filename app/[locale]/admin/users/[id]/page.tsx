"use client";

import { useParams } from "next/navigation";
import Loading from "@/components/loading";
import Link from "next/link";
import UserEditForm from "@/components/admin/UserEditForm";
import { useAdminUserById } from "@/hooks/reactQuery/useAdminUsersQuery";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";

export default function UserEditPage() {
  const { id } = useParams();
  const { user, isLoading, isError, error } = useAdminUserById(id as string);

  if (isLoading) return <Loading />;
  if (isError) return <p>Error: {String(error)}</p>;
  if (!user) return <p>User not found.</p>;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Edit User"
        description={user.email}
        actions={
          <Button asChild variant="secondary">
            <Link href="/admin/users">Back to All Users</Link>
          </Button>
        }
      />

      <UserEditForm user={user} />
    </div>
  );
}
