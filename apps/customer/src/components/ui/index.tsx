import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { PackageOpen } from "lucide-react";
import { resolveImageUrl } from "../../api";

export function Status({ error, empty, children, emptyMessage = "Check back soon." }: { error?: Error | null; empty?: boolean; children: ReactNode; emptyMessage?: string }) { 
  if (error) return <div className="state error"><h2>Something went wrong</h2><p>{error.message}</p></div>; 
  if (empty) return (
    <div className="state" style={{ background: "var(--card)", border: "1px dashed var(--border)", borderRadius: 24, padding: "50px 20px" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--layer-2)", color: "var(--gold)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <PackageOpen size={32}/>
      </div>
      <h2 style={{ fontSize: "1.4rem", margin: "0 0 10px 0" }}>Nothing here yet</h2>
      <p style={{ color: "var(--muted)", margin: 0 }}>{emptyMessage}</p>
    </div>
  ); 
  return <>{children}</>; 
}

export function Spinner() { 
  return <div className="loader" role="status"><span/>Loading…</div>; 
}

export function Brand({ logo, name = "SHADOW SHOP" }: { logo?: string; name?: string }) { 
  const firstWord = name.split(" ")[0] || "SHADOW";
  const rest = name.split(" ").slice(1).join(" ") || "SHOP";
  
  return (
    <Link to="/" className="brand" aria-label={`${name} home`}>
      {logo && <img src={resolveImageUrl(logo, "")} alt={name} style={{ objectFit: "contain", maxWidth: "100%" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />}
      <div className={logo ? "brand-name-with-logo" : ""}>
        <span>{firstWord}</span>{rest ? <b> {rest}</b> : null}
      </div>
    </Link>
  ); 
}
