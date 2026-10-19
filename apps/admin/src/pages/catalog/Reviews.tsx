import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Star,
  CheckCircle2,
  Eye,
  EyeOff,
  Check,
  X,
  RotateCcw,
  MessageSquare,
  RefreshCw,
  Search,
  Filter,
  Trash2,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { api, resolveImageUrl } from "../../api";
import { PageHead, Loading, ErrorState, Empty, Pager, Modal, type Pagination } from "../../components/ui";

interface AdminReview {
  id: string;
  productId: string;
  customerId: string;
  rating: number;
  title: string | null;
  comment: string | null;
  status: "PUBLISHED" | "PENDING" | "HIDDEN" | "REJECTED";
  isVerified: boolean;
  purchasedSize: string | null;
  purchasedColor: string | null;
  fit: string | null;
  fabricQuality: string | null;
  comfort: string | null;
  helpfulCount: number;
  notHelpfulCount: number;
  createdAt: string;
  product: { id: string; name: string; slug: string; thumbnail: string };
  customer: { id: string; name: string; email: string; phone: string | null };
  images: { id: string; url: string; sortOrder: number }[];
  replies: { id: string; replyText: string; createdAt: string; admin: { id: string; name: string } }[];
  moderationAudits: { id: string; action: string; reason: string | null; createdAt: string; admin: { id: string; name: string } }[];
}

interface ReviewMetrics {
  total: number;
  published: number;
  pending: number;
  hidden: number;
  rejected: number;
  storeAverage: number;
}

export function Reviews() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("ALL");
  const [rating, setRating] = useState<number | "">("");
  const [search, setSearch] = useState("");

  // Modals
  const [selectedReview, setSelectedReview] = useState<AdminReview | null>(null);
  const [replyingReview, setReplyingReview] = useState<AdminReview | null>(null);
  const [replyText, setReplyText] = useState("");
  const [moderatingReason, setModeratingReason] = useState("");

  // 1. Fetch Metrics
  const { data: metrics } = useQuery<ReviewMetrics>({
    queryKey: ["admin-review-metrics"],
    queryFn: () => api<ReviewMetrics>("/admin/reviews/metrics"),
  });

  // 2. Fetch Paginated Reviews
  const queryParams = new URLSearchParams({
    page: String(page),
    limit: "15",
    ...(status && status !== "ALL" ? { status } : {}),
    ...(rating ? { rating: String(rating) } : {}),
    ...(search ? { search } : {}),
  });

  const { data, isLoading, error } = useQuery<{
    items: AdminReview[];
    pagination: Pagination;
  }>({
    queryKey: ["admin-reviews", page, status, rating, search],
    queryFn: () => api(`/admin/reviews?${queryParams.toString()}`),
  });

  // 3. Status Change Mutation
  const statusMutation = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      api(`/admin/reviews/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["admin-review-metrics"] });
      if (selectedReview) setSelectedReview(null);
    },
  });

  // 4. Official Reply Mutation
  const replyMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      api(`/admin/reviews/${id}/reply`, {
        method: "POST",
        body: JSON.stringify({ text }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      setReplyingReview(null);
      setReplyText("");
    },
  });

  // 5. Delete Inappropriate Photo Mutation
  const deletePhotoMutation = useMutation({
    mutationFn: ({ reviewId, imageId }: { reviewId: string; imageId: string }) =>
      api(`/admin/reviews/${reviewId}/images/${imageId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      if (selectedReview) setSelectedReview(null);
    },
  });

  // 6. Recalculate All Ratings Maintenance
  const recalculateMutation = useMutation({
    mutationFn: () => api("/admin/reviews/recalculate-all", { method: "POST" }),
    onSuccess: (res: any) => {
      alert(res.message || "All product ratings successfully recalculated!");
      queryClient.invalidateQueries({ queryKey: ["admin-review-metrics"] });
    },
  });

  const handleStatusChange = (id: string, targetStatus: string) => {
    const reason = prompt(`Enter reason for updating review to ${targetStatus} (optional):`) || "";
    statusMutation.mutate({ id, status: targetStatus, reason });
  };

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyingReview || !replyText.trim()) return;
    replyMutation.mutate({ id: replyingReview.id, text: replyText.trim() });
  };

  return (
    <div className="admin-page-container">
      <PageHead
        eyebrow="CATALOG &amp; COMMUNITY"
        title="Customer Ratings &amp; Reviews"
        description="Inspect customer reviews, verify purchases, moderate inappropriate content, reply officially, and audit review history."
        action={
          <button
            type="button"
            className="outline-button"
            onClick={() => {
              if (confirm("Recalculate ratings across all products in the database?")) {
                recalculateMutation.mutate();
              }
            }}
            disabled={recalculateMutation.isPending}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
          >
            <RefreshCw size={15} className={recalculateMutation.isPending ? "spin" : ""} />
            <span>{recalculateMutation.isPending ? "Recalculating..." : "Recalculate All Ratings"}</span>
          </button>
        }
      />

      {/* Metrics Row */}
      {metrics && (
        <div className="admin-stats-grid" style={{ marginBottom: "28px" }}>
          <div className="stat-card">
            <span>Total Reviews</span>
            <strong>{metrics.total.toLocaleString("en-IN")}</strong>
            <small>All time feedback</small>
          </div>
          <div className="stat-card">
            <span>Published</span>
            <strong style={{ color: "#059669" }}>{metrics.published.toLocaleString("en-IN")}</strong>
            <small>Live on storefront</small>
          </div>
          <div className="stat-card">
            <span>Pending</span>
            <strong style={{ color: "#2563eb" }}>{metrics.pending.toLocaleString("en-IN")}</strong>
            <small>Awaiting review</small>
          </div>
          <div className="stat-card">
            <span>Hidden / Flagged</span>
            <strong style={{ color: "#f59e0b" }}>{metrics.hidden.toLocaleString("en-IN")}</strong>
            <small>Hidden from store</small>
          </div>
          <div className="stat-card">
            <span>Average Store Rating</span>
            <strong style={{ color: "var(--gold)" }}>
              ★ {metrics.storeAverage > 0 ? metrics.storeAverage.toFixed(1) : "N/A"}
            </strong>
            <small>Across active products</small>
          </div>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="admin-toolbar" style={{ display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "center", marginBottom: "24px" }}>
        {/* Status Pills */}
        <div className="status-tabs-pill" style={{ display: "flex", gap: "6px" }}>
          {["ALL", "PUBLISHED", "PENDING", "HIDDEN", "REJECTED"].map((st) => (
            <button
              key={st}
              type="button"
              className={`filter-btn ${status === st ? "active" : ""}`}
              onClick={() => { setStatus(st); setPage(1); }}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Rating Select */}
        <select
          value={rating}
          onChange={(e) => { setRating(e.target.value ? Number(e.target.value) : ""); setPage(1); }}
          className="admin-select"
          style={{ minWidth: "130px" }}
        >
          <option value="">All Stars</option>
          <option value="5">5 Stars (Excellent)</option>
          <option value="4">4 Stars (Good)</option>
          <option value="3">3 Stars (Average)</option>
          <option value="2">2 Stars (Fair)</option>
          <option value="1">1 Star (Poor)</option>
        </select>

        {/* Search Field */}
        <div className="search-field" style={{ flex: 1, minWidth: "240px" }}>
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by customer name, email, review title, or product..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Main Table */}
      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error as Error} />
      ) : !data?.items || data.items.length === 0 ? (
        <Empty label="No reviews match your filters." />
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Customer</th>
                <th>Rating</th>
                <th>Review Preview</th>
                <th>Photos</th>
                <th>Status</th>
                <th>Date</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => {
                const statusColors: Record<string, string> = {
                  PUBLISHED: "#059669",
                  PENDING: "#2563eb",
                  HIDDEN: "#f59e0b",
                  REJECTED: "#dc2626",
                };

                return (
                  <tr key={r.id}>
                    {/* Product */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <img
                          src={resolveImageUrl(r.product.thumbnail)}
                          alt={r.product.name}
                          style={{ width: "40px", height: "40px", borderRadius: "8px", objectFit: "cover" }}
                        />
                        <div>
                          <strong style={{ fontSize: "13px", display: "block" }}>{r.product.name}</strong>
                          <small style={{ color: "var(--muted)" }}>{r.product.slug}</small>
                        </div>
                      </div>
                    </td>

                    {/* Customer */}
                    <td>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <span style={{ fontWeight: 600 }}>{r.customer.name}</span>
                          {r.isVerified && (
                            <span title="Verified Buyer" style={{ display: "inline-flex", alignItems: "center" }}>
                              <CheckCircle2 size={13} color="#059669" />
                            </span>
                          )}
                        </div>
                        <small style={{ color: "var(--muted)", display: "block" }}>{r.customer.email}</small>
                      </div>
                    </td>

                    {/* Star Rating */}
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          background: r.rating >= 4 ? "#388e3c" : r.rating === 3 ? "#f57c00" : "#d32f2f",
                          color: "#fff",
                          fontWeight: 700,
                          borderRadius: "4px",
                          padding: "2px 7px",
                          fontSize: "12px",
                        }}
                      >
                        {r.rating} ★
                      </span>
                    </td>

                    {/* Review Preview */}
                    <td style={{ maxWidth: "260px" }}>
                      {r.title && <strong style={{ fontSize: "12.5px", display: "block" }}>{r.title}</strong>}
                      <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.comment || "(No written text)"}
                      </p>
                      {r.replies && r.replies.length > 0 && (
                        <small style={{ color: "var(--gold)", fontWeight: 700, display: "block", marginTop: "2px" }}>
                          ✓ Store Replied
                        </small>
                      )}
                    </td>

                    {/* Photos */}
                    <td>
                      {r.images.length > 0 ? (
                        <div style={{ display: "flex", gap: "4px" }}>
                          {r.images.slice(0, 2).map((img) => (
                            <img
                              key={img.id}
                              src={resolveImageUrl(img.url)}
                              alt="Customer attachment"
                              style={{ width: "32px", height: "32px", borderRadius: "6px", objectFit: "cover" }}
                            />
                          ))}
                          {r.images.length > 2 && (
                            <span style={{ fontSize: "11px", fontWeight: 700, alignSelf: "center", color: "var(--muted)" }}>
                              +{r.images.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "var(--muted)", fontSize: "12px" }}>—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 9px",
                          borderRadius: "99px",
                          fontSize: "11px",
                          fontWeight: 700,
                          color: statusColors[r.status] || "var(--text)",
                          background: `${statusColors[r.status] || "#888"}18`,
                        }}
                      >
                        {r.status}
                      </span>
                    </td>

                    {/* Date */}
                    <td>
                      <small style={{ color: "var(--muted)" }}>
                        {new Date(r.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </small>
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <button
                          type="button"
                          className="icon-btn-table"
                          title="View Details"
                          onClick={() => setSelectedReview(r)}
                        >
                          <Eye size={15} />
                        </button>

                        {r.status !== "PUBLISHED" && (
                          <button
                            type="button"
                            className="icon-btn-table"
                            title="Approve / Publish"
                            style={{ color: "#059669" }}
                            onClick={() => handleStatusChange(r.id, "PUBLISHED")}
                          >
                            <Check size={15} />
                          </button>
                        )}

                        {r.status === "PUBLISHED" && (
                          <button
                            type="button"
                            className="icon-btn-table"
                            title="Hide Review"
                            style={{ color: "#f59e0b" }}
                            onClick={() => handleStatusChange(r.id, "HIDDEN")}
                          >
                            <EyeOff size={15} />
                          </button>
                        )}

                        {r.status === "HIDDEN" && (
                          <button
                            type="button"
                            className="icon-btn-table"
                            title="Restore Review"
                            style={{ color: "#059669" }}
                            onClick={() => handleStatusChange(r.id, "PUBLISHED")}
                          >
                            <RotateCcw size={15} />
                          </button>
                        )}

                        {r.status !== "REJECTED" && (
                          <button
                            type="button"
                            className="icon-btn-table"
                            title="Reject Review"
                            style={{ color: "var(--danger)" }}
                            onClick={() => handleStatusChange(r.id, "REJECTED")}
                          >
                            <X size={15} />
                          </button>
                        )}

                        <button
                          type="button"
                          className="icon-btn-table"
                          title="Add Store Reply"
                          onClick={() => {
                            setReplyingReview(r);
                            setReplyText(r.replies[0]?.replyText || "");
                          }}
                        >
                          <MessageSquare size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {data.pagination.pages > 1 && (
            <Pager value={data.pagination} onChange={setPage} />
          )}
        </div>
      )}

      {/* ── MODAL: View Full Review Details ──────────────────────────────── */}
      {selectedReview && (
        <Modal title="Review Details &amp; Moderation" onClose={() => setSelectedReview(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Header info */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px" }}>{selectedReview.product.name}</h3>
                <small style={{ color: "var(--muted)" }}>SKU: {selectedReview.product.slug}</small>
              </div>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  background: selectedReview.rating >= 4 ? "#388e3c" : "#f57c00",
                  color: "#fff",
                  fontWeight: 700,
                  borderRadius: "4px",
                  padding: "4px 10px",
                  fontSize: "14px",
                }}
              >
                {selectedReview.rating} ★
              </span>
            </div>

            {/* Customer Box */}
            <div style={{ background: "var(--layer-2)", padding: "14px 18px", borderRadius: "12px", fontSize: "13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Customer: <b>{selectedReview.customer.name}</b></span>
                {selectedReview.isVerified && <span style={{ color: "#059669", fontWeight: 700 }}>✓ Verified Buyer</span>}
              </div>
              <div style={{ color: "var(--muted)", marginTop: "4px" }}>
                Email: {selectedReview.customer.email} {selectedReview.customer.phone ? `· Phone: ${selectedReview.customer.phone}` : ""}
              </div>
              {(selectedReview.purchasedSize || selectedReview.purchasedColor) && (
                <div style={{ marginTop: "6px" }}>
                  Purchased Variant: <b>{selectedReview.purchasedSize} / {selectedReview.purchasedColor}</b>
                </div>
              )}
            </div>

            {/* Review Title & Body */}
            <div>
              {selectedReview.title && (
                <h4 style={{ margin: "0 0 6px", fontSize: "15px" }}>{selectedReview.title}</h4>
              )}
              <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.7", whiteSpace: "pre-wrap" }}>
                {selectedReview.comment || "(No written text provided)"}
              </p>
            </div>

            {/* Photos */}
            {selectedReview.images.length > 0 && (
              <div>
                <label style={{ fontWeight: 700, fontSize: "13px", display: "block", marginBottom: "8px" }}>
                  Attached Customer Photos ({selectedReview.images.length})
                </label>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  {selectedReview.images.map((img) => (
                    <div key={img.id} style={{ position: "relative", width: "90px", height: "90px", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)" }}>
                      <img src={resolveImageUrl(img.url)} alt="Attachment" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("Delete this inappropriate photo from review?")) {
                            deletePhotoMutation.mutate({ reviewId: selectedReview.id, imageId: img.id });
                          }
                        }}
                        style={{
                          position: "absolute",
                          top: "4px",
                          right: "4px",
                          background: "rgba(220, 38, 38, 0.9)",
                          border: "none",
                          borderRadius: "50%",
                          width: "24px",
                          height: "24px",
                          color: "#fff",
                          display: "grid",
                          placeItems: "center",
                          cursor: "pointer",
                        }}
                        title="Remove photo"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audit History */}
            {selectedReview.moderationAudits.length > 0 && (
              <div>
                <label style={{ fontWeight: 700, fontSize: "13px", display: "block", marginBottom: "6px" }}>
                  Moderation Audit Trail
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "var(--muted)" }}>
                  {selectedReview.moderationAudits.map((a) => (
                    <div key={a.id} style={{ background: "var(--layer-2)", padding: "8px 12px", borderRadius: "6px" }}>
                      <b>{a.action}</b> by {a.admin.name} on {new Date(a.createdAt).toLocaleString("en-IN")}
                      {a.reason && <span> — Reason: "{a.reason}"</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
              {selectedReview.status !== "PUBLISHED" && (
                <button
                  type="button"
                  className="button"
                  style={{ background: "#059669" }}
                  onClick={() => handleStatusChange(selectedReview.id, "PUBLISHED")}
                >
                  Publish Review
                </button>
              )}
              {selectedReview.status === "PUBLISHED" && (
                <button
                  type="button"
                  className="outline-button"
                  style={{ borderColor: "#f59e0b", color: "#f59e0b" }}
                  onClick={() => handleStatusChange(selectedReview.id, "HIDDEN")}
                >
                  Hide Review
                </button>
              )}
              {selectedReview.status !== "REJECTED" && (
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => handleStatusChange(selectedReview.id, "REJECTED")}
                >
                  Reject Spam
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL: Store Official Reply ──────────────────────────────────── */}
      {replyingReview && (
        <Modal title="Official Store Response" onClose={() => setReplyingReview(null)}>
          <form onSubmit={handleReplySubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <p style={{ margin: "0 0 8px", fontSize: "13px", color: "var(--muted)" }}>
                Replying to <b>{replyingReview.customer.name}</b>'s review on <b>{replyingReview.product.name}</b>
              </p>
              <div style={{ background: "var(--layer-2)", padding: "12px 14px", borderRadius: "8px", fontSize: "13px", fontStyle: "italic", marginBottom: "16px" }}>
                "{replyingReview.comment || replyingReview.title || `${replyingReview.rating} Stars`}"
              </div>
            </div>

            <div>
              <label style={{ fontWeight: 700, fontSize: "13.5px", display: "block", marginBottom: "6px" }}>
                Store Reply Message
              </label>
              <textarea
                rows={4}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Thank the customer, explain care instructions, or resolve any sizing queries..."
                className="admin-textarea"
                required
                maxLength={2000}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
              <button type="button" className="outline-button" onClick={() => setReplyingReview(null)}>
                Cancel
              </button>
              <button type="submit" className="button" disabled={replyMutation.isPending}>
                {replyMutation.isPending ? "Posting Reply..." : "Post Official Response"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
