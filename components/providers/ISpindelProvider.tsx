"use client";

import React, { createContext, useContext, useState } from "react";
import { useAuthToken } from "@/hooks/auth/useAuthToken";
import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";

const HydroContext = createContext<any>(null);

export const ISpindelProvider = ({
  children
}: {
  children: React.ReactNode;
}) => {
  const token = useAuthToken();
  const fetchWithAuth = useFetchWithAuth();

  const [logs, setLogs] = useState<any[]>([]);

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

  const context = {
    logs,
    setLogs,
    fetchLogs,
    deleteLog,
    updateLog,
    deleteLogsInRange,
    getLogs,
    getBrewLogs
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
