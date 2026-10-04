import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/http.js";

const mask = (value: string) =>
  value.includes("@")
    ? `${value[0]}*****@${value.split("@")[1]}`
    : `${value.slice(0, 3)}******${value.slice(-4)}`;

async function sendSmtpEmail(destination: string, purpose: string, code: string) {
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false, // Allow self-signed certs in dev
    },
  });

  const purposeLabel: Record<string, string> = {
    REGISTRATION: "Account Verification",
    EMAIL_VERIFICATION: "Email Verification",
    PASSWORD_RESET: "Password Reset",
    PHONE_VERIFICATION: "Phone Verification",
  };

  const label = purposeLabel[purpose] || "Verification";

  await transport.sendMail({
    from: `"SHADOW SHOP" <${env.SMTP_FROM || env.SMTP_USER}>`,
    to: destination,
    subject: `Your SHADOW SHOP ${label} Code: ${code}`,
    text: `Your SHADOW SHOP verification code is: ${code}\n\nThis code expires in ${env.OTP_EXPIRY_MINUTES} minutes.\nDo not share this code with anyone.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0a0a0f; color: #ffffff; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px 40px; text-align: center; border-bottom: 1px solid #2a2a3e;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.1em; color: #ffffff;">SHADOW SHOP</h1>
        </div>
        <div style="padding: 40px;">
          <p style="color: #a0a0b0; font-size: 14px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.1em;">${label}</p>
          <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 24px;">Your verification code</h2>
          <div style="background: #1a1a2e; border: 1px solid #2a2a4e; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 40px; font-weight: 800; letter-spacing: 0.3em; color: #f0c040; font-family: monospace;">${code}</span>
          </div>
          <p style="color: #a0a0b0; font-size: 13px; line-height: 1.6;">
            This code expires in <strong style="color: #fff;">${env.OTP_EXPIRY_MINUTES} minutes</strong>. 
            Do not share this code with anyone.
          </p>
        </div>
        <div style="background: #0d0d18; padding: 20px 40px; text-align: center; border-top: 1px solid #1a1a2e;">
          <p style="color: #606070; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} SHADOW SHOP. All rights reserved.</p>
        </div>
      </div>
    `,
  });
}

async function deliver(destination: string, purpose: string, code: string) {
  const isEmail = destination.includes("@");

  // Always log to console in development for easy debugging
  if (env.NODE_ENV === "development") {
    console.log(`\n================================================================`);
    console.log(`  SHADOW SHOP OTP [DEV MODE]`);
    console.log(`================================================================`);
    console.log(`  Purpose    : ${purpose.replaceAll("_", " ")}`);
    console.log(`  Destination: ${mask(destination)}`);
    console.log(`  OTP Code   : ${code}`);
    console.log(`  Expires In : ${env.OTP_EXPIRY_MINUTES} minutes`);
    console.log(`================================================================\n`);
  }

  // Try SMTP email delivery
  if (isEmail && env.EMAIL_PROVIDER === "smtp" && env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD) {
    try {
      await sendSmtpEmail(destination, purpose, code);
      console.log(`[OTP] Email sent via SMTP to ${mask(destination)}`);
      return;
    } catch (smtpError: unknown) {
      const msg = smtpError instanceof Error ? smtpError.message : String(smtpError);
      console.error(`[OTP] SMTP delivery failed: ${msg}`);
      // In development, still succeed (OTP is in console above)
      if (env.NODE_ENV === "development") {
        console.warn(`[OTP] Dev mode: proceeding despite SMTP failure. Check console for OTP.`);
        return;
      }
      throw new AppError(502, "We could not send the verification email. Please try again.", "OTP_DELIVERY_FAILED");
    }
  }

  // Try SMS delivery
  if (!isEmail && env.SMS_PROVIDER === "webhook" && env.SMS_WEBHOOK_URL) {
    const response = await fetch(env.SMS_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.SMS_API_KEY}`,
      },
      body: JSON.stringify({ to: destination, message: `Your SHADOW SHOP code is ${code}. Valid for ${env.OTP_EXPIRY_MINUTES} minutes.` }),
    });
    if (!response.ok) throw new AppError(502, "The SMS provider could not deliver the verification code.", "OTP_DELIVERY_FAILED");
    return;
  }

  // In dev mode without SMTP/SMS configured — OTP is already in console, that's fine
  if (env.NODE_ENV === "development") {
    console.warn(`[OTP] No delivery provider configured. OTP logged to console above.`);
    return;
  }

  throw new AppError(503, "OTP delivery is not configured. Please contact support.", "OTP_PROVIDER_NOT_CONFIGURED");
}

export async function createOtp(
  destination: string,
  purpose: "REGISTRATION" | "PASSWORD_RESET" | "EMAIL_VERIFICATION" | "PHONE_VERIFICATION"
) {
  const normalized = destination.trim().toLowerCase();

  // Always sync cooldown from env (so .env changes take effect without DB reset)
  const config = await prisma.securitySettings.upsert({
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

  // Check cooldown
  const latest = await prisma.oTPVerification.findFirst({
    where: { destination: normalized, purpose },
    orderBy: { createdAt: "desc" },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < config.otpResendCooldownSeconds * 1000) {
    const waitSeconds = Math.ceil((config.otpResendCooldownSeconds * 1000 - (Date.now() - latest.createdAt.getTime())) / 1000);
    throw new AppError(429, `Please wait ${waitSeconds} seconds before requesting another code.`, "OTP_COOLDOWN");
  }

  // Invalidate old OTPs
  await prisma.oTPVerification.updateMany({
    where: { destination: normalized, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });

  // Generate new OTP
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + config.otpExpiryMinutes * 60_000);

  const record = await prisma.oTPVerification.create({
    data: { destination: normalized, purpose, codeHash, expiresAt },
  });

  // Deliver OTP — if delivery fails, clean up the record (except in dev where console is used)
  try {
    await deliver(normalized, purpose, code);
  } catch (error) {
    await prisma.oTPVerification.delete({ where: { id: record.id } });
    throw error;
  }

  return { expiresAt, resendAfterSeconds: config.otpResendCooldownSeconds };
}

export async function verifyOtp(
  destination: string,
  purpose: "REGISTRATION" | "PASSWORD_RESET" | "EMAIL_VERIFICATION" | "PHONE_VERIFICATION",
  code: string
) {
  const config = await prisma.securitySettings.upsert({
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

  const normalized = destination.trim().toLowerCase();
  const record = await prisma.oTPVerification.findFirst({
    where: { destination: normalized, purpose, usedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!record || record.expiresAt <= new Date()) {
    throw new AppError(400, "This verification code is invalid or has expired.", "OTP_INVALID");
  }
  if (record.attempts >= config.otpMaxAttempts) {
    throw new AppError(429, "Too many verification attempts. Please request a new code.", "OTP_ATTEMPTS_EXCEEDED");
  }

  const valid = await bcrypt.compare(code, record.codeHash);
  if (!valid) {
    await prisma.oTPVerification.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw new AppError(400, "Incorrect code. Please check and try again.", "OTP_INVALID");
  }

  await prisma.oTPVerification.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  return true;
}
