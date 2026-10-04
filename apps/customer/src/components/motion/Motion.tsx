import React, { useEffect, useState, useRef, type ReactNode } from "react";

/**
 * Hook to detect user's prefers-reduced-motion preference.
 */
export function useReducedMotionSafe(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return reducedMotion;
}

/**
 * Hook for subtle desktop mouse parallax on hero elements.
 * Automatically disabled on mobile (<1024px) or if reduced motion is enabled.
 */
export function useMouseParallax(strength: number = 12) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const reducedMotion = useReducedMotionSafe();

  useEffect(() => {
    if (reducedMotion || typeof window === "undefined" || window.innerWidth < 1024) {
      return;
    }

    let rafId: number;

    const handleMouseMove = (e: MouseEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const { innerWidth, innerHeight } = window;
        const normalizedX = (e.clientX / innerWidth - 0.5) * 2;
        const normalizedY = (e.clientY / innerHeight - 0.5) * 2;
        setOffset({
          x: Math.round(normalizedX * strength * 10) / 10,
          y: Math.round(normalizedY * strength * 10) / 10
        });
      });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, [strength, reducedMotion]);

  return offset;
}

/**
 * Hook for intersection observer scroll reveals.
 */
export function useScrollReveal(threshold: number = 0.15, once: boolean = true) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotionSafe();

  useEffect(() => {
    if (reducedMotion) {
      setIsIntersecting(true);
      return;
    }

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          if (once) observer.unobserve(node);
        } else if (!once) {
          setIsIntersecting(false);
        }
      },
      { threshold, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, once, reducedMotion]);

  return { ref, isIntersecting };
}

/**
 * Reusable Viewport Reveal Component.
 */
export function Reveal({
  children,
  delay = 0,
  duration = 600,
  direction = "up",
  distance = 24,
  className = "",
  style = {}
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  distance?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { ref, isIntersecting } = useScrollReveal();
  const reduced = useReducedMotionSafe();

  const getTransform = () => {
    if (reduced || direction === "none") return "none";
    switch (direction) {
      case "up": return `translate3d(0, ${distance}px, 0)`;
      case "down": return `translate3d(0, -${distance}px, 0)`;
      case "left": return `translate3d(${distance}px, 0, 0)`;
      case "right": return `translate3d(-${distance}px, 0, 0)`;
      default: return "none";
    }
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: isIntersecting || reduced ? 1 : 0,
        transform: isIntersecting || reduced ? "translate3d(0,0,0)" : getTransform(),
        transition: reduced ? "none" : `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
        willChange: isIntersecting ? "auto" : "opacity, transform"
      }}
    >
      {children}
    </div>
  );
}

/**
 * Stagger Container for item lists.
 */
export function StaggerContainer({
  children,
  className = "",
  style = {}
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

/**
 * Stagger Item with individual index delay.
 */
export function StaggerItem({
  children,
  index = 0,
  baseDelay = 80,
  duration = 550,
  className = "",
  style = {}
}: {
  children: ReactNode;
  index?: number;
  baseDelay?: number;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Reveal delay={index * baseDelay} duration={duration} direction="up" distance={20} className={className} style={style}>
      {children}
    </Reveal>
  );
}

/**
 * Magnetic button for desktop hero CTA.
 */
export function MagneticButton({
  children,
  className = "",
  onClick,
  style = {}
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const reduced = useReducedMotionSafe();

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (reduced || window.innerWidth < 1024) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * 0.25;
    const y = (e.clientY - rect.top - rect.height / 2) * 0.25;
    setPos({ x, y });
  };

  const handleMouseLeave = () => setPos({ x: 0, y: 0 });

  return (
    <button
      className={className}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        ...style,
        transform: reduced ? "none" : `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        transition: pos.x === 0 && pos.y === 0 ? "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)" : "none"
      }}
    >
      {children}
    </button>
  );
}

/**
 * Smooth price transition component for confirmed backend values.
 */
export function AnimatedPrice({
  value,
  currency = "₹",
  className = ""
}: {
  value: number | string;
  currency?: string;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (value !== displayValue) {
      setIsUpdating(true);
      const timer = setTimeout(() => {
        setDisplayValue(value);
        setIsUpdating(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [value, displayValue]);

  const formatted = typeof displayValue === "number"
    ? new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(displayValue)
    : displayValue;

  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        opacity: isUpdating ? 0.4 : 1,
        transform: isUpdating ? "translate3d(0, -3px, 0)" : "translate3d(0, 0, 0)",
        transition: "opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
      }}
    >
      {currency}{formatted}
    </span>
  );
}

/**
 * Image reveal with shimmer skeleton and smooth fade.
 */
export function ImageReveal({
  src,
  alt = "",
  className = "",
  style = {},
  loading = "lazy"
}: {
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  loading?: "lazy" | "eager";
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div style={{ position: "relative", overflow: "hidden", ...style }} className={className}>
      {!loaded && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, var(--layer-2) 0%, var(--layer-3) 50%, var(--layer-2) 100%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.8s infinite"
          }}
        />
      )}
      <img
        src={src}
        alt={alt}
        loading={loading}
        onLoad={() => setLoaded(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
      />
    </div>
  );
}
