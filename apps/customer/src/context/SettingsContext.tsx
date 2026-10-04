import React, { createContext, useContext, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { StoreData } from "../types";

type SettingsContextType = {
  settings: StoreData | undefined;
  isLoading: boolean;
  isMapModalOpen: boolean;
  openMapModal: () => void;
  closeMapModal: () => void;
};

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { data: settings, isLoading } = useQuery({ 
    queryKey: ["settings"], 
    queryFn: () => api<StoreData>("/settings") 
  });
  
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  return (
    <SettingsContext.Provider value={{
      settings,
      isLoading,
      isMapModalOpen,
      openMapModal: () => setIsMapModalOpen(true),
      closeMapModal: () => setIsMapModalOpen(false)
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
