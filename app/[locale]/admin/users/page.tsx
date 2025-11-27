"use client";

import { useRouter } from "next/navigation";
import Loading from "@/components/loading";
import { PaginatedTable } from "@/components/PaginatedTable";
import { useAdminUsersQuery } from "@/hooks/reactQuery/useAdminUsersQuery";

function UserDashboard() {
  const router = useRouter();
  const { data: users, isLoading, isError, error } = useAdminUsersQuery();

  if (isLoading) return <Loading />;

  if (isError) {
    const msg = (error as Error)?.message ?? "An error has occurred.";
    return <div>{msg}</div>;
  }

  if (!users) return null;

  const sorted = [...users]
    .sort((a, b) => a.email.localeCompare(b.email))
    .sort((a, b) => a.role.localeCompare(b.role));

  return (
    <div>
      <h1 className="text-2xl">Users</h1>

      <PaginatedTable
        data={sorted}
        columns={[
          { key: "public_username", header: "Username" },
          { key: "email", header: "Email" },
          { key: "hydro_token", header: "Hydrometer Token" },
          { key: "role", header: "Role" }
        ]}
        pageSize={10}
        onRowClick={(user) => router.push(`/admin/users/${user.id}`)}
        searchKey={["email", "public_username", "role"]}
      />
    </div>
  );
}

export default UserDashboard;
