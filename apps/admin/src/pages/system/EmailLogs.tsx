import { useState, useEffect, useCallback } from "react";
import {
  Mail,
  AlertCircle,
  CheckCircle2,
  Clock,
  Send,
  RefreshCw,
  Shield,
  Settings,
} from "lucide-react";
import { api } from "../../api";
import { PageHead, Loading } from "../../components/ui";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailStatus {
  provider: string;
  apiKeyConfigured: boolean;
  fromAddress: string | null;
  fromName: string;
  adminEmailConfigured: boolean;
  lastJob: {
    status: string;
    templateId: string;
    lastError: string | null;
    sentAt: string | null;
    createdAt: string;
  } | null;
}

interface EmailLog {
  id: string;
  eventType: string;
  recipient: string;
  templateId: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  scheduledAt: string;
  sentAt: string | null;
  createdAt: string;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, React.CSSProperties> = {
    SENT: { background: "rgba(16,185,129,0.1)", color: "#10b981" },
    PENDING: { background: "rgba(245,158,11,0.1)", color: "#f59e0b" },
    FAILED: { background: "rgba(239,68,68,0.1)", color: "#ef4444" },
    PROCESSING: { background: "rgba(99,102,241,0.1)", color: "#6366f1" },
  };
  const icons: Record<string, React.ReactNode> = {
    SENT: <CheckCircle2 size={12} />,
    PENDING: <Clock size={12} />,
    FAILED: <AlertCircle size={12} />,
    PROCESSING: <RefreshCw size={12} />,
  };
  const style = styles[status] ?? { background: "var(--layer-3)", color: "var(--muted)" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        borderRadius: 4,
        fontSize: "11px",
        fontWeight: 600,
        ...style,
      }}
    >
      {icons[status]}
      {status}
    </span>
  );
}

// ─── Diagnostics Panel ────────────────────────────────────────────────────────

function DiagnosticsPanel() {
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api<EmailStatus>("/admin/email/status");
      setStatus(res);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const sendTest = async () => {
    if (!testEmail.trim()) return;
    setSending(true);
    setTestResult(null);
    try {
      await api("/admin/email/test", {
        method: "POST",
        body: JSON.stringify({ email: testEmail.trim() }),
      });
      setTestResult({ ok: true, message: `Test email sent to ${testEmail}` });
    } catch (err: any) {
      setTestResult({ ok: false, message: err?.message || "Failed to send test email." });
    } finally {
      setSending(false);
    }
  };

  const providerColor =
    status?.provider === "resend" && status.apiKeyConfigured && status.fromAddress
      ? "#10b981"
      : status?.provider === "none"
      ? "#f59e0b"
      : "#ef4444";

  const providerLabel =
    status?.provider === "none"
      ? "Not Configured"
      : status?.provider?.toUpperCase() ?? "Unknown";

  return (
    <div
      style={{
        background: "var(--layer-2)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Shield size={18} color="var(--muted)" />
          <span style={{ fontWeight: 600, fontSize: 15 }}>Email System Status</span>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "4px 10px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--muted)",
          }}
        >
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {loading ? (
        <Loading />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Provider card */}
          <div
            style={{
              background: "var(--layer-3)",
              borderRadius: 8,
              padding: "14px 16px",
              border: `1px solid ${providerColor}30`,
            }}
          >
            <p style={{ margin: "0 0 4px", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", fontWeight: 600 }}>
              Provider
            </p>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: providerColor }}>
              {providerLabel}
            </p>
            {status?.fromAddress && (
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                {status.fromName} &lt;{status.fromAddress}&gt;
              </p>
            )}
          </div>

          {/* Config health */}
          <div
            style={{
              background: "var(--layer-3)",
              borderRadius: 8,
              padding: "14px 16px",
              border: "1px solid var(--border)",
            }}
          >
            <p style={{ margin: "0 0 8px", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", fontWeight: 600 }}>
              Configuration
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[
                { label: "API Key", ok: status?.apiKeyConfigured ?? false },
                { label: "From Address", ok: Boolean(status?.fromAddress) },
                { label: "Admin Email", ok: status?.adminEmailConfigured ?? false },
              ].map(({ label, ok }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  {ok ? (
                    <CheckCircle2 size={13} color="#10b981" />
                  ) : (
                    <AlertCircle size={13} color="#f59e0b" />
                  )}
                  <span style={{ color: ok ? "var(--text)" : "#f59e0b" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Last job */}
          {status?.lastJob && (
            <div
              style={{
                background: "var(--layer-3)",
                borderRadius: 8,
                padding: "14px 16px",
                border: "1px solid var(--border)",
                gridColumn: "1 / -1",
              }}
            >
              <p style={{ margin: "0 0 6px", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", fontWeight: 600 }}>
                Last Email Job
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <StatusBadge status={status.lastJob.status} />
                <span style={{ fontSize: 13, fontFamily: "monospace", color: "var(--muted)" }}>
                  {status.lastJob.templateId}
                </span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {new Date(status.lastJob.createdAt).toLocaleString("en-IN")}
                </span>
                {status.lastJob.lastError && (
                  <span style={{ fontSize: 12, color: "#ef4444" }}>{status.lastJob.lastError}</span>
                )}
              </div>
            </div>
          )}

          {/* Send test email */}
          <div
            style={{
              background: "var(--layer-3)",
              borderRadius: 8,
              padding: "14px 16px",
              border: "1px solid var(--border)",
              gridColumn: "1 / -1",
            }}
          >
            <p style={{ margin: "0 0 10px", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              <Settings size={12} />
              Send Test Email
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="email"
                placeholder="recipient@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendTest()}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--layer-2)",
                  color: "var(--text)",
                  fontSize: 13,
                }}
              />
              <button
                onClick={sendTest}
                disabled={sending || !testEmail.trim()}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "#18181b",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: sending || !testEmail.trim() ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  opacity: sending || !testEmail.trim() ? 0.6 : 1,
                }}
              >
                <Send size={13} />
                {sending ? "Sending…" : "Send Test"}
              </button>
            </div>
            {testResult && (
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 13,
                  color: testResult.ok ? "#10b981" : "#ef4444",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {testResult.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                {testResult.message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EmailLogs() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
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
  }, [page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <PageHead
        eyebrow="System"
        title="Email Transaction Logs"
        description="Monitor automated outbound emails to customers and administrators."
      />

      {/* Diagnostics + Test Panel */}
      <DiagnosticsPanel />

      {/* Logs Table */}
      <div
        style={{
          background: "var(--layer-2)",
          borderRadius: "12px",
          border: "1px solid var(--border)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Mail size={15} color="var(--muted)" />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Outbox Log</span>
          </div>
          <button
            onClick={fetchLogs}
            disabled={loading}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "4px 10px",
              cursor: "pointer",
              fontSize: 12,
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <RefreshCw size={11} />
            Refresh
          </button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr
              style={{
                background: "var(--layer-3)",
                borderBottom: "1px solid var(--border)",
                fontSize: "12px",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              <th style={{ padding: "10px 16px", fontWeight: 600 }}>Job ID</th>
              <th style={{ padding: "10px 16px", fontWeight: 600 }}>Template</th>
              <th style={{ padding: "10px 16px", fontWeight: 600 }}>Recipient</th>
              <th style={{ padding: "10px 16px", fontWeight: 600 }}>Status</th>
              <th style={{ padding: "10px 16px", fontWeight: 600 }}>Timing</th>
              <th style={{ padding: "10px 16px", fontWeight: 600 }}>Error</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: "40px", textAlign: "center" }}>
                  <Loading />
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
                  No email logs found.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: "1px solid var(--border)", fontSize: "14px" }}>
                  <td style={{ padding: "11px 16px", fontFamily: "monospace", color: "var(--muted)", fontSize: 12 }}>
                    {log.id.slice(0, 8)}
                  </td>
                  <td style={{ padding: "11px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Mail size={13} color="var(--muted)" />
                      <span style={{ fontFamily: "monospace", fontSize: 12 }}>{log.templateId}</span>
                    </div>
                  </td>
                  <td style={{ padding: "11px 16px", fontSize: 13 }}>{log.recipient}</td>
                  <td style={{ padding: "11px 16px" }}>
                    <StatusBadge status={log.status} />
                  </td>
                  <td style={{ padding: "11px 16px", fontSize: 12, color: "var(--muted)" }}>
                    {new Date(log.scheduledAt).toLocaleString("en-IN")}
                    {log.sentAt && (
                      <>
                        <br />
                        <span style={{ color: "#10b981" }}>
                          Sent: {new Date(log.sentAt).toLocaleString("en-IN")}
                        </span>
                      </>
                    )}
                    {!log.sentAt && (
                      <>
                        <br />
                        Attempts: {log.attempts}/{log.maxAttempts}
                      </>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "11px 16px",
                      color: "#ef4444",
                      fontSize: 12,
                      maxWidth: "200px",
                    }}
                  >
                    <div
                      style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                      title={log.lastError ?? ""}
                    >
                      {log.lastError || "—"}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--layer-2)",
              color: "var(--text)",
              cursor: page === 1 ? "not-allowed" : "pointer",
            }}
          >
            Previous
          </button>
          <span style={{ display: "flex", alignItems: "center", fontSize: "14px", fontWeight: 500 }}>
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--layer-2)",
              color: "var(--text)",
              cursor: page === totalPages ? "not-allowed" : "pointer",
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
