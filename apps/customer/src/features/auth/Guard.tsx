import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { Spinner } from "../../components/ui";

export function Guard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.loading) return <Spinner />;
  if (!auth.user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}
