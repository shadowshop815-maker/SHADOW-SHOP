import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

export function PromoCarousel({ banners }: { banners: any[] }) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (banners.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % banners.length);
    }, 4000);
    return () => clearInterval(timerRef.current);
  }, [banners.length]);

  const goTo = (idx: number) => {
    setCurrent(idx);
    if (timerRef.current) clearInterval(timerRef.current);
    // Restart timer
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % banners.length);
    }, 4000);
  };

  if (!banners || banners.length === 0) return null;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 480, // A nice landscape height
        borderRadius: "var(--radius-xl)",
        overflow: "hidden",
        background: "var(--layer-2)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          transition: "transform 0.8s cubic-bezier(0.25, 1, 0.5, 1)",
          transform: `translateX(-${current * 100}%)`,
        }}
      >
        {banners.map((banner, i) => {
          const content = (
            <div style={{ position: "relative", width: "100%", height: "100%" }}>
              {/* Actual Image - Never Cropped */}
              <img
                src={banner.image}
                alt={banner.title || `Promotion ${i + 1}`}
                loading="lazy"
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                  zIndex: 1,
                  // Slow zoom effect for the active slide (Ken Burns)
                  transform: current === i ? "scale(1.03)" : "scale(1)",
                  transition: "transform 5s linear",
                }}
              />
              {/* Dark gradient overlay for text readability */}
              {banner.title && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)",
                    display: "flex",
                    alignItems: "flex-end",
                    padding: "40px 30px",
                  }}
                >
                  <h3
                    style={{
                      color: "#fff",
                      fontSize: "clamp(24px, 4vw, 32px)",
                      fontWeight: 800,
                      margin: 0,
                      letterSpacing: "0.02em",
                      textTransform: "uppercase",
                      // Slide-up animation for the text
                      transform: current === i ? "translateY(0)" : "translateY(20px)",
                      opacity: current === i ? 1 : 0,
                      transition: "transform 0.8s cubic-bezier(0.25, 1, 0.5, 1) 0.3s, opacity 0.8s ease 0.3s",
                    }}
                  >
                    {banner.title}
                  </h3>
                </div>
              )}
            </div>
          );

          return (
            <div key={banner.id || i} style={{ flex: "0 0 100%", minWidth: "100%", height: "100%" }}>
              {banner.link && banner.link !== "none" ? (
                <Link to={banner.link} style={{ display: "block", width: "100%", height: "100%" }}>
                  {content}
                </Link>
              ) : (
                content
              )}
            </div>
          );
        })}
      </div>

      {/* Progress / Dot Indicators */}
      {banners.length > 1 && (
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            gap: 12,
            zIndex: 10,
          }}
        >
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.preventDefault();
                goTo(i);
              }}
              style={{
                width: current === i ? 36 : 10,
                height: 10,
                borderRadius: 5,
                background: current === i ? "var(--gold)" : "rgba(255,255,255,0.4)",
                border: "none",
                padding: 0,
                cursor: "pointer",
                transition: "all 0.4s cubic-bezier(0.25, 1, 0.5, 1)",
                backdropFilter: "blur(4px)",
              }}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
