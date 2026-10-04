import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit2, CheckCircle, XCircle } from "lucide-react";
import { api } from "../../api";
import { PageHead, Loading } from "../../components/ui";

type TaxProfile = {
  id: string; name: string; code: string; description: string;
  rate: number; cgstComponent: number; sgstComponent: number;
  igstComponent: number; cessComponent: number; active: boolean;
};

type HSNEntry = {
  id: string; hsnCode: string; description: string;
  taxProfileId: string | null; active: boolean;
  taxProfile: TaxProfile | null;
};

const inputStyle = { padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--layer-3)", fontSize: "14px", color: "var(--text)", width: "100%" };
const labelStyle = { display: "flex" as const, flexDirection: "column" as const, gap: "6px", fontSize: "12px", fontWeight: 600 as const, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase" as const };

function TaxProfilesTab() {
  const client = useQueryClient();
  const [editing, setEditing] = useState<TaxProfile | null | "new">(null);
  const { data: profiles = [], isLoading } = useQuery<TaxProfile[]>({
    queryKey: ["tax-profiles"],
    queryFn: () => api<TaxProfile[]>("/admin/tax/profiles")
  });

  const saveMutation = useMutation({
    mutationFn: (body: any) => editing && editing !== "new"
      ? api(`/admin/tax/profiles/${(editing as TaxProfile).id}`, { method: "PATCH", body: JSON.stringify(body) })
      : api("/admin/tax/profiles", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { client.invalidateQueries({ queryKey: ["tax-profiles"] }); setEditing(null); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/tax/profiles/${id}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["tax-profiles"] })
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const rate = Number(fd.get("rate"));
    saveMutation.mutate({
      name: fd.get("name"), code: fd.get("code"), description: fd.get("description"),
      rate, cgstComponent: Number(fd.get("cgstComponent") || rate / 2),
      sgstComponent: Number(fd.get("sgstComponent") || rate / 2),
      igstComponent: Number(fd.get("igstComponent") || rate),
      cessComponent: Number(fd.get("cessComponent") || 0),
      active: true
    });
  };

  if (isLoading) return <Loading />;

  const defaultEdit = editing && editing !== "new" ? editing as TaxProfile : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 4px 0" }}>Tax Profiles</h3>
          <p style={{ color: "var(--muted)", margin: 0, fontSize: "13px" }}>Configure GST slabs (e.g. GST 5%, 12%, 18%, 28%)</p>
        </div>
        <button type="button" className="button primary" onClick={() => setEditing("new")} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Plus size={16} /> Add Profile
        </button>
      </div>

      {editing && (
        <form className="panel" onSubmit={handleSubmit} style={{ border: "1px solid var(--primary)", background: "var(--layer-2)" }}>
          <h4 style={{ margin: "0 0 20px 0", color: "var(--primary)" }}>{defaultEdit ? "Edit Tax Profile" : "New Tax Profile"}</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
            <label style={labelStyle}>Profile Name <input name="name" defaultValue={defaultEdit?.name} required style={inputStyle} placeholder="e.g. GST 18%" /></label>
            <label style={labelStyle}>Code <input name="code" defaultValue={defaultEdit?.code} required style={inputStyle} placeholder="e.g. GST18" /></label>
            <label style={labelStyle}>Total Rate (%) <input name="rate" type="number" step="0.01" defaultValue={defaultEdit?.rate} required style={inputStyle} /></label>
            <label style={labelStyle}>CGST % <input name="cgstComponent" type="number" step="0.01" defaultValue={defaultEdit?.cgstComponent} style={inputStyle} placeholder="Half of rate for intra-state" /></label>
            <label style={labelStyle}>SGST % <input name="sgstComponent" type="number" step="0.01" defaultValue={defaultEdit?.sgstComponent} style={inputStyle} placeholder="Half of rate for intra-state" /></label>
            <label style={labelStyle}>IGST % <input name="igstComponent" type="number" step="0.01" defaultValue={defaultEdit?.igstComponent} style={inputStyle} placeholder="Full rate for inter-state" /></label>
            <label style={labelStyle}>Cess % <input name="cessComponent" type="number" step="0.01" defaultValue={defaultEdit?.cessComponent ?? 0} style={inputStyle} /></label>
          </div>
          <label style={{ ...labelStyle, marginTop: "16px" }}>Description <input name="description" defaultValue={defaultEdit?.description} style={inputStyle} /></label>
          <div style={{ marginTop: "20px", display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button type="button" className="button ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" className="button primary" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Saving..." : "Save Profile"}</button>
          </div>
        </form>
      )}

      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ background: "var(--layer-2)", borderBottom: "1px solid var(--border)" }}>
              {["Code", "Name", "Rate", "CGST", "SGST", "IGST", "Cess", "Status", ""].map(h => (
                <th key={h} style={{ padding: "14px 16px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profiles.length === 0 && <tr><td colSpan={9} style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>No tax profiles. Add GST 5%, 12%, 18% etc. to get started.</td></tr>}
            {profiles.map(p => (
              <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "14px 16px", fontFamily: "monospace", fontWeight: 700, color: "var(--primary)" }}>{p.code}</td>
                <td style={{ padding: "14px 16px", fontWeight: 500 }}>{p.name}</td>
                <td style={{ padding: "14px 16px", fontWeight: 700 }}>{p.rate}%</td>
                <td style={{ padding: "14px 16px", color: "var(--muted)", fontSize: "13px" }}>{p.cgstComponent}%</td>
                <td style={{ padding: "14px 16px", color: "var(--muted)", fontSize: "13px" }}>{p.sgstComponent}%</td>
                <td style={{ padding: "14px 16px", color: "var(--muted)", fontSize: "13px" }}>{p.igstComponent}%</td>
                <td style={{ padding: "14px 16px", color: "var(--muted)", fontSize: "13px" }}>{p.cessComponent}%</td>
                <td style={{ padding: "14px 16px" }}>
                  {p.active ? <span style={{ color: "var(--success)", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}><CheckCircle size={12} /> Active</span>
                    : <span style={{ color: "var(--muted)", fontSize: "12px" }}>Inactive</span>}
                </td>
                <td style={{ padding: "14px 16px", textAlign: "right", display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setEditing(p)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text)", padding: "6px" }}><Edit2 size={15} /></button>
                  <button type="button" onClick={() => { if (confirm("Deactivate this profile?")) deleteMutation.mutate(p.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: "6px" }}><XCircle size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HSNTab() {
  const client = useQueryClient();
  const [editing, setEditing] = useState<HSNEntry | "new" | null>(null);
  const { data: hsn = [], isLoading } = useQuery<HSNEntry[]>({ queryKey: ["hsn-master"], queryFn: () => api<HSNEntry[]>("/admin/tax/hsn") });
  const { data: profiles = [] } = useQuery<TaxProfile[]>({ queryKey: ["tax-profiles"], queryFn: () => api<TaxProfile[]>("/admin/tax/profiles") });

  const saveMutation = useMutation({
    mutationFn: (body: any) => editing && editing !== "new"
      ? api(`/admin/tax/hsn/${(editing as HSNEntry).id}`, { method: "PATCH", body: JSON.stringify(body) })
      : api("/admin/tax/hsn", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { client.invalidateQueries({ queryKey: ["hsn-master"] }); setEditing(null); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/tax/hsn/${id}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["hsn-master"] })
  });

  if (isLoading) return <Loading />;

  const defaultEdit = editing && editing !== "new" ? editing as HSNEntry : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 4px 0" }}>HSN Code Master</h3>
          <p style={{ color: "var(--muted)", margin: 0, fontSize: "13px" }}>Map HSN codes to tax profiles for GST invoicing</p>
        </div>
        <button type="button" className="button primary" onClick={() => setEditing("new")} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Plus size={16} /> Add HSN Code
        </button>
      </div>

      {editing && (
        <form className="panel" onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); saveMutation.mutate({ hsnCode: fd.get("hsnCode"), description: fd.get("description"), taxProfileId: fd.get("taxProfileId") || null }); }} style={{ border: "1px solid var(--primary)", background: "var(--layer-2)" }}>
          <h4 style={{ margin: "0 0 20px 0", color: "var(--primary)" }}>{defaultEdit ? "Edit HSN Code" : "Add HSN Code"}</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: "16px" }}>
            <label style={labelStyle}>HSN Code <input name="hsnCode" defaultValue={defaultEdit?.hsnCode} required style={inputStyle} placeholder="e.g. 62034200" /></label>
            <label style={labelStyle}>Description <input name="description" defaultValue={defaultEdit?.description} required style={inputStyle} placeholder="e.g. Men's cotton trousers" /></label>
            <label style={labelStyle}>
              Tax Profile
              <select name="taxProfileId" defaultValue={defaultEdit?.taxProfileId || ""} style={inputStyle}>
                <option value="">-- No profile --</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name} ({p.rate}%)</option>)}
              </select>
            </label>
          </div>
          <div style={{ marginTop: "20px", display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button type="button" className="button ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" className="button primary" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Saving..." : "Save HSN Code"}</button>
          </div>
        </form>
      )}

      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ background: "var(--layer-2)", borderBottom: "1px solid var(--border)" }}>
              {["HSN Code", "Description", "Tax Profile", "Rate", ""].map(h => (
                <th key={h} style={{ padding: "14px 16px", fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hsn.length === 0 && <tr><td colSpan={5} style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>No HSN codes added yet.</td></tr>}
            {hsn.map(h => (
              <tr key={h.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "14px 16px", fontFamily: "monospace", fontWeight: 700, color: "var(--primary)" }}>{h.hsnCode}</td>
                <td style={{ padding: "14px 16px" }}>{h.description}</td>
                <td style={{ padding: "14px 16px" }}>
                  {h.taxProfile ? <span style={{ padding: "4px 10px", background: "rgba(99,102,241,0.1)", color: "var(--primary)", borderRadius: "6px", fontSize: "12px", fontWeight: 600 }}>{h.taxProfile.code}</span> : <span style={{ color: "var(--muted)", fontSize: "12px" }}>—</span>}
                </td>
                <td style={{ padding: "14px 16px", fontWeight: 600 }}>{h.taxProfile ? `${h.taxProfile.rate}%` : "—"}</td>
                <td style={{ padding: "14px 16px", textAlign: "right", display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setEditing(h)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text)", padding: "6px" }}><Edit2 size={15} /></button>
                  <button type="button" onClick={() => { if (confirm("Delete?")) deleteMutation.mutate(h.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: "6px" }}><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TaxPage() {
  const [tab, setTab] = useState<"profiles" | "hsn">("profiles");

  return (
    <>
      <PageHead eyebrow="SYSTEM" title="Tax & GST Management" description="Configure GST tax profiles, HSN codes, and tax rates for GST-compliant invoicing." />

      <div style={{ padding: "16px", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "10px", marginBottom: "24px" }}>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", lineHeight: "1.6" }}>
          <strong style={{ color: "var(--text)" }}>How Tax Profiles Work:</strong> Create a profile (e.g. "GST 18%") with its CGST/SGST/IGST components.
          Then assign that profile to products either by Tax Profile ID in the product editor or by mapping HSN codes.
          The checkout engine will calculate and split tax automatically based on Place of Supply.
        </p>
      </div>

      <div className="tabs" style={{ marginBottom: "24px" }}>
        {(["profiles", "hsn"] as const).map(v => (
          <button key={v} className={tab === v ? "active" : ""} onClick={() => setTab(v)} style={{ textTransform: "capitalize" }}>{v === "profiles" ? "Tax Profiles (GST Slabs)" : "HSN Code Master"}</button>
        ))}
      </div>

      {tab === "profiles" && <TaxProfilesTab />}
      {tab === "hsn" && <HSNTab />}
    </>
  );
}
