import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, MessageSquarePlus, ShieldCheck, PackageCheck } from "lucide-react";
import { useAuth } from "../../features/auth/AuthContext";
import type { RatingSummary as RatingSummaryType, Review, ReviewEligibility, CustomerPhotoItem } from "../../types";
import { RatingSummary } from "./RatingSummary";
import { ReviewPhotoGallery } from "./ReviewPhotoGallery";
import { ReviewCard } from "./ReviewCard";
import { ReviewFormModal } from "./ReviewFormModal";
import {
  fetchRatingSummary,
  fetchReviews,
  fetchCustomerPhotos,
  fetchReviewEligibility,
} from "../../services/reviewStore";

interface ReviewSectionProps {
  slug: string;
  productId: string;
  productName: string;
  productThumbnail?: string;
}

export function ReviewSection({ slug, productId, productName, productThumbnail }: ReviewSectionProps) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEligibilityNoticeOpen, setIsEligibilityNoticeOpen] = useState(false);

  // Filter and Sort states
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [withPhotosOnly, setWithPhotosOnly] = useState(false);
  const [withTextOnly, setWithTextOnly] = useState(false);
  const [sort, setSort] = useState<"recent" | "highest" | "lowest" | "helpful">("recent");
  const [page, setPage] = useState(1);

  // 1. Fetch Real Rating Summary
  const { data: summary, isLoading: summaryLoading } = useQuery<RatingSummaryType>({
    queryKey: ["product-rating-summary", slug],
    queryFn: () => fetchRatingSummary(slug),
  });

  // 2. Fetch Real Customer Photos
  const { data: photos = [] } = useQuery<CustomerPhotoItem[]>({
    queryKey: ["product-review-photos", slug],
    queryFn: () => fetchCustomerPhotos(slug),
  });

  // 3. Fetch Real Review Eligibility
  const { data: eligibility } = useQuery<ReviewEligibility>({
    queryKey: ["review-eligibility", slug, auth.user?.id],
    queryFn: () => fetchReviewEligibility(slug, auth.user),
    enabled: Boolean(auth.user),
  });

  // 4. Fetch Real Paginated Reviews
  const { data: reviewsData, isLoading: reviewsLoading } = useQuery<{
    items: Review[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }>({
    queryKey: ["product-reviews", slug, page, sort, selectedRating, verifiedOnly, withPhotosOnly, withTextOnly, auth.user?.id],
    queryFn: () =>
      fetchReviews(slug, {
        page,
        limit: 6,
        sort,
        rating: selectedRating,
        verified: verifiedOnly,
        hasPhotos: withPhotosOnly,
        hasText: withTextOnly,
        user: auth.user,
      }),
  });

  // Real-time synchronization: listen for review changes across all windows/tabs
  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail?.slug || customEvent.detail.slug === slug) {
        queryClient.invalidateQueries({ queryKey: ["product-rating-summary", slug] });
        queryClient.invalidateQueries({ queryKey: ["product-reviews", slug] });
        queryClient.invalidateQueries({ queryKey: ["product-review-photos", slug] });
        queryClient.invalidateQueries({ queryKey: ["review-eligibility", slug] });
        queryClient.invalidateQueries({ queryKey: ["product", slug] });
      }
    };

    window.addEventListener("shadow_reviews_updated", handleUpdate);
    return () => window.removeEventListener("shadow_reviews_updated", handleUpdate);
  }, [slug, queryClient]);

  const handleReviewSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["product-rating-summary", slug] });
    queryClient.invalidateQueries({ queryKey: ["product-reviews", slug] });
    queryClient.invalidateQueries({ queryKey: ["product-review-photos", slug] });
    queryClient.invalidateQueries({ queryKey: ["review-eligibility", slug] });
    queryClient.invalidateQueries({ queryKey: ["product", slug] });
  };

  const handleOpenReviewModal = () => {
    if (!auth.user) {
      setIsEligibilityNoticeOpen(true);
      return;
    }
    if (!eligibility?.canReview) {
      setIsEligibilityNoticeOpen(true);
      return;
    }
    setIsModalOpen(true);
  };

  return (
    <section className="review-section-container" id="customer-reviews">
      {/* Flipkart-style Collapsible Header */}
      <div className="review-accordion-header" onClick={() => setIsOpen(!isOpen)}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
          <h3 className="review-accordion-title">Ratings and reviews</h3>
          {summary && summary.totalRatings > 0 ? (
            <span className="review-header-rating-badge">
              ★ {summary.averageRating.toFixed(1)} ({summary.totalRatings.toLocaleString("en-IN")})
            </span>
          ) : (
            <span style={{ fontSize: "12.5px", color: "var(--muted)", fontWeight: 500 }}>
              (0 Ratings)
            </span>
          )}
        </div>
        <button
          type="button"
          className="accordion-toggle-btn"
          aria-label={isOpen ? "Collapse reviews" : "Expand reviews"}
        >
          {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {isOpen && (
        <div className="review-section-content">
          {/* Rating Summary (Bars & Average) */}
          {summaryLoading ? (
            <div style={{ padding: "30px 0", textAlign: "center" }}>
              <div className="loader"><span /></div>
            </div>
          ) : summary ? (
            <RatingSummary
              summary={summary}
              eligibility={eligibility}
              onOpenReviewModal={handleOpenReviewModal}
            />
          ) : null}

          {/* Flipkart Photo Grid & Lightbox (renders only when real customer photos exist) */}
          {photos && photos.length > 0 && <ReviewPhotoGallery photos={photos} />}

          {/* Filter & Sort Controls */}
          <div className="reviews-toolbar">
            <div className="filter-pills-scroll">
              <button
                type="button"
                className={`filter-pill ${selectedRating === null && !verifiedOnly && !withPhotosOnly && !withTextOnly ? "active" : ""}`}
                onClick={() => {
                  setSelectedRating(null);
                  setVerifiedOnly(false);
                  setWithPhotosOnly(false);
                  setWithTextOnly(false);
                  setPage(1);
                }}
              >
                All
              </button>

              {[5, 4, 3, 2, 1].map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`filter-pill ${selectedRating === r ? "active" : ""}`}
                  onClick={() => {
                    setSelectedRating(selectedRating === r ? null : r);
                    setPage(1);
                  }}
                >
                  {r} ★
                </button>
              ))}

              <button
                type="button"
                className={`filter-pill ${verifiedOnly ? "active" : ""}`}
                onClick={() => {
                  setVerifiedOnly(!verifiedOnly);
                  setPage(1);
                }}
              >
                Verified Only
              </button>

              <button
                type="button"
                className={`filter-pill ${withPhotosOnly ? "active" : ""}`}
                onClick={() => {
                  setWithPhotosOnly(!withPhotosOnly);
                  setPage(1);
                }}
              >
                With Photos
              </button>

              <button
                type="button"
                className={`filter-pill ${withTextOnly ? "active" : ""}`}
                onClick={() => {
                  setWithTextOnly(!withTextOnly);
                  setPage(1);
                }}
              >
                With Text
              </button>
            </div>

            {/* Sort Selector */}
            <div className="reviews-sort-wrapper">
              <label htmlFor="review-sort-select" className="sr-only">Sort Reviews</label>
              <select
                id="review-sort-select"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as any);
                  setPage(1);
                }}
                className="review-sort-select"
              >
                <option value="recent">Most Recent</option>
                <option value="highest">Highest Rated</option>
                <option value="lowest">Lowest Rated</option>
                <option value="helpful">Most Helpful</option>
              </select>
            </div>
          </div>

          {/* Reviews List */}
          {reviewsLoading ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "var(--muted)" }}>
              <div className="loader" style={{ minHeight: "120px" }}>
                <span />
              </div>
            </div>
          ) : reviewsData?.items && reviewsData.items.length > 0 ? (
            <div className="reviews-list-container">
              {reviewsData.items.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onEdit={handleOpenReviewModal}
                />
              ))}

              {/* Pagination controls */}
              {reviewsData.pagination.pages > 1 && (
                <div className="reviews-pagination">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="pagination-btn"
                  >
                    Previous
                  </button>
                  <span className="pagination-text">
                    Page {page} of {reviewsData.pagination.pages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= reviewsData.pagination.pages}
                    onClick={() => setPage((p) => p + 1)}
                    className="pagination-btn"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Authentic Real Empty State */
            <div className="reviews-empty-state">
              <div className="empty-icon-circle">
                <MessageSquarePlus size={28} color="var(--gold)" />
              </div>
              <h4 style={{ margin: "14px 0 6px", fontSize: "16px", color: "var(--text)" }}>
                No reviews yet
              </h4>
              <p style={{ margin: 0, fontSize: "13.5px", color: "var(--muted)", maxWidth: "360px", lineHeight: 1.6 }}>
                Be the first verified customer to share feedback and photos after receiving delivery!
              </p>
              <button
                type="button"
                onClick={handleOpenReviewModal}
                className="button"
                style={{ marginTop: "18px" }}
              >
                {eligibility?.hasExistingReview ? "Edit Your Review" : "Write a Review"}
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "12px", color: "var(--muted)", fontSize: "12px" }}>
                <ShieldCheck size={14} color="var(--gold)" />
                <span>Reviews are restricted to customers who purchased and received this product</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Eligibility Notice Modal (Flipkart / Amazon authentic standard) */}
      {isEligibilityNoticeOpen && (
        <div className="review-modal-backdrop" onClick={() => setIsEligibilityNoticeOpen(false)}>
          <div
            className="review-modal-card"
            style={{ maxWidth: "460px", padding: "32px 28px", textAlign: "center" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: !auth.user ? "rgba(217, 119, 6, 0.12)" : "rgba(16, 185, 129, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 18px",
              }}
            >
              {!auth.user ? (
                <ShieldCheck size={32} color="var(--gold)" />
              ) : (
                <PackageCheck size={32} color="#059669" />
              )}
            </div>

            <h3 style={{ fontSize: "19px", color: "var(--text)", margin: "0 0 10px 0", fontWeight: 800 }}>
              {!auth.user ? "Sign In to Rate & Review" : "Delivery Required to Review"}
            </h3>

            <p style={{ fontSize: "14px", color: "var(--muted)", lineHeight: 1.6, margin: "0 0 24px" }}>
              {!auth.user
                ? "To ensure all ratings and reviews are 100% genuine, only verified buyers who have received delivery of this product can submit a review. Please sign in with your buyer account."
                : "Reviews unlock automatically once your order has been confirmed as Delivered by our courier partner. If your order is on the way, you can check its live status in your Orders page."}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {!auth.user ? (
                <Link
                  to={`/login?redirect=/products/${slug}#customer-reviews`}
                  className="button"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Sign In with Buyer Account
                </Link>
              ) : (
                <Link
                  to="/account"
                  className="button"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  View My Orders
                </Link>
              )}
              <button
                type="button"
                className="button ghost"
                onClick={() => setIsEligibilityNoticeOpen(false)}
                style={{ width: "100%", justifyContent: "center" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal Form (Only opened for eligible delivered buyers) */}
      <ReviewFormModal
        slug={slug}
        productName={productName}
        productThumbnail={productThumbnail}
        eligibility={
          eligibility || {
            canReview: false,
            isDeliveredBuyer: false,
            hasExistingReview: false,
            existingReview: null,
          }
        }
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleReviewSuccess}
      />
    </section>
  );
}
