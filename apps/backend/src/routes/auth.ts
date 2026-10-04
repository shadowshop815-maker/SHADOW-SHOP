import { Router } from "express";
import bcrypt from "bcryptjs";
import { loginSchema, otpRequestSchema, otpVerifySchema, passwordSchema, registerSchema } from "@shadow/shared";
import { prisma } from "../config/db.js";
import { requireAuth, signToken } from "../middleware/auth.js";
import { createOtp, verifyOtp } from "../services/otp.js";
import { AppError, asyncHandler, success } from "../utils/http.js";
import { sendEmail } from "../services/email/emailService.js";
import { generateEmailHtml, generateEmailText } from "../services/email/emailTemplates.js";
import { env } from "../config/env.js";

export const authRouter = Router();

// ─── Registration ─────────────────────────────────────────────────────────────

authRouter.post("/register", asyncHandler(async (req, res) => {
  const input = registerSchema.parse(req.body);
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, ...(input.phone ? [{ phone: input.phone }] : [])] },
    include: { customerProfile: true },
  });

  if (existing) {
    if (existing.customerProfile?.status === "PERMANENTLY_BANNED") {
      throw new AppError(403, "Your account is currently restricted. Please contact support if you believe this is an error.", "ACCOUNT_RESTRICTED");
    }
    throw new AppError(409, "An account with this email or phone already exists.", "ACCOUNT_EXISTS");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash,
      customerProfile: { create: {} },
    },
  });

  try {
    await createOtp(user.email, "REGISTRATION");
  } catch (otpErr: unknown) {
    if (otpErr instanceof AppError && (otpErr.code === "OTP_COOLDOWN" || otpErr.code === "OTP_PROVIDER_NOT_CONFIGURED")) {
      return success(res, "Account created. Please verify your email to continue.", { userId: user.id, destination: user.email }, 201);
    }
    throw otpErr;
  }

  return success(res, "Account created. Enter the verification code sent to your email.", { userId: user.id, destination: user.email }, 201);
}));

// ─── Login ────────────────────────────────────────────────────────────────────

authRouter.post("/login", asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: input.email }, include: { customerProfile: true } });

  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AppError(401, "Email or password is incorrect.", "INVALID_CREDENTIALS");
  }

  if (user.customerProfile) {
    if (
      user.customerProfile.status === "TEMPORARILY_BANNED" &&
      user.customerProfile.banExpires &&
      user.customerProfile.banExpires <= new Date()
    ) {
      await prisma.customerProfile.update({
        where: { userId: user.id },
        data: { status: "ACTIVE", banExpires: null, banReason: null },
      });
    } else if (user.customerProfile.status !== "ACTIVE") {
      throw new AppError(403, "Your account is currently restricted. Please contact support if you believe this is an error.", "ACCOUNT_RESTRICTED");
    }
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const token = signToken({ id: user.id, role: user.role, email: user.email });

  return success(res, "Signed in successfully.", {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      emailVerified: Boolean(user.emailVerifiedAt),
    },
  });
}));

// ─── OTP Request ──────────────────────────────────────────────────────────────

authRouter.post("/otp/request", asyncHandler(async (req, res) => {
  const input = otpRequestSchema.parse(req.body);

  // For password reset: don't reveal whether the account exists
  if (input.purpose === "PASSWORD_RESET") {
    const exists = await prisma.user.findFirst({
      where: {
        OR: [
          { email: input.destination.toLowerCase() },
          { phone: input.destination },
        ],
      },
    });
    if (!exists) {
      return success(res, "If an account exists for this email, a verification code has been sent.", {});
    }
  }

  const info = await createOtp(input.destination, input.purpose);
  return success(res, "Verification code sent.", info);
}));

// ─── OTP Verify ───────────────────────────────────────────────────────────────

authRouter.post("/otp/verify", asyncHandler(async (req, res) => {
  const input = otpVerifySchema.parse(req.body);
  await verifyOtp(input.destination, input.purpose, input.code);

  const destination = input.destination.trim().toLowerCase();

  if (input.purpose === "REGISTRATION" || input.purpose === "EMAIL_VERIFICATION") {
    await prisma.user.updateMany({
      where: { email: destination },
      data: { emailVerifiedAt: new Date() },
    });

    // Send welcome email after first-time email verification
    const user = await prisma.user.findFirst({ where: { email: destination } });
    if (user && input.purpose === "REGISTRATION") {
      // Fire-and-forget — don't block the verify response
      sendEmail({
        to: destination,
        subject: "Welcome to SHADOW SHOP",
        html: generateEmailHtml("welcome", { name: user.name }),
        text: generateEmailText("welcome", { name: user.name }),
      }).catch(err => console.error("[Auth] Welcome email failed:", err?.message));
    }
  }

  if (input.purpose === "PHONE_VERIFICATION") {
    await prisma.user.updateMany({
      where: { phone: input.destination },
      data: { phoneVerifiedAt: new Date() },
    });
  }

  return success(res, "Verification successful.", {});
}));

// ─── Forgot Password ──────────────────────────────────────────────────────────

authRouter.post("/password/forgot", asyncHandler(async (req, res) => {
  const destination = String(req.body.destination || "").trim().toLowerCase();
  const exists = await prisma.user.findFirst({
    where: { OR: [{ email: destination }, { phone: destination }] },
  });
  // Always send same response to avoid account enumeration
  if (exists) {
    await createOtp(destination, "PASSWORD_RESET").catch(err => {
      // Swallow cooldown errors — same response either way
      if (err instanceof AppError && err.code === "OTP_COOLDOWN") return;
      throw err;
    });
  }
  return success(res, "If an account exists for this email, a verification code has been sent.", {});
}));

// ─── Password Reset ───────────────────────────────────────────────────────────

authRouter.post("/password/reset", asyncHandler(async (req, res) => {
  const destination = String(req.body.destination || "").trim().toLowerCase();
  const code = String(req.body.code || "");
  const password = passwordSchema.parse(req.body.password);

  await verifyOtp(destination, "PASSWORD_RESET", code);

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: destination }, { phone: destination }] },
  });
  if (!user) throw new AppError(400, "The password reset request is invalid.", "RESET_INVALID");

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 12) },
  });

  // Send password-changed notification (fire-and-forget)
  sendEmail({
    to: user.email,
    subject: "Your SHADOW SHOP Password Was Changed",
    html: generateEmailHtml("password_changed", { name: user.name }),
    text: generateEmailText("password_changed", { name: user.name }),
  }).catch(err => console.error("[Auth] Password-changed email failed:", err?.message));

  return success(res, "Password changed. You can now sign in.", {});
}));

// ─── Get Profile ──────────────────────────────────────────────────────────────

authRouter.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.auth!.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      createdAt: true,
    },
  });
  return success(res, "Profile loaded.", user);
}));

// ─── Update Profile ───────────────────────────────────────────────────────────

authRouter.patch("/me", requireAuth, asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const phone = req.body.phone ? String(req.body.phone).trim() : null;
  if (name.length < 2) throw new AppError(400, "Please enter your full name.", "VALIDATION_ERROR");
  const user = await prisma.user.update({
    where: { id: req.auth!.id },
    data: { name, phone },
    select: { id: true, name: true, email: true, phone: true, role: true },
  });
  return success(res, "Profile updated.", user);
}));

// ─── Change Password (authenticated) ─────────────────────────────────────────

authRouter.post("/password/change", requireAuth, asyncHandler(async (req, res) => {
  const currentPassword = String(req.body.currentPassword || "");
  const password = passwordSchema.parse(req.body.password);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.id } });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new AppError(400, "Current password is incorrect.", "PASSWORD_INCORRECT");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 12) },
  });

  // Send password-changed notification (fire-and-forget)
  sendEmail({
    to: user.email,
    subject: "Your SHADOW SHOP Password Was Changed",
    html: generateEmailHtml("password_changed", { name: user.name }),
    text: generateEmailText("password_changed", { name: user.name }),
  }).catch(err => console.error("[Auth] Password-changed email failed:", err?.message));

  return success(res, "Password updated.", {});
}));
