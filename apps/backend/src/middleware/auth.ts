import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/http.js";

export type AuthUser = { id: string; role: "CUSTOMER" | "ADMIN"; email: string };
declare global { namespace Express { interface Request { auth?: AuthUser } } }

export const signToken = (user: AuthUser) => jwt.sign(user, env.JWT_SECRET, { expiresIn: "7d", issuer: "shadow-shop", algorithm: "HS256" });

export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return next();
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { issuer: "shadow-shop", algorithms: ["HS256"] }) as AuthUser;
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (user) req.auth = { id: user.id, role: user.role, email: user.email };
  } catch { /* Anonymous access remains anonymous. */ }
  next();
};

export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) throw new AppError(401, "Please sign in to continue.", "AUTH_REQUIRED");
    const payload = jwt.verify(token, env.JWT_SECRET, { issuer: "shadow-shop", algorithms: ["HS256"] }) as AuthUser;
    const user = await prisma.user.findUnique({ where: { id: payload.id }, include: { customerProfile: true } });
    if (!user) throw new AppError(401, "Your session is no longer valid.", "INVALID_SESSION");
    if (user.role === "CUSTOMER" && user.customerProfile) {
      const profile = user.customerProfile;
      if (profile.status === "TEMPORARILY_BANNED" && profile.banExpires && profile.banExpires <= new Date()) {
        await prisma.customerProfile.update({ where: { userId: user.id }, data: { status: "ACTIVE", banExpires: null, banReason: null } });
      } else if (profile.status !== "ACTIVE") throw new AppError(403, "Your account is currently restricted. Please contact support if you believe this is an error.", "ACCOUNT_RESTRICTED");
    }
    req.auth = { id: user.id, role: user.role, email: user.email };
    next();
  } catch (error) { next(error instanceof AppError ? error : new AppError(401, "Your session is invalid or expired.", "INVALID_SESSION")); }
};

export const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
  if (req.auth?.role !== "ADMIN") return next(new AppError(403, "Administrator access is required.", "ADMIN_REQUIRED"));
  next();
};
