"use client";

import { useToast } from "@/hooks/use-toast";
import { SessionProvider, useSession, signIn, signOut } from "next-auth/react";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface AuthContextType {
  user: { id: string; email: string; role: string } | null;
  loading: boolean;
  loginWithGoogle: () => void;
  loginWithCredentials: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchAuthenticatedData: (endpoint: string, method?: string) => Promise<any>;
  fetchAuthenticatedPost: (endpoint: string, body: any) => Promise<any>;
  fetchAuthenticatedPatch: (endpoint: string, body: any) => Promise<any>;
  isLoggedIn: boolean;
  updatePublicUsername: (username: string) => void;
  deleteRecipe: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { data: session, status } = useSession();
  const [user, setUser] = useState<AuthContextType["user"]>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInternalUser = async () => {
      try {
        const storedToken = localStorage.getItem("accessToken");
        if (!storedToken && status !== "authenticated") {
          setUser(null);
          setLoading(false);
          return;
        }

        // Fetch user data using token or Google session
        const res = await fetch("/api/auth/account-info", {
          headers: {
            Authorization: `Bearer ${session?.accessToken || storedToken}`,
          },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch user data");
        }

        const data = await res.json();

        setUser({
          id: data.user.id,
          email: data.user.email,
          role: data.user.role || "user",
        });
        setToken(storedToken); // Maintain token for custom users
      } catch (error) {
        console.error("Error fetching internal user on init:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchInternalUser();
  }, [session, status]);

  const loginWithCredentials = async (email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          errorData.error || t("auth.login.error.description", "Invalid login.")
        );
      }

      const { accessToken, role, id } = await res.json();
      setToken(accessToken);
      localStorage.setItem("accessToken", accessToken);
      setUser({ id, email, role });

      toast({
        title: t("auth.login.success.title", "Login Successful!"),
        description: t(
          "auth.login.success.description",
          `Welcome back, ${email}!`
        ),
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: t("auth.login.error.title", "Login Failed"),
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const register = async (
    email: string,
    password: string,
    public_username?: string
  ) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, public_username }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          errorData.error || t("auth.registration.error.description", "Error!")
        );
      }

      const { accessToken, role, id } = await res.json();
      setToken(accessToken);
      localStorage.setItem("accessToken", accessToken);
      setUser({ id, email, role });

      toast({
        title: t("auth.registration.success.title", "Registration Successful!"),
        description: t(
          "auth.registration.success.description",
          "You can now access your account."
        ),
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: t("auth.registration.error.title", "Registration Failed"),
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const logout = async () => {
    await signOut({ redirect: false }); // For Google sessions
    setUser(null);
    setToken(null);
    localStorage.removeItem("accessToken");

    toast({
      title: t("auth.logout.success.title", "Logged out successfully."),
      description: t("auth.logout.success.description", "See you next time!"),
      variant: "default",
    });
  };

  const updatePublicUsername = async (username: string) => {
    if (!user) {
      toast({
        title: t("auth.username.error.title", "Update Failed"),
        description: t(
          "auth.username.error.description",
          "You must be logged in to update your username."
        ),
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch("/api/auth/create-username", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || session?.user?.id}`,
        },
        body: JSON.stringify({ public_username: username }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          errorData.error ||
            t(
              "auth.username.error.description",
              "An error occurred while updating your username."
            )
        );
      }

      const data = await res.json();

      // Update local user data with the new username
      setUser((prevUser) =>
        prevUser ? { ...prevUser, public_username: data.public_username } : null
      );

      toast({
        title: t("auth.username.success.title", "Username Updated!"),
        description: t(
          "auth.username.success.description",
          "Your public username has been successfully updated."
        ),
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: t("auth.username.error.title", "Update Failed"),
        description: error.message,
        variant: "destructive",
      });
    }
  };
  const deleteRecipe = async (recipeId: string): Promise<void> => {
    if (!user) {
      toast({
        title: t("auth.delete.error.title", "Delete Failed"),
        description: t(
          "auth.delete.error.description",
          "You must be logged in to delete a recipe."
        ),
        variant: "destructive",
      });
      throw new Error("User not authenticated"); // Re-throw the error
    }

    try {
      const res = await fetch(`/api/recipes/${recipeId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token || session?.user?.id}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          errorData.error ||
            t("auth.delete.error.description", "Failed to delete recipe.")
        );
      }

      const data = await res.json();

      toast({
        title: t("auth.delete.success.title", "Recipe Deleted"),
        description: t(
          "auth.delete.success.description",
          `${data.message || "Recipe has been successfully deleted."}`
        ),
        variant: "default",
      });
    } catch (error: any) {
      // Show toast for error but re-throw it for the calling function to handle
      toast({
        title: t("auth.delete.error.title", "Delete Failed"),
        description: error.message,
        variant: "destructive",
      });
      throw error; // Re-throw the error
    }
  };

  const fetchAuthenticatedPatch = async (endpoint: string, body: any) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || session?.accessToken}`,
    };
    const res = await fetch(endpoint, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch data");
    }
    return res.json();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithGoogle: () => signIn("google"),
        loginWithCredentials,
        register,
        logout,
        fetchAuthenticatedData: async (endpoint: string, method?: string) => {
          const headers: Record<string, string> = {
            Authorization: `Bearer ${token || session?.accessToken}`,
          };
          const res = await fetch(endpoint, {
            method: method ? method : "GET",
            headers,
          });
          if (!res.ok) {
            throw new Error("Failed to fetch data");
          }
          return res.json();
        },
        fetchAuthenticatedPost: async (endpoint: string, body: any) => {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token || session?.accessToken}`,
          };
          const res = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            throw new Error("Failed to fetch data");
          }
          return res.json();
        },
        isLoggedIn: !!user,
        updatePublicUsername,
        deleteRecipe,
        fetchAuthenticatedPatch,
      }}
    >
      <SessionProvider>{children}</SessionProvider>
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
