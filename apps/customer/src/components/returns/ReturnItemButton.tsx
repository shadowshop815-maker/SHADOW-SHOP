import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, RefreshCcw } from "lucide-react";
import { api } from "../../api";
import { Spinner } from "../ui";

export function ReturnItemButton({ order, item }: { order: any, item: any }) {
  const client = useQueryClient();
  const [modal, setModal] = useState(false);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [qty, setQty] = useState(item.quantity);
  const [resolution, setResolution] = useState("");
  const [upiId, setUpiId] = useState("");
  
  const { data: eligibility, isLoading } = useQuery({
    queryKey: ["return-eligibility", order.id, item.id],
    queryFn: () => api<any>(`/returns/eligibility/${order.id}/${item.id}`),
    enabled: !!order && !!item && item.itemStatus === "DELIVERED"
  });
  
  const [timeLeft, setTimeLeft] = useState("");
  const [expired, setExpired] = useState(false);
  
  useEffect(() => {
    if (!eligibility?.eligible) return;
    
    const calculateTimeLeft = () => {
      const remainingMs = new Date(eligibility.deadline).getTime() - Date.now();
      if (remainingMs <= 0) {
        setExpired(true);
        setTimeLeft("Window Expired");
        return;
      }
      
      const d = Math.floor(remainingMs / 86400000);
      const h = Math.floor((remainingMs % 86400000) / 3600000);
      const m = Math.floor((remainingMs % 3600000) / 60000);
      const s = Math.floor((remainingMs % 60000) / 1000);
      
      let timeString = "";
      if (d > 0) timeString += `${d}d `;
      if (h > 0 || d > 0) timeString += `${h}h `;
      timeString += `${m}m ${s}s`;
      
      setTimeLeft(timeString);
    };
    
    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [eligibility]);
  
  const submit = useMutation({
    mutationFn: () => api(`/returns`, {
      method: "POST",
      body: JSON.stringify({
        orderId: order.id,
        orderItemId: item.id,
        quantity: qty,
        reason,
        comment,
        upiId,
        resolution: resolution || (eligibility?.settings?.allowedReturnResolutions?.[0] ?? "REFUND")
      })
    }),
    onSuccess: () => {
      setModal(false);
      client.invalidateQueries({ queryKey: ["return-eligibility", order.id, item.id] });
      client.invalidateQueries({ queryKey: ["order", order.id] });
    }
  });

  if (item.itemStatus?.startsWith("RETURN_")) {
    return <span className="status text-gold">Return {item.itemStatus.split("_").slice(1).join(" ")}</span>;
  }
  
  if (item.itemStatus === "RETURN_REQUESTED" || eligibility?.existingReturnRequest) {
    return <span className="status text-gold">Return Requested</span>;
  }
  
  if (isLoading) return <Spinner />;
  
  if (!eligibility || !eligibility.eligible) {
    if (eligibility?.reason === "RETURN_WINDOW_EXPIRED") {
      return <span className="text-muted" style={{ fontSize: 13 }}>Return window ended</span>;
    }
    return null;
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {!expired && (
          <span style={{ fontSize: 13, color: "var(--gold)", display: "flex", alignItems: "center", gap: 4 }}>
            <Clock size={14} /> Return window closes in: {timeLeft}
          </span>
        )}
        <button 
          type="button" 
          className="outline-button" 
          disabled={expired}
          onClick={() => setModal(true)}
          style={{ padding: "6px 12px", fontSize: 12 }}
        >
          <RefreshCcw size={14} /> Return Item
        </button>
      </div>
      
      {modal && (
        <div 
          onClick={() => setModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px"
          }}
        >
          <div 
            className="panel"
            onClick={e => e.stopPropagation()} 
            style={{
              padding: "35px",
              width: "100%",
              maxWidth: "500px",
              position: "relative"
            }}
          >
            <h3 style={{ margin: "0 0 10px", fontSize: "28px", color: "var(--text)" }}>Request Return</h3>
            <p style={{ margin: "0 0 25px", color: "var(--muted)", fontSize: "15px", lineHeight: 1.5 }}>
              You are requesting a return for <b style={{ color: "var(--text)" }}>{item.productNameSnapshot}</b>. Please provide the details below.
            </p>
            
            {eligibility?.settings?.allowPartialReturns && item.quantity > 1 && (
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Quantity to Return</label>
                <select 
                  value={qty} 
                  onChange={e => setQty(Number(e.target.value))} 
                  style={{ width: "100%", padding: "14px", borderRadius: "12px", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", fontSize: "15px", outline: "none", appearance: "none" }}
                >
                  {Array.from({ length: item.quantity }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            )}
            
            {eligibility?.settings?.allowedReturnResolutions?.length > 1 && (
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Preferred Resolution</label>
                <select 
                  value={resolution || eligibility.settings.allowedReturnResolutions[0]} 
                  onChange={e => setResolution(e.target.value)} 
                  style={{ width: "100%", padding: "14px", borderRadius: "12px", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", fontSize: "15px", outline: "none", appearance: "none" }}
                >
                  {eligibility.settings.allowedReturnResolutions.map((res: string) => (
                    <option key={res} value={res}>{res.charAt(0) + res.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
            )}
            
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Reason for return {eligibility?.settings?.requireReturnReason ? "*" : "(Optional)"}</label>
              <select 
                value={reason} 
                onChange={e => setReason(e.target.value)} 
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "12px",
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  fontSize: "15px",
                  outline: "none",
                  appearance: "none"
                }}
              >
                <option value="">Select a reason...</option>
                <option value="Damaged/Defective">Damaged or Defective</option>
                <option value="Wrong Item">Received Wrong Item</option>
                <option value="Size Issue">Size Issue</option>
                <option value="Not as expected">Not as expected</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            {(resolution || eligibility?.settings?.allowedReturnResolutions?.[0]) === "REFUND" && (
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>UPI ID for Refund *</label>
                <input 
                  type="text"
                  value={upiId} 
                  onChange={e => setUpiId(e.target.value)} 
                  placeholder="e.g. 9876543210@ybl"
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: "12px",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    fontSize: "15px",
                    outline: "none"
                  }}
                />
              </div>
            )}
            
            {eligibility?.settings?.allowReturnComment && (
              <div style={{ marginBottom: "30px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Additional Comments</label>
                <textarea 
                  value={comment} 
                  onChange={e => setComment(e.target.value)} 
                  placeholder="Please provide any details..."
                  style={{
                    width: "100%",
                    minHeight: "100px",
                    padding: "14px",
                    borderRadius: "12px",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    fontSize: "15px",
                    outline: "none",
                    resize: "vertical"
                  }}
                />
              </div>
            )}
            
            <div style={{ display: "flex", gap: "12px" }}>
              <button 
                type="button" 
                disabled={(eligibility?.settings?.requireReturnReason && !reason) || ((resolution || eligibility?.settings?.allowedReturnResolutions?.[0]) === "REFUND" && !upiId.trim()) || submit.isPending}
                onClick={() => submit.mutate()}
                className="button"
                style={{ flex: 1, padding: "16px", borderRadius: "12px", opacity: ((eligibility?.settings?.requireReturnReason && !reason) || ((resolution || eligibility?.settings?.allowedReturnResolutions?.[0]) === "REFUND" && !upiId.trim()) || submit.isPending) ? 0.5 : 1 }}
              >
                {submit.isPending ? <Spinner /> : "Submit Request"}
              </button>
              <button 
                type="button" 
                onClick={() => setModal(false)}
                className="outline-button"
                style={{ padding: "16px 25px", borderRadius: "12px" }}
              >
                Cancel
              </button>
            </div>
            {submit.error && <p style={{ marginTop: "20px", color: "#FF453A", fontSize: "14px", fontWeight: 500 }}>{(submit.error as any).message}</p>}
          </div>
        </div>
      )}
    </>
  );
}
