import React, { useState, useEffect, useRef } from "react";
import { X, Tag, CheckCircle2, AlertCircle, MapPin, Clock, RefreshCw, Loader2 } from "lucide-react";
import { money } from "../../api";

interface OfferDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  offers: any[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  appliedCode?: string | null;
  isApplying?: boolean;
  onApply: (code: string, onError?: (msg: string) => void) => void;
  onRemove: () => void;
}

export function OfferDrawer({
  isOpen,
  onClose,
  offers,
  isLoading = false,
  isError = false,
  onRetry,
  appliedCode,
  isApplying = false,
  onApply,
  onRemove
}: OfferDrawerProps) {
  const [applyingCode, setApplyingCode] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [manualCode, setManualCode] = useState("");
  const [manualError, setManualError] = useState("");
  const [isApplyingManual, setIsApplyingManual] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "auto";
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (appliedCode) {
      setApplyingCode(null);
      setErrorCode(null);
      setErrorMsg("");
    }
  }, [appliedCode]);

  useEffect(() => {
    if (!isApplying) setApplyingCode(null);
  }, [isApplying]);

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleCardApply = (code: string) => {
    if (applyingCode || isApplying) return;
    setApplyingCode(code);
    setErrorCode(null);
    setErrorMsg("");
    onApply(code, (msg: string) => {
      setApplyingCode(null);
      setErrorCode(code);
      setErrorMsg(msg);
    });
  };

  const handleManualApply = () => {
    if (isApplyingManual || isApplying) return;
    const code = manualCode.trim().toUpperCase();
    if (!code) return;
    setManualError("");
    setIsApplyingManual(true);
    onApply(code, (msg: string) => {
      setIsApplyingManual(false);
      setManualError(msg);
    });
  };

  const appliedOffer = offers.find(o => o.code === appliedCode);
  const otherOffers = offers.filter(o => o.code !== appliedCode);

  // Separate eligible from ineligible for display ordering
  const eligibleOffers = otherOffers.filter(o => o.eligibility?.eligible);
  const ineligibleOffers = otherOffers.filter(o => !o.eligibility?.eligible);

  return (
    <>
      {/* Backdrop */}
      <div 
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(4px)",
          zIndex: 9999,
          opacity: isOpen ? 1 : 0,
          visibility: isOpen ? "visible" : "hidden",
          transition: "all 0.3s ease",
        }}
      />

      {/* Drawer */}
      <div style={{
        position: "fixed",
        top: 0, right: 0, bottom: 0,
        width: "100%",
        maxWidth: "420px",
        background: "var(--bg, #F9F9F9)",
        zIndex: 10000,
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        display: "flex",
        flexDirection: "column",
        boxShadow: "-12px 0 48px rgba(0,0,0,0.12)"
      }}>
        {/* Header */}
        <div style={{ 
          display: "flex", alignItems: "center", justifyContent: "space-between", 
          padding: "18px 20px", 
          background: "var(--card, #fff)", 
          borderBottom: "1px solid var(--border, #E5E5E5)", 
          flexShrink: 0
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "var(--text, #000)", display: "flex", alignItems: "center", gap: "8px" }}>
              <Tag size={16} color="var(--gold, #b58a35)" />
              Offers & Coupons
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted, #888)" }}>
              {isLoading ? "Loading available offers..." : `${offers.length} offer${offers.length !== 1 ? "s" : ""} available`}
            </p>
          </div>
          <button 
            onClick={onClose} 
            style={{ 
              background: "var(--layer-2, #F5F5F5)", 
              border: "none", 
              cursor: "pointer", 
              color: "var(--text, #444)", 
              padding: "8px", 
              borderRadius: "10px",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.2s"
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Manual Code Entry */}
        <div style={{ 
          padding: "16px 20px", 
          background: "var(--card, #fff)", 
          borderBottom: "1px solid var(--border, #EAEAEA)",
          flexShrink: 0
        }}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted, #666)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Have a code?
          </p>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Enter offer code"
              value={manualCode}
              onChange={e => { setManualCode(e.target.value.toUpperCase()); setManualError(""); }}
              onKeyDown={e => e.key === "Enter" && handleManualApply()}
              style={{
                flex: 1,
                padding: "10px 14px",
                border: manualError ? "1.5px solid var(--danger, #dc2626)" : "1.5px solid var(--border, #E0E0E0)",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.04em",
                background: "var(--layer-1, #FAFAFA)",
                color: "var(--text, #000)",
                outline: "none",
                transition: "border-color 0.2s"
              }}
            />
            <button
              onClick={handleManualApply}
              disabled={!manualCode.trim() || isApplyingManual || isApplying}
              style={{
                padding: "10px 18px",
                background: manualCode.trim() ? "var(--gold, #b58a35)" : "var(--layer-2, #EAEAEA)",
                color: manualCode.trim() ? "#fff" : "var(--muted, #999)",
                border: "none",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: 800,
                cursor: manualCode.trim() ? "pointer" : "not-allowed",
                flexShrink: 0,
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              {isApplyingManual ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : null}
              APPLY
            </button>
          </div>
          {manualError && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px" }}>
              <AlertCircle size={13} color="var(--danger, #dc2626)" />
              <span style={{ fontSize: "12px", color: "var(--danger, #dc2626)", fontWeight: 600 }}>{manualError}</span>
            </div>
          )}
        </div>

        {/* Content Area - Scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          
          {/* LOADING STATE */}
          {isLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1, 2].map(i => (
                <div key={i} style={{ 
                  height: "110px", borderRadius: "16px", 
                  background: "linear-gradient(90deg, var(--layer-2, #f0f0f0) 25%, var(--layer-1, #f8f8f8) 50%, var(--layer-2, #f0f0f0) 75%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 1.5s infinite"
                }} />
              ))}
              <style>{`
                @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
              `}</style>
            </div>
          )}

          {/* ERROR STATE */}
          {!isLoading && isError && (
            <div style={{ textAlign: "center", padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <AlertCircle size={36} color="var(--danger, #dc2626)" style={{ opacity: 0.6 }} />
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "var(--text)" }}>Couldn't load offers</p>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--muted)" }}>Check your connection and try again.</p>
              </div>
              {onRetry && (
                <button
                  onClick={onRetry}
                  style={{ 
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "10px 20px", borderRadius: "10px",
                    background: "var(--layer-2)", border: "1px solid var(--border)",
                    fontSize: "13px", fontWeight: 700, cursor: "pointer", color: "var(--text)"
                  }}
                >
                  <RefreshCw size={14} /> Try Again
                </button>
              )}
            </div>
          )}

          {/* EMPTY STATE */}
          {!isLoading && !isError && offers.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--muted)", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <Tag size={40} color="#CCC" />
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "var(--text, #333)" }}>No active offers right now</p>
                <p style={{ margin: "4px 0 0", fontSize: "12px" }}>Check back soon for new deals.</p>
              </div>
            </div>
          )}

          {/* OFFERS LIST */}
          {!isLoading && !isError && offers.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

              {/* Applied Offer */}
              {appliedOffer && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <SectionLabel>Applied Offer</SectionLabel>
                  <OfferCard
                    offer={appliedOffer}
                    isApplied={true}
                    isApplying={false}
                    onRemove={onRemove}
                    disabled={isApplying}
                    errorMsg={null}
                  />
                </div>
              )}

              {/* Eligible Offers */}
              {eligibleOffers.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <SectionLabel>{appliedOffer ? "Other Available Offers" : "Available Offers"}</SectionLabel>
                  {eligibleOffers.map(offer => (
                    <OfferCard
                      key={offer.id}
                      offer={offer}
                      isApplied={false}
                      isApplying={applyingCode === offer.code}
                      onApply={() => handleCardApply(offer.code)}
                      disabled={isApplying || applyingCode !== null}
                      errorMsg={errorCode === offer.code ? errorMsg : null}
                    />
                  ))}
                </div>
              )}

              {/* Ineligible Offers — still visible with reason */}
              {ineligibleOffers.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <SectionLabel muted>
                    {eligibleOffers.length === 0 && !appliedOffer ? "Offers Available" : "Other Offers"}
                  </SectionLabel>
                  {ineligibleOffers.map(offer => (
                    <OfferCard
                      key={offer.id}
                      offer={offer}
                      isApplied={false}
                      isApplying={applyingCode === offer.code}
                      onApply={() => handleCardApply(offer.code)}
                      disabled={isApplying || applyingCode !== null}
                      errorMsg={errorCode === offer.code ? errorMsg : null}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function SectionLabel({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <div style={{ 
      fontSize: "10.5px", fontWeight: 800, 
      letterSpacing: "1.2px", 
      color: muted ? "var(--muted, #999)" : "var(--gold, #b58a35)", 
      textTransform: "uppercase", 
      paddingLeft: "2px",
      paddingBottom: "2px"
    }}>
      {children}
    </div>
  );
}

function OfferCard({ offer, isApplied, isApplying, onApply, onRemove, disabled, errorMsg }: any) {
  const isEligible = offer.eligibility?.eligible;
  const eligCode = offer.eligibility?.code;
  const eligMsg = offer.eligibility?.message;

  const discountText = offer.discountType === "PERCENTAGE" 
    ? `${offer.discountValue}%` 
    : offer.discountType === "FIXED" 
      ? `₹${offer.discountValue}` 
      : "FREE";
  
  const discountLabel = offer.discountType === "FREE_DELIVERY" 
    ? "DELIVERY" 
    : offer.discountType === "PERCENTAGE" 
      ? "OFF" 
      : "OFF";

  // Status badge logic
  const needsAddress = eligCode === "ADDRESS_REQUIRED";
  const outsideRadius = eligCode === "OUTSIDE_OFFER_RADIUS";
  const minNotMet = eligCode === "MINIMUM_ORDER_NOT_MET";

  const getEligibilityBadge = () => {
    if (isApplied) return null;
    if (isEligible) return (
      <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 700, color: "var(--success, #059669)" }}>
        <CheckCircle2 size={12} />
        Applicable for your order
      </div>
    );
    if (needsAddress) return (
      <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 600, color: "var(--muted, #888)" }}>
        <MapPin size={12} />
        Select a delivery address to check
      </div>
    );
    if (outsideRadius) return (
      <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 600, color: "var(--danger, #dc2626)" }}>
        <MapPin size={12} />
        {eligMsg || "Outside delivery radius"}
      </div>
    );
    if (minNotMet) return (
      <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 600, color: "#e97d00" }}>
        <AlertCircle size={12} />
        {eligMsg || "Minimum order not met"}
      </div>
    );
    return (
      <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted, #888)", lineHeight: 1.3 }}>
        {eligMsg || "Not eligible for this order"}
      </div>
    );
  };

  return (
    <div style={{ 
      background: isApplied ? "rgba(181, 138, 53, 0.04)" : "var(--card, #fff)", 
      border: isApplied 
        ? "1.5px solid var(--gold, #b58a35)" 
        : errorMsg 
          ? "1.5px solid var(--danger, #dc2626)" 
          : "1px solid var(--border, #EAEAEA)", 
      borderRadius: "16px", 
      position: "relative",
      transition: "all 0.25s ease",
      opacity: (!isEligible && !isApplied && !needsAddress) ? 0.72 : 1,
      overflow: "hidden",
      boxShadow: isApplied 
        ? "0 4px 20px rgba(181, 138, 53, 0.12)" 
        : "0 1px 4px rgba(0,0,0,0.04)",
      display: "flex",
      alignItems: "stretch"
    }}>

      {/* Left: Discount Value Column */}
      <div style={{
        padding: "20px 14px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minWidth: "84px",
        background: isApplied ? "rgba(181, 138, 53, 0.06)" : "var(--layer-1, #FDFDFD)",
        borderRight: isApplied ? "1px dashed rgba(181, 138, 53, 0.35)" : "1px dashed var(--border, #EAEAEA)",
        position: "relative",
        flexShrink: 0
      }}>
        {/* Notch decorations */}
        <div style={{ position: "absolute", right: "-8px", top: "-8px", width: "16px", height: "16px", background: "var(--bg, #F9F9F9)", borderRadius: "50%", borderBottom: "1px solid var(--border, #EAEAEA)", borderLeft: "1px solid var(--border, #EAEAEA)" }} />
        <div style={{ position: "absolute", right: "-8px", bottom: "-8px", width: "16px", height: "16px", background: "var(--bg, #F9F9F9)", borderRadius: "50%", borderTop: "1px solid var(--border, #EAEAEA)", borderLeft: "1px solid var(--border, #EAEAEA)" }} />
        
        <strong style={{ fontSize: "22px", fontWeight: 900, color: isApplied ? "var(--gold, #b58a35)" : "var(--text, #111)", lineHeight: 1, letterSpacing: "-0.5px" }}>
          {discountText}
        </strong>
        <span style={{ fontSize: "10px", fontWeight: 800, color: isApplied ? "var(--gold, #b58a35)" : "var(--muted, #888)", letterSpacing: "1.2px", marginTop: "4px", textTransform: "uppercase" }}>
          {discountLabel}
        </span>
      </div>

      {/* Right: Details */}
      <div style={{ padding: "14px 14px 14px 16px", flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        
        {/* Code + Name Row */}
        <div style={{ marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
            <Tag size={11} color={isApplied ? "var(--gold, #b58a35)" : "var(--muted, #999)"} />
            <span style={{ fontSize: "11px", color: isApplied ? "var(--gold, #b58a35)" : "var(--muted, #666)", fontWeight: 800, letterSpacing: "0.6px" }}>
              {offer.code}
            </span>
          </div>
          <strong style={{ fontSize: "14px", fontWeight: 800, color: "var(--text, #000)", letterSpacing: "-0.1px", lineHeight: 1.2 }}>
            {offer.name}
          </strong>
        </div>

        {/* Meta info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginBottom: "10px" }}>
          {Number(offer.minOrderAmount) > 0 && (
            <span style={{ fontSize: "11px", color: "var(--muted, #777)" }}>
              Min. <strong style={{ color: "var(--text, #333)" }}>{money(offer.minOrderAmount)}</strong>
            </span>
          )}
          {offer.discountType === "PERCENTAGE" && Number(offer.maxDiscountAmount) > 0 && (
            <span style={{ fontSize: "11px", color: "var(--muted, #777)" }}>
              Max. <strong style={{ color: "var(--text, #333)" }}>{money(offer.maxDiscountAmount)}</strong>
            </span>
          )}
          {offer.radiusKm != null && (
            <span style={{ fontSize: "11px", color: "var(--muted, #777)", display: "flex", alignItems: "center", gap: "3px" }}>
              <MapPin size={10} />
              Within <strong style={{ color: "var(--text, #333)" }}>{offer.radiusKm} KM</strong>
            </span>
          )}
          {offer.endsAt && (
            <span style={{ fontSize: "11px", color: "var(--muted, #777)", display: "flex", alignItems: "center", gap: "3px" }}>
              <Clock size={10} />
              Expires {new Date(offer.endsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>

        {/* Error message */}
        {errorMsg && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", padding: "7px 10px", background: "rgba(220,38,38,0.06)", borderRadius: "8px", marginBottom: "10px" }}>
            <AlertCircle size={13} color="var(--danger, #dc2626)" style={{ flexShrink: 0, marginTop: "1px" }} />
            <span style={{ fontSize: "11px", color: "var(--danger, #dc2626)", fontWeight: 600, lineHeight: 1.3 }}>{errorMsg}</span>
          </div>
        )}

        {/* Bottom: Eligibility + Action */}
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--border, #F0F0F0)", paddingTop: "10px", gap: "8px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {getEligibilityBadge()}
          </div>
          
          {isApplied ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--success, #059669)", fontWeight: 800, fontSize: "12px" }}>
                <CheckCircle2 size={14} fill="var(--success, #059669)" color="#fff" />
                APPLIED
              </div>
              <button 
                onClick={onRemove}
                disabled={disabled}
                style={{ 
                  background: "none", border: "none", color: "var(--danger, #dc2626)", 
                  fontSize: "12px", fontWeight: 800, padding: 0, cursor: "pointer",
                  opacity: disabled ? 0.5 : 1, letterSpacing: "0.3px"
                }}
              >
                REMOVE
              </button>
            </div>
          ) : (
            <button 
              onClick={onApply}
              disabled={disabled || (!isEligible && !needsAddress)}
              style={{ 
                flexShrink: 0,
                padding: "7px 14px",
                background: isEligible ? "var(--gold, #b58a35)" : "transparent",
                border: isEligible ? "none" : "1px solid var(--border, #E0E0E0)",
                color: isEligible ? "#fff" : "var(--muted, #999)",
                borderRadius: "8px",
                fontSize: "12px", 
                fontWeight: 800,
                letterSpacing: "0.4px",
                cursor: (disabled || (!isEligible && !needsAddress)) ? "not-allowed" : "pointer",
                opacity: (disabled && !isApplying) ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                gap: "5px",
                transition: "all 0.2s"
              }}
            >
              {isApplying ? (
                <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
              ) : null}
              {isApplying ? "..." : "APPLY"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
