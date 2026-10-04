import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// Resolve the directory of this file (works with tsx/esm)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env first, then backend-specific .env (backend .env overrides root)
// __dirname is apps/backend/src/config
const rootEnvPath = path.resolve(__dirname, "../../../../.env");
const backendEnvPath = path.resolve(__dirname, "../../.env");

dotenv.config({ path: rootEnvPath, override: true });
dotenv.config({ path: backendEnvPath, override: true }); // backend .env wins over root

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
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
  EMAIL_PROVIDER: z.string().default("none"),

  // Resend (primary provider)
  RESEND_API_KEY: z.string().default(""),

  // Email identity (sender and store info)
  EMAIL_FROM: z.string().default(""),
  EMAIL_FROM_NAME: z.string().default("SHADOW SHOP"),
  ADMIN_EMAIL: z.string().default(""),
  SUPPORT_EMAIL: z.string().default(""),

  // SMTP (optional fallback)
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASSWORD: z.string().default(""),
  SMTP_FROM: z.string().default(""),

  // Google Apps Script email relay (legacy optional)
  GAS_WEBHOOK_URL: z.string().default(""),

  // SMS (separate system)
  SMS_PROVIDER: z.string().default("none"),
  SMS_API_KEY: z.string().default(""),
  SMS_WEBHOOK_URL: z.string().default(""),

  // Uploads
  UPLOAD_PATH: z.string().default("uploads"),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(8),

  // Development-only email test destination
  EMAIL_TEST_TO: z.string().default(""),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment configuration:\n${parsed.error.message}`);
}
export const env = parsed.data;

// Upload directory is relative to the backend app root (apps/backend/)
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
      console.log(`[EMAIL] Sender configured: YES (${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>)`);
    }
  } else if (provider === "smtp") {
    console.log(`[EMAIL] Provider: smtp`);
    console.log(`[EMAIL] SMTP host: ${env.SMTP_HOST || "(not set)"}`);
    console.log(`[EMAIL] SMTP user configured: ${env.SMTP_USER ? "YES" : "NO"}`);
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

// Debug log in development to confirm env values are loaded
if (env.NODE_ENV === "development") {
  console.log(`[ENV] Loaded from:`);
  console.log(`  Root   : ${rootEnvPath}`);
  console.log(`  Backend: ${backendEnvPath}`);
  console.log(`[ENV] EMAIL_PROVIDER=${env.EMAIL_PROVIDER}`);
  console.log(`[ENV] OTP cooldown=${env.OTP_RESEND_COOLDOWN_SECONDS}s | expiry=${env.OTP_EXPIRY_MINUTES}min`);
}
