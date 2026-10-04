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
  OTP_EXPIRY_MINUTES: z.coerce.number().positive().default(5),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().nonnegative().default(60),
  EMAIL_PROVIDER: z.string().default("resend"),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASSWORD: z.string().default(""),
  SMTP_FROM: z.string().default(""),
  RESEND_API_KEY: z.string().default(""),
  SMS_PROVIDER: z.string().default("none"),
  SMS_API_KEY: z.string().default(""),
  SMS_WEBHOOK_URL: z.string().default(""),
  UPLOAD_PATH: z.string().default("uploads"),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(8),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment configuration:\n${parsed.error.message}`);
}
export const env = parsed.data;

// Upload directory is relative to the backend app root (apps/backend/)
export const uploadDirectory = path.resolve(__dirname, "../../", env.UPLOAD_PATH);

// Debug log in development to confirm which env values are loaded
if (env.NODE_ENV === "development") {
  console.log(`[ENV] Loaded from:`);
  console.log(`  Root   : ${rootEnvPath}`);
  console.log(`  Backend: ${backendEnvPath}`);
  console.log(`[ENV] EMAIL_PROVIDER=${env.EMAIL_PROVIDER} | SMTP_HOST=${env.SMTP_HOST || "(not set)"} | SMTP_USER=${env.SMTP_USER || "(not set)"}`);
  console.log(`[ENV] OTP cooldown=${env.OTP_RESEND_COOLDOWN_SECONDS}s | expiry=${env.OTP_EXPIRY_MINUTES}min`);
}
