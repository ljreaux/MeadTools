"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuthToken } from "@/hooks/auth/useAuthToken";
import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";
import { useAccountInfo } from "@/hooks/reactQuery/useAccountInfo";

interface ISpindelContext {
  deviceList: any[];
  logs: any[];
  setLogs: (logs: any[]) => void;

  hydrometerToken: string | undefined;
  loading: boolean;
  tokenLoading: boolean;

  getNewHydrometerToken: () => Promise<void>;
  fetchLogs: (
    startDate: string,
    endDate: string,
    deviceId: string
  ) => Promise<any[] | undefined>;
  fetchBrews: () => Promise<void>;

  startBrew: (id: string, brewName: string | null) => Promise<void>;
  endBrew: (deviceId: string, brewId: string | null) => Promise<void>;
  updateCoeff: (deviceId: string, coefficients: number[]) => Promise<void>;

  brews: any[];
  recipes: any[];

  deleteDevice: (deviceId: string) => Promise<void>;
  deleteBrew: (brewId: string) => Promise<void>;
  deleteLog: (logId: string, deviceId: string) => Promise<void>;
  deleteLogsInRange: (
    start_date: Date,
    end_date: Date,
    deviceId: string
  ) => Promise<string>;

  getLogs: (
    start_date: string,
    end_date: string,
    device_id: string
  ) => Promise<any[]>;

  updateLog: (log: any) => Promise<any>;
  updateBrewName: (id: string, brew_name: string | null) => Promise<any[]>;

  linkBrew: (recipeId: string, brewId: string) => Promise<void>;
  getBrewLogs: (brewsId: string) => Promise<any[] | undefined>;
  updateEmailAlerts: (brewId: string, requested: boolean) => Promise<any>;
}

const HydroContext = createContext<ISpindelContext | null>(null);

export const ISpindelProvider = ({
  children
}: {
  children: React.ReactNode;
}) => {
  const token = useAuthToken();
  const fetchWithAuth = useFetchWithAuth();
  const { data: accountInfo } = useAccountInfo();

  const [loading, setLoading] = useState(false);
  const [deviceList, setDeviceList] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [hydrometerToken, setHydrometerToken] = useState<string | undefined>(
    undefined
  );
  const [brews, setBrews] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [tokenLoading, setTokenLoading] = useState(false);

  // Sync recipes from React Query accountInfo instead of fetching manually
  useEffect(() => {
    if (accountInfo?.recipes) {
      setRecipes(accountInfo.recipes);
    } else {
      setRecipes([]);
    }
  }, [accountInfo?.recipes]);

  // Fetch devices + hydrometer token when we have a token
  useEffect(() => {
    if (!token) {
      // Logged out: clear state
      setDeviceList([]);
      setHydrometerToken(undefined);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const response = await fetchWithAuth<{
          hydro_token?: string;
          devices?: any[];
        }>("/api/hydrometer");

        if (cancelled) return;

        const { hydro_token, devices } = response || {};
        setDeviceList(devices || []);
        if (hydro_token) {
          setHydrometerToken(hydro_token);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error fetching device list:", error);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, fetchWithAuth]);

  const fetchBrews = async () => {
    if (!token) {
      setBrews([]);
      return;
    }

    try {
      setLoading(true);
      const brews = await fetchWithAuth<any[]>("/api/hydrometer/brew");
      setBrews(brews || []);
    } catch (error) {
      console.error("Error fetching brews:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all brews when token available
  useEffect(() => {
    if (!token) {
      setBrews([]);
      return;
    }
    fetchBrews();
  }, [token]);

  const getNewHydrometerToken = async () => {
    if (!token) return;

    try {
      setTokenLoading(true);
      const { token: newToken } = await fetchWithAuth<{ token?: string }>(
        "/api/hydrometer/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({})
        }
      );
      setHydrometerToken(newToken);
    } catch (error) {
      console.error("Error generating hydrometer token:", error);
    } finally {
      setTokenLoading(false);
    }
  };

  const fetchLogs = async (
    startDate: string,
    endDate: string,
    deviceId: string
  ) => {
    if (!token) return [];

    try {
      const data = await fetchWithAuth<any[]>(
        `/api/hydrometer/logs?start_date=${startDate}&end_date=${endDate}&device_id=${deviceId}`
      );
      return data;
    } catch (error) {
      console.error("Error fetching logs:", error);
      return [];
    }
  };

  const startBrew = async (id: string, brewName: string | null = null) => {
    if (!token) return;

    try {
      const [brew, device] = await fetchWithAuth<[any, any]>(
        "/api/hydrometer/brew",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_id: id,
            brew_name: brewName
          })
        }
      );

      setBrews((prev) => [...prev, brew]);
      setDeviceList((prev) =>
        prev.map((dev) => (dev.id === id ? device : dev))
      );
    } catch (error) {
      console.error("Error starting brew:", error);
    }
  };

  const endBrew = async (deviceId: string, brewId: string | null) => {
    if (!token) return;

    try {
      const [, device] = await fetchWithAuth<[any, any]>(
        "/api/hydrometer/brew",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_id: deviceId,
            brew_id: brewId
          })
        }
      );

      setDeviceList((prev) =>
        prev.map((dev) => (dev.id === deviceId ? device : dev))
      );
    } catch (error) {
      console.error("Error ending brew:", error);
    }
  };

  const updateCoeff = async (deviceId: string, coefficients: number[]) => {
    if (!token) return;

    try {
      const device = await fetchWithAuth<any>(
        `/api/hydrometer/device/${deviceId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coefficients })
        }
      );
      setDeviceList((prev) =>
        prev.map((dev) => (dev.id === deviceId ? device : dev))
      );
    } catch (error) {
      console.error("Error updating coefficients:", error);
    }
  };

  const deleteDevice = async (deviceId: string) => {
    if (!token) return;

    try {
      await fetchWithAuth(`/api/hydrometer/device/${deviceId}`, {
        method: "DELETE"
      });
      setDeviceList((prev) => prev.filter((dev) => dev.id !== deviceId));
    } catch (error) {
      console.error("Error deleting device:", error);
    }
  };

  const deleteBrew = async (brewId: string) => {
    if (!token) return;

    try {
      await fetchWithAuth(`/api/hydrometer/brew/${brewId}`, {
        method: "DELETE"
      });
      setBrews((prev) => prev.filter((brew) => brew.id !== brewId));
    } catch (error) {
      console.error("Error deleting brew:", error);
    }
  };

  const deleteLog = async (logId: string, deviceId: string) => {
    if (!token) return;

    try {
      await fetchWithAuth(
        `/api/hydrometer/logs/${logId}?device_id=${deviceId}`,
        { method: "DELETE" }
      );
    } catch (error) {
      console.error("Error deleting log:", error);
      throw error;
    }
  };

  const updateLog = async (log: any) => {
    if (!token) throw new Error("Not authenticated");

    try {
      return await fetchWithAuth(
        `/api/hydrometer/logs/${log.id}?device_id=${log.device_id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(log)
        }
      );
    } catch (error) {
      console.error("Error updating log:", error);
      throw error;
    }
  };

  const deleteLogsInRange = async (
    start_date: Date,
    end_date: Date,
    deviceId: string
  ): Promise<string> => {
    if (!deviceId || !token) return "Failed to delete";

    try {
      const response = await fetchWithAuth<{ message?: string }>(
        `/api/hydrometer/logs/range?start_date=${start_date.toISOString()}&end_date=${end_date.toISOString()}&device_id=${deviceId}`,
        {
          method: "DELETE"
        }
      );

      if (response?.message === "Logs deleted successfully.") {
        return response.message;
      } else {
        console.error(
          "Failed to delete logs.",
          response?.message || "Unknown error"
        );
        return response?.message || "Failed to delete logs.";
      }
    } catch (error) {
      console.error("Error deleting logs in range:", error);
      return "Failed to delete logs.";
    }
  };

  const getLogs = async (
    start_date: string,
    end_date: string,
    device_id: string
  ): Promise<any[]> => {
    if (!device_id || !token) return [];

    try {
      const response = await fetchWithAuth<any[]>(
        `/api/hydrometer/logs?start_date=${start_date}&end_date=${end_date}&device_id=${device_id}`
      );

      return response || [];
    } catch (error) {
      console.error("Failed to get logs:", error);
      return [];
    }
  };

  const updateBrewName = async (
    id: string,
    brew_name: string | null = null
  ) => {
    if (!token) return [];

    try {
      const response = await fetchWithAuth<any[]>("/api/hydrometer/brew", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brew_id: id,
          brew_name
        })
      });

      setBrews((prev) =>
        prev.map((brew) =>
          brew.id === id ? { ...brew, name: brew_name } : brew
        )
      );
      return response || [];
    } catch (error) {
      console.error("Failed to update brew name:", error);
      return [];
    }
  };

  const linkBrew = async (recipe_id: string, brew_id: string) => {
    if (!token) return;

    try {
      await fetchWithAuth(`/api/hydrometer/brew/${brew_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe_id })
      });
    } catch (error) {
      console.error("Failed to link brew to recipe:", error);
    }
  };

  const updateEmailAlerts = async (
    brew_id: string,
    requested_email_alerts: boolean
  ) => {
    if (!token) return;

    try {
      await fetchWithAuth(`/api/hydrometer/brew/${brew_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brew_id,
          requested_email_alerts
        })
      });
    } catch (error) {
      console.error("Failed to request email updates", error);
    }
  };

  const getBrewLogs = async (brews_id: string) => {
    if (!token) return [];

    try {
      const response = await fetchWithAuth<any[]>(
        `/api/hydrometer/logs/${brews_id}`
      );
      return response || [];
    } catch (error) {
      console.error("Failed to get brew logs:", error);
      return [];
    }
  };

  const context: ISpindelContext = {
    deviceList,
    logs,
    setLogs,
    fetchLogs,
    fetchBrews,
    hydrometerToken,
    getNewHydrometerToken,
    loading,
    startBrew,
    endBrew,
    updateCoeff,
    brews,
    deleteDevice,
    deleteBrew,
    tokenLoading,
    deleteLog,
    updateLog,
    deleteLogsInRange,
    getLogs,
    updateBrewName,
    recipes,
    linkBrew,
    getBrewLogs,
    updateEmailAlerts
  };

  return (
    <HydroContext.Provider value={context}>{children}</HydroContext.Provider>
  );
};

export const useISpindel = () => {
  const context = useContext(HydroContext);
  if (!context) {
    throw new Error("useISpindel must be used within an ISpindelProvider");
  }
  return context;
};
