import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, ShieldCheck, Lock, Mail, ArrowRight, Activity, Package, Users, TrendingUp, AlertCircle } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";

export function Login() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const mutation = useMutation({
    mutationFn: () => auth.login(email.trim().toLowerCase(), password),
    onSuccess: () => navigate("/"),
  });

  if (auth.user) return <Navigate to="/" />;

  return (
    <main
      className="adm-main"
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        overflow: "hidden",
        backgroundColor: "#0d0d11",
      }}
    >
      <style>{`
        @keyframes adm-fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes adm-float1 { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-24px) scale(1.03); } }
        @keyframes adm-float2 { 0%,100% { transform: translateY(0); } 50% { transform: translateY(16px); } }
        @keyframes adm-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes adm-spin { to { transform: rotate(360deg); } }
        @keyframes adm-pop { 0% { transform: scale(0.96); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }

        /* Input styling with bulletproof left padding to prevent icon overlap */
        .adm-inp-wrap {
          position: relative;
          width: 100%;
        }

        .adm-inp,
        input.adm-inp,
        input[type="email"].adm-inp,
        input[type="password"].adm-inp,
        input[type="text"].adm-inp {
          width: 100% !important;
          height: 48px !important;
          min-height: 48px !important;
          background: #ffffff !important;
          border: 1.5px solid #e2e4e9 !important;
          border-radius: 12px !important;
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          padding-left: 48px !important;
          padding-right: 46px !important;
          color: #111827 !important;
          font-size: 15px !important;
          font-weight: 500 !important;
          outline: none !important;
          transition: all 0.2s ease !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif !important;
          box-sizing: border-box !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04) !important;
        }

        .adm-inp:focus,
        input.adm-inp:focus,
        input[type="email"].adm-inp:focus,
        input[type="password"].adm-inp:focus {
          border-color: #BA9653 !important;
          background: #ffffff !important;
          box-shadow: 0 0 0 4px rgba(186, 150, 83, 0.16), 0 2px 4px rgba(0,0,0,0.04) !important;
        }

        .adm-inp::placeholder {
          color: #9ca3af !important;
          font-size: 14px !important;
          font-weight: 400 !important;
        }

        .adm-inp-icon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
          pointer-events: none;
          transition: color 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 3;
        }

        .adm-inp-wrap:focus-within .adm-inp-icon {
          color: #BA9653;
        }

        .adm-inp-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          cursor: pointer;
          color: #9ca3af;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
          border-radius: 8px;
          transition: all 0.15s ease;
          z-index: 3;
        }

        .adm-inp-toggle:hover {
          color: #111827;
          background: rgba(0, 0, 0, 0.05);
        }

        .adm-btn {
          width: 100%;
          height: 50px;
          border-radius: 12px;
          background: linear-gradient(135deg, #c7a45e 0%, #BA9653 50%, #a37f37 100%);
          color: #ffffff;
          font-weight: 700;
          font-size: 15px;
          letter-spacing: 0.02em;
          border: none;
          cursor: pointer;
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
          transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-shadow: 0 4px 16px rgba(186, 150, 83, 0.35);
        }

        .adm-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #d3b069 0%, #c49f57 50%, #ad893e 100%);
          transform: translateY(-1.5px);
          box-shadow: 0 8px 24px rgba(186, 150, 83, 0.45);
        }

        .adm-btn:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 2px 8px rgba(186, 150, 83, 0.3);
        }

        .adm-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          filter: grayscale(20%);
        }

        .adm-stat-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 18px;
          border-radius: 14px;
          background: rgba(186, 150, 83, 0.08);
          border: 1px solid rgba(186, 150, 83, 0.16);
          transition: all 0.25s ease;
        }

        .adm-stat-row:hover {
          background: rgba(186, 150, 83, 0.14);
          transform: translateX(4px);
        }

        /* Responsive Breakpoints */
        @media (max-width: 900px) {
          .adm-main {
            grid-template-columns: 1fr !important;
            background: #f8f8f9 !important;
          }
          .adm-right {
            display: none !important;
          }
          .adm-left {
            padding: 32px 18px !important;
            min-height: 100vh !important;
            justify-content: center !important;
            align-items: center !important;
            background: #f8f8f9 !important;
          }
          .adm-card {
            background: #ffffff !important;
            padding: 32px 24px !important;
            border-radius: 20px !important;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04) !important;
            border: 1px solid #eef0f3 !important;
          }
        }

        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px #ffffff inset !important;
          -webkit-text-fill-color: #111827 !important;
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
          background: "#f9fafb",
          position: "relative",
          overflow: "hidden",
          minHeight: "100vh",
        }}
      >
        {/* Subtle ambient blur */}
        <div
          style={{
            position: "absolute",
            bottom: "-10%",
            left: "-10%",
            width: "50%",
            height: "50%",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(186,150,83,0.12) 0%, transparent 70%)",
            filter: "blur(60px)",
            pointerEvents: "none",
          }}
        />

        <div
          className="adm-card"
          style={{
            maxWidth: "420px",
            width: "100%",
            margin: "0 auto",
            position: "relative",
            animation: "adm-fadeUp 0.45s ease both",
          }}
        >
          {/* Logo & Brand Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "36px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "14px",
                background: "linear-gradient(135deg, #111116 0%, #1e1e24 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 14px rgba(0,0,0,0.18), 0 0 0 1px rgba(186,150,83,0.3)",
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: "22px", fontWeight: 900, fontFamily: "'Cinzel', Georgia, serif", color: "#BA9653", letterSpacing: "-1px" }}>
                S
              </span>
            </div>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "0.08em", color: "#111827", lineHeight: 1.2 }}>
                SHADOW <span style={{ color: "#BA9653" }}>SHOP</span>
              </div>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#8a8d93", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: "3px" }}>
                Store Admin Portal
              </div>
            </div>
          </div>

          {/* Heading */}
          <div style={{ marginBottom: "28px" }}>
            <h1 style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 8px", color: "#111827", lineHeight: 1.2 }}>
              Welcome back
            </h1>
            <p style={{ color: "#6b7280", fontSize: "14.5px", margin: 0, lineHeight: 1.5 }}>
              Sign in with your verified administrator credentials to manage your store.
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            {/* Email Field */}
            <div>
              <label
                htmlFor="admin-email-input"
                style={{
                  display: "block",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  color: "#374151",
                  marginBottom: "8px",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                Email Address
              </label>
              <div className="adm-inp-wrap">
                <span className="adm-inp-icon">
                  <Mail size={18} />
                </span>
                <input
                  id="admin-email-input"
                  className="adm-inp"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="admin-password-input"
                style={{
                  display: "block",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  color: "#374151",
                  marginBottom: "8px",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                Password
              </label>
              <div className="adm-inp-wrap">
                <span className="adm-inp-icon">
                  <Lock size={18} />
                </span>
                <input
                  id="admin-password-input"
                  className="adm-inp"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="adm-inp-toggle"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {mutation.error && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "14px 16px",
                  background: "#fef2f2",
                  border: "1.5px solid #fecaca",
                  borderRadius: "12px",
                  fontSize: "13.5px",
                  color: "#dc2626",
                  lineHeight: 1.45,
                  animation: "adm-pop 0.25s ease",
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "1px", color: "#dc2626" }} />
                <div>
                  <div style={{ fontWeight: 700 }}>Authentication Error</div>
                  <div style={{ fontSize: "13px", marginTop: "2px", color: "#b91c1c" }}>
                    {mutation.error.message || "Email or password is incorrect."}
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="adm-btn"
              disabled={mutation.isPending}
              style={{ marginTop: "6px" }}
            >
              {mutation.isPending ? (
                <>
                  <div
                    style={{
                      width: "18px",
                      height: "18px",
                      border: "2.5px solid rgba(255,255,255,0.35)",
                      borderTopColor: "#ffffff",
                      borderRadius: "50%",
                      animation: "adm-spin 0.75s linear infinite",
                      flexShrink: 0,
                    }}
                  />
                  <span>Signing In…</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Security Badge */}
          <div
            style={{
              marginTop: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              color: "#9ca3af",
              fontSize: "12px",
              textAlign: "center",
            }}
          >
            <ShieldCheck size={16} color="#BA9653" />
            <span>End-to-end encrypted session. Unauthorized access is logged.</span>
          </div>
        </div>
      </section>

      {/* ── Right: Executive Showcase (Desktop only) ── */}
      <section
        className="adm-right"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #09090c 0%, #0f0f13 55%, #0c0b0e 100%)",
          overflow: "hidden",
          minHeight: "100vh",
        }}
      >
        {/* Animated ambient orbs */}
        <div
          style={{
            position: "absolute",
            top: "10%",
            right: "5%",
            width: "320px",
            height: "320px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(186,150,83,0.22) 0%, transparent 70%)",
            animation: "adm-float1 9s ease-in-out infinite",
            filter: "blur(48px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "15%",
            left: "5%",
            width: "280px",
            height: "280px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(186,150,83,0.15) 0%, transparent 70%)",
            animation: "adm-float2 11s ease-in-out infinite",
            filter: "blur(56px)",
          }}
        />

        {/* Subtle grid pattern */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "linear-gradient(rgba(186,150,83,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(186,150,83,0.05) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />

        {/* Content Card */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            padding: "56px",
            display: "flex",
            flexDirection: "column",
            gap: "28px",
            width: "100%",
            maxWidth: "460px",
          }}
        >
          {/* Big Monogram */}
          <div>
            <div
              style={{
                fontSize: "96px",
                fontWeight: 900,
                lineHeight: 0.9,
                fontFamily: "'Cinzel', Georgia, serif",
                letterSpacing: "-0.02em",
                background: "linear-gradient(135deg, #c9a75d 0%, #f0d080 45%, #9a7032 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              SS
            </div>
            <p
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: "11px",
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                marginTop: "16px",
                fontWeight: 700,
              }}
            >
              Executive Command Center
            </p>
          </div>

          {/* Gold Divider */}
          <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, rgba(186,150,83,0.4), transparent)" }} />

          {/* Feature indicators */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { icon: <Activity size={16} color="#BA9653" />, label: "Live Orders & Transit", desc: "Real-time dispatch tracking" },
              { icon: <Package size={16} color="#BA9653" />, label: "Dynamic Inventory", desc: "Automated low-stock alerts" },
              { icon: <Users size={16} color="#BA9653" />, label: "Customer Intelligence", desc: "CRM, addresses & security" },
              { icon: <TrendingUp size={16} color="#BA9653" />, label: "Financial Metrics", desc: "Sales, taxes & refund oversight" },
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
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.92)" }}>{s.label}</div>
                  <div style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.45)", marginTop: "2px" }}>{s.desc}</div>
                </div>
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#4ade80",
                    boxShadow: "0 0 8px rgba(74,222,128,0.6)",
                    animation: "adm-blink 2s ease-in-out infinite",
                    animationDelay: `${i * 0.4}s`,
                    flexShrink: 0,
                  }}
                />
              </div>
            ))}
          </div>

          {/* Operational Status */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px 16px",
              borderRadius: "12px",
              background: "rgba(74,222,128,0.06)",
              border: "1px solid rgba(74,222,128,0.18)",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#4ade80",
                boxShadow: "0 0 8px rgba(74,222,128,0.6)",
                flexShrink: 0,
              }}
            />
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "12.5px", fontWeight: 600 }}>
              All store microservices operational
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
