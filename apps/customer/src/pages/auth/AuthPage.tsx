import { useState } from "react";
import { Link, useNavigate, useLocation, Navigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Check, Eye, EyeOff, ShoppingBag, ArrowRight, Mail, Lock, User } from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../features/auth/AuthContext";

export function AuthPage({ mode }: { mode: "login" | "register" | "forgot" }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [sent, setSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const successMessage = (location.state as { message?: string })?.message || null;

  const passwordChecks = {
    length: form.password.length >= 8,
    upper: /[A-Z]/.test(form.password),
    lower: /[a-z]/.test(form.password),
    digit: /\d/.test(form.password),
  };
  const passwordValid = Object.values(passwordChecks).every(Boolean);

  const mutation = useMutation({
    mutationFn: async () => {
      setFormError(null);
      if (mode === "register" && !passwordValid)
        throw new Error("Password must be at least 8 characters with uppercase, lowercase, and a number.");
      if (mode === "login") return auth.login(form.email, form.password);
      if (mode === "register")
        return api<{ destination: string }>("/auth/register", { method: "POST", body: JSON.stringify(form) });
      return api("/auth/password/forgot", { method: "POST", body: JSON.stringify({ destination: form.email }) });
    },
    onSuccess: result => {
      if (mode === "login") navigate((location.state as { from?: string })?.from || "/account");
      else if (mode === "register")
        navigate(`/verify?destination=${encodeURIComponent((result as { destination: string }).destination)}&purpose=REGISTRATION`);
      else setSent(true);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  if (auth.user && mode === "login") return <Navigate to="/account" />;

  const modeLabel = mode === "login" ? "Welcome back" : mode === "register" ? "Create account" : "Reset password";
  const modeSubtitle =
    mode === "login"
      ? "Sign in to continue shopping"
      : mode === "register"
      ? "Join the Shadow Shop community"
      : "We'll send a recovery code to your inbox";
  const btnText = mutation.isPending
    ? "Please wait…"
    : mode === "login"
    ? "Sign In"
    : mode === "register"
    ? "Create Account"
    : "Send Recovery Code";

  const C = {
    bg: "#f8f7f5",
    panel: "#ffffff",
    text: "#111111",
    muted: "#6b6b70",
    subtle: "#a1a1aa",
    border: "rgba(0,0,0,0.1)",
    borderFocus: "#b58a35",
    inputBg: "#f3f3f4",
    inputBgFocus: "#ffffff",
    gold: "#b58a35",
    goldPale: "rgba(181,138,53,0.1)",
    goldGlow: "rgba(181,138,53,0.18)",
    danger: "#dc2626",
    dangerBg: "rgba(220,38,38,0.08)",
    dangerBorder: "rgba(220,38,38,0.2)",
    success: "#059669",
    successBg: "rgba(5,150,105,0.1)",
    successBorder: "rgba(5,150,105,0.2)",
    ink: "#0a0a0c",
    paper: "#ffffff",
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1fr 1fr", background: C.bg }}>
      <style>{`
        @keyframes ss-fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        @keyframes ss-float1 { 0%,100% { transform:translateY(0) scale(1); } 50% { transform:translateY(-28px) scale(1.04); } }
        @keyframes ss-float2 { 0%,100% { transform:translateY(0); } 50% { transform:translateY(20px); } }
        @keyframes ss-pop { 0% { transform:scale(0.92); opacity:0; } 100% { transform:scale(1); opacity:1; } }
        .ss-inp {
          width: 100%;
          background: ${C.inputBg};
          border: 1.5px solid ${C.border};
          border-radius: 12px;
          padding: 14px 16px 14px 46px;
          color: ${C.text};
          font-size: 15px;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
          font-family: 'Inter', sans-serif;
          box-sizing: border-box;
        }
        .ss-inp:focus {
          border-color: ${C.gold};
          background: ${C.inputBgFocus};
          box-shadow: 0 0 0 4px ${C.goldGlow};
        }
        .ss-inp::placeholder { color: ${C.subtle}; }
        .ss-inp-wrap { position: relative; }
        .ss-inp-icon {
          position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          color: ${C.subtle}; pointer-events: none; transition: color 0.2s;
          display: flex; align-items: center;
        }
        .ss-inp-wrap:focus-within .ss-inp-icon { color: ${C.gold}; }
        .ss-inp-toggle {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: ${C.subtle}; display: flex; align-items: center; padding: 4px;
          border-radius: 6px; transition: color 0.2s;
        }
        .ss-inp-toggle:hover { color: ${C.text}; }
        .ss-btn {
          width: 100%; padding: 15px 20px; border-radius: 12px;
          background: ${C.ink}; color: ${C.paper};
          font-weight: 700; font-size: 15px; letter-spacing: 0.02em;
          border: none; cursor: pointer; font-family: 'Inter', sans-serif;
          transition: all 0.25s cubic-bezier(0.16,1,0.3,1);
          display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.15);
        }
        .ss-btn:hover:not(:disabled) {
          background: ${C.gold};
          box-shadow: 0 8px 28px rgba(181,138,53,0.35);
          transform: translateY(-2px);
        }
        .ss-btn:active:not(:disabled) { transform: translateY(0); }
        .ss-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .ss-chip {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: 8px;
          font-size: 11.5px; font-weight: 600; transition: all 0.2s;
        }
        .ss-side-card {
          display: flex; align-items: flex-start; gap: 14px; padding: 18px 20px;
          border-radius: 18px; background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          backdrop-filter: blur(12px); transition: background 0.3s;
        }
        .ss-side-card:hover { background: rgba(255,255,255,0.1); }
        @media (max-width: 860px) {
          .ss-auth-right { display: none !important; }
          .ss-auth-left { grid-column: 1 / -1 !important; }
        }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px ${C.inputBg} inset !important;
          -webkit-text-fill-color: ${C.text} !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>

      {/* ── Left: Form Panel ── */}
      <div
        className="ss-auth-left"
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "56px 64px",
          background: C.bg,
          position: "relative",
          overflow: "hidden",
          minHeight: "100vh",
        }}
      >
        {/* Subtle bg orb */}
        <div
          style={{
            position: "absolute",
            top: "10%",
            right: "-15%",
            width: "50vw",
            height: "50vw",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${C.goldGlow} 0%, transparent 65%)`,
            filter: "blur(80px)",
            pointerEvents: "none",
          }}
        />

        <div style={{ maxWidth: "400px", width: "100%", margin: "0 auto", position: "relative", animation: "ss-fadeUp 0.45s ease both" }}>
          {/* Brand */}
          <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "48px", textDecoration: "none" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                background: "linear-gradient(135deg,#111 0%,#222 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
              }}
            >
              <ShoppingBag size={20} color={C.gold} />
            </div>
            <span style={{ fontSize: "17px", fontWeight: 800, letterSpacing: "0.07em", color: C.text, fontFamily: "'Cinzel',serif" }}>
              SHADOW <span style={{ color: C.gold }}>SHOP</span>
            </span>
          </Link>

          {/* Badge + Heading */}
          <div style={{ marginBottom: "32px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "5px 13px",
                background: C.goldPale,
                border: `1px solid rgba(181,138,53,0.25)`,
                borderRadius: "999px",
                marginBottom: "16px",
              }}
            >
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: C.gold }} />
              <span style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.15em", color: C.gold, textTransform: "uppercase" }}>
                {mode === "login" ? "Authentication" : mode === "register" ? "New Account" : "Recovery"}
              </span>
            </div>
            <h1 style={{ fontSize: "30px", fontWeight: 800, color: C.text, letterSpacing: "-0.03em", margin: "0 0 8px", lineHeight: 1.2 }}>
              {modeLabel}
            </h1>
            <p style={{ color: C.muted, fontSize: "14.5px", margin: 0, lineHeight: 1.65 }}>{modeSubtitle}</p>
          </div>

          {/* Success message */}
          {successMessage && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 16px",
                background: C.successBg,
                border: `1px solid ${C.successBorder}`,
                borderRadius: "12px",
                marginBottom: "20px",
                fontSize: "13.5px",
                color: C.success,
                fontWeight: 600,
                animation: "ss-pop 0.3s ease",
              }}
            >
              <Check size={16} /> {successMessage}
            </div>
          )}

          {/* Sent state */}
          {sent ? (
            <div style={{ textAlign: "center", padding: "20px 0", animation: "ss-fadeUp 0.4s ease" }}>
              <div
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "50%",
                  background: C.goldPale,
                  border: `2px solid rgba(181,138,53,0.3)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 24px",
                  boxShadow: `0 8px 30px ${C.goldGlow}`,
                }}
              >
                <Mail size={28} color={C.gold} />
              </div>
              <h2 style={{ fontSize: "22px", fontWeight: 800, color: C.text, marginBottom: "10px" }}>Check your inbox</h2>
              <p style={{ color: C.muted, fontSize: "14px", lineHeight: 1.7, marginBottom: "28px" }}>
                We sent a recovery code to{" "}
                <strong style={{ color: C.text }}>{form.email}</strong>. Check your spam folder too.
              </p>
              <Link
                to={`/reset-password?destination=${encodeURIComponent(form.email)}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                  justifyContent: "center",
                  padding: "15px",
                  borderRadius: "12px",
                  background: C.ink,
                  color: C.paper,
                  fontWeight: 700,
                  textDecoration: "none",
                  fontSize: "14px",
                  transition: "all 0.2s",
                }}
              >
                Enter Code <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* Full name (register only) */}
              {mode === "register" && (
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: C.muted, marginBottom: "8px", letterSpacing: "0.05em" }}>
                    Full Name
                  </label>
                  <div className="ss-inp-wrap">
                    <span className="ss-inp-icon"><User size={16} /></span>
                    <input className="ss-inp" autoFocus required placeholder="John Doe" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  </div>
                </div>
              )}

              {/* Email */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: C.muted, marginBottom: "8px", letterSpacing: "0.05em" }}>
                  Email Address
                </label>
                <div className="ss-inp-wrap">
                  <span className="ss-inp-icon"><Mail size={16} /></span>
                  <input
                    className="ss-inp"
                    autoFocus={mode !== "register"}
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>

              {/* Password */}
              {mode !== "forgot" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 700, color: C.muted, letterSpacing: "0.05em" }}>Password</label>
                    {mode === "login" && (
                      <Link to="/forgot-password" style={{ fontSize: "12px", color: C.gold, fontWeight: 700, textDecoration: "none" }}>
                        Forgot?
                      </Link>
                    )}
                  </div>
                  <div className="ss-inp-wrap">
                    <span className="ss-inp-icon"><Lock size={16} /></span>
                    <input
                      className="ss-inp"
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={form.password}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                      style={{ paddingRight: "48px" }}
                    />
                    <button type="button" className="ss-inp-toggle" tabIndex={-1} onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Password strength (register) */}
                  {mode === "register" && form.password && (
                    <div style={{ display: "flex", gap: "7px", flexWrap: "wrap", marginTop: "10px" }}>
                      {[
                        { key: "length", label: "8+ chars" },
                        { key: "upper", label: "A–Z" },
                        { key: "lower", label: "a–z" },
                        { key: "digit", label: "0–9" },
                      ].map(({ key, label }) => {
                        const ok = passwordChecks[key as keyof typeof passwordChecks];
                        return (
                          <span
                            key={key}
                            className="ss-chip"
                            style={{
                              background: ok ? "rgba(5,150,105,0.12)" : "rgba(0,0,0,0.05)",
                              color: ok ? C.success : C.subtle,
                              border: `1px solid ${ok ? "rgba(5,150,105,0.3)" : C.border}`,
                            }}
                          >
                            {ok && <Check size={10} />}
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {(formError || mutation.error) && (
                <div
                  style={{
                    padding: "12px 16px",
                    background: C.dangerBg,
                    border: `1px solid ${C.dangerBorder}`,
                    borderRadius: "12px",
                    fontSize: "13.5px",
                    color: C.danger,
                    fontWeight: 600,
                    animation: "ss-pop 0.25s ease",
                  }}
                >
                  {formError || mutation.error?.message}
                </div>
              )}

              {/* Submit */}
              <button type="submit" className="ss-btn" disabled={mutation.isPending} style={{ marginTop: "8px" }}>
                {btnText}
                {!mutation.isPending && <ArrowRight size={17} />}
              </button>
            </form>
          )}

          {/* Footer link */}
          {!sent && (
            <p style={{ marginTop: "28px", textAlign: "center", fontSize: "13.5px", color: C.muted }}>
              {mode === "login" && (
                <>Don't have an account?{" "}<Link to="/register" style={{ color: C.gold, fontWeight: 700, textDecoration: "none" }}>Sign up →</Link></>
              )}
              {mode === "register" && (
                <>Already have an account?{" "}<Link to="/login" style={{ color: C.gold, fontWeight: 700, textDecoration: "none" }}>Sign in →</Link></>
              )}
              {mode === "forgot" && (
                <Link to="/login" style={{ color: C.gold, fontWeight: 700, textDecoration: "none" }}>← Back to sign in</Link>
              )}
            </p>
          )}
        </div>
      </div>

      {/* ── Right: Visual Panel ── */}
      <div
        className="ss-auth-right"
        style={{
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(145deg,#09090c 0%,#101014 55%,#0c0b0e 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        {/* Orbs */}
        <div style={{ position: "absolute", top: "12%", left: "8%", width: "280px", height: "280px", borderRadius: "50%", background: "radial-gradient(circle,rgba(181,138,53,0.22) 0%,transparent 70%)", animation: "ss-float1 9s ease-in-out infinite", filter: "blur(48px)" }} />
        <div style={{ position: "absolute", bottom: "18%", right: "6%", width: "240px", height: "240px", borderRadius: "50%", background: "radial-gradient(circle,rgba(181,138,53,0.14) 0%,transparent 70%)", animation: "ss-float2 11s ease-in-out infinite", filter: "blur(56px)" }} />
        {/* Grid */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(181,138,53,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(181,138,53,0.05) 1px,transparent 1px)", backgroundSize: "46px 46px", opacity: 0.7 }} />

        {/* Content */}
        <div style={{ position: "relative", zIndex: 10, padding: "56px", display: "flex", flexDirection: "column", gap: "36px", maxWidth: "420px", width: "100%" }}>
          {/* Monogram */}
          <div>
            <div
              style={{
                fontSize: "96px",
                fontWeight: 900,
                lineHeight: 0.9,
                fontFamily: "'Cinzel',serif",
                letterSpacing: "-0.02em",
                background: "linear-gradient(135deg,#c9a75d 0%,#f0d080 42%,#a07830 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              SS
            </div>
            <p style={{ color: "rgba(255,255,255,0.38)", fontSize: "11.5px", letterSpacing: "0.28em", textTransform: "uppercase", marginTop: "12px", fontWeight: 700 }}>
              Shadow Shop
            </p>
          </div>

          {/* Divider */}
          <div style={{ height: "1px", background: "linear-gradient(90deg,transparent,rgba(181,138,53,0.35),transparent)" }} />

          {/* Feature cards */}
          {[
            { icon: "🛍️", title: "Curated Collection", desc: "Premium products handpicked for quality and style." },
            { icon: "⚡", title: "Fast Delivery", desc: "Same-day dispatch with real-time tracking updates." },
            { icon: "🔒", title: "Secure Shopping", desc: "Bank-grade encryption on every transaction." },
          ].map(f => (
            <div key={f.title} className="ss-side-card">
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "11px",
                  background: "rgba(181,138,53,0.12)",
                  border: "1px solid rgba(181,138,53,0.22)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  flexShrink: 0,
                }}
              >
                {f.icon}
              </div>
              <div>
                <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.9)", fontSize: "14px", marginBottom: "4px" }}>{f.title}</div>
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", lineHeight: 1.55 }}>{f.desc}</div>
              </div>
            </div>
          ))}

          {/* Trust badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px 16px",
              borderRadius: "12px",
              background: "rgba(181,138,53,0.08)",
              border: "1px solid rgba(181,138,53,0.18)",
            }}
          >
            <span style={{ color: "#c9a75d", fontSize: "18px" }}>★★★★★</span>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "12.5px", fontWeight: 600 }}>Trusted by 10,000+ customers</span>
          </div>
        </div>
      </div>
    </div>
  );
}
