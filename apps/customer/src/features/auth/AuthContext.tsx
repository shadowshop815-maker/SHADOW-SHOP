import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError, getToken } from "../../api";
import type { User } from "../../types";

type AuthValue = { 
  user: User | null; 
  loading: boolean; 
  login: (email: string, password: string) => Promise<void>; 
  logout: () => void; 
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);
export const useAuth = () => useContext(AuthContext)!;

export function AuthProvider({ children }: { children: ReactNode }) {
  // Restore cached user immediately to avoid white screen / spinner on page refresh
  const [user, setUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem("shadow_user");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }); 

  // If we already have a cached user, we don't need to block UI with a full-screen spinner
  const [loading, setLoading] = useState(() => Boolean(getToken()) && !localStorage.getItem("shadow_user")); 
  const queryClient = useQueryClient();

  const refresh = async () => { 
    const token = getToken();
    if (!token) { 
      setUser(null); 
      localStorage.removeItem("shadow_user");
      setLoading(false); 
      return; 
    } 

    try { 
      const freshUser = await api<User>("/auth/me");
      setUser(freshUser); 
      localStorage.setItem("shadow_user", JSON.stringify(freshUser));
    } catch (err: any) { 
      // ONLY log the user out if the server explicitly rejected the token with 401 or 403
      if (err?.status === 401 || err?.status === 403 || err?.code === "UNAUTHORIZED" || err?.code === "TOKEN_EXPIRED") {
        localStorage.removeItem("shadow_token"); 
        localStorage.removeItem("shadow_user");
        setUser(null); 
      }
      // If it was a network error, timeout, or 503 Render cold start, we keep the user session intact
    } finally { 
      setLoading(false); 
    } 
  };

  useEffect(() => { 
    void refresh(); 
  }, []);

  const login = async (email: string, password: string) => { 
    const result = await api<{ token: string; user: User }>("/auth/login", { 
      method: "POST", 
      body: JSON.stringify({ email, password }) 
    }); 
    if (result.user.role !== "CUSTOMER") {
      throw new ApiError("Use the administrator portal for this account.", "CUSTOMER_LOGIN_REQUIRED"); 
    }
    localStorage.setItem("shadow_token", result.token); 
    localStorage.setItem("shadow_user", JSON.stringify(result.user));
    setUser(result.user); 
    await queryClient.invalidateQueries(); 
  };

  const logout = () => { 
    localStorage.removeItem("shadow_token"); 
    localStorage.removeItem("shadow_user");
    setUser(null); 
    queryClient.clear(); 
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
