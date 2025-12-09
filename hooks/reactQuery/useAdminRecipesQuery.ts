"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { qk } from "@/lib/db/queryKeys";
import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";
import { RecipeApiResponse } from "./useRecipeQuery";

type AdminRecipesPage = {
  recipes: RecipeApiResponse[];
  totalCount: number;
  totalPages: number;
  page: number;
  limit: number;
};

type UseAdminRecipesArgs = {
  page: number;
  limit: number;
  search?: string;
};

export function useAdminRecipesQuery({
  page,
  limit,
  search
}: UseAdminRecipesArgs) {
  const fetchWithAuth = useFetchWithAuth();

  return useQuery<AdminRecipesPage>({
    queryKey: qk.adminRecipes(page, limit, search ?? ""),
    queryFn: () =>
      fetchWithAuth<AdminRecipesPage>(
        `/api/recipes?page=${page}&limit=${limit}${
          search ? `&query=${encodeURIComponent(search)}` : ""
        }`
      ),
    // v5 replacement for keepPreviousData: true
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000
  });
}
