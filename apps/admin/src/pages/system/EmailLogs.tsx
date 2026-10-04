import { useState, useEffect } from "react";
import { Mail, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { api } from "../../api";
import { PageHead, Loading } from "../../components/ui";

export default function EmailLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api<any>(`/admin/email-logs?page=${page}&limit=20`);
      setLogs(res.items);
      setTotalPages(res.pagination.pages);
    } catch (error) {
      console.error("Failed to load email logs", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SENT": return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 4, background: "rgba(16, 185, 129, 0.1)", color: "#10b981", fontSize: "12px", fontWeight: 600 }}><CheckCircle2 size={14}/> SENT</span>;
      case "PENDING": return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 4, background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", fontSize: "12px", fontWeight: 600 }}><Clock size={14}/> PENDING</span>;
      case "FAILED": return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 4, background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", fontSize: "12px", fontWeight: 600 }}><AlertCircle size={14}/> FAILED</span>;
      default: return <span style={{ padding: "4px 8px", borderRadius: 4, background: "var(--layer-3)", fontSize: "12px", fontWeight: 600 }}>{status}</span>;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <PageHead 
        eyebrow="System"
        title="Email Transaction Logs" 
        description="Monitor automated outbound emails to customers and administrators." 
      />

      <div style={{ background: "var(--layer-2)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ background: "var(--layer-3)", borderBottom: "1px solid var(--border)", fontSize: "12px", textTransform: "uppercase", color: "var(--muted)" }}>
              <th style={{ padding: "12px 16px", fontWeight: 600 }}>Job ID</th>
              <th style={{ padding: "12px 16px", fontWeight: 600 }}>Template</th>
              <th style={{ padding: "12px 16px", fontWeight: 600 }}>Recipient</th>
              <th style={{ padding: "12px 16px", fontWeight: 600 }}>Status</th>
              <th style={{ padding: "12px 16px", fontWeight: 600 }}>Timing</th>
              <th style={{ padding: "12px 16px", fontWeight: 600 }}>Errors</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center" }}><Loading /></td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>No email logs found.</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: "1px solid var(--border)", fontSize: "14px" }}>
                  <td style={{ padding: "12px 16px", fontFamily: "monospace", color: "var(--muted)" }}>
                    {log.id.slice(0, 8)}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Mail size={14} color="var(--muted)" />
                      {log.templateId}
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>{log.recipient}</td>
                  <td style={{ padding: "12px 16px" }}>{getStatusBadge(log.status)}</td>
                  <td style={{ padding: "12px 16px", fontSize: "12px", color: "var(--muted)" }}>
                    Scheduled: {new Date(log.scheduledAt).toLocaleString("en-IN")}<br/>
                    {log.sentAt ? `Sent: ${new Date(log.sentAt).toLocaleString("en-IN")}` : `Attempts: ${log.attempts}/${log.maxAttempts}`}
                  </td>
                  <td style={{ padding: "12px 16px", color: "#ef4444", fontSize: "12px", maxWidth: "200px" }}>
                    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={log.lastError}>
                      {log.lastError || "-"}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginTop: "16px" }}>
          <button 
            disabled={page === 1} 
            onClick={() => setPage(p => p - 1)}
            style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--layer-2)", color: "var(--text)", cursor: page === 1 ? "not-allowed" : "pointer" }}
          >
            Previous
          </button>
          <span style={{ display: "flex", alignItems: "center", fontSize: "14px", fontWeight: 500 }}>
            Page {page} of {totalPages}
          </span>
          <button 
            disabled={page === totalPages} 
            onClick={() => setPage(p => p + 1)}
            style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--layer-2)", color: "var(--text)", cursor: page === totalPages ? "not-allowed" : "pointer" }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
