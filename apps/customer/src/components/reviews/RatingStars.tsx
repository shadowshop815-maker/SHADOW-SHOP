import { useState } from "react";
import { Star } from "lucide-react";

interface RatingBadgeProps {
  rating: number | string;
  size?: "sm" | "md" | "lg";
  count?: number;
  showCount?: boolean;
  className?: string;
}

/**
 * Flipkart-style green rating badge (e.g. 4.1 ★)
 */
export function RatingBadge({ rating, size = "md", count, showCount = false, className = "" }: RatingBadgeProps) {
  const num = Number(rating);
  if (num <= 0 || isNaN(num)) return null;

  const formatted = num % 1 === 0 ? num.toFixed(0) : num.toFixed(1);

  // Flipkart color mapping based on rating
  let bg = "#388e3c"; // Deep green for >= 4.0
  if (num < 3.0) bg = "#d32f2f"; // Red for < 3
  else if (num < 3.8) bg = "#f57c00"; // Orange for 3.0 - 3.7

  const sizeStyles = {
    sm: { padding: "2px 6px", fontSize: "11px", iconSize: 10, gap: "3px" },
    md: { padding: "3px 8px", fontSize: "12.5px", iconSize: 12, gap: "4px" },
    lg: { padding: "5px 12px", fontSize: "15px", iconSize: 14, gap: "6px" },
  }[size];

  return (
    <span
      className={`rating-badge-pill ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: sizeStyles.gap,
        background: bg,
        color: "#ffffff",
        fontWeight: 700,
        borderRadius: "4px",
        padding: sizeStyles.padding,
        fontSize: sizeStyles.fontSize,
        lineHeight: 1,
        letterSpacing: "0.02em",
        verticalAlign: "middle",
      }}
    >
      <span>{formatted}</span>
      <Star size={sizeStyles.iconSize} fill="currentColor" stroke="none" />
      {showCount && count !== undefined && count > 0 && (
        <span style={{ opacity: 0.85, fontWeight: 500, marginLeft: 2 }}>({count})</span>
      )}
    </span>
  );
}

interface RatingStarSelectorProps {
  value: number;
  onChange: (val: number) => void;
  size?: number;
}

const RATING_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Average",
  4: "Good",
  5: "Excellent",
};

/**
 * Interactive 1-5 Star Picker with hover states and labels
 */
export function RatingStarSelector({ value, onChange, size = 32 }: RatingStarSelectorProps) {
  const [hover, setHover] = useState<number | null>(null);

  const activeVal = hover ?? value;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }} role="radiogroup" aria-label="Select Rating">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= activeVal;
          return (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(null)}
              style={{
                background: "transparent",
                border: "none",
                padding: "4px",
                cursor: "pointer",
                transition: "transform 0.15s ease",
                transform: hover === star ? "scale(1.2)" : "scale(1)",
              }}
              aria-label={`${star} Star - ${RATING_LABELS[star]}`}
            >
              <Star
                size={size}
                fill={isFilled ? "#ffb400" : "transparent"}
                color={isFilled ? "#ffb400" : "var(--muted)"}
                strokeWidth={isFilled ? 0 : 1.5}
              />
            </button>
          );
        })}
      </div>
      {activeVal > 0 && (
        <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--gold)" }}>
          {activeVal} Star{activeVal > 1 ? "s" : ""} — {RATING_LABELS[activeVal]}
        </span>
      )}
    </div>
  );
}
