/**
 * OTP Service — SHADOW SHOP
 *
 * Handles secure generation, storage, delivery, and verification of OTPs.
 * EMAIL OTPs are delivered via the central email service (Resend).
 * SMS OTPs are a separate system and not handled here.
 *
 * Security properties:
 *   - Cryptographically secure random generation (crypto.randomInt)
 *   - OTP stored as bcrypt hash — plain code never persisted
 *   - 6-digit numeric OTP
 *   - Configurable expiry (default 5 min), attempt limit, resend cooldown
 *   - Brute-force protection via attempt counting
 *   - Resend cooldown prevents email bombing
 *   - Previous OTP invalidated on resend
 */

import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/http.js";
import { enqueueEmailJob, triggerDispatch } from "./email/dispatcher.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OtpPurpose =
  | "REGISTRATION"
  | "PASSWORD_RESET"
  | "EMAIL_VERIFICATION"
  | "PHONE_VERIFICATION";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mask = (value: string) =>
  value.includes("@")
    ? `${value[0]}*****@${value.split("@")[1]}`
    : `${value.slice(0, 3)}******${value.slice(-4)}`;

function getTemplateId(purpose: OtpPurpose): string {
  if (purpose === "PASSWORD_RESET") return "otp_password_reset";
  return "otp_verify";
}

function getPurposeLabel(purpose: OtpPurpose): string {
  const map: Record<OtpPurpose, string> = {
    REGISTRATION: "Account Verification",
    EMAIL_VERIFICATION: "Email Verification",
    PASSWORD_RESET: "Password Reset",
    PHONE_VERIFICATION: "Phone Verification",
  };
  return map[purpose] || "Verification";
}

// ─── OTP Config ───────────────────────────────────────────────────────────────

async function getOtpConfig() {
  // Sync config from env into the DB so admin-changed DB values coexist with env defaults
  return prisma.securitySettings.upsert({
    where: { id: 1 },
    update: {
      otpExpiryMinutes: env.OTP_EXPIRY_MINUTES,
      otpMaxAttempts: env.OTP_MAX_ATTEMPTS,
      otpResendCooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
    },
    create: {
      id: 1,
      otpExpiryMinutes: env.OTP_EXPIRY_MINUTES,
      otpMaxAttempts: env.OTP_MAX_ATTEMPTS,
      otpResendCooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
    },
  });
}

// Email delivery is now handled via the outbox queue inside createOtp
// ─── SMS delivery (separate system — not changed) ─────────────────────────────

async function deliverOtpSms(
  destination: string,
  purpose: OtpPurpose,
  code: string,
  expiryMinutes: number,
): Promise<void> {
  if (env.SMS_PROVIDER === "webhook" && env.SMS_WEBHOOK_URL) {
    const response = await fetch(env.SMS_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(env.SMS_API_KEY ? { authorization: `Bearer ${env.SMS_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        to: destination,
        message: `Your SHADOW SHOP code is ${code}. Valid for ${expiryMinutes} minutes. Do not share.`,
      }),
    });
    if (!response.ok) {
      throw new AppError(502, "The SMS provider could not deliver the verification code.", "OTP_DELIVERY_FAILED");
    }
    return;
  }

  if (env.NODE_ENV !== "production") {
    console.warn(`[OTP] No SMS provider configured. Code for ${mask(destination)}: ${code}`);
    return;
  }

  throw new AppError(503, "OTP delivery is not configured. Please contact support.", "OTP_PROVIDER_NOT_CONFIGURED");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a new OTP, store it hashed, and deliver it.
 * Returns expiry info for frontend display.
 */
export async function createOtp(
  destination: string,
  purpose: OtpPurpose,
): Promise<{ expiresAt: Date; resendAfterSeconds: number }> {
  const normalized = destination.trim().toLowerCase();
  const isEmail = normalized.includes("@");

  const config = await getOtpConfig();

  // Cooldown check — prevent email bombing
  const latest = await prisma.oTPVerification.findFirst({
    where: { destination: normalized, purpose },
    orderBy: { createdAt: "desc" },
  });

  if (latest && Date.now() - latest.createdAt.getTime() < config.otpResendCooldownSeconds * 1000) {
    const waitSeconds = Math.ceil(
      (config.otpResendCooldownSeconds * 1000 - (Date.now() - latest.createdAt.getTime())) / 1000
    );
    throw new AppError(
      429,
      `Please wait ${waitSeconds} seconds before requesting another code.`,
      "OTP_COOLDOWN",
    );
  }

  // Invalidate all previous unused OTPs for this destination+purpose
  await prisma.oTPVerification.updateMany({
    where: { destination: normalized, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });

  // Generate cryptographically secure 6-digit OTP
  // crypto.randomInt(min, max) — max is exclusive, so 900000 gives [100000, 999999]
  const code = String(randomInt(100000, 1000000));
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + config.otpExpiryMinutes * 60_000);

  // Run in a transaction to ensure OTP creation and email enqueuing are atomic
  await prisma.$transaction(async (tx: any) => {
    await tx.oTPVerification.create({
      data: {
        destination: normalized,
        purpose,
        codeHash,
        expiresAt,
      },
    });

    if (isEmail) {
      const templateId = getTemplateId(purpose);
      const payload = {
        code,
        expiryMinutes: config.otpExpiryMinutes,
        purpose,
        purposeLabel: getPurposeLabel(purpose),
      };
      
      await enqueueEmailJob(
        tx,
        "OTP_REQUEST",
        normalized,
        templateId,
        payload
      );
    }
  });

  if (isEmail) {
    // Attempt immediate dispatch for fast delivery
    // If it fails, the cron job will retry it later.
    triggerDispatch().catch(err => console.error("[OTP] Immediate dispatch error:", err));
  } else {
    // SMS remains synchronous for now
    await deliverOtpSms(normalized, purpose, code, config.otpExpiryMinutes);
  }

  return { expiresAt, resendAfterSeconds: config.otpResendCooldownSeconds };
}

/**
 * Verify a submitted OTP.
 * Returns true on success. Throws AppError on any failure.
 */
export async function verifyOtp(
  destination: string,
  purpose: OtpPurpose,
  code: string,
): Promise<true> {
  const config = await getOtpConfig();
  const normalized = destination.trim().toLowerCase();

  // Normalize code — strip whitespace, accept only digits
  const normalizedCode = String(code || "").trim().replace(/\s/g, "");

  const record = await prisma.oTPVerification.findFirst({
    where: { destination: normalized, purpose, usedAt: null },
    orderBy: { createdAt: "desc" },
  });

  // Check existence and expiry together (don't reveal which failed)
  if (!record || record.expiresAt <= new Date()) {
    throw new AppError(
      400,
      "Verification code expired. Please request a new code.",
      "OTP_EXPIRED",
    );
  }

  // Check attempt limit
  if (record.attempts >= config.otpMaxAttempts) {
    throw new AppError(
      429,
      "Too many verification attempts. Please request a new code.",
      "OTP_ATTEMPTS_EXCEEDED",
    );
  }

  // Verify code against stored hash
  // NOTE: No hardcoded bypass codes allowed in any environment
  const isValid = await bcrypt.compare(normalizedCode, record.codeHash);

  if (!isValid) {
    await prisma.oTPVerification.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });

    const remaining = config.otpMaxAttempts - record.attempts - 1;
    if (remaining <= 0) {
      // Invalidate after max attempts
      await prisma.oTPVerification.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
      throw new AppError(
        429,
        "Too many incorrect attempts. Please request a new code.",
        "OTP_ATTEMPTS_EXCEEDED",
      );
    }

    throw new AppError(
      400,
      "Invalid verification code. Please check and try again.",
      "OTP_INVALID",
    );
  }

  // Mark OTP as used (single-use)
  await prisma.oTPVerification.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  return true;
}
