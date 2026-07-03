"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";
import type { AdminBrewsPage, AdminSummary } from "@/lib/db/admin";
import { qk } from "@/lib/db/queryKeys";
import type { BrewViewDetail } from "@/types/brewView";

export function useAdminSummary() {
  const fetchWithAuth = useFetchWithAuth();

  return useQuery<AdminSummary>({
    queryKey: qk.adminSummary,
    queryFn: () => fetchWithAuth<AdminSummary>("/api/admin/summary"),
    staleTime: 60 * 1000
  });
}

export function useAdminBrews({
  page,
  limit,
  query,
  stage,
  status
}: {
  page: number;
  limit: number;
  query?: string;
  stage?: string;
  status?: string;
}) {
  const fetchWithAuth = useFetchWithAuth();
  const searchParams = new URLSearchParams({
    page: String(page),
    limit: String(limit)
  });

  if (query) searchParams.set("query", query);
  if (stage) searchParams.set("stage", stage);
  if (status) searchParams.set("status", status);

  return useQuery<AdminBrewsPage>({
    queryKey: qk.adminBrews.list(
      page,
      limit,
      query ?? "",
      stage ?? "",
      status ?? ""
    ),
    queryFn: () =>
      fetchWithAuth<AdminBrewsPage>(
        `/api/admin/brews?${searchParams.toString()}`
      ),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000
  });
}

export function useAdminBrew(brewId?: string) {
  const fetchWithAuth = useFetchWithAuth();

  return useQuery<BrewViewDetail>({
    queryKey: qk.adminBrews.detail(brewId ?? ""),
    enabled: Boolean(brewId),
    queryFn: () => fetchWithAuth<BrewViewDetail>(`/api/admin/brews/${brewId}`),
    staleTime: 60 * 1000
  });
}
