import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import fs from "node:fs";

// Find root based on process.cwd() rather than __dirname which changes between src/dist
const cwd = process.cwd();
const isBackendDir = cwd.endsWith(path.join("apps", "backend")) || cwd.endsWith("apps/backend");

const rootEnvPath = isBackendDir ? path.resolve(cwd, "../../.env") : path.resolve(cwd, ".env");
const backendEnvPath = isBackendDir ? path.resolve(cwd, ".env") : path.resolve(cwd, "apps/backend/.env");

// In production, Render env vars should be the absolute truth.
// Do not override existing env vars if they are set in the environment.
const overrideEnv = process.env.NODE_ENV !== "production";

if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath, override: overrideEnv });
}
if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath, override: overrideEnv });
}

const stripQuotes = (val: string) => val.replace(/^["']|["']$/g, "");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default(process.env.RENDER ? "production" : "development"),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  CUSTOMER_URL: z.string().url().default("http://localhost:3000"),
  ADMIN_URL: z.string().url().default("http://localhost:3001"),
  BACKEND_URL: z.string().url().default(process.env.RENDER_EXTERNAL_URL || "http://localhost:5000"),

  // OTP configuration
  OTP_EXPIRY_MINUTES: z.coerce.number().positive().default(5),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().nonnegative().default(60),

  // Email provider selection
  EMAIL_PROVIDER: z.string().transform(stripQuotes).default("none"),

  // Resend (primary provider)
  RESEND_API_KEY: z.string().trim().transform(stripQuotes).default(""),

  // Email identity (sender and store info)
  EMAIL_FROM: z.string().trim().transform(stripQuotes).default(""),
  EMAIL_FROM_NAME: z.string().trim().transform(stripQuotes).default("SHADOW SHOP"),
  ADMIN_EMAIL: z.string().trim().transform(stripQuotes).default(""),
  SUPPORT_EMAIL: z.string().trim().transform(stripQuotes).default(""),

  // SMTP (optional fallback)
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASSWORD: z.string().default(""),
  SMTP_FROM: z.string().default(""),

  // Google Apps Script email relay (legacy optional)
  GAS_WEBHOOK_URL: z.string().default(""),

  // Brevo API (Transactional Email)
  BREVO_API_KEY: z.string().trim().transform(stripQuotes).default(""),
  EMAIL_REPLY_TO: z.string().trim().transform(stripQuotes).default(""),
  ADMIN_NOTIFICATION_EMAIL: z.string().trim().transform(stripQuotes).default(""),

  // SMS (separate system)
  SMS_PROVIDER: z.string().default("none"),
  SMS_API_KEY: z.string().default(""),
  SMS_WEBHOOK_URL: z.string().default(""),

  // Uploads
  UPLOAD_PATH: z.string().default("uploads"),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(8),

  // Development-only email test destination
  EMAIL_TEST_TO: z.string().default(""),

  // System
  SYSTEM_SECRET: z.string().default(""),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment configuration:\n${parsed.error.message}`);
}
export const env = parsed.data;

// Upload directory is relative to the backend app root (apps/backend/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const uploadDirectory = path.resolve(__dirname, "../../", env.UPLOAD_PATH);

// ============================================================
// Email provider startup validation
// ============================================================
function validateEmailConfig() {
  const provider = env.EMAIL_PROVIDER;

  if (provider === "resend") {
    const issues: string[] = [];
    if (!env.RESEND_API_KEY) issues.push("RESEND_API_KEY is missing");
    if (!env.EMAIL_FROM) issues.push("EMAIL_FROM is missing");
    if (!env.EMAIL_FROM_NAME) issues.push("EMAIL_FROM_NAME is missing");

    if (issues.length > 0) {
      console.error("[EMAIL] ❌ Email provider configuration errors:");
      issues.forEach(issue => console.error(`[EMAIL]   - ${issue}`));
      if (env.NODE_ENV === "production") {
        throw new Error(`Email configuration invalid for production:\n${issues.join("\n")}`);
      }
    } else {
      console.log(`[EMAIL] Provider: resend`);
      console.log(`[EMAIL] API key configured: YES`);
      console.log(`[EMAIL] API key format check: ${env.RESEND_API_KEY.startsWith("re_") ? "PASSED" : "WARN (doesn't start with re_)"}`);
      console.log(`[EMAIL] Sender configured: YES (${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>)`);
    }
  } else if (provider === "smtp") {
    console.log(`[EMAIL] Provider: smtp`);
    console.log(`[EMAIL] SMTP host: ${env.SMTP_HOST || "(not set)"}`);
    console.log(`[EMAIL] SMTP user configured: ${env.SMTP_USER ? "YES" : "NO"}`);
  } else if (provider === "brevo") {
    const issues: string[] = [];
    if (!env.BREVO_API_KEY) issues.push("BREVO_API_KEY is missing");
    if (!env.EMAIL_FROM) issues.push("EMAIL_FROM is missing");

    if (issues.length > 0) {
      console.error("[EMAIL] ❌ Email provider configuration errors (brevo):");
      issues.forEach(issue => console.error(`[EMAIL]   - ${issue}`));
      if (env.NODE_ENV === "production") {
        throw new Error(`Email configuration invalid for production:\n${issues.join("\n")}`);
      }
    } else {
      console.log(`[EMAIL] Provider: brevo`);
      console.log(`[EMAIL] API key configured: YES`);
      console.log(`[EMAIL] API key format check: ${env.BREVO_API_KEY.startsWith("xkeysib-") ? "PASSED" : "WARN (doesn't start with xkeysib-)"}`);
      console.log(`[EMAIL] Sender configured: YES (${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>)`);
    }
  } else if (provider === "gas") {
    console.log(`[EMAIL] Provider: gas (Google Apps Script relay)`);
  } else {
    if (env.NODE_ENV === "production") {
      console.warn("[EMAIL] ⚠️  EMAIL_PROVIDER is 'none' — transactional emails will NOT be sent in production.");
    } else {
      console.log("[EMAIL] Provider: none (development mode — OTP printed to console)");
    }
  }

  if (env.ADMIN_EMAIL) {
    console.log(`[EMAIL] Admin email configured: YES`);
  } else {
    console.warn("[EMAIL] ⚠️  ADMIN_EMAIL not set — admin order alerts will be skipped.");
  }
}

// Run validation at startup
validateEmailConfig();

console.log(`[ENV] Environment: ${env.NODE_ENV}`);
if (env.NODE_ENV === "production") {
  console.log(`[ENV] Config Source: Render Environment Variables (No .env needed)`);
} else {
  console.log(`[ENV] Loaded from:`);
  console.log(`  Root   : ${rootEnvPath} (${fs.existsSync(rootEnvPath) ? "Found" : "Missing"})`);
  console.log(`  Backend: ${backendEnvPath} (${fs.existsSync(backendEnvPath) ? "Found" : "Missing"})`);
}
console.log(`[ENV] EMAIL_PROVIDER=${env.EMAIL_PROVIDER}`);
console.log(`[ENV] OTP cooldown=${env.OTP_RESEND_COOLDOWN_SECONDS}s | expiry=${env.OTP_EXPIRY_MINUTES}min`);
