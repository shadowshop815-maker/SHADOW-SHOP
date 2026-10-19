import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { resolveImageUrl } from "../../api";
import type { CustomerPhotoItem } from "../../types";
import { RatingBadge } from "./RatingStars";

interface ReviewPhotoGalleryProps {
  photos: CustomerPhotoItem[];
}

export function ReviewPhotoGallery({ photos }: ReviewPhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft") {
        setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : photos.length - 1));
      }
      if (e.key === "ArrowRight") {
        setLightboxIndex((prev) => (prev !== null && prev < photos.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, photos.length]);

  if (!photos || photos.length === 0) return null;

  const mainPhoto = photos[0];
  const sidePhotos = photos.slice(1, 5);
  const remainingCount = photos.length > 5 ? photos.length - 5 : 0;

  return (
    <div className="customer-photo-gallery-section">
      <div className="customer-photo-header">
        <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text)" }}>
          Customer Photos ({photos.length})
        </h4>
        <span style={{ fontSize: "12px", color: "var(--muted)" }}>Click to view full screen</span>
      </div>

      <div className="flipkart-photo-grid">
        {/* Large Tile (Left) */}
        {mainPhoto && (
          <button
            type="button"
            className="gallery-tile large-tile"
            onClick={() => setLightboxIndex(0)}
            aria-label={`View photo 1 of ${photos.length}`}
          >
            <img
              src={resolveImageUrl(mainPhoto.url)}
              alt="Customer photo"
              loading="lazy"
            />
          </button>
        )}

        {/* 2x2 Grid (Right) */}
        <div className="side-photo-grid">
          {sidePhotos.map((photo, index) => {
            const actualIndex = index + 1;
            const isLastTile = index === 3;
            const hasMore = isLastTile && remainingCount > 0;

            return (
              <button
                key={photo.id || index}
                type="button"
                className="gallery-tile small-tile"
                onClick={() => setLightboxIndex(actualIndex)}
                aria-label={`View photo ${actualIndex + 1} of ${photos.length}`}
              >
                <img
                  src={resolveImageUrl(photo.url)}
                  alt="Customer thumbnail"
                  loading="lazy"
                />
                {hasMore && (
                  <div className="more-photos-overlay">
                    <span>+{remainingCount}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div className="lightbox-backdrop" onClick={() => setLightboxIndex(null)}>
          <div className="lightbox-dialog" onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <button
              type="button"
              className="lightbox-close-btn"
              onClick={() => setLightboxIndex(null)}
              aria-label="Close photo preview"
            >
              <X size={22} />
            </button>

            {/* Previous Arrow */}
            {photos.length > 1 && (
              <button
                type="button"
                className="lightbox-nav-btn prev-btn"
                onClick={() =>
                  setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : photos.length - 1))
                }
                aria-label="Previous image"
              >
                <ChevronLeft size={28} />
              </button>
            )}

            {/* Current Image */}
            <div className="lightbox-image-container">
              <img
                src={resolveImageUrl(photos[lightboxIndex].url)}
                alt={`Customer review photo ${lightboxIndex + 1}`}
                className="lightbox-main-img"
              />
            </div>

            {/* Next Arrow */}
            {photos.length > 1 && (
              <button
                type="button"
                className="lightbox-nav-btn next-btn"
                onClick={() =>
                  setLightboxIndex((prev) => (prev !== null && prev < photos.length - 1 ? prev + 1 : 0))
                }
                aria-label="Next image"
              >
                <ChevronRight size={28} />
              </button>
            )}

            {/* Photo Metadata Footer */}
            <div className="lightbox-footer">
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <RatingBadge rating={photos[lightboxIndex].rating} size="sm" />
                <span style={{ fontWeight: 700, fontSize: "14px", color: "#ffffff" }}>
                  {photos[lightboxIndex].author}
                </span>
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px" }}>
                  Photo {lightboxIndex + 1} of {photos.length}
                </span>
              </div>
              {photos[lightboxIndex].title && (
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#ffffff", fontWeight: 600 }}>
                  {photos[lightboxIndex].title}
                </p>
              )}
              {photos[lightboxIndex].comment && (
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
                  {photos[lightboxIndex].comment}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
