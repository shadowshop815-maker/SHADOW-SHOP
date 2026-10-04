import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(public status: number, message: string, public code = "REQUEST_FAILED", public fields?: unknown) { super(message); }
}

export const asyncHandler = (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { Promise.resolve(handler(req, res, next)).catch(next); };

export const success = (res: Response, message: string, data?: unknown, status = 200) => res.status(status).json({ success: true, message, ...(data === undefined ? {} : { data }) });

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError) return res.status(400).json({ success: false, message: "Please correct the highlighted fields.", error: { code: "VALIDATION_ERROR", fields: error.flatten().fieldErrors } });
  if (error instanceof AppError) return res.status(error.status).json({ success: false, message: error.message, error: { code: error.code, ...(error.fields ? { fields: error.fields } : {}) } });
  console.error("Unhandled API error", error);
  return res.status(500).json({ success: false, message: "An unexpected error occurred.", error: { code: "INTERNAL_ERROR" } });
};
