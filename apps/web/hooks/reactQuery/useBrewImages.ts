"use client";
import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/auth/useAuth";
import { useAuthToken } from "@/hooks/auth/useAuthToken";
import { BrewImageError } from "@meadtools/brew-domain/images";
import {
  brewImagesResponseSchema,
  brewImageErrorResponseSchema,
} from "@meadtools/api-contract/brew-images";

export function useBrewImagesOverview(brewId: string, publicView = false) {
  const token = useAuthToken();
  const { user } = useAuth();
  const request = useCallback(
    async (path: string, init?: RequestInit): Promise<unknown> => {
      const response = await fetch(path, {
        ...init,
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(token && !publicView ? { Authorization: `Bearer ${token}` } : {}),
          ...init?.headers,
        },
      });
      const body = await response.json();
      if (!response.ok) {
        const error = brewImageErrorResponseSchema.safeParse(body);
        throw new BrewImageError(
          error.success ? error.data.code : "UPLOAD_FAILED",
        );
      }
      return body;
    },
    [token, publicView],
  );
  const overview = useQuery({
    queryKey: ["brew-images", brewId, publicView ? "public" : user?.id],
    queryFn: async () =>
      brewImagesResponseSchema.parse(
        await request(
          `/api/brews/${brewId}/images${publicView ? "?public=true" : ""}`,
        ),
      ),
    enabled: publicView || Boolean(user),
    gcTime: 0,
    retry: 1,
  });
  return { overview, request, token };
}
