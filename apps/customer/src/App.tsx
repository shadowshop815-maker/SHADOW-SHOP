import { Routes, Route, Link } from "react-router-dom";
import { AuthProvider } from "./features/auth/AuthContext";
import { Guard } from "./features/auth/Guard";
import { Shell } from "./components/layout/Shell";
import { SettingsProvider, useSettings } from "./context/SettingsContext";
import { MapModal } from "./components/location/MapModal";

import { Home } from "./pages/Home";
import { Products } from "./pages/Products";
import { ProductDetail } from "./pages/ProductDetail";
import { CartPage } from "./pages/CartPage";
import { Checkout } from "./pages/Checkout";
import { Confirmation } from "./pages/checkout/Confirmation";

import { AuthPage } from "./pages/auth/AuthPage";
import { OtpPage } from "./pages/auth/OtpPage";

import { Account } from "./pages/account/Account";
import { OrderDetail } from "./pages/account/OrderDetail";

import { Updates } from "./pages/content/Updates";
import { Contact } from "./pages/content/Contact";
import { SearchPage } from "./pages/SearchPage";
import { Policies } from "./pages/content/Policies";

export default function App() {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}

function AppContent() {
  const { isMapModalOpen, closeMapModal } = useSettings();
  
  return (
    <AuthProvider>
      <MapModal isOpen={isMapModalOpen} onClose={closeMapModal} />
      <Shell>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:slug" element={<ProductDetail />} />
          <Route path="/cart" element={<Guard><CartPage /></Guard>} />
          <Route path="/checkout" element={<Guard><Checkout /></Guard>} />
          
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
          <Route path="/verify" element={<OtpPage />} />
          <Route path="/reset-password" element={<OtpPage reset />} />
          
          <Route path="/account" element={<Guard><Account /></Guard>} />
          <Route path="/account/orders/:id" element={<Guard><OrderDetail /></Guard>} />
          
          <Route path="/order-confirmation/:number" element={<Confirmation />} />
          
          <Route path="/updates" element={<Updates />} />
          <Route path="/media" element={<Updates media />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/policies" element={<Policies />} />
          
          <Route path="*" element={
            <section className="state page">
              <h1>404</h1>
              <p>This page stepped into the shadows.</p>
              <Link className="button" to="/">Return home</Link>
            </section>
          } />
        </Routes>
      </Shell>
    </AuthProvider>
  );
}
