import { CheckCircle2, Star, Edit3, Plus } from "lucide-react";
import type { RatingSummary as RatingSummaryType, ReviewEligibility } from "../../types";
import { RatingBadge } from "./RatingStars";

interface RatingSummaryProps {
  summary: RatingSummaryType;
  eligibility?: ReviewEligibility | null;
  onOpenReviewModal: () => void;
}

export function RatingSummary({ summary, eligibility, onOpenReviewModal }: RatingSummaryProps) {
  const { averageRating, totalRatings, verifiedBuyerRatings, ratingLabel, stars, starPercentages, attributes } = summary;

  // Star bar colors (Flipkart standard)
  const getBarColor = (starLevel: number) => {
    if (starLevel >= 4) return "#388e3c"; // Green
    if (starLevel === 3) return "#8bc34a"; // Light green
    if (starLevel === 2) return "#ff9800"; // Orange
    return "#f44336"; // Red
  };

  return (
    <div className="rating-summary-card">
      <div className="rating-summary-grid">
        {/* Left Column: Big Rating & Label */}
        <div className="rating-score-box">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <span className="rating-big-number">{averageRating > 0 ? averageRating.toFixed(1) : "0.0"}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {averageRating > 0 && <RatingBadge rating={averageRating} size="md" />}
                <span className="rating-label-text">{ratingLabel}</span>
              </div>
              <span className="rating-meta-sub">
                based on {totalRatings.toLocaleString("en-IN")} rating{totalRatings !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <div className="verified-badge-row">
            <CheckCircle2 size={14} color="#059669" />
            <span>{verifiedBuyerRatings.toLocaleString("en-IN")} Verified Buyer Ratings</span>
          </div>

          {/* Action button: Rate Product or Edit Your Review */}
          <div style={{ marginTop: "18px" }}>
            <button
              type="button"
              onClick={onOpenReviewModal}
              className="rate-product-btn"
            >
              {eligibility?.hasExistingReview ? (
                <>
                  <Edit3 size={15} />
                  <span>Edit Your Review</span>
                </>
              ) : (
                <>
                  <Plus size={15} />
                  <span>Rate Product</span>
                </>
              )}
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px", fontSize: "11.5px", color: eligibility?.canReview ? "#059669" : "var(--muted)" }}>
              {eligibility?.canReview ? (
                <>
                  <CheckCircle2 size={13} color="#059669" />
                  <span style={{ fontWeight: 600 }}>Verified Purchase · Delivered</span>
                </>
              ) : (
                <span>🛡️ Ratings unlock automatically after delivery</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: 5-Star Distribution Bars */}
        <div className="rating-bars-box">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = stars[star as 1 | 2 | 3 | 4 | 5] || 0;
            const percent = starPercentages[star as 1 | 2 | 3 | 4 | 5] || 0;
            const color = getBarColor(star);

            return (
              <div key={star} className="rating-bar-row">
                <span className="star-level-label">
                  <span>{star}</span>
                  <Star size={11} fill="currentColor" stroke="none" />
                </span>

                <div className="rating-bar-track">
                  <div
                    className="rating-bar-fill"
                    style={{
                      width: `${percent}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>

                <span className="rating-bar-count">
                  {count > 0 ? count.toLocaleString("en-IN") : "0"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Attribute Feedback Tags (Flipkart style: Fabric Quality, Comfort, Fit, Style) */}
      {(attributes.fit.length > 0 || attributes.fabricQuality.length > 0 || attributes.comfort.length > 0) && (
        <div className="attribute-tags-row">
          {attributes.fabricQuality.slice(0, 1).map((a) => (
            <span key={a.label} className="attribute-pill">
              Fabric: <b>{a.label}</b> ({a.percentage}%)
            </span>
          ))}
          {attributes.fit.slice(0, 1).map((a) => (
            <span key={a.label} className="attribute-pill">
              Fit: <b>{a.label}</b> ({a.percentage}%)
            </span>
          ))}
          {attributes.comfort.slice(0, 1).map((a) => (
            <span key={a.label} className="attribute-pill">
              Comfort: <b>{a.label}</b> ({a.percentage}%)
            </span>
          ))}
          <span className="attribute-pill">True to Specs ✓</span>
        </div>
      )}
    </div>
  );
}
