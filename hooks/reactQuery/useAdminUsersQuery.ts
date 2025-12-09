"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/db/queryKeys";
import { useFetchWithAuth } from "../auth/useFetchWithAuth";

export type User = {
  id: number;
  email: string;
  google_id?: string;
  hydro_token: string;
  public_username?: string;
  role: "user" | "admin";
  active: boolean;
};

export function useAdminUsersQuery() {
  const fetchWithAuth = useFetchWithAuth();

  return useQuery<User[]>({
    queryKey: qk.adminUsers,
    queryFn: async () => {
      return await fetchWithAuth<User[]>("/api/users");
    },

    staleTime: 5 * 60 * 1000
  });
}

export function useAdminUserById(id?: number | string) {
  const query = useAdminUsersQuery();

  const user =
    id && query.data
      ? (query.data.find((u) => u.id === Number(id)) ?? null)
      : null;

  return {
    ...query,
    user
  };
}
