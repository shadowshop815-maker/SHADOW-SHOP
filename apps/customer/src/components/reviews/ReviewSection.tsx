import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "../../features/auth/AuthContext";
import type { RatingSummary as RatingSummaryType, Review, CustomerPhotoItem } from "../../types";
import { RatingSummary } from "./RatingSummary";
import { ReviewPhotoGallery } from "./ReviewPhotoGallery";
import { ReviewCard } from "./ReviewCard";
import {
  fetchRatingSummary,
  fetchReviews,
  fetchCustomerPhotos,
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

  // 3. Fetch Real Paginated Reviews
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
        queryClient.invalidateQueries({ queryKey: ["product", slug] });
      }
    };

    window.addEventListener("shadow_reviews_updated", handleUpdate);
    return () => window.removeEventListener("shadow_reviews_updated", handleUpdate);
  }, [slug, queryClient]);

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
            <RatingSummary summary={summary} />
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
            /* Authentic Real Empty State (Strictly Read-Only) */
            <div className="reviews-empty-state">
              <h4 style={{ margin: "14px 0 6px", fontSize: "16px", color: "var(--text)" }}>
                No reviews yet
              </h4>
              <p style={{ margin: 0, fontSize: "13.5px", color: "var(--muted)", maxWidth: "380px", lineHeight: 1.6 }}>
                There are no published reviews for this product yet. Verified buyers can submit reviews after delivery from their Account → My Orders.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

