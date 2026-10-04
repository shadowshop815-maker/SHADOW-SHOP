import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../api";
import { useAuth } from "../../features/auth/AuthContext";
import { Eye, EyeOff, RotateCcw, Mail, Check, ArrowRight, Lock, ShoppingBag } from "lucide-react";

export function OtpPage({ reset = false }: { reset?: boolean }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [destination, setDestination] = useState(params.get("destination") || "");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const purpose = params.get("purpose") || "REGISTRATION";

  const code = digits.join("");

  const passwordChecks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
  };
  const passwordValid = Object.values(passwordChecks).every(Boolean);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const handleDigitChange = (index: number, value: string) => {
    const v = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = v;
    setDigits(next);
    if (v && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = "";
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = Array(6).fill("").map((_, i) => pasted[i] || "");
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const verifyMutation = useMutation({
    mutationFn: () =>
      reset
        ? api("/auth/password/reset", { method: "POST", body: JSON.stringify({ destination, code, password }) })
        : api("/auth/otp/verify", { method: "POST", body: JSON.stringify({ destination, code, purpose }) }),
    onSuccess: () => {
      if (reset) navigate("/login");
      else if (purpose === "REGISTRATION") navigate("/login", { state: { message: "Account verified! Please sign in." } });
      else navigate("/account");
    },
  });

  const resendMutation = useMutation({
    mutationFn: () =>
      api<{ resendAfterSeconds: number }>("/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ destination, purpose }),
      }),
    onSuccess: (data) => {
      setDigits(["", "", "", "", "", ""]);
      setResendCooldown((data as any)?.resendAfterSeconds || 30);
      inputRefs.current[0]?.focus();
    },
  });

  const canResend = resendCooldown <= 0 && !resendMutation.isPending;

  const C = {
    bg: "#f8f7f5",
    text: "#111111",
    muted: "#6b6b70",
    subtle: "#a1a1aa",
    border: "rgba(0,0,0,0.1)",
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
        @keyframes otp-fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        @keyframes otp-float1 { 0%,100% { transform:translateY(0) scale(1); } 50% { transform:translateY(-26px) scale(1.04); } }
        @keyframes otp-float2 { 0%,100% { transform:translateY(0); } 50% { transform:translateY(18px); } }
        @keyframes otp-pop { 0% { transform:scale(0.92); opacity:0; } 100% { transform:scale(1); opacity:1; } }
        @keyframes otp-spin { to { transform:rotate(360deg); } }

        .otp-digit {
          width: 52px; height: 60px;
          border: 2px solid rgba(0,0,0,0.12);
          border-radius: 14px;
          background: #f3f3f4;
          color: #111111;
          font-size: 26px; font-weight: 800;
          text-align: center; outline: none;
          transition: all 0.2s cubic-bezier(0.16,1,0.3,1);
          caret-color: #b58a35;
          font-family: 'Inter', monospace;
        }
        .otp-digit:focus {
          border-color: #b58a35;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(181,138,53,0.18), 0 4px 14px rgba(181,138,53,0.1);
          transform: scale(1.06);
        }
        .otp-digit.otp-filled {
          border-color: rgba(181,138,53,0.45);
          background: #ffffff;
          color: #111111;
        }

        .otp-inp {
          width: 100%;
          background: #f3f3f4;
          border: 1.5px solid rgba(0,0,0,0.1);
          border-radius: 12px;
          padding: 14px 48px 14px 46px;
          color: #111111;
          font-size: 15px; outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
          font-family: 'Inter', sans-serif;
          box-sizing: border-box;
        }
        .otp-inp:focus {
          border-color: #b58a35;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(181,138,53,0.18);
        }
        .otp-inp::placeholder { color: #a1a1aa; }

        .otp-btn {
          width: 100%; padding: 15px 20px; border-radius: 12px;
          background: #0a0a0c; color: #ffffff;
          font-weight: 700; font-size: 15px;
          border: none; cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: all 0.25s cubic-bezier(0.16,1,0.3,1);
          display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.15);
        }
        .otp-btn:hover:not(:disabled) {
          background: #b58a35;
          box-shadow: 0 8px 28px rgba(181,138,53,0.35);
          transform: translateY(-2px);
        }
        .otp-btn:active:not(:disabled) { transform: translateY(0); }
        .otp-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .otp-chip {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: 8px;
          font-size: 11.5px; font-weight: 600; transition: all 0.2s;
        }
        .otp-side-card {
          display: flex; align-items: flex-start; gap: 14px; padding: 18px 20px;
          border-radius: 18px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          transition: background 0.3s;
        }
        .otp-side-card:hover { background: rgba(255,255,255,0.1); }

        @media (max-width: 860px) {
          .otp-right-panel { display: none !important; }
          .otp-left-panel { grid-column: 1 / -1 !important; }
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
      <div
        className="otp-left-panel"
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
        <div style={{ position: "absolute", top: "10%", right: "-15%", width: "50vw", height: "50vw", borderRadius: "50%", background: `radial-gradient(circle,${C.goldGlow} 0%,transparent 65%)`, filter: "blur(80px)", pointerEvents: "none" }} />

        <div style={{ maxWidth: "400px", width: "100%", margin: "0 auto", position: "relative", animation: "otp-fadeUp 0.45s ease both" }}>
          {/* Brand */}
          <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "48px", textDecoration: "none" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "linear-gradient(135deg,#111 0%,#222 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(0,0,0,0.2)" }}>
              <ShoppingBag size={20} color={C.gold} />
            </div>
            <span style={{ fontSize: "17px", fontWeight: 800, letterSpacing: "0.07em", color: C.text, fontFamily: "'Cinzel',serif" }}>
              SHADOW <span style={{ color: C.gold }}>SHOP</span>
            </span>
          </Link>

          {/* Heading */}
          <div style={{ marginBottom: "32px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "5px 13px", background: C.goldPale, border: `1px solid rgba(181,138,53,0.25)`, borderRadius: "999px", marginBottom: "16px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: C.gold }} />
              <span style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.15em", color: C.gold, textTransform: "uppercase" }}>
                {reset ? "Password Reset" : "Verification"}
              </span>
            </div>
            <h1 style={{ fontSize: "30px", fontWeight: 800, color: C.text, letterSpacing: "-0.03em", margin: "0 0 12px", lineHeight: 1.2 }}>
              {reset ? "Set new password" : "Enter your code"}
            </h1>
            {destination && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "9px 14px", background: "#f0f0f1", border: `1px solid rgba(0,0,0,0.08)`, borderRadius: "10px", fontSize: "13px", color: C.muted }}>
                <Mail size={14} color={C.gold} />
                Code sent to <strong style={{ color: C.text }}>{destination}</strong>
              </div>
            )}
          </div>

          <form onSubmit={e => { e.preventDefault(); verifyMutation.mutate(); }} style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
            {/* Destination if not prefilled */}
            {!params.get("destination") && (
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: C.muted, marginBottom: "8px", letterSpacing: "0.05em" }}>Email</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: C.subtle, display: "flex", alignItems: "center", pointerEvents: "none" }}><Mail size={16} /></span>
                  <input className="otp-inp" required value={destination} onChange={e => setDestination(e.target.value)} placeholder="you@example.com" />
                </div>
              </div>
            )}

            {/* OTP digit boxes */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: C.muted, marginBottom: "14px", letterSpacing: "0.05em" }}>
                6-Digit Verification Code
              </label>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center" }} onPaste={handleDigitPaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={el => { inputRefs.current[i] = el; }}
                    className={`otp-digit${d ? " otp-filled" : ""}`}
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    autoFocus={i === 0}
                    onChange={e => handleDigitChange(i, e.target.value)}
                    onKeyDown={e => handleDigitKeyDown(i, e)}
                  />
                ))}
              </div>
              {/* Progress dots */}
              <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginTop: "12px" }}>
                {digits.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      width: d ? "18px" : "6px",
                      height: "6px",
                      borderRadius: "99px",
                      background: d ? C.gold : "rgba(0,0,0,0.15)",
                      transition: "all 0.25s cubic-bezier(0.16,1,0.3,1)",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* New Password (reset mode) */}
            {reset && (
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: C.muted, marginBottom: "8px", letterSpacing: "0.05em" }}>New Password</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: C.subtle, display: "flex", alignItems: "center", pointerEvents: "none" }}><Lock size={16} /></span>
                  <input
                    className="otp-inp"
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.subtle, display: "flex", alignItems: "center", padding: "4px", borderRadius: "6px", transition: "color 0.2s" }}
                    onMouseOver={e => (e.currentTarget.style.color = C.text)}
                    onMouseOut={e => (e.currentTarget.style.color = C.subtle)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {password && (
                  <div style={{ display: "flex", gap: "7px", flexWrap: "wrap", marginTop: "10px" }}>
                    {[{ key: "length", label: "8+ chars" }, { key: "upper", label: "A–Z" }, { key: "lower", label: "a–z" }, { key: "digit", label: "0–9" }].map(({ key, label }) => {
                      const ok = passwordChecks[key as keyof typeof passwordChecks];
                      return (
                        <span key={key} className="otp-chip" style={{ background: ok ? "rgba(5,150,105,0.12)" : "rgba(0,0,0,0.05)", color: ok ? C.success : C.subtle, border: `1px solid ${ok ? "rgba(5,150,105,0.3)" : C.border}` }}>
                          {ok && <Check size={10} />} {label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Errors */}
            {(verifyMutation.error || resendMutation.error) && (
              <div style={{ padding: "12px 16px", background: C.dangerBg, border: `1px solid ${C.dangerBorder}`, borderRadius: "12px", fontSize: "13.5px", color: C.danger, fontWeight: 600, animation: "otp-pop 0.25s ease" }}>
                {verifyMutation.error?.message || resendMutation.error?.message}
              </div>
            )}
            {resendMutation.isSuccess && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 16px", background: C.successBg, border: `1px solid ${C.successBorder}`, borderRadius: "12px", fontSize: "13.5px", color: C.success, fontWeight: 600, animation: "otp-pop 0.3s ease" }}>
                <Check size={16} /> New code sent!
              </div>
            )}

            {/* Verify button */}
            <button
              type="submit"
              className="otp-btn"
              disabled={verifyMutation.isPending || code.length < 6 || (reset && !passwordValid)}
              style={{ marginTop: "4px" }}
            >
              {verifyMutation.isPending ? "Verifying…" : reset ? "Update Password" : "Verify & Continue"}
              {!verifyMutation.isPending && <ArrowRight size={17} />}
            </button>

            {/* Resend */}
            <div style={{ textAlign: "center" }}>
              <button
                type="button"
                disabled={!canResend}
                onClick={() => resendMutation.mutate()}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: canResend ? "pointer" : "not-allowed",
                  color: canResend ? C.gold : C.subtle,
                  fontSize: "13.5px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "8px 14px",
                  borderRadius: "10px",
                  transition: "all 0.2s",
                  fontFamily: "'Inter', sans-serif",
                }}
                onMouseOver={e => { if (canResend) e.currentTarget.style.background = C.goldPale; }}
                onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <RotateCcw size={14} style={{ animation: resendMutation.isPending ? "otp-spin 1s linear infinite" : "none" }} />
                {resendMutation.isPending ? "Sending…" : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
              </button>
            </div>
          </form>

          <p style={{ marginTop: "24px", textAlign: "center", fontSize: "13px", color: C.muted }}>
            <Link to="/login" style={{ color: C.gold, fontWeight: 700, textDecoration: "none" }}>← Back to sign in</Link>
          </p>
        </div>
      </div>

      {/* ── Right: Visual Panel ── */}
      <div
        className="otp-right-panel"
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
        <div style={{ position: "absolute", top: "12%", left: "8%", width: "260px", height: "260px", borderRadius: "50%", background: "radial-gradient(circle,rgba(181,138,53,0.22) 0%,transparent 70%)", animation: "otp-float1 9s ease-in-out infinite", filter: "blur(48px)" }} />
        <div style={{ position: "absolute", bottom: "18%", right: "6%", width: "220px", height: "220px", borderRadius: "50%", background: "radial-gradient(circle,rgba(181,138,53,0.14) 0%,transparent 70%)", animation: "otp-float2 11s ease-in-out infinite", filter: "blur(56px)" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(181,138,53,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(181,138,53,0.05) 1px,transparent 1px)", backgroundSize: "46px 46px", opacity: 0.7 }} />

        <div style={{ position: "relative", zIndex: 10, padding: "56px", display: "flex", flexDirection: "column", gap: "32px", maxWidth: "420px", width: "100%" }}>
          <div>
            <div style={{ fontSize: "96px", fontWeight: 900, lineHeight: 0.9, fontFamily: "'Cinzel',serif", letterSpacing: "-0.02em", background: "linear-gradient(135deg,#c9a75d 0%,#f0d080 42%,#a07830 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>SS</div>
            <p style={{ color: "rgba(255,255,255,0.38)", fontSize: "11.5px", letterSpacing: "0.28em", textTransform: "uppercase", marginTop: "12px", fontWeight: 700 }}>
              {reset ? "Secure Reset" : "Secure Verification"}
            </p>
          </div>

          <div style={{ height: "1px", background: "linear-gradient(90deg,transparent,rgba(181,138,53,0.35),transparent)" }} />

          {(reset
            ? [
                { icon: "📧", step: "1", title: "Check your email", desc: "We sent a 6-digit code to your inbox." },
                { icon: "🔑", step: "2", title: "Enter the code", desc: "Type the code in the boxes to the left." },
                { icon: "🔒", step: "3", title: "Set new password", desc: "Choose a strong, unique password." },
              ]
            : [
                { icon: "📧", step: "1", title: "Check your email", desc: "We sent a 6-digit code to your inbox." },
                { icon: "✅", step: "2", title: "Enter the code", desc: "Each digit in its own box for accuracy." },
                { icon: "🎉", step: "3", title: "You're verified!", desc: "Access your Shadow Shop account." },
              ]
          ).map(s => (
            <div key={s.step} className="otp-side-card">
              <div style={{ width: "38px", height: "38px", borderRadius: "11px", background: "rgba(181,138,53,0.12)", border: "1px solid rgba(181,138,53,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 800, color: "#c9a75d", letterSpacing: "0.12em", marginBottom: "4px" }}>STEP {s.step}</div>
                <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.9)", fontSize: "14px", marginBottom: "3px" }}>{s.title}</div>
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
