import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/http.js";

export type AuthUser = { id: string; role: "CUSTOMER" | "ADMIN"; email: string };
declare global { namespace Express { interface Request { auth?: AuthUser } } }

export const signToken = (user: AuthUser) => jwt.sign(user, env.JWT_SECRET, { expiresIn: "7d", issuer: "shadow-shop", algorithm: "HS256" });

/**
 * Fast optional auth: decodes JWT without DB round-trip.
 * Sufficient for public catalog routes that merely need to know *who* asked.
 */
export const optionalAuth = (req: Request, _res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return next();
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { issuer: "shadow-shop", algorithms: ["HS256"] }) as AuthUser;
    req.auth = { id: payload.id, role: payload.role, email: payload.email };
  } catch { /* Anonymous access remains anonymous. */ }
  next();
};

/**
 * Strict auth: verifies JWT then performs a lightweight DB check.
 * - ADMIN: only validates token; no extra DB read needed (role is in JWT).
 * - CUSTOMER: checks ban status (requires DB lookup for profile).
 */
export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) throw new AppError(401, "Please sign in to continue.", "AUTH_REQUIRED");
    const payload = jwt.verify(token, env.JWT_SECRET, { issuer: "shadow-shop", algorithms: ["HS256"] }) as AuthUser;

    if (payload.role === "ADMIN") {
      // Fast path: admin role is embedded in a signed JWT — no DB round-trip needed.
      // We still validate the user exists on first admin action per session via requireAdmin.
      req.auth = { id: payload.id, role: payload.role, email: payload.email };
      return next();
    }

    // CUSTOMER: must check ban status
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, role: true, email: true, customerProfile: { select: { status: true, banExpires: true } } }
    });
    if (!user) throw new AppError(401, "Your session is no longer valid.", "INVALID_SESSION");
    const profile = user.customerProfile;
    if (profile) {
      if (profile.status === "TEMPORARILY_BANNED" && profile.banExpires && profile.banExpires <= new Date()) {
        await prisma.customerProfile.update({ where: { userId: user.id }, data: { status: "ACTIVE", banExpires: null, banReason: null } });
      } else if (profile.status !== "ACTIVE") {
        throw new AppError(403, "Your account is currently restricted. Please contact support if you believe this is an error.", "ACCOUNT_RESTRICTED");
      }
    }
    req.auth = { id: user.id, role: user.role as AuthUser["role"], email: user.email };
    next();
  } catch (error) { next(error instanceof AppError ? error : new AppError(401, "Your session is invalid or expired.", "INVALID_SESSION")); }
};

/**
 * Additional guard that confirms the signed-in user is an admin.
 * Also verifies the admin account still exists in DB (runs once per admin request).
 */
export const requireAdmin = async (req: Request, _res: Response, next: NextFunction) => {
  if (req.auth?.role !== "ADMIN") return next(new AppError(403, "Administrator access is required.", "ADMIN_REQUIRED"));
  // Verify admin account still exists (lightweight — just checks existence)
  const exists = await prisma.user.findUnique({ where: { id: req.auth.id }, select: { id: true } });
  if (!exists) return next(new AppError(401, "Your session is no longer valid.", "INVALID_SESSION"));
  next();
};
