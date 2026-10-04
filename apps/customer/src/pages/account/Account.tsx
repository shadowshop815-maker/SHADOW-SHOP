import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, MapPin, ShoppingBag } from "lucide-react";
import { api, money } from "../../api";
import type { Order, Address } from "../../types";
import { useAuth } from "../../features/auth/AuthContext";
import { Spinner, Status } from "../../components/ui";
import { blankAddress, AddressFields } from "../../components/location/LocationPicker";
import { Reveal, StaggerContainer, StaggerItem } from "../../components/motion/Motion";

function OrderCard({ order }: { order: Order }) { 
  return (
    <article className="order-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
      <div>
        <span className="eyebrow" style={{ color: "var(--gold)", fontSize: "11px", marginBottom: "4px" }}>
          PLACED {new Date(order.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <h3 style={{ margin: "4px 0 6px 0", fontSize: "18px", color: "var(--text)" }}>
          Order #{order.orderNumber}
        </h3>
        <p style={{ margin: 0, fontSize: "13.5px", color: "var(--muted)" }}>
          {order.items.length} item{order.items.length > 1 ? "s" : ""} · Total: <strong style={{ color: "var(--text)" }}>{money(order.grandTotal)}</strong>
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <span className={`status ${order.orderStatus.toLowerCase()}`}>
          {order.orderStatus.replaceAll("_", " ")}
        </span>
        <Link to={`/account/orders/${order.id}`} className="button ghost" style={{ padding: "10px 18px", fontSize: "13px" }}>
          <span>Order Details</span>
          <ChevronRight size={15} />
        </Link>
      </div>
    </article>
  ); 
}

export function Account() { 
  const auth = useAuth(); 
  const client = useQueryClient(); 
  const [tab, setTab] = useState("orders"); 
  
  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: () => api<Order[]>("/orders")
  }); 
  
  const { data: addresses } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => api<Address[]>("/addresses")
  }); 
  
  const [address, setAddress] = useState<Address>(blankAddress); 
  
  const addressMutation = useMutation({
    mutationFn: () => api<Address>("/addresses", { method: "POST", body: JSON.stringify(address) }),
    onSuccess: () => {
      setAddress(blankAddress);
      client.invalidateQueries({ queryKey: ["addresses"] });
    }
  }); 
  
  const profileMutation = useMutation({
    mutationFn: (body: { name: string; phone: string }) => api("/auth/me", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => auth.refresh()
  }); 
  
  const [name, setName] = useState(auth.user?.name || ""); 
  const [phone, setPhone] = useState(auth.user?.phone || ""); 
  
  return (
    <section className="section page account" style={{ paddingTop: "40px" }}>
      <div className="account-head">
        <div>
          <span className="eyebrow">CUSTOMER ACCOUNT</span>
          <h1>Hello, {auth.user?.name ? auth.user.name.split(" ")[0] : "Customer"}</h1>
          <p>{auth.user?.email}</p>
        </div>
        <button type="button" className="outline-button" onClick={auth.logout}>
          Sign out
        </button>
      </div>
      
      {/* Navigation Tabs */}
      <div className="tabs">
        {["orders", "addresses", "profile"].map(v => (
          <button 
            type="button"
            className={tab === v ? "active" : ""} 
            onClick={() => setTab(v)} 
            key={v}
          >
            {v}
          </button>
        ))}
      </div>
      
      {/* ORDERS TAB */}
      {tab === "orders" && (
        isLoading ? (
          <Spinner/>
        ) : (
          <Status empty={!orders?.length}>
            {orders && orders.length > 0 ? (
              <StaggerContainer className="order-list">
                {orders.map((order, idx) => (
                  <StaggerItem key={order.id} index={idx} baseDelay={60}>
                    <OrderCard order={order} />
                  </StaggerItem>
                ))}
              </StaggerContainer>
            ) : (
              <div style={{ textAlign: "center", padding: "60px 20px", background: "var(--card)", borderRadius: "var(--radius-lg)", border: "1px dashed var(--border)" }}>
                <ShoppingBag size={40} color="var(--gold)" style={{ marginBottom: "16px" }} />
                <h2 style={{ fontSize: "20px", margin: "0 0 8px 0" }}>No orders placed yet</h2>
                <p style={{ color: "var(--muted)", maxWidth: "380px", margin: "0 auto 24px" }}>
                  Your wardrobe archive is currently waiting for its first luxury piece.
                </p>
                <Link to="/products" className="button">
                  Explore Collection
                </Link>
              </div>
            )}
          </Status>
        )
      )}
      
      {/* ADDRESSES TAB */}
      {tab === "addresses" && (
        <div className="account-grid">
          <div>
            <h2 style={{ fontSize: "20px", letterSpacing: "0.04em", marginBottom: "20px" }}>Saved Addresses</h2>
            {addresses && addresses.length > 0 ? (
              addresses.map(a => (
                <article className="address-card" key={a.id}>
                  <b style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "16px", marginBottom: "6px" }}>
                    {a.fullName}
                    {a.isDefault && <span className="badge gold" style={{ position: "static" }}>Default</span>}
                  </b>
                  <p style={{ fontSize: "14px", lineHeight: "1.6", color: "var(--muted)" }}>
                    {a.line1}, {a.town || ""}, {a.city}<br/>
                    {a.state} {a.pinCode}, {a.country}<br/>
                    Phone: {a.phone}
                  </p>
                  {a.latitude != null && (
                    <span className="located" style={{ marginTop: "10px" }}>
                      <MapPin size={15}/> Exact GPS location saved
                    </span>
                  )}
                </article>
              ))
            ) : (
              <p style={{ color: "var(--muted)", fontSize: "14px" }}>No saved addresses yet.</p>
            )}
          </div>

          <form className="panel" onSubmit={e => { e.preventDefault(); addressMutation.mutate(); }}>
            <h2 style={{ fontSize: "20px", letterSpacing: "0.04em", marginBottom: "20px" }}>Add New Address</h2>
            <AddressFields value={address} onChange={setAddress}/>
            <label className="checkbox" style={{ margin: "20px 0", cursor: "pointer", display: "flex", gap: "10px" }}>
              <input type="checkbox" checked={address.isDefault} onChange={e => setAddress({ ...address, isDefault: e.target.checked })}/>
              <span>Set as my primary default address</span>
            </label>
            {addressMutation.error && <p className="error-text">{addressMutation.error.message}</p>}
            <button className="button" disabled={addressMutation.isPending}>Save Address</button>
          </form>
        </div>
      )}
      
      {/* PROFILE TAB */}
      {tab === "profile" && (
        <form className="panel narrow" onSubmit={e => { e.preventDefault(); profileMutation.mutate({ name, phone }); }} style={{ padding: "40px", maxWidth: "600px" }}>
          <h2 style={{ fontSize: "22px", letterSpacing: "0.04em", marginBottom: "24px", borderBottom: "1px solid var(--border)", paddingBottom: "16px" }}>
            Personal Account Details
          </h2>
          <div style={{ display: "grid", gap: "20px", marginBottom: "28px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Full Name
              <input value={name} onChange={e => setName(e.target.value)} required style={{ padding: "14px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--bg)", fontSize: "15px", color: "var(--text)", width: "100%", outline: "none" }}/>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Email Address
              <input value={auth.user?.email} readOnly style={{ padding: "14px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--layer-2)", fontSize: "15px", color: "var(--muted)", width: "100%", cursor: "not-allowed", outline: "none" }}/>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Contact Phone
              <input value={phone} onChange={e => setPhone(e.target.value)} style={{ padding: "14px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--bg)", fontSize: "15px", color: "var(--text)", width: "100%", outline: "none" }}/>
            </label>
          </div>
          {profileMutation.isSuccess && (
            <p className="success-text" style={{ marginBottom: "20px", padding: "12px 16px", background: "rgba(16, 185, 129, 0.1)", borderRadius: "8px" }}>
              Profile details updated successfully.
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", paddingTop: "20px", borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
            <Link to="/forgot-password" style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--gold)", textDecoration: "underline" }}>
              Update Password
            </Link>
            <button className="button" style={{ padding: "14px 28px" }} disabled={profileMutation.isPending}>
              {profileMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      )}
    </section>
  ); 
}
