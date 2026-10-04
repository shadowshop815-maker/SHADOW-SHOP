import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, ShieldCheck, Lock, Mail, ArrowRight, Activity, Package, Users, TrendingUp } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";

export function Login() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const mutation = useMutation({
    mutationFn: () => auth.login(email, password),
    onSuccess: () => navigate("/"),
  });

  if (auth.user) return <Navigate to="/" />;

  return (
    <main
      style={{
        minHeight: "100vh",
        width: "100vw",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes adm-fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes adm-float1 { 0%,100% { transform:translateY(0) scale(1); } 50% { transform:translateY(-26px) scale(1.04); } }
        @keyframes adm-float2 { 0%,100% { transform:translateY(0); } 50% { transform:translateY(18px); } }
        @keyframes adm-blink { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
        @keyframes adm-spin { to { transform:rotate(360deg); } }
        @keyframes adm-pop { 0% { transform:scale(0.93); opacity:0; } 100% { transform:scale(1); opacity:1; } }

        .adm-inp {
          width: 100%;
          background: #f3f3f4;
          border: 1.5px solid rgba(0,0,0,0.1);
          border-radius: 12px;
          padding: 14px 16px 14px 48px;
          color: #111111;
          font-size: 15px; outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
          font-family: 'Inter', sans-serif;
          box-sizing: border-box;
        }
        .adm-inp:focus {
          border-color: #BA9653;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(186,150,83,0.14);
        }
        .adm-inp::placeholder { color: #a1a1aa; }
        .adm-inp-wrap { position: relative; }
        .adm-inp-icon {
          position: absolute; left: 15px; top: 50%; transform: translateY(-50%);
          color: #a1a1aa; pointer-events: none; transition: color 0.2s;
          display: flex; align-items: center;
        }
        .adm-inp-wrap:focus-within .adm-inp-icon { color: #BA9653; }
        .adm-inp-toggle {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: #a1a1aa; display: flex; align-items: center;
          padding: 4px; border-radius: 6px; transition: color 0.2s;
        }
        .adm-inp-toggle:hover { color: #111111; }

        .adm-btn {
          width: 100%; padding: 15px 20px; border-radius: 12px;
          background: #BA9653; color: #ffffff;
          font-weight: 700; font-size: 15px; letter-spacing: 0.03em;
          border: none; cursor: pointer; font-family: 'Inter', sans-serif;
          transition: all 0.25s cubic-bezier(0.16,1,0.3,1);
          display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 4px 18px rgba(186,150,83,0.3);
        }
        .adm-btn:hover:not(:disabled) {
          background: #a0803c;
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(186,150,83,0.4);
        }
        .adm-btn:active:not(:disabled) { transform: translateY(0); }
        .adm-btn:disabled { opacity: 0.65; cursor: not-allowed; }

        .adm-stat-row {
          display: flex; align-items: center; gap: 14px; padding: 14px 18px;
          border-radius: 14px;
          background: rgba(186,150,83,0.08);
          border: 1px solid rgba(186,150,83,0.16);
          transition: background 0.3s;
        }
        .adm-stat-row:hover { background: rgba(186,150,83,0.14); }

        @media (max-width: 860px) {
          .adm-right { display: none !important; }
          .adm-left { grid-column: 1 / -1 !important; }
        }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px #f3f3f4 inset !important;
          -webkit-text-fill-color: #111111 !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>

      {/* ── Left: Form Panel ── */}
      <section
        className="adm-left"
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "64px 72px",
          background: "#f8f7f5",
          position: "relative",
          overflow: "hidden",
          minHeight: "100vh",
        }}
      >
        {/* Subtle orb */}
        <div
          style={{
            position: "absolute",
            bottom: "-8%",
            left: "-12%",
            width: "55%",
            height: "55%",
            borderRadius: "50%",
            background: "radial-gradient(circle,rgba(186,150,83,0.1) 0%,transparent 70%)",
            filter: "blur(60px)",
            pointerEvents: "none",
          }}
        />

        <div style={{ maxWidth: "400px", width: "100%", margin: "0 auto", position: "relative", animation: "adm-fadeUp 0.45s ease both" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "56px" }}>
            <div
              style={{
                width: "46px",
                height: "46px",
                borderRadius: "13px",
                background: "linear-gradient(135deg,#0f0f11 0%,#1a1a20 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 14px rgba(0,0,0,0.18), 0 0 0 1px rgba(186,150,83,0.25)",
              }}
            >
              <span style={{ fontSize: "20px", fontWeight: 900, fontFamily: "'Cinzel',serif", color: "#BA9653", letterSpacing: "-1px" }}>S</span>
            </div>
            <div>
              <div style={{ fontSize: "15px", fontWeight: 800, fontFamily: "'Inter',sans-serif", letterSpacing: "0.1em", color: "#111111" }}>
                SHADOW <span style={{ color: "#BA9653" }}>SHOP</span>
              </div>
            </div>
          </div>

          {/* Badge + Heading */}
          <div style={{ marginBottom: "36px" }}>

            <h1 style={{ fontSize: "30px", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 8px", color: "#111111", lineHeight: 1.15 }}>
              Admin Portal
            </h1>
            <p style={{ color: "#6b6b70", fontSize: "14.5px", margin: 0, lineHeight: 1.65 }}>
              Sign in to manage your store.
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={e => { e.preventDefault(); mutation.mutate(); }}
            style={{ display: "flex", flexDirection: "column", gap: "18px" }}
          >
            {/* Email */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#48484a",
                  marginBottom: "8px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Email Address
              </label>
              <div className="adm-inp-wrap">
                <span className="adm-inp-icon"><Mail size={17} /></span>
                <input
                  className="adm-inp"
                  autoFocus
                  type="email"
                  required
                  placeholder="admin@shadowshop.local"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#48484a",
                  marginBottom: "8px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Password
              </label>
              <div className="adm-inp-wrap">
                <span className="adm-inp-icon"><Lock size={17} /></span>
                <input
                  className="adm-inp"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ paddingRight: "48px" }}
                />
                <button
                  type="button"
                  className="adm-inp-toggle"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {mutation.error && (
              <div
                style={{
                  padding: "12px 16px",
                  background: "rgba(224,49,49,0.08)",
                  border: "1px solid rgba(224,49,49,0.2)",
                  borderRadius: "11px",
                  fontSize: "13.5px",
                  color: "#e03131",
                  fontWeight: 600,
                  animation: "adm-pop 0.25s ease",
                }}
              >
                {mutation.error.message}
              </div>
            )}

            {/* Submit */}
            <button type="submit" className="adm-btn" disabled={mutation.isPending} style={{ marginTop: "10px" }}>
              {mutation.isPending ? (
                <>
                  <div
                    style={{
                      width: "17px",
                      height: "17px",
                      border: "2.5px solid rgba(255,255,255,0.3)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      animation: "adm-spin 0.75s linear infinite",
                      flexShrink: 0,
                    }}
                  />
                  Signing in…
                </>
              ) : (
                <>
                  Sign In <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <p style={{ marginTop: "32px", textAlign: "center", fontSize: "12px", color: "#8e8e93", lineHeight: 1.7 }}>
            Protected by end-to-end encryption.<br />
            Unauthorized access is monitored and logged.
          </p>
        </div>
      </section>

      {/* ── Right: Art Panel ── */}
      <section
        className="adm-right"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg,#09090c 0%,#0f0f13 55%,#0c0b0e 100%)",
          overflow: "hidden",
          minHeight: "100vh",
        }}
      >
        {/* Animated orbs */}
        <div style={{ position: "absolute", top: "10%", right: "5%", width: "300px", height: "300px", borderRadius: "50%", background: "radial-gradient(circle,rgba(186,150,83,0.2) 0%,transparent 70%)", animation: "adm-float1 9s ease-in-out infinite", filter: "blur(48px)" }} />
        <div style={{ position: "absolute", bottom: "15%", left: "5%", width: "250px", height: "250px", borderRadius: "50%", background: "radial-gradient(circle,rgba(186,150,83,0.13) 0%,transparent 70%)", animation: "adm-float2 11s ease-in-out infinite", filter: "blur(56px)" }} />
        {/* Grid overlay */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(186,150,83,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(186,150,83,0.05) 1px,transparent 1px)", backgroundSize: "44px 44px" }} />

        {/* Content */}
        <div style={{ position: "relative", zIndex: 10, padding: "56px", display: "flex", flexDirection: "column", gap: "28px", width: "100%", maxWidth: "460px" }}>
          {/* Big monogram */}
          <div style={{ marginBottom: "4px" }}>
            <div
              style={{
                fontSize: "108px",
                fontWeight: 900,
                lineHeight: 0.85,
                fontFamily: "'Cinzel',serif",
                letterSpacing: "-0.02em",
                background: "linear-gradient(135deg,#c9a75d 0%,#f0d080 45%,#9a7032 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              SS
            </div>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "10.5px", letterSpacing: "0.3em", textTransform: "uppercase", marginTop: "14px", fontWeight: 700 }}>
              Executive Command Center
            </p>
          </div>

          {/* Divider */}
          <div style={{ height: "1px", background: "linear-gradient(90deg,transparent,rgba(186,150,83,0.35),transparent)" }} />

          {/* Stat rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { icon: <Activity size={16} color="#BA9653" />, label: "Live Orders", desc: "Real-time monitoring" },
              { icon: <Package size={16} color="#BA9653" />, label: "Inventory", desc: "Full stock control" },
              { icon: <Users size={16} color="#BA9653" />, label: "Customers", desc: "CRM & analytics" },
              { icon: <TrendingUp size={16} color="#BA9653" />, label: "Revenue", desc: "Dashboard & reports" },
            ].map((s, i) => (
              <div key={s.label} className="adm-stat-row">
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "rgba(186,150,83,0.12)",
                    border: "1px solid rgba(186,150,83,0.22)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {s.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>{s.label}</div>
                  <div style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.42)", marginTop: "1px" }}>{s.desc}</div>
                </div>
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#4ade80",
                    boxShadow: "0 0 8px rgba(74,222,128,0.6)",
                    animation: `adm-blink 2s ease-in-out infinite`,
                    animationDelay: `${i * 0.4}s`,
                    flexShrink: 0,
                  }}
                />
              </div>
            ))}
          </div>

          {/* Status bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px 16px",
              borderRadius: "12px",
              background: "rgba(74,222,128,0.06)",
              border: "1px solid rgba(74,222,128,0.15)",
            }}
          >
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 8px rgba(74,222,128,0.5)", flexShrink: 0 }} />
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "12.5px", fontWeight: 600 }}>All systems operational</span>
          </div>
        </div>
      </section>
    </main>
  );
}
