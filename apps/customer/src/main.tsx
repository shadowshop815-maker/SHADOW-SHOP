import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 5-minute stale time — products/settings don't change every 30s
      staleTime: 5 * 60_000,
      // Keep unused data in cache for 10 minutes
      gcTime: 10 * 60_000,
      // Retry once with exponential backoff (handles Render cold starts gracefully)
      retry: 1,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    }
  }
});

// Preload catalog snapshot for instantly fast first paints (home page featured products)
fetch("/catalog-snapshot.json")
  .then((res) => res.json())
  .then((payload) => {
    if (payload?.success && payload?.data) {
      queryClient.setQueryData(["products", "home"], payload.data);
    }
  })
  .catch(() => {});

// Preload settings snapshot
fetch("/settings-snapshot.json")
  .then((res) => res.json())
  .then((payload) => {
    if (payload?.success && payload?.data) {
      queryClient.setQueryData(["settings"], payload.data);
    }
  })
  .catch(() => {});

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><ErrorBoundary><QueryClientProvider client={queryClient}><BrowserRouter><App /></BrowserRouter></QueryClientProvider></ErrorBoundary></React.StrictMode>);
