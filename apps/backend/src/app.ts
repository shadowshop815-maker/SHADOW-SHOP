import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { env, uploadDirectory } from "./config/env.js";
import { prisma } from "./config/db.js";
import { authRouter } from "./routes/auth.js";
import { catalogRouter } from "./routes/catalog.js";
import { commerceRouter } from "./routes/commerce.js";
import { contentRouter } from "./routes/content.js";
import { adminRouter } from "./routes/admin.js";
import { adminOffersRouter } from "./routes/adminOffers.js";
import { adminReturnsRouter } from "./routes/adminReturns.js";
import { returnsRouter } from "./routes/returns.js";
import { errorHandler } from "./utils/http.js";

export const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

// Security: HTTP Method Whitelisting
const ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
app.use((req, res, next) => {
  if (!ALLOWED_METHODS.includes(req.method)) {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }
  next();
});

// Security: Strict Content-Type Enforcement for API writes
app.use("/api", (req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    if (req.path.includes('/webhooks') || req.path.includes('/uploads')) return next();
    const cType = req.headers['content-type'] || '';
    if (!cType.includes('application/json') && !cType.includes('multipart/form-data')) {
      return res.status(415).json({ success: false, message: "Unsupported Media Type: Must be application/json" });
    }
  }
  next();
});

// Security: Prevent HTTP Parameter Pollution (HPP) manually
app.use((req, _res, next) => {
  if (req.query) {
    for (const key in req.query) {
      const val = req.query[key];
      if (Array.isArray(val) && key !== "sort" && key !== "filter") {
        req.query[key] = val[0] as string; // Take only the first occurrence to avoid array pollution
      }
    }
  }
  next();
});

// Security: Block common malicious bot signatures (Basic WAF)
app.use((req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  if (/(sqlmap|nikto|scan|nmap|curl|wget)/i.test(userAgent) && !userAgent.includes("Postman")) {
    return res.status(403).json({ success: false, message: "Access Denied" });
  }
  const badPatterns = ["../", "..\\", "%00", "<script", "UNION SELECT"];
  const url = req.url.toUpperCase();
  if (badPatterns.some(p => url.includes(p.toUpperCase()))) {
    return res.status(403).json({ success: false, message: "Malicious request blocked." });
  }
  next();
});

// Security: Deep Input Sanitization (XSS & NoSQLi Protection)
const sanitizeInput = (obj: any): any => {
  if (typeof obj === 'string') {
    return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
              .replace(/javascript:/gi, '')
              .replace(/on\w+="[^"]*"/gi, '');
  }
  if (Array.isArray(obj)) return obj.map(sanitizeInput);
  if (obj !== null && typeof obj === 'object') {
    if (Buffer.isBuffer(obj) || obj instanceof Date) return obj;
    return Object.keys(obj).reduce((acc, key) => {
      if (key.startsWith('$') || key.includes('.')) return acc;
      acc[key] = sanitizeInput(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
};


// Advanced Security Headers
app.use(helmet({ 
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "http:", "https:"],
      connectSrc: ["'self'", "*"]
    }
  },
  xXssProtection: true,
  xFrameOptions: { action: "deny" },
  dnsPrefetchControl: { allow: false },
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));

app.use(cors({ origin: [env.CUSTOMER_URL, env.ADMIN_URL], credentials: false, methods: ["GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"] }));

// Global Rate Limiter (Protects against generic DDoS/Brute-forcing)
const globalLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 1500, // limit each IP to 1500 requests per windowMs
  message: { success: false, message: "Too many requests from this IP, please try again later.", error: { code: "RATE_LIMITED" } },
  standardHeaders: "draft-7", 
  legacyHeaders: false 
});
app.use("/api", globalLimiter);
// Payment Webhook Pre-processing (Must be before express.json)
// Stripe/Razorpay require raw body to verify cryptographic signatures.
app.use("/api/v1/webhooks", express.raw({ type: 'application/json' }), (req, _res, next) => {
  // Store raw body for signature verification
  (req as any).rawBody = req.body;
  next();
});

// Prevent caching of sensitive API responses (Financial/Auth data)
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.use(express.json({ limit: "500kb" })); // Reduced limit for better DDoS protection
// Deep Input Sanitization runs AFTER body parsing so req.body is available
app.use((req, _res, next) => {
  if (req.body) req.body = sanitizeInput(req.body);
  if (req.query) req.query = sanitizeInput(req.query);
  if (req.params) req.params = sanitizeInput(req.params);
  next();
});
app.use("/uploads", express.static(uploadDirectory, { immutable: true, maxAge: "7d" }));
// Return clean 404 for any /uploads file that doesn't exist (prevents ENOENT crash logs)
app.use("/uploads", (_req: express.Request, res: express.Response) => {
  res.status(404).json({ success: false, message: "File not found." });
});
app.use("/api/v1/auth", rateLimit({ windowMs: 15 * 60_000, limit: 80, standardHeaders: "draft-7", legacyHeaders: false }), authRouter);
app.use("/api/v1", catalogRouter);
app.use("/api/v1", commerceRouter);
app.use("/api/v1", contentRouter);
app.use("/api/v1/returns", rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false }), returnsRouter);
app.use("/api/v1/admin/offers", rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: "draft-7", legacyHeaders: false }), adminOffersRouter);
app.use("/api/v1/admin/returns", rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: "draft-7", legacyHeaders: false }), adminReturnsRouter);
app.use("/api/v1/admin", rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: "draft-7", legacyHeaders: false }), adminRouter);
app.get("/health", async (_req, res) => { try { await prisma.$queryRaw`SELECT 1`; res.json({ success: true, service: "SHADOW SHOP API", database: "connected" }); } catch { res.status(503).json({ success: false, service: "SHADOW SHOP API", database: "disconnected" }); } });
app.use((_req, res) => res.status(404).json({ success: false, message: "Route not found.", error: { code: "NOT_FOUND" } }));
app.use(errorHandler);
