import { useState, useRef, useEffect } from "react";
import { X, Upload, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { api, resolveImageUrl } from "../../api";
import { useAuth } from "../../features/auth/AuthContext";
import { submitRealReview } from "../../services/reviewStore";
import type { ReviewEligibility } from "../../types";
import { RatingStarSelector } from "./RatingStars";

interface ReviewFormModalProps {
  slug: string;
  productName: string;
  productThumbnail?: string;
  eligibility: ReviewEligibility;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReviewFormModal({
  slug,
  productName,
  productThumbnail,
  eligibility,
  isOpen,
  onClose,
  onSuccess,
}: ReviewFormModalProps) {
  const auth = useAuth();
  const existing = eligibility.existingReview;
  const isEditing = Boolean(existing?.id);

  const [rating, setRating] = useState<number>(existing?.rating || 5);
  const [title, setTitle] = useState<string>(existing?.title || "");
  const [comment, setComment] = useState<string>(existing?.comment || "");
  const [fit, setFit] = useState<string>(existing?.fit || "TRUE_TO_SIZE");
  const [fabricQuality, setFabricQuality] = useState<string>(existing?.fabricQuality || "EXCELLENT");
  const [comfort, setComfort] = useState<string>(existing?.comfort || "VERY_COMFORTABLE");

  // Existing uploaded images
  const [existingImages, setExistingImages] = useState<string[]>(
    existing?.images?.map((i) => i.url) || []
  );

  // New files selected by user
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newFilePreviews, setNewFilePreviews] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (existing) {
      setRating(existing.rating || 5);
      setTitle(existing.title || "");
      setComment(existing.comment || "");
      setFit(existing.fit || "TRUE_TO_SIZE");
      setFabricQuality(existing.fabricQuality || "EXCELLENT");
      setComfort(existing.comfort || "VERY_COMFORTABLE");
      setExistingImages(existing.images?.map((i) => i.url) || []);
    }
  }, [existing]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const totalCurrent = existingImages.length + newFiles.length;
    const availableSlots = 5 - totalCurrent;

    if (availableSlots <= 0) {
      setErrorMsg("You can upload a maximum of 5 images.");
      return;
    }

    const validFiles: File[] = [];
    const validPreviews: string[] = [];

    for (const file of files.slice(0, availableSlots)) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg(`File "${file.name}" exceeds 5MB limit.`);
        continue;
      }
      validFiles.push(file);
      validPreviews.push(URL.createObjectURL(file));
    }

    setNewFiles((prev) => [...prev, ...validFiles]);
    setNewFilePreviews((prev) => [...prev, ...validPreviews]);
    setErrorMsg("");
  };

  const removeNewFile = (index: number) => {
    URL.revokeObjectURL(newFilePreviews[index]);
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
    setNewFilePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setErrorMsg("Please select a star rating (1 to 5 stars).");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      // 1. Upload any new files if present
      let uploadedUrls: string[] = [];
      if (newFiles.length > 0) {
        try {
          const formData = new FormData();
          for (const file of newFiles) {
            formData.append("images", file);
          }
          const uploadRes = await api<{ urls: string[] }>("/reviews/upload-images", {
            method: "POST",
            body: formData,
          });
          uploadedUrls = uploadRes.urls || [];
        } catch {
          // Client data URL conversion fallback if backend upload is offline
          uploadedUrls = await Promise.all(
            newFiles.map(
              (file) =>
                new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(file);
                })
            )
          );
        }
      }

      if (!auth.user) {
        setErrorMsg("Please sign in with your buyer account to submit a review.");
        setLoading(false);
        return;
      }

      const allImageUrls = [...existingImages, ...uploadedUrls];

      // 2. Submit or update review via real persistent review service
      await submitRealReview(
        slug,
        eligibility.orderItemId || slug,
        {
          rating,
          title: title.trim(),
          comment: comment.trim(),
          images: allImageUrls,
          fit,
          fabricQuality,
          comfort,
        },
        auth.user
      );

      setSuccessMsg(isEditing ? "Review updated successfully!" : "Review published successfully! Thank you for sharing your experience.");

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit review. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="review-modal-backdrop" onClick={onClose}>
      <div className="review-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="review-modal-header">
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>
              {isEditing ? "Edit Your Review" : "Rate & Review Product"}
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
              {productName}
            </p>
          </div>
          <button type="button" className="review-modal-close" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>

        {/* Product snapshot preview */}
        {productThumbnail && (
          <div className="review-modal-product-preview">
            <img src={resolveImageUrl(productThumbnail)} alt={productName} />
            <div>
              <strong>{productName}</strong>
              <div style={{ display: "flex", gap: "10px", marginTop: "4px", fontSize: "12px", color: "var(--muted)" }}>
                {eligibility.purchasedSize && <span>Size: <b>{eligibility.purchasedSize}</b></span>}
                {eligibility.purchasedColor && <span>Color: <b>{eligibility.purchasedColor}</b></span>}
                <span style={{ color: "#059669", fontWeight: 700 }}>✓ Verified Buyer</span>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="review-form">
          {/* Star Rating Section */}
          <div className="form-group">
            <label style={{ fontWeight: 700, fontSize: "14px", display: "block", marginBottom: "8px" }}>
              Your Overall Rating *
            </label>
            <RatingStarSelector value={rating} onChange={setRating} size={36} />
          </div>

          {/* Feedback attributes */}
          <div className="form-row-triplet">
            <div className="form-group">
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>Fit</label>
              <select value={fit} onChange={(e) => setFit(e.target.value)} className="review-select">
                <option value="TRUE_TO_SIZE">True to size</option>
                <option value="RUNS_SMALL">Runs small</option>
                <option value="RUNS_LARGE">Runs large</option>
              </select>
            </div>

            <div className="form-group">
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>Fabric Quality</label>
              <select value={fabricQuality} onChange={(e) => setFabricQuality(e.target.value)} className="review-select">
                <option value="EXCELLENT">Excellent</option>
                <option value="GOOD">Good</option>
                <option value="FAIR">Fair</option>
                <option value="POOR">Poor</option>
              </select>
            </div>

            <div className="form-group">
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>Comfort</label>
              <select value={comfort} onChange={(e) => setComfort(e.target.value)} className="review-select">
                <option value="VERY_COMFORTABLE">Very comfortable</option>
                <option value="AVERAGE">Average</option>
                <option value="UNCOMFORTABLE">Uncomfortable</option>
              </select>
            </div>
          </div>

          {/* Review Title */}
          <div className="form-group">
            <label style={{ fontWeight: 700, fontSize: "13.5px", display: "block", marginBottom: "6px" }}>
              Review Title (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Wonderful shirt, great fabric quality!"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              className="review-input"
            />
          </div>

          {/* Review Comment */}
          <div className="form-group">
            <label style={{ fontWeight: 700, fontSize: "13.5px", display: "block", marginBottom: "6px" }}>
              Detailed Review (Optional)
            </label>
            <textarea
              placeholder="Share your thoughts on fit, material, look and feel to help other shoppers..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={2000}
              className="review-textarea"
            />
            <small style={{ color: "var(--muted)", fontSize: "11px", display: "block", textAlign: "right" }}>
              {comment.length} / 2000
            </small>
          </div>

          {/* Photo Upload Section */}
          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
              <label style={{ fontWeight: 700, fontSize: "13.5px" }}>
                Add Photos (Max 5)
              </label>
              <span style={{ fontSize: "11.5px", color: "var(--muted)" }}>
                {existingImages.length + newFiles.length} of 5 photos
              </span>
            </div>

            {/* Photo preview thumbnails */}
            <div className="photo-upload-previews">
              {existingImages.map((url, idx) => (
                <div key={`exist-${idx}`} className="photo-preview-item">
                  <img src={resolveImageUrl(url)} alt="Review preview" />
                  <button
                    type="button"
                    onClick={() => removeExistingImage(idx)}
                    className="remove-photo-btn"
                    aria-label="Remove photo"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}

              {newFilePreviews.map((url, idx) => (
                <div key={`new-${idx}`} className="photo-preview-item">
                  <img src={url} alt="Local preview" />
                  <button
                    type="button"
                    onClick={() => removeNewFile(idx)}
                    className="remove-photo-btn"
                    aria-label="Remove photo"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}

              {existingImages.length + newFiles.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="upload-photo-placeholder"
                  aria-label="Upload photo"
                >
                  <Upload size={20} />
                  <span>Upload</span>
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </div>

          {/* Feedback Alerts */}
          {errorMsg && (
            <div className="review-alert error">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="review-alert success">
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Submit Button */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px" }}>
            <button type="button" onClick={onClose} className="button ghost" disabled={loading}>
              Cancel
            </button>
            <button
              type="submit"
              className="button"
              disabled={loading}
              style={{ minWidth: "160px" }}
            >
              {loading ? "Submitting..." : isEditing ? "Update Review" : "Submit Review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
