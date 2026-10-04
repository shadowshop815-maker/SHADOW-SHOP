import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError, getToken } from "../../api";

type User = { id: string; name: string; email: string; phone: string | null; role: string; emailVerified?: boolean };
type AuthValue = { 
  user: User | null; 
  loading: boolean; 
  login: (email: string, password: string) => Promise<void>; 
  logout: () => void; 
  refresh: () => Promise<void> 
};

const AuthContext = createContext<AuthValue | null>(null);
export const useAuth = () => useContext(AuthContext)!;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null); 
  const [loading, setLoading] = useState(Boolean(getToken())); 
  const queryClient = useQueryClient();

  const refresh = async () => { 
    if (!getToken()) { setUser(null); setLoading(false); return; } 
    try { 
      setUser(await api<User>("/auth/me")); 
    } catch { 
      localStorage.removeItem("shadow_token"); 
      setUser(null); 
    } finally { 
      setLoading(false); 
    } 
  };

  useEffect(() => { void refresh(); }, []);

  const login = async (email: string, password: string) => { 
    const result = await api<{ token: string; user: User }>("/auth/login", { 
      method: "POST", 
      body: JSON.stringify({ email, password }) 
    }); 
    if (result.user.role !== "CUSTOMER") throw new ApiError("Use the administrator portal for this account.", "CUSTOMER_LOGIN_REQUIRED"); 
    localStorage.setItem("shadow_token", result.token); 
    setUser(result.user); 
    await queryClient.invalidateQueries(); 
  };

  const logout = () => { 
    localStorage.removeItem("shadow_token"); 
    setUser(null); 
    queryClient.clear(); 
  };

  return <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>{children}</AuthContext.Provider>;
}
