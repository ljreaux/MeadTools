"use client";
import Loading from "@/components/loading";
import { PaginatedTable } from "@/components/PaginatedTable";
import { useAdminFetchData } from "@/hooks/useAdminFetchData";
import { useRouter } from "next/navigation";

export type User = {
  id: number;
  email: string;
  google_id?: string;
  hydro_token: string;
  public_username?: string;
  role: "user" | "admin";
};

function UserDashboard() {
  const router = useRouter();
  const {
    data: users,
    loading,
    error,
  } = useAdminFetchData<User[]>("/api/users");

  if (loading) return <Loading />;
  if (error) return <div>An error has occurred.</div>;

  if (!users) return null;
  return (
    <div>
      <h1 className="text-2xl">Users</h1>

      <PaginatedTable
        data={users
          .sort((a, b) => a.email.localeCompare(b.email))
          .sort((a, b) => a.role.localeCompare(b.role))}
        columns={[
          { key: "public_username", header: "Username" },
          { key: "email", header: "Email" },
          { key: "hydro_token", header: "Hydrometer Token" },
          { key: "role", header: "Role" },
        ]}
        pageSize={10}
        onRowClick={(user) => router.push(`/admin/users/${user.id}`)}
        searchKey={["email", "public_username", "role"]}
      />
    </div>
  );
}

export default UserDashboard;
