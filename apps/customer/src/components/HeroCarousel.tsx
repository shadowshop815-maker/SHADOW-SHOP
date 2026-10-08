import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { resolveImageUrl } from "../api";

export function HeroCarousel({ heroImage, link }: { heroImage?: string; link?: string }) {
  let slides: any[] = [];
  try { slides = JSON.parse(heroImage || "[]"); } catch {
    if (heroImage && typeof heroImage === "string" && !heroImage.startsWith("[")) {
      slides = [{ id: "legacy", image: heroImage, link: link || "/products" }];
    }
  }

  // Filter slides that have a real image
  slides = slides.filter((s: any) => s.image && String(s.image).trim() !== "");

  if (!Array.isArray(slides) || slides.length === 0) {
    return null; // parent will render the premium art placeholder
  }

  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent(c => (c + 1) % slides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="hero-carousel-container" style={{ position: "relative", width: "100%", height: 560, borderRadius: 34, overflow: "hidden", background: "var(--layer-2)" }}>
      {slides.map((slide, i) => {
        const isCurrent = i === current;
        return (
          <div key={slide.id || i} style={{ 
            position: "absolute", 
            inset: 0, 
            opacity: isCurrent ? 1 : 0, 
            transition: "opacity 0.8s ease-in-out",
            zIndex: isCurrent ? 1 : 0,
            pointerEvents: isCurrent ? "auto" : "none"
          }}>
            {slide.link !== "none" ? (
              <Link to={slide.link || link || "/products"} className="hero-slide-link" style={{ display: "block", width: "100%", height: "100%", overflow: "hidden", borderRadius: 34 }}>
                <img src={resolveImageUrl(slide.image)} alt="SHADOW SHOP Hero" style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.5s ease" }} />
              </Link>
            ) : (
              <img src={resolveImageUrl(slide.image)} alt="SHADOW SHOP Hero" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 34 }} />
            )}
          </div>
        );
      })}
      
      {slides.length > 1 && (
        <div style={{ position: "absolute", bottom: 24, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 10, zIndex: 2 }}>
          {slides.map((_, i) => (
            <button 
              key={i} 
              onClick={() => setCurrent(i)}
              style={{ 
                width: i === current ? 24 : 8, 
                height: 8, 
                borderRadius: 4, 
                background: i === current ? "var(--gold)" : "rgba(255,255,255,0.5)", 
                border: "none", 
                padding: 0, 
                cursor: "pointer", 
                transition: "all 0.3s"
              }}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
