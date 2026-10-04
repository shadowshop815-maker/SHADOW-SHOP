import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, token } from "../../api";

type User = { id: string; name: string; email: string; role: string };
type Auth = { user: User | null; loading: boolean; login: (email: string, password: string) => Promise<void>; logout: () => void };

const AuthContext = createContext<Auth | null>(null);
export const useAuth = () => useContext(AuthContext)!;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(token()));
  const client = useQueryClient();

  useEffect(() => {
    if (!token()) {
      setLoading(false);
      return;
    }
    api<User>("/auth/me")
      .then(value => value.role === "ADMIN" ? setUser(value) : localStorage.removeItem("shadow_admin_token"))
      .catch(() => localStorage.removeItem("shadow_admin_token"))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const result = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    if (result.user.role !== "ADMIN") throw new Error("This portal is for administrators only.");
    localStorage.setItem("shadow_admin_token", result.token);
    setUser(result.user);
  };

  const logout = () => {
    localStorage.removeItem("shadow_admin_token");
    setUser(null);
    client.clear();
  };

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}
