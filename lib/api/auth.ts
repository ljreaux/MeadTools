import { RecipeApiResponse } from "@/hooks/useRecipeQuery";

export type AuthUser = {
  id: string | number;
  email: string;
  role: string;
  public_username?: string | null;
};

export type AccountUser = {
  id: number;
  google_id: string | null;
  hydro_token: string | null;
  public_username: string | null;
  email: string;
  role?: string | null;
};

export type AccountInfo = {
  user: AccountUser;
  recipes: RecipeApiResponse[];
};

// 🔹 Lightweight user for `useAuth`
export async function fetchAccountInfo(
  token: string | null,
  nextAuthAccessToken?: string | null
): Promise<AuthUser | null> {
  if (!token && !nextAuthAccessToken) return null;

  const res = await fetch("/api/auth/account-info", {
    headers: {
      Authorization: `Bearer ${nextAuthAccessToken || token}`
    }
  });

  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error("Failed to fetch user data");
  }

  const data = await res.json();

  return {
    id: data.user.id,
    email: data.user.email,
    role: data.user.role || "user",
    public_username: data.user.public_username ?? null
  };
}

// 🔹 Full account info (user + recipes) for account page
export async function fetchFullAccountInfo(
  token: string | null,
  nextAuthAccessToken?: string | null
): Promise<AccountInfo> {
  if (!token && !nextAuthAccessToken) {
    throw new Error("No auth token available");
  }

  const res = await fetch("/api/auth/account-info", {
    headers: {
      Authorization: `Bearer ${nextAuthAccessToken || token}`
    }
  });

  if (!res.ok) {
    throw new Error("Failed to fetch account info");
  }

  return res.json() as Promise<AccountInfo>;
}
