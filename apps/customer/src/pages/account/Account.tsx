import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  MapPin,
  ShoppingBag,
  Star,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Clock,
  PackageCheck,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { api, money, resolveImageUrl } from "../../api";
import type { Order, Address, MyReviewItem, EligibleReviewItem } from "../../types";
import { useAuth } from "../../features/auth/AuthContext";
import { Spinner, Status } from "../../components/ui";
import { blankAddress, AddressFields } from "../../components/location/LocationPicker";
import { StaggerContainer, StaggerItem } from "../../components/motion/Motion";
import { fetchMyReviews, fetchMyEligibleItems } from "../../services/reviewStore";
import { ReviewFormModal } from "../../components/reviews/ReviewFormModal";

function OrderCard({ order }: { order: Order }) {
  return (
    <article
      className="order-card"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "16px",
      }}
    >
      <div>
        <span className="eyebrow" style={{ color: "var(--gold)", fontSize: "11px", marginBottom: "4px" }}>
          PLACED {new Date(order.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
        </span>
        <h3 style={{ margin: "4px 0 6px 0", fontSize: "18px", color: "var(--text)" }}>
          Order #{order.orderNumber}
        </h3>
        <p style={{ margin: 0, fontSize: "13.5px", color: "var(--muted)" }}>
          {order.items.length} item{order.items.length > 1 ? "s" : ""} · Total:{" "}
          <strong style={{ color: "var(--text)" }}>{money(order.grandTotal)}</strong>
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <span className={`status ${order.orderStatus.toLowerCase()}`}>
          {order.orderStatus.replaceAll("_", " ")}
        </span>
        <Link to={`/account/orders/${order.id}`} className="button ghost" style={{ padding: "10px 18px", fontSize: "13px" }}>
          <span>Order Details</span>
          <ChevronRight size={15} />
        </Link>
      </div>
    </article>
  );
}

export function Account() {
  const auth = useAuth();
  const client = useQueryClient();
  const [tab, setTab] = useState("orders");
  const [reviewSubTab, setReviewSubTab] = useState<"to_review" | "reviewed">("to_review");

  // Orders Query
  const { data: orders, isLoading: loadingOrders } = useQuery({
    queryKey: ["orders"],
    queryFn: () => api<Order[]>("/orders"),
  });

  // Addresses Query
  const { data: addresses } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => api<Address[]>("/addresses"),
  });
  const [address, setAddress] = useState<Address>(blankAddress);

  useEffect(() => {
    if (auth.user && (!address.fullName || !address.phone)) {
      setAddress((prev) => ({
        ...prev,
        fullName: prev.fullName || auth.user?.name || "",
        phone: prev.phone || auth.user?.phone || "",
      }));
    }
  }, [auth.user]);

  const addressMutation = useMutation({
    mutationFn: () => api<Address>("/addresses", { method: "POST", body: JSON.stringify(address) }),
    onSuccess: () => {
      setAddress(blankAddress);
      client.invalidateQueries({ queryKey: ["addresses"] });
    },
  });

  // Profile Mutation
  const profileMutation = useMutation({
    mutationFn: (body: { name: string; phone: string }) =>
      api("/auth/me", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => auth.refresh(),
  });

  const [name, setName] = useState(auth.user?.name || "");
  const [phone, setPhone] = useState(auth.user?.phone || "");

  // Review System Queries
  const {
    data: eligibleItems = [],
    isLoading: loadingEligible,
    refetch: refetchEligible,
  } = useQuery({
    queryKey: ["my-eligible-items"],
    queryFn: fetchMyEligibleItems,
    enabled: Boolean(auth.user),
  });

  const {
    data: myReviews = [],
    isLoading: loadingReviews,
    refetch: refetchReviews,
  } = useQuery({
    queryKey: ["my-reviews"],
    queryFn: fetchMyReviews,
    enabled: Boolean(auth.user),
  });

  // Modal State for Review Submission / Editing
  const [reviewModalItem, setReviewModalItem] = useState<{
    productId: string;
    productSlug?: string;
    productName: string;
    productThumbnail?: string;
    purchasedSize?: string;
    purchasedColor?: string;
    orderId?: string;
    orderNumber?: string;
    existingReview?: any;
  } | null>(null);

  const pendingEligible = eligibleItems.filter((i) => !i.hasReview);

  return (
    <section className="section page account" style={{ paddingTop: "40px", minHeight: "80vh" }}>
      <div className="account-head">
        <div>
          <span className="eyebrow">CUSTOMER ACCOUNT</span>
          <h1>Hello, {auth.user?.name ? auth.user.name.split(" ")[0] : "Customer"}</h1>
          <p>{auth.user?.email}</p>
        </div>
        <button type="button" className="outline-button" onClick={auth.logout}>
          Sign out
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="tabs">
        {[
          { id: "orders", label: "My Orders" },
          {
            id: "reviews",
            label: `My Reviews ${pendingEligible.length > 0 ? `(${pendingEligible.length})` : ""}`,
          },
          { id: "addresses", label: "Saved Addresses" },
          { id: "profile", label: "Profile" },
        ].map((t) => (
          <button
            type="button"
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
            key={t.id}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── ORDERS TAB ──────────────────────────────────────────────────────── */}
      {tab === "orders" &&
        (loadingOrders ? (
          <Spinner />
        ) : (
          <Status empty={!orders?.length}>
            {orders && orders.length > 0 ? (
              <StaggerContainer className="order-list">
                {orders.map((order, idx) => (
                  <StaggerItem key={order.id} index={idx} baseDelay={60}>
                    <OrderCard order={order} />
                  </StaggerItem>
                ))}
              </StaggerContainer>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  background: "var(--card)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px dashed var(--border)",
                }}
              >
                <ShoppingBag size={40} color="var(--gold)" style={{ marginBottom: "16px" }} />
                <h2 style={{ fontSize: "20px", margin: "0 0 8px 0" }}>No orders placed yet</h2>
                <p style={{ color: "var(--muted)", maxWidth: "380px", margin: "0 auto 24px" }}>
                  Your wardrobe archive is currently waiting for its first luxury piece.
                </p>
                <Link to="/products" className="button">
                  Explore Collection
                </Link>
              </div>
            )}
          </Status>
        ))}

      {/* ─── MY REVIEWS TAB (Flipkart / Amazon style Verified Purchase Reviews) ── */}
      {tab === "reviews" && (
        <div style={{ maxWidth: "980px" }}>
          {/* Sub-tab Pill Switcher */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              marginBottom: "28px",
              paddingBottom: "14px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <button
              type="button"
              onClick={() => setReviewSubTab("to_review")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                borderRadius: "var(--radius-pill)",
                fontSize: "13.5px",
                fontWeight: 700,
                border: "1px solid",
                borderColor: reviewSubTab === "to_review" ? "var(--gold)" : "var(--border)",
                background: reviewSubTab === "to_review" ? "var(--gold-pale, rgba(212,175,55,0.12))" : "var(--layer-2)",
                color: reviewSubTab === "to_review" ? "var(--gold)" : "var(--muted)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <PackageCheck size={16} />
              <span>To Review ({pendingEligible.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setReviewSubTab("reviewed")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                borderRadius: "var(--radius-pill)",
                fontSize: "13.5px",
                fontWeight: 700,
                border: "1px solid",
                borderColor: reviewSubTab === "reviewed" ? "var(--gold)" : "var(--border)",
                background: reviewSubTab === "reviewed" ? "var(--gold-pale, rgba(212,175,55,0.12))" : "var(--layer-2)",
                color: reviewSubTab === "reviewed" ? "var(--gold)" : "var(--muted)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <Star size={16} />
              <span>Reviewed ({myReviews.length})</span>
            </button>
          </div>

          {/* Sub-tab 1: To Review (Delivered items awaiting review) */}
          {reviewSubTab === "to_review" && (
            <div>
              {loadingEligible ? (
                <Spinner />
              ) : pendingEligible.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "60px 24px",
                    background: "var(--card)",
                    borderRadius: "16px",
                    border: "1px dashed var(--border)",
                  }}
                >
                  <PackageCheck size={44} color="var(--gold)" style={{ marginBottom: "16px" }} />
                  <h3 style={{ fontSize: "19px", margin: "0 0 8px", color: "var(--text)" }}>
                    No pending reviews
                  </h3>
                  <p style={{ color: "var(--muted)", maxWidth: "440px", margin: "0 auto 20px", fontSize: "14px" }}>
                    Only delivered purchases are eligible for review. Once your orders arrive, you can share your verified feedback here!
                  </p>
                  <Link to="/products" className="button ghost">
                    Shop New Arrivals
                  </Link>
                </div>
              ) : (
                <div style={{ display: "grid", gap: "16px" }}>
                  {pendingEligible.map((item) => (
                    <article
                      key={item.orderItemId}
                      className="panel"
                      style={{
                        padding: "20px 24px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "20px",
                        borderRadius: "16px",
                      }}
                    >
                      <div style={{ display: "flex", gap: "18px", alignItems: "center", minWidth: "260px" }}>
                        <div
                          style={{
                            width: "72px",
                            height: "80px",
                            borderRadius: "12px",
                            background: "var(--layer-2)",
                            border: "1px solid var(--border)",
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            padding: "4px",
                          }}
                        >
                          <img
                            src={resolveImageUrl(item.productThumbnail)}
                            alt={item.productName}
                            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "cover" }}
                            onError={(e) => {
                              e.currentTarget.src = "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80";
                            }}
                          />
                        </div>

                        <div>
                          <Link
                            to={`/products/${item.productSlug || item.productId}`}
                            style={{
                              fontSize: "16px",
                              fontWeight: 700,
                              color: "var(--text)",
                              textDecoration: "none",
                              display: "block",
                              marginBottom: "4px",
                            }}
                          >
                            {item.productName}
                          </Link>

                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              alignItems: "center",
                              flexWrap: "wrap",
                              fontSize: "12px",
                              color: "var(--muted)",
                            }}
                          >
                            {item.selectedSize && <span>Size: <b style={{ color: "var(--text)" }}>{item.selectedSize}</b></span>}
                            {item.selectedColor && <span>Color: <b style={{ color: "var(--text)" }}>{item.selectedColor}</b></span>}
                            <span>•</span>
                            <span style={{ color: "#059669", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <CheckCircle2 size={12} /> Delivered
                            </span>
                            <span>•</span>
                            <span>Order #{item.orderNumber}</span>
                          </div>

                          <div style={{ marginTop: "6px", fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>
                            {money(item.productPrice)}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="button"
                        onClick={() =>
                          setReviewModalItem({
                            productId: item.productId,
                            productSlug: item.productSlug,
                            productName: item.productName,
                            productThumbnail: item.productThumbnail,
                            purchasedSize: item.selectedSize,
                            purchasedColor: item.selectedColor,
                            orderId: item.orderId,
                            orderNumber: item.orderNumber,
                            existingReview: undefined,
                          })
                        }
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "10px 22px",
                          fontSize: "13px",
                          fontWeight: 700,
                        }}
                      >
                        <Star size={15} fill="currentColor" />
                        <span>Write a Review</span>
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sub-tab 2: Reviewed (Existing Submitted Reviews) */}
          {reviewSubTab === "reviewed" && (
            <div>
              {loadingReviews ? (
                <Spinner />
              ) : myReviews.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "60px 24px",
                    background: "var(--card)",
                    borderRadius: "16px",
                    border: "1px dashed var(--border)",
                  }}
                >
                  <MessageSquare size={44} color="var(--gold)" style={{ marginBottom: "16px" }} />
                  <h3 style={{ fontSize: "19px", margin: "0 0 8px", color: "var(--text)" }}>
                    No reviews submitted yet
                  </h3>
                  <p style={{ color: "var(--muted)", maxWidth: "440px", margin: "0 auto 20px", fontSize: "14px" }}>
                    Once you write reviews for your delivered items, you can view, edit, and track their published status right here.
                  </p>
                  {pendingEligible.length > 0 && (
                    <button
                      type="button"
                      className="button"
                      onClick={() => setReviewSubTab("to_review")}
                    >
                      View Items to Review ({pendingEligible.length})
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: "grid", gap: "20px" }}>
                  {myReviews.map((rev: MyReviewItem) => (
                    <article
                      key={rev.id}
                      className="panel"
                      style={{
                        padding: "24px",
                        borderRadius: "16px",
                        border: "1px solid var(--border)",
                        background: "var(--layer-1, var(--card))",
                      }}
                    >
                      {/* Product Header */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          flexWrap: "wrap",
                          gap: "16px",
                          paddingBottom: "16px",
                          borderBottom: "1px solid var(--border)",
                          marginBottom: "16px",
                        }}
                      >
                        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                          <div
                            style={{
                              width: "60px",
                              height: "68px",
                              borderRadius: "10px",
                              background: "var(--layer-2)",
                              border: "1px solid var(--border)",
                              overflow: "hidden",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              padding: "4px",
                            }}
                          >
                            <img
                              src={resolveImageUrl(rev.productThumbnail)}
                              alt={rev.productName}
                              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "cover" }}
                              onError={(e) => {
                                e.currentTarget.src = "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80";
                              }}
                            />
                          </div>

                          <div>
                            <Link
                              to={`/products/${rev.productSlug || rev.productId}`}
                              style={{
                                fontSize: "16px",
                                fontWeight: 700,
                                color: "var(--text)",
                                textDecoration: "none",
                                display: "block",
                                marginBottom: "4px",
                              }}
                            >
                              {rev.productName}
                            </Link>

                            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", fontSize: "12px", color: "var(--muted)" }}>
                              {rev.purchasedSize && <span>Size: <b style={{ color: "var(--text)" }}>{rev.purchasedSize}</b></span>}
                              {rev.purchasedColor && <span>Color: <b style={{ color: "var(--text)" }}>{rev.purchasedColor}</b></span>}
                              {rev.orderNumber && <span>• Order #{rev.orderNumber}</span>}
                              <span>•</span>
                              <span>Reviewed {new Date(rev.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>
                            </div>
                          </div>
                        </div>

                        {/* Status Badge & Edit Action */}
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          {rev.status === "PUBLISHED" ? (
                            <span
                              style={{
                                fontSize: "11.5px",
                                padding: "4px 10px",
                                borderRadius: "var(--radius-pill)",
                                background: "rgba(16, 185, 129, 0.12)",
                                color: "#059669",
                                fontWeight: 700,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <CheckCircle2 size={12} /> Published
                            </span>
                          ) : rev.status === "PENDING" ? (
                            <span
                              style={{
                                fontSize: "11.5px",
                                padding: "4px 10px",
                                borderRadius: "var(--radius-pill)",
                                background: "rgba(245, 158, 11, 0.12)",
                                color: "#d97706",
                                fontWeight: 700,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <Clock size={12} /> Under Review
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: "11.5px",
                                padding: "4px 10px",
                                borderRadius: "var(--radius-pill)",
                                background: "rgba(107, 114, 128, 0.12)",
                                color: "var(--muted)",
                                fontWeight: 700,
                              }}
                            >
                              {rev.status}
                            </span>
                          )}

                          <button
                            type="button"
                            className="outline-button"
                            onClick={() =>
                              setReviewModalItem({
                                productId: rev.productId,
                                productSlug: rev.productSlug,
                                productName: rev.productName,
                                productThumbnail: rev.productThumbnail,
                                purchasedSize: rev.purchasedSize || undefined,
                                purchasedColor: rev.purchasedColor || undefined,
                                orderNumber: rev.orderNumber || undefined,
                                existingReview: {
                                  id: rev.id,
                                  rating: rev.rating,
                                  title: rev.title,
                                  comment: rev.comment,
                                  status: rev.status,
                                  fit: rev.fit || undefined,
                                  fabricQuality: rev.fabricQuality || undefined,
                                  comfort: rev.comfort || undefined,
                                  images: rev.images,
                                },
                              })
                            }
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "6px 14px",
                              fontSize: "12px",
                              borderRadius: "8px",
                              color: "var(--gold)",
                              borderColor: "var(--gold)",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            <Edit3 size={13} />
                            <span>Edit Review</span>
                          </button>
                        </div>
                      </div>

                      {/* Rating Stars & Title */}
                      <div style={{ marginBottom: "10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                          <div style={{ display: "flex", gap: "2px" }}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                size={15}
                                fill={s <= rev.rating ? "var(--gold)" : "none"}
                                color={s <= rev.rating ? "var(--gold)" : "var(--border)"}
                              />
                            ))}
                          </div>
                          <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--gold)" }}>
                            {rev.rating}.0
                          </span>
                          <span
                            style={{
                              fontSize: "11px",
                              color: "#059669",
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                              marginLeft: "6px",
                            }}
                          >
                            <CheckCircle2 size={12} /> Verified Buyer
                          </span>
                        </div>

                        {rev.title && (
                          <h4 style={{ margin: "4px 0 6px", fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>
                            {rev.title}
                          </h4>
                        )}
                      </div>

                      {/* Comment text */}
                      {rev.comment && (
                        <p style={{ margin: "0 0 14px", fontSize: "14px", lineHeight: "1.65", color: "var(--muted)" }}>
                          {rev.comment}
                        </p>
                      )}

                      {/* Fit / Fabric / Comfort Tags */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
                        {rev.fit && (
                          <span style={{ fontSize: "11.5px", background: "var(--layer-2)", padding: "3px 10px", borderRadius: "6px", border: "1px solid var(--border)", color: "var(--text)" }}>
                            Fit: <b>{rev.fit.replaceAll("_", " ")}</b>
                          </span>
                        )}
                        {rev.fabricQuality && (
                          <span style={{ fontSize: "11.5px", background: "var(--layer-2)", padding: "3px 10px", borderRadius: "6px", border: "1px solid var(--border)", color: "var(--text)" }}>
                            Fabric: <b>{rev.fabricQuality.replaceAll("_", " ")}</b>
                          </span>
                        )}
                        {rev.comfort && (
                          <span style={{ fontSize: "11.5px", background: "var(--layer-2)", padding: "3px 10px", borderRadius: "6px", border: "1px solid var(--border)", color: "var(--text)" }}>
                            Comfort: <b>{rev.comfort.replaceAll("_", " ")}</b>
                          </span>
                        )}
                      </div>

                      {/* Review Photos Thumbnails */}
                      {rev.images && rev.images.length > 0 && (
                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "14px" }}>
                          {rev.images.map((img, i) => (
                            <a
                              key={img.id || i}
                              href={resolveImageUrl(img.url)}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                width: "64px",
                                height: "64px",
                                borderRadius: "8px",
                                overflow: "hidden",
                                border: "1px solid var(--border)",
                                display: "block",
                              }}
                            >
                              <img
                                src={resolveImageUrl(img.url)}
                                alt={`Customer upload ${i + 1}`}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Official Store Replies */}
                      {rev.replies && rev.replies.length > 0 && (
                        <div
                          style={{
                            marginTop: "14px",
                            padding: "12px 16px",
                            background: "var(--layer-2)",
                            borderRadius: "10px",
                            borderLeft: "3px solid var(--gold)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--gold)", fontWeight: 700, marginBottom: "4px" }}>
                            <Sparkles size={13} />
                            <span>Official SHADOW Response</span>
                          </div>
                          {rev.replies.map((rep) => (
                            <p key={rep.id} style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--text)" }}>
                              {rep.text}
                            </p>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── ADDRESSES TAB ───────────────────────────────────────────────────── */}
      {tab === "addresses" && (
        <div className="account-grid">
          <div>
            <h2 style={{ fontSize: "20px", letterSpacing: "0.04em", marginBottom: "20px" }}>Saved Addresses</h2>
            {addresses && addresses.length > 0 ? (
              addresses.map((a) => (
                <article className="address-card" key={a.id}>
                  <b style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "16px", marginBottom: "6px" }}>
                    {a.fullName}
                    {a.isDefault && <span className="badge gold" style={{ position: "static" }}>Default</span>}
                  </b>
                  <p style={{ fontSize: "14px", lineHeight: "1.6", color: "var(--muted)" }}>
                    {a.line1}, {a.town || ""}, {a.city}
                    <br />
                    {a.state} {a.pinCode}, {a.country}
                    <br />
                    Phone: {a.phone}
                  </p>
                  {a.latitude != null && (
                    <span className="located" style={{ marginTop: "10px" }}>
                      <MapPin size={15} /> Exact GPS location saved
                    </span>
                  )}
                </article>
              ))
            ) : (
              <p style={{ color: "var(--muted)", fontSize: "14px" }}>No saved addresses yet.</p>
            )}
          </div>

          <form
            className="panel"
            onSubmit={(e) => {
              e.preventDefault();
              addressMutation.mutate();
            }}
          >
            <h2 style={{ fontSize: "20px", letterSpacing: "0.04em", marginBottom: "20px" }}>Add New Address</h2>
            <AddressFields value={address} onChange={setAddress} />
            <label className="checkbox" style={{ margin: "20px 0", cursor: "pointer", display: "flex", gap: "10px" }}>
              <input
                type="checkbox"
                checked={address.isDefault}
                onChange={(e) => setAddress({ ...address, isDefault: e.target.checked })}
              />
              <span>Set as my primary default address</span>
            </label>
            {addressMutation.error && <p className="error-text">{addressMutation.error.message}</p>}
            <button className="button" disabled={addressMutation.isPending}>
              Save Address
            </button>
          </form>
        </div>
      )}

      {/* ─── PROFILE TAB ─────────────────────────────────────────────────────── */}
      {tab === "profile" && (
        <form
          className="panel narrow"
          onSubmit={(e) => {
            e.preventDefault();
            profileMutation.mutate({ name, phone });
          }}
          style={{ padding: "40px", maxWidth: "600px" }}
        >
          <h2
            style={{
              fontSize: "22px",
              letterSpacing: "0.04em",
              marginBottom: "24px",
              borderBottom: "1px solid var(--border)",
              paddingBottom: "16px",
            }}
          >
            Personal Account Details
          </h2>
          <div style={{ display: "grid", gap: "20px", marginBottom: "28px" }}>
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                fontSize: "13px",
                fontWeight: 700,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Full Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{
                  padding: "14px",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  fontSize: "15px",
                  color: "var(--text)",
                  width: "100%",
                  outline: "none",
                }}
              />
            </label>
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                fontSize: "13px",
                fontWeight: 700,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Email Address
              <input
                value={auth.user?.email}
                readOnly
                style={{
                  padding: "14px",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  background: "var(--layer-2)",
                  fontSize: "15px",
                  color: "var(--muted)",
                  width: "100%",
                  cursor: "not-allowed",
                  outline: "none",
                }}
              />
            </label>
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                fontSize: "13px",
                fontWeight: 700,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Contact Phone
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{
                  padding: "14px",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  fontSize: "15px",
                  color: "var(--text)",
                  width: "100%",
                  outline: "none",
                }}
              />
            </label>
          </div>
          {profileMutation.isSuccess && (
            <p
              className="success-text"
              style={{
                marginBottom: "20px",
                padding: "12px 16px",
                background: "rgba(16, 185, 129, 0.1)",
                borderRadius: "8px",
              }}
            >
              Profile details updated successfully.
            </p>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "20px",
              paddingTop: "20px",
              borderTop: "1px solid var(--border)",
              flexWrap: "wrap",
            }}
          >
            <Link
              to="/forgot-password"
              style={{
                fontSize: "13.5px",
                fontWeight: 700,
                color: "var(--gold)",
                textDecoration: "underline",
              }}
            >
              Update Password
            </Link>
            <button className="button" style={{ padding: "14px 28px" }} disabled={profileMutation.isPending}>
              {profileMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      )}

      {/* ─── REVIEW SUBMISSION & EDIT MODAL ──────────────────────────────────── */}
      {reviewModalItem && (
        <ReviewFormModal
          slug={reviewModalItem.productSlug || reviewModalItem.productId}
          productId={reviewModalItem.productId}
          productName={reviewModalItem.productName}
          productThumbnail={reviewModalItem.productThumbnail}
          eligibility={{
            isEligible: true,
            hasPurchased: true,
            isDelivered: true,
            orderId: reviewModalItem.orderId,
            orderNumber: reviewModalItem.orderNumber,
            purchasedSize: reviewModalItem.purchasedSize,
            purchasedColor: reviewModalItem.purchasedColor,
            existingReview: reviewModalItem.existingReview,
          }}
          isOpen={Boolean(reviewModalItem)}
          onClose={() => setReviewModalItem(null)}
          onSuccess={() => {
            refetchEligible();
            refetchReviews();
            client.invalidateQueries({ queryKey: ["my-reviews"] });
            client.invalidateQueries({ queryKey: ["my-eligible-items"] });
          }}
        />
      )}
    </section>
  );
}
