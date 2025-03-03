"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "../providers/AuthProvider";

export interface ISpindelContext {
  deviceList: any[];
  logs: any[];
  setLogs: (logs: any[]) => void;
  getNewHydrometerToken: () => Promise<void>;
  fetchLogs: (
    startDate: string,
    endDate: string,
    deviceId: string
  ) => Promise<any[]>;
  hydrometerToken: string | undefined;
  loading: boolean;
  startBrew: (id: string, brewName: string | null) => Promise<void>;
  endBrew: (deviceId: string, brewId: string | null) => Promise<void>;
  updateCoeff: (deviceId: string, coefficients: number[]) => Promise<void>;
  brews: any[];
  deleteDevice: (deviceId: string) => Promise<void>;
  deleteBrew: (brewId: string) => Promise<void>;
  deleteLog: (logId: string, deviceId: string) => Promise<void>;
  updateLog: (log: any) => Promise<any>;
  tokenLoading: boolean;
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
  updateBrewName: (id: string, brew_name: string | null) => Promise<any[]>;
  recipes: any[];
  linkBrew: (recipeId: string, brewId: string) => Promise<void>;
  getBrewLogs: (brewsId: string) => Promise<any[]>;
}

const HydroContext = createContext<ISpindelContext | null>(null);

export const ISpindelProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const {
    fetchAuthenticatedData,
    fetchAuthenticatedPost,
    fetchAuthenticatedPatch,
    user,
  } = useAuth();
  const [loading, setLoading] = useState(false);
  const [deviceList, setDeviceList] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [hydrometerToken, setHydrometerToken] = useState<string | undefined>(
    undefined
  );
  const [brews, setBrews] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);

  const [tokenLoading, setTokenLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const response = await fetchAuthenticatedData("/api/hydrometer");
        const { hydro_token, devices } = response;
        setDeviceList(devices || []);
        if (hydro_token) {
          setHydrometerToken(hydro_token);
        }
      } catch (error) {
        console.error("Error fetching device list:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        fetchAuthenticatedData("/api/auth/account-info")
          .then((data) => {
            setRecipes(data.recipes);
          })
          .catch((error) => console.error(error));
      } catch (error) {
        console.error("Error fetching device list:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // Fetch all brews
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const brews = await fetchAuthenticatedData("/api/hydrometer/brew");
        setBrews(brews || []);
      } catch (error) {
        console.error("Error fetching brews:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const getNewHydrometerToken = async () => {
    try {
      setTokenLoading(true);
      const { token } = await fetchAuthenticatedPost(
        "/api/hydrometer/register",
        {}
      );
      setHydrometerToken(token || null);
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
    try {
      const data = await fetchAuthenticatedData(
        `/api/hydrometer/logs?start_date=${startDate}&end_date=${endDate}&device_id=${deviceId}`
      );
      return data;
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
  };

  const startBrew = async (id: string, brewName: string | null = null) => {
    try {
      const [brew, device] = await fetchAuthenticatedPost(
        "/api/hydrometer/brew",
        {
          device_id: id,
          brew_name: brewName,
        }
      );
      setBrews([...brews, brew]);
      setDeviceList((prev) =>
        prev.map((dev) => (dev.id === id ? device : dev))
      );
    } catch (error) {
      console.error("Error starting brew:", error);
    }
  };

  const endBrew = async (deviceId: string, brewId: string | null) => {
    try {
      const [, device] = await fetchAuthenticatedPatch("/api/hydrometer/brew", {
        device_id: deviceId,
        brew_id: brewId,
      });

      setDeviceList((prev) =>
        prev.map((dev) => (dev.id === deviceId ? device : dev))
      );
    } catch (error) {
      console.error("Error ending brew:", error);
    }
  };

  const updateCoeff = async (deviceId: string, coefficients: number[]) => {
    try {
      const device = await fetchAuthenticatedPatch(
        `/api/hydrometer/device/${deviceId}`,
        { coefficients }
      );
      setDeviceList((prev) =>
        prev.map((dev) => (dev.id === deviceId ? device : dev))
      );
    } catch (error) {
      console.error("Error updating coefficients:", error);
    }
  };

  const deleteDevice = async (deviceId: string) => {
    try {
      await fetchAuthenticatedData(
        `/api/hydrometer/device/${deviceId}`,
        "DELETE"
      );
      setDeviceList((prev) => prev.filter((dev) => dev.id !== deviceId));
    } catch (error) {
      console.error("Error deleting device:", error);
    }
  };

  const deleteBrew = async (brewId: string) => {
    try {
      await fetchAuthenticatedData(`/api/hydrometer/brew/${brewId}`, "DELETE");
      setBrews((prev) => prev.filter((brew) => brew.id !== brewId));
    } catch (error) {
      console.error("Error deleting brew:", error);
    }
  };

  const deleteLog = async (logId: string, deviceId: string) => {
    try {
      await fetchAuthenticatedData(
        `/api/hydrometer/logs/${logId}?device_id=${deviceId}`,
        "DELETE"
      );
    } catch (error) {
      console.error("Error deleting log:", error);
      throw error;
    }
  };

  const updateLog = async (log: any) => {
    try {
      return await fetchAuthenticatedPatch(
        `/api/hydrometer/logs/${log.id}?device_id=${log.device_id}`,
        log
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
    if (!deviceId) return "Failed to delete";

    try {
      const response = await fetchAuthenticatedData(
        `/api/hydrometer/logs/range?start_date=${start_date.toISOString()}&end_date=${end_date.toISOString()}&device_id=${deviceId}`,
        "DELETE"
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
    if (!device_id) return [];

    try {
      const response = await fetchAuthenticatedData(
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
    try {
      const response = await fetchAuthenticatedPatch("/api/hydrometer/brew", {
        brew_id: id,
        brew_name,
      });
      // Optionally update the local state if needed
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
    try {
      await fetchAuthenticatedPatch(`/api/hydrometer/brew/${brew_id}`, {
        recipe_id,
      });
    } catch (error) {
      console.error("Failed to link brew to recipe:", error);
    }
  };

  const getBrewLogs = async (brews_id: string) => {
    try {
      const response = await fetchAuthenticatedData(
        `/api/hydrometer/logs/${brews_id}`
      );
      return response || [];
    } catch (error) {
      console.error("Failed to get brew logs:", error);
    }
  };

  const context = {
    deviceList,
    logs,
    setLogs,
    fetchLogs,
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
  };

  return (
    <HydroContext.Provider value={context}>{children}</HydroContext.Provider>
  );
};

export const useISpindel = () => {
  const context = useContext(HydroContext);
  if (!context) {
    throw new Error("useISpindel must be used within a ContextProvider");
  }
  return context;
};
