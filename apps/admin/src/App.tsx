import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./features/auth/AuthContext";
import { ConfirmProvider } from "./features/confirm/ConfirmContext";
import { AdminShell } from "./components/layout/AdminShell";
import { Loading } from "./components/ui";

// Pages
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Products } from "./pages/catalog/Products";
import { Categories } from "./pages/catalog/Categories";
import { Inventory } from "./pages/catalog/Inventory";
import { Orders } from "./pages/sales/Orders";
import { Cancellations } from "./pages/sales/Cancellations";
import { Returns } from "./pages/sales/Returns";
import { Refunds } from "./pages/sales/Refunds";
import { Customers } from "./pages/Customers";
import { Updates } from "./pages/content/Updates";
import { MediaPage } from "./pages/content/MediaPage";
import { Newsletter } from "./pages/content/Newsletter";
import { Enquiries } from "./pages/communication/Enquiries";
import { SettingsPage } from "./pages/system/SettingsPage";
import { SecurityPage } from "./pages/system/SecurityPage";
import { AuditLog } from "./pages/system/AuditLog";
import { Offers } from "./pages/marketing/Offers";

import { TaxPage } from "./pages/system/TaxPage";
import EmailLogs from "./pages/system/EmailLogs";

function Guarded() {
  const auth = useAuth();
  
  if (auth.loading) return <Loading />;
  if (!auth.user) return <Navigate to="/login" replace />;
  
  return (
    <AdminShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/products" element={<Products />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/cancellations" element={<Cancellations />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/refunds" element={<Refunds />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/updates" element={<Updates />} />
        <Route path="/media" element={<MediaPage />} />
        <Route path="/newsletter" element={<Newsletter />} />
        <Route path="/offers" element={<Offers />} />
        <Route path="/enquiries" element={<Enquiries />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/delivery" element={<Navigate to="/settings" replace state={{ tab: 'delivery' }} />} />
        <Route path="/tax" element={<TaxPage />} />
        <Route path="/email-logs" element={<EmailLogs />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/audit" element={<AuditLog />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AdminShell>
  );
}

export default function App() {
  return (
    <ConfirmProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Guarded />} />
        </Routes>
      </AuthProvider>
    </ConfirmProvider>
  );
}
