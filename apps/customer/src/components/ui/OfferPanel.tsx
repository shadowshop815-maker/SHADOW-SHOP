import React, { useState, useEffect, useRef } from "react";
import {
  Tag, CheckCircle2, AlertCircle, MapPin, Clock,
  RefreshCw, Loader2, ChevronDown, ChevronUp,
  Sparkles, Percent, Truck, Info
} from "lucide-react";
import { money } from "../../api";

interface OfferPanelProps {
  offers: any[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  appliedCode?: string | null;
  isApplying?: boolean;
  onApply: (code: string, onError?: (msg: string) => void) => void;
  onRemove: () => void;
  cartError?: string | null;
}

export function OfferPanel({
  offers,
  isLoading = false,
  isError = false,
  onRetry,
  appliedCode,
  isApplying = false,
  onApply,
  onRemove,
  cartError,
}: OfferPanelProps) {
  const [open, setOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualError, setManualError] = useState("");
  const [isApplyingManual, setIsApplyingManual] = useState(false);
  const [applyingCode, setApplyingCode] = useState<string | null>(null);
  const [cardError, setCardError] = useState<{ code: string; msg: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (appliedCode) {
      setApplyingCode(null);
      setCardError(null);
    }
  }, [appliedCode]);

  useEffect(() => {
    if (!isApplying) setApplyingCode(null);
  }, [isApplying]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const handleManualApply = () => {
    const code = manualCode.trim().toUpperCase();
    if (!code || isApplyingManual || isApplying) return;
    setManualError("");
    setIsApplyingManual(true);
    onApply(code, (msg) => {
      setIsApplyingManual(false);
      setManualError(msg);
    });
  };

  const handleCardApply = (code: string) => {
    if (applyingCode || isApplying) return;
    setApplyingCode(code);
    setCardError(null);
    onApply(code, (msg) => {
      setApplyingCode(null);
      setCardError({ code, msg });
    });
  };

  const appliedOffer = offers.find((o) => o.code === appliedCode);
  const otherOffers = offers.filter((o) => o.code !== appliedCode);
  const eligibleOffers = otherOffers.filter((o) => o.eligibility?.eligible);
  const ineligibleOffers = otherOffers.filter((o) => !o.eligibility?.eligible);

  const totalCount = offers.length;
  const eligibleCount = eligibleOffers.length + (appliedOffer ? 1 : 0);

  return (
    <div style={{ position: "relative" }}>
      <style>{`
        @keyframes op-fadeDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes op-spin { to { transform: rotate(360deg); } }
        @keyframes op-shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        @keyframes op-pop {
          0%   { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1);    opacity: 1; }
        }

        .op-trigger {
          display: flex; align-items: center; justify-content: space-between;
          width: 100%; padding: 13px 16px;
          border: 1.5px solid var(--border, #e5e5e5);
          border-radius: 14px;
          background: var(--card, #fff);
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }
        .op-trigger:hover {
          border-color: var(--gold, #b58a35);
          box-shadow: 0 0 0 3px rgba(181,138,53,0.08);
        }
        .op-trigger.op-open {
          border-color: var(--gold, #b58a35);
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
          border-bottom-color: transparent;
          box-shadow: 0 -2px 12px rgba(0,0,0,0.06);
        }

        .op-panel {
          background: var(--card, #fff);
          border: 1.5px solid var(--gold, #b58a35);
          border-top: none;
          border-bottom-left-radius: 14px;
          border-bottom-right-radius: 14px;
          overflow: hidden;
          animation: op-fadeDown 0.22s ease;
          box-shadow: 0 12px 40px rgba(0,0,0,0.1);
        }

        .op-inp {
          flex: 1; padding: 10px 14px;
          border: 1.5px solid var(--border, #e0e0e0);
          border-radius: 10px;
          font-size: 13px; font-weight: 700; letter-spacing: 0.06em;
          background: var(--layer-1, #fafafa);
          color: var(--text, #111);
          outline: none; font-family: inherit;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .op-inp:focus {
          border-color: var(--gold, #b58a35);
          box-shadow: 0 0 0 3px rgba(181,138,53,0.12);
        }
        .op-inp::placeholder { color: var(--subtle, #aaa); font-weight: 400; }

        .op-apply-btn {
          padding: 10px 18px;
          border: none; border-radius: 10px;
          font-size: 13px; font-weight: 800; letter-spacing: 0.04em;
          cursor: pointer; transition: all 0.2s; font-family: inherit;
          display: flex; align-items: center; gap: 6px; flex-shrink: 0;
        }

        .op-card {
          border: 1px solid var(--border, #eaeaea);
          border-radius: 14px;
          overflow: hidden;
          transition: all 0.2s;
          display: flex; align-items: stretch;
          position: relative;
        }
        .op-card:hover:not(.op-card-ineligible) {
          border-color: rgba(181,138,53,0.4);
          box-shadow: 0 4px 18px rgba(181,138,53,0.1);
          transform: translateY(-1px);
        }
        .op-card-applied {
          border: 1.5px solid var(--gold, #b58a35) !important;
          background: rgba(181,138,53,0.03);
          box-shadow: 0 4px 20px rgba(181,138,53,0.12) !important;
        }
        .op-card-ineligible { opacity: 0.75; }
        .op-card-expired { opacity: 0.55; }

        .op-card-action-btn {
          padding: 7px 14px; border-radius: 9px;
          font-size: 12px; font-weight: 800; letter-spacing: 0.04em;
          border: none; cursor: pointer; transition: all 0.2s; font-family: inherit;
          display: flex; align-items: center; gap: 5px; flex-shrink: 0;
        }
        .op-card-action-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .op-card-remove-btn {
          background: none; border: none; padding: 0;
          color: var(--danger, #dc2626); font-size: 12px; font-weight: 800;
          cursor: pointer; letter-spacing: 0.3px; font-family: inherit;
          transition: opacity 0.2s;
        }
        .op-card-remove-btn:hover { opacity: 0.7; }
        .op-card-remove-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>

      {/* ── Trigger Button ── */}
      <button
        type="button"
        className={`op-trigger${open ? " op-open" : ""}`}
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "32px", height: "32px", borderRadius: "9px",
              background: open || appliedCode
                ? "rgba(181,138,53,0.12)"
                : "var(--layer-2,#f5f5f5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.2s",
            }}
          >
            <Tag size={15} color={open || appliedCode ? "var(--gold,#b58a35)" : "var(--muted,#888)"} />
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text,#111)" }}>
              {appliedCode
                ? <><span style={{ color: "var(--muted,#888)", fontWeight: 500 }}>Applied:</span>{" "}<strong style={{ color: "var(--gold,#b58a35)", letterSpacing: "0.06em" }}>{appliedCode}</strong></>
                : "Offers & Coupons"}
            </div>
            {!appliedCode && totalCount > 0 && (
              <div style={{ fontSize: "11px", color: "var(--muted,#888)", marginTop: "1px" }}>
                {isLoading ? "Loading…" : `${totalCount} offer${totalCount !== 1 ? "s" : ""} available`}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          {isLoading && (
            <Loader2
              size={14}
              style={{ animation: "op-spin 1s linear infinite", color: "var(--gold,#b58a35)" }}
            />
          )}
          {eligibleCount > 0 && !appliedCode && (
            <span
              style={{
                background: "rgba(181,138,53,0.12)",
                color: "var(--gold,#b58a35)",
                fontSize: "11px", fontWeight: 800,
                padding: "2px 8px", borderRadius: "999px",
              }}
            >
              {eligibleCount}
            </span>
          )}
          {open ? (
            <ChevronUp size={16} color="var(--gold,#b58a35)" />
          ) : (
            <ChevronDown size={16} color="var(--muted,#888)" />
          )}
        </div>
      </button>

      {/* ── Panel ── */}
      {open && (
        <div ref={panelRef} className="op-panel">
          {/* Manual Code Input */}
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid var(--border,#eaeaea)",
              background: "var(--layer-1,#fafafa)",
            }}
          >
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                ref={inputRef}
                className="op-inp"
                type="text"
                placeholder="Enter code e.g. SAVE100"
                value={manualCode}
                style={{ borderColor: manualError ? "var(--danger,#dc2626)" : undefined }}
                onChange={(e) => { setManualCode(e.target.value.toUpperCase()); setManualError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleManualApply()}
              />
              <button
                type="button"
                className="op-apply-btn"
                disabled={!manualCode.trim() || isApplyingManual || isApplying}
                onClick={handleManualApply}
                style={{
                  background: manualCode.trim() ? "var(--gold,#b58a35)" : "var(--layer-2,#eaeaea)",
                  color: manualCode.trim() ? "#fff" : "var(--muted,#aaa)",
                }}
              >
                {isApplyingManual ? (
                  <Loader2 size={13} style={{ animation: "op-spin 1s linear infinite" }} />
                ) : null}
                APPLY
              </button>
            </div>
            {manualError && (
              <div
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  marginTop: "8px", fontSize: "12px",
                  color: "var(--danger,#dc2626)", fontWeight: 600,
                  animation: "op-pop 0.2s ease",
                }}
              >
                <AlertCircle size={13} /> {manualError}
              </div>
            )}
            {cartError && !manualError && (
              <div
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  marginTop: "8px", fontSize: "12px",
                  color: "var(--danger,#dc2626)", fontWeight: 600,
                  animation: "op-pop 0.2s ease",
                }}
              >
                <AlertCircle size={13} /> {cartError}
              </div>
            )}
          </div>

          {/* Offers List */}
          <div
            style={{
              maxHeight: "420px",
              overflowY: "auto",
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {/* Loading skeleton */}
            {isLoading && [1, 2].map((i) => (
              <div
                key={i}
                style={{
                  height: "96px", borderRadius: "14px",
                  background: "linear-gradient(90deg,var(--layer-2,#f0f0f0) 25%,var(--layer-1,#f8f8f8) 50%,var(--layer-2,#f0f0f0) 75%)",
                  backgroundSize: "200% 100%",
                  animation: "op-shimmer 1.5s infinite",
                }}
              />
            ))}

            {/* Error state */}
            {!isLoading && isError && (
              <div
                style={{
                  textAlign: "center", padding: "24px 16px",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
                }}
              >
                <AlertCircle size={28} color="var(--danger,#dc2626)" style={{ opacity: 0.5 }} />
                <div>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>
                    Couldn't load offers
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                    Check your connection and try again.
                  </p>
                </div>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      padding: "8px 16px", borderRadius: "10px",
                      background: "var(--layer-2)", border: "1px solid var(--border)",
                      fontSize: "12px", fontWeight: 700, cursor: "pointer",
                      color: "var(--text)", fontFamily: "inherit",
                    }}
                  >
                    <RefreshCw size={13} /> Try Again
                  </button>
                )}
              </div>
            )}

            {/* Empty state */}
            {!isLoading && !isError && offers.length === 0 && (
              <div
                style={{
                  textAlign: "center", padding: "28px 16px",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
                }}
              >
                <Sparkles size={28} color="var(--muted,#ccc)" />
                <div>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--text,#333)" }}>
                    No active offers right now
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                    Check back soon or enter a promo code above.
                  </p>
                </div>
              </div>
            )}

            {/* Applied offer */}
            {!isLoading && !isError && appliedOffer && (
              <>
                <SectionLabel>Applied Offer</SectionLabel>
                <OfferCard
                  offer={appliedOffer}
                  isApplied
                  isApplying={false}
                  disabled={isApplying}
                  onRemove={onRemove}
                  errorMsg={null}
                />
              </>
            )}

            {/* Eligible offers */}
            {!isLoading && !isError && eligibleOffers.length > 0 && (
              <>
                <SectionLabel>Offers Available</SectionLabel>
                {eligibleOffers.map((offer) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    isApplied={false}
                    isApplying={applyingCode === offer.code}
                    disabled={isApplying || applyingCode !== null}
                    onApply={() => handleCardApply(offer.code)}
                    errorMsg={cardError && cardError.code === offer.code ? cardError.msg : null}
                  />
                ))}
              </>
            )}

            {/* Ineligible offers */}
            {!isLoading && !isError && ineligibleOffers.length > 0 && (
              <>
                <SectionLabel muted>
                  {eligibleOffers.length === 0 && !appliedOffer ? "Offers Available" : "Other Offers"}
                </SectionLabel>
                {ineligibleOffers.map((offer) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    isApplied={false}
                    isApplying={applyingCode === offer.code}
                    disabled={isApplying || applyingCode !== null}
                    onApply={() => handleCardApply(offer.code)}
                    errorMsg={cardError && cardError.code === offer.code ? cardError.msg : null}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Section Label ─── */
function SectionLabel({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <div
      style={{
        fontSize: "10px", fontWeight: 800, letterSpacing: "1.2px",
        color: muted ? "var(--muted,#999)" : "var(--gold,#b58a35)",
        textTransform: "uppercase", paddingLeft: "2px",
      }}
    >
      {children}
    </div>
  );
}

/* ─── Offer Card ─── */
function OfferCard({
  offer, isApplied, isApplying, onApply, onRemove, disabled, errorMsg,
}: any) {
  const eligCode = offer.eligibility?.code as string | undefined;
  const eligMsg  = offer.eligibility?.message as string | undefined;
  const isEligible   = offer.eligibility?.eligible as boolean;

  const isExpired       = eligCode === "OFFER_EXPIRED" || eligCode === "OFFER_INACTIVE";
  const isOutsideRadius = eligCode === "OUTSIDE_OFFER_RADIUS";
  const isMinNotMet     = eligCode === "MINIMUM_ORDER_NOT_MET";
  const needsAddress    = eligCode === "ADDRESS_REQUIRED";
  const isNotStarted    = eligCode === "OFFER_NOT_STARTED";
  const isLimitReached  = eligCode === "USAGE_LIMIT_REACHED" || eligCode === "CUSTOMER_USAGE_LIMIT_REACHED";

  // Display helpers
  const discountText =
    offer.discountType === "PERCENTAGE"
      ? `${offer.discountValue}%`
      : offer.discountType === "FIXED"
      ? `₹${offer.discountValue}`
      : "FREE";
  const discountLabel =
    offer.discountType === "FREE_DELIVERY" ? "DELIVERY" : "OFF";

  const discountIcon =
    offer.discountType === "PERCENTAGE" ? (
      <Percent size={12} />
    ) : offer.discountType === "FREE_DELIVERY" ? (
      <Truck size={12} />
    ) : null;

  /* Eligibility badge */
  const renderBadge = () => {
    if (isApplied)
      return (
        <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--success,#059669)", fontSize: "11px", fontWeight: 800 }}>
          <CheckCircle2 size={13} fill="var(--success,#059669)" color="#fff" />
          APPLIED
        </span>
      );
    if (isEligible)
      return (
        <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--success,#059669)", fontSize: "11px", fontWeight: 700 }}>
          <CheckCircle2 size={12} />
          Applicable for your order
        </span>
      );
    if (isExpired)
      return (
        <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--muted,#999)", fontSize: "11px", fontWeight: 600 }}>
          <Clock size={12} />
          Offer has expired
        </span>
      );
    if (isNotStarted)
      return (
        <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#7c6f00", fontSize: "11px", fontWeight: 600 }}>
          <Clock size={12} />
          Offer has not started yet
        </span>
      );
    if (isOutsideRadius)
      return (
        <span style={{ display: "flex", alignItems: "flex-start", gap: "4px", color: "var(--danger,#dc2626)", fontSize: "11px", fontWeight: 600, lineHeight: 1.35 }}>
          <MapPin size={12} style={{ flexShrink: 0, marginTop: "1px" }} />
          <span>{eligMsg || "Outside delivery radius"}</span>
        </span>
      );
    if (isMinNotMet)
      return (
        <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#c97d00", fontSize: "11px", fontWeight: 600 }}>
          <AlertCircle size={12} />
          {eligMsg || "Minimum order not met"}
        </span>
      );
    if (needsAddress)
      return (
        <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--muted,#888)", fontSize: "11px", fontWeight: 600 }}>
          <MapPin size={12} />
          Select a delivery address to check
        </span>
      );
    if (isLimitReached)
      return (
        <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--muted,#999)", fontSize: "11px", fontWeight: 600 }}>
          <Info size={12} />
          {eligMsg || "Usage limit reached"}
        </span>
      );
    return (
      <span style={{ fontSize: "11px", color: "var(--muted,#999)", fontWeight: 600 }}>
        {eligMsg || "Not eligible"}
      </span>
    );
  };

  /* Can this card's button be clicked? */
  const canApply = isEligible && !isApplied && !isExpired && !isLimitReached && !isNotStarted;
  const btnDisabled = disabled || !canApply;

  const cardClass = [
    "op-card",
    isApplied ? "op-card-applied" : "",
    !isApplied && !isEligible && !needsAddress && !isMinNotMet ? "op-card-ineligible" : "",
    isExpired ? "op-card-expired" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={cardClass} style={{ background: isApplied ? undefined : "var(--card,#fff)" }}>

      {/* Left discount column */}
      <div
        style={{
          padding: "18px 12px",
          display: "flex", flexDirection: "column",
          justifyContent: "center", alignItems: "center",
          minWidth: "80px",
          background: isApplied
            ? "rgba(181,138,53,0.08)"
            : isExpired
            ? "var(--layer-2,#f5f5f5)"
            : "var(--layer-1,#fafafa)",
          borderRight: isApplied
            ? "1px dashed rgba(181,138,53,0.4)"
            : "1px dashed var(--border,#e5e5e5)",
          position: "relative", flexShrink: 0,
          transition: "background 0.2s",
        }}
      >
        {/* Coupon notch decorations */}
        <div style={{ position: "absolute", right: "-8px", top: "-1px", width: "16px", height: "16px", background: "var(--bg,#f9f9f9)", borderRadius: "50%", boxShadow: "inset -2px 1px 0 var(--border,#e5e5e5)" }} />
        <div style={{ position: "absolute", right: "-8px", bottom: "-1px", width: "16px", height: "16px", background: "var(--bg,#f9f9f9)", borderRadius: "50%", boxShadow: "inset -2px -1px 0 var(--border,#e5e5e5)" }} />

        <strong
          style={{
            fontSize: "21px", fontWeight: 900, lineHeight: 1, letterSpacing: "-0.5px",
            color: isApplied
              ? "var(--gold,#b58a35)"
              : isExpired
              ? "var(--muted,#aaa)"
              : "var(--text,#111)",
          }}
        >
          {discountText}
        </strong>
        <span
          style={{
            fontSize: "9.5px", fontWeight: 800, letterSpacing: "1.2px",
            marginTop: "4px", textTransform: "uppercase",
            color: isApplied ? "var(--gold,#b58a35)" : "var(--muted,#888)",
            display: "flex", alignItems: "center", gap: "3px",
          }}
        >
          {discountIcon}
          {discountLabel}
        </span>
      </div>

      {/* Right details column */}
      <div style={{ padding: "14px 14px 13px 15px", flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Code + Name */}
        <div style={{ marginBottom: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "2px" }}>
            <Tag size={10} color={isApplied ? "var(--gold,#b58a35)" : "var(--muted,#aaa)"} />
            <span
              style={{
                fontSize: "10.5px", fontWeight: 800, letterSpacing: "0.8px",
                color: isApplied ? "var(--gold,#b58a35)" : "var(--muted,#888)",
              }}
            >
              {offer.code}
            </span>
          </div>
          <strong style={{ fontSize: "13.5px", fontWeight: 800, color: "var(--text,#000)", lineHeight: 1.2 }}>
            {offer.name}
          </strong>
        </div>

        {/* Meta pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "10px" }}>
          {Number(offer.minOrderAmount) > 0 && (
            <MetaPill>
              Min. {money(offer.minOrderAmount)}
            </MetaPill>
          )}
          {offer.discountType === "PERCENTAGE" && Number(offer.maxDiscountAmount) > 0 && (
            <MetaPill>
              Max. {money(offer.maxDiscountAmount)}
            </MetaPill>
          )}
          {offer.radiusKm != null && (
            <MetaPill icon={<MapPin size={9} />}>
              Within {offer.radiusKm} KM
            </MetaPill>
          )}
          {offer.endsAt && !isExpired && (
            <MetaPill icon={<Clock size={9} />} warning>
              Expires {new Date(offer.endsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </MetaPill>
          )}
          {isExpired && offer.endsAt && (
            <MetaPill icon={<Clock size={9} />} danger>
              Expired {new Date(offer.endsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </MetaPill>
          )}
        </div>

        {/* Error from card-apply attempt */}
        {errorMsg && (
          <div
            style={{
              display: "flex", alignItems: "flex-start", gap: "6px",
              padding: "6px 10px",
              background: "rgba(220,38,38,0.06)",
              border: "1px solid rgba(220,38,38,0.15)",
              borderRadius: "8px", marginBottom: "10px",
              animation: "op-pop 0.2s ease",
            }}
          >
            <AlertCircle size={12} color="var(--danger,#dc2626)" style={{ flexShrink: 0, marginTop: "1px" }} />
            <span style={{ fontSize: "11px", color: "var(--danger,#dc2626)", fontWeight: 600, lineHeight: 1.35 }}>
              {errorMsg}
            </span>
          </div>
        )}

        {/* Eligibility + Action row */}
        <div
          style={{
            marginTop: "auto",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderTop: "1px solid var(--border,#f0f0f0)", paddingTop: "9px", gap: "8px",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>{renderBadge()}</div>

          {isApplied ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
              <button type="button" className="op-card-remove-btn" disabled={disabled} onClick={onRemove}>
                REMOVE
              </button>
            </div>
          ) : !isExpired && !isLimitReached && !isNotStarted ? (
            <button
              type="button"
              className="op-card-action-btn"
              disabled={btnDisabled}
              onClick={onApply}
              style={{
                background: canApply ? "var(--gold,#b58a35)" : "transparent",
                color: canApply ? "#fff" : "var(--muted,#aaa)",
                border: canApply ? "none" : "1px solid var(--border,#ddd)",
                cursor: btnDisabled ? "not-allowed" : "pointer",
              }}
            >
              {isApplying ? (
                <Loader2 size={12} style={{ animation: "op-spin 1s linear infinite" }} />
              ) : null}
              {isApplying ? "…" : "APPLY"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ─── Meta Pill ─── */
function MetaPill({
  children, icon, warning, danger,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  warning?: boolean;
  danger?: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: "3px",
        padding: "2px 8px", borderRadius: "999px",
        fontSize: "10.5px", fontWeight: 600,
        background: danger
          ? "rgba(220,38,38,0.08)"
          : warning
          ? "rgba(201,167,93,0.1)"
          : "var(--layer-2,#f5f5f5)",
        color: danger
          ? "var(--danger,#dc2626)"
          : warning
          ? "#a07030"
          : "var(--muted,#777)",
        border: danger
          ? "1px solid rgba(220,38,38,0.15)"
          : warning
          ? "1px solid rgba(181,138,53,0.2)"
          : "1px solid var(--border,#e5e5e5)",
      }}
    >
      {icon}
      {children}
    </span>
  );
}
