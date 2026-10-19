import { useState } from "react";
import { CheckCircle2, ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";
import { resolveImageUrl } from "../../api";
import { useAuth } from "../../features/auth/AuthContext";
import { submitRealVote } from "../../services/reviewStore";
import type { Review } from "../../types";
import { RatingBadge } from "./RatingStars";

interface ReviewCardProps {
  review: Review;
  onOpenPhotoLightbox?: (photoUrl: string) => void;
  onEdit?: () => void;
}

export function ReviewCard({ review, onOpenPhotoLightbox, onEdit }: ReviewCardProps) {
  const auth = useAuth();
  const [helpfulCount, setHelpfulCount] = useState(review.helpfulVotes ?? (review as any).helpfulCount ?? 0);
  const [notHelpfulCount, setNotHelpfulCount] = useState(review.notHelpfulVotes ?? (review as any).notHelpfulCount ?? 0);
  const [userVote, setUserVote] = useState<"HELPFUL" | "NOT_HELPFUL" | null>(review.userVote ?? null);
  const [voting, setVoting] = useState(false);

  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) return "Today";
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 30) return `${diffDays} days ago`;
      const diffMonths = Math.floor(diffDays / 30);
      if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
      const diffYears = Math.floor(diffDays / 365);
      return `${diffYears} year${diffYears > 1 ? "s" : ""} ago`;
    } catch {
      return "";
    }
  };

  const handleVote = async (type: "HELPFUL" | "NOT_HELPFUL") => {
    if (!auth.user) {
      alert("Please sign in to vote on reviews.");
      return;
    }
    if (review.isOwnReview) {
      alert("You cannot vote on your own review.");
      return;
    }
    if (voting) return;

    // Optimistic state calculation
    const prevVote = userVote;
    const prevHelpful = helpfulCount;
    const prevNotHelpful = notHelpfulCount;

    let nextVote: "HELPFUL" | "NOT_HELPFUL" | null = type;
    let nextHelpful = helpfulCount;
    let nextNotHelpful = notHelpfulCount;

    if (prevVote === type) {
      // Toggle off / remove vote
      nextVote = null;
      if (type === "HELPFUL") nextHelpful = Math.max(0, nextHelpful - 1);
      else nextNotHelpful = Math.max(0, nextNotHelpful - 1);
    } else {
      // Switching or new vote
      if (type === "HELPFUL") {
        nextHelpful += 1;
        if (prevVote === "NOT_HELPFUL") nextNotHelpful = Math.max(0, nextNotHelpful - 1);
      } else {
        nextNotHelpful += 1;
        if (prevVote === "HELPFUL") nextHelpful = Math.max(0, nextHelpful - 1);
      }
    }

    setUserVote(nextVote);
    setHelpfulCount(nextHelpful);
    setNotHelpfulCount(nextNotHelpful);
    setVoting(true);

    try {
      await submitRealVote(
        review.id,
        (review as any).productSlug || review.productId,
        type,
        auth.user
      );
    } catch (err) {
      // Rollback on API failure
      setUserVote(prevVote);
      setHelpfulCount(prevHelpful);
      setNotHelpfulCount(prevNotHelpful);
    } finally {
      setVoting(false);
    }
  };

  return (
    <div className="review-card-item">
      {/* Top Row: Rating Badge + Title + Relative Date */}
      <div className="review-card-top">
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <RatingBadge rating={review.rating} size="sm" />
          {review.title && <strong className="review-title-text">{review.title}</strong>}
        </div>
        <span className="review-date-text">{formatRelativeTime(review.createdAt)}</span>
      </div>

      {/* Purchased Variation & Attributes */}
      {(review.purchasedSize || review.purchasedColor || review.fit || review.fabricQuality) && (
        <div className="review-tags-row">
          {review.purchasedSize && <span className="review-meta-pill">Size: {review.purchasedSize}</span>}
          {review.purchasedColor && <span className="review-meta-pill">Color: {review.purchasedColor}</span>}
          {review.fit && <span className="review-meta-pill">Fit: {review.fit.replace(/_/g, " ")}</span>}
          {review.fabricQuality && (
            <span className="review-meta-pill">Fabric: {review.fabricQuality.replace(/_/g, " ")}</span>
          )}
        </div>
      )}

      {/* Review Comment Body */}
      {review.comment && <p className="review-comment-body">{review.comment}</p>}

      {/* Review Photos Strip */}
      {review.images && review.images.length > 0 && (
        <div className="review-photos-strip">
          {review.images.map((img) => (
            <button
              key={img.id}
              type="button"
              className="review-thumb-btn"
              onClick={() => onOpenPhotoLightbox?.(img.url)}
              aria-label="View photo"
            >
              <img src={resolveImageUrl(img.url)} alt="Review attachment" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {/* Bottom Row: Verified Buyer Name + Helpful Voting */}
      <div className="review-card-bottom">
        <div className="author-verified-badge">
          {review.isVerified && <CheckCircle2 size={13} color="#059669" />}
          <span className="author-name">{review.author}</span>
          {review.isVerified && <span className="verified-buyer-text">Verified Buyer</span>}
          {review.isOwnReview && onEdit && (
            <button type="button" onClick={onEdit} className="edit-own-review-btn">
              Edit
            </button>
          )}
        </div>

        {/* Helpful / Not Helpful Votes */}
        <div className="review-votes-group">
          <button
            type="button"
            className={`vote-btn ${userVote === "HELPFUL" ? "active-up" : ""}`}
            onClick={() => handleVote("HELPFUL")}
            disabled={voting || review.isOwnReview}
            title={review.isOwnReview ? "Cannot vote on own review" : "Helpful review"}
            aria-label="Helpful"
          >
            <ThumbsUp size={14} />
            <span>{helpfulCount > 0 ? helpfulCount : ""}</span>
          </button>

          <button
            type="button"
            className={`vote-btn ${userVote === "NOT_HELPFUL" ? "active-down" : ""}`}
            onClick={() => handleVote("NOT_HELPFUL")}
            disabled={voting || review.isOwnReview}
            title={review.isOwnReview ? "Cannot vote on own review" : "Not helpful review"}
            aria-label="Not helpful"
          >
            <ThumbsDown size={14} />
            <span>{notHelpfulCount > 0 ? notHelpfulCount : ""}</span>
          </button>
        </div>
      </div>

      {/* Official Store Replies */}
      {review.replies && review.replies.length > 0 && (
        <div className="official-reply-card">
          <div className="official-reply-head">
            <MessageSquare size={13} color="var(--gold)" />
            <span>SHADOW SHOP Official Response</span>
          </div>
          <p className="official-reply-body">{review.replies[0].text}</p>
        </div>
      )}
    </div>
  );
}
