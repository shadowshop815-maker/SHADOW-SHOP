/**
 * Email Dispatcher — SHADOW SHOP
 *
 * Implements the Transactional Outbox pattern:
 *   1. Business logic enqueues an EmailJob record inside the same DB transaction.
 *   2. A background worker picks up pending jobs and sends via the central email service.
 *
 * This ensures:
 *   - A failed email never rolls back a committed order/transaction.
 *   - Emails are retried on transient failure (network, provider 429/5xx).
 *   - Permanent failures (bad recipient, invalid API key) are not retried indefinitely.
 *   - Idempotency keys prevent duplicate sends on restart or retry.
 */

import { randomUUID } from "node:crypto";
import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import { sendEmail } from "./emailService.js";
import { generateEmailHtml, generateEmailText } from "./emailTemplates.js";

// ─── Types ─────────────────────────────────────────────────────────────────────

type EmailJobStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED";

// ─── Subject mapping ──────────────────────────────────────────────────────────

function resolveSubject(templateId: string, payload: any): string {
  const orderNum = payload?.orderNumber ? `#${payload.orderNumber}` : "";
  const retNum = payload?.returnNumber || "";
  const map: Record<string, string> = {
    otp_verify: "Your SHADOW SHOP Verification Code",
    otp_password_reset: "SHADOW SHOP — Reset Your Password",
    password_changed: "Your SHADOW SHOP Password Was Changed",
    welcome: "Welcome to SHADOW SHOP",
    order_placed: `Order Confirmation ${orderNum}`,
    admin_new_order_alert: `New Order Alert ${orderNum}`,
    order_confirmed: `Your Order is Confirmed ${orderNum}`,
    order_processing: `Your Order is Being Processed ${orderNum}`,
    order_packed: `Your Order is Packed ${orderNum}`,
    order_shipped: `Your Order Has Shipped ${orderNum}`,
    order_out_for_delivery: `Your Order is Out for Delivery ${orderNum}`,
    order_delivered: `Your Order Has Been Delivered ${orderNum}`,
    order_cancelled: `Order Cancelled ${orderNum}`,
    return_requested: `Return Request Received — ${retNum}`,
    return_approved: `Return Approved — ${retNum}`,
    return_rejected: `Return Request Update — ${retNum}`,
    return_pickup_scheduled: `Pickup Scheduled — ${retNum}`,
    return_picked_up: `Return Item Picked Up — ${retNum}`,
    return_received: `Return Received — ${retNum}`,
    refund_initiated: `Refund Initiated — ${retNum || orderNum}`,
    return_refund_completed: `Refund Processed — ${retNum}`,
    admin_new_return_alert: `New Return Request — ${retNum}`,
    email_system_test: "SHADOW SHOP Email System Test",
  };
  return map[templateId] || "Update from SHADOW SHOP";
}

// ─── Unrecoverable error detection ───────────────────────────────────────────

function isUnrecoverableError(errorMsg: string): boolean {
  const permanentErrors = [
    "No recipients defined",
    "EENVELOPE",
    "Invalid recipient",
    "RESEND_API_KEY not configured",
    "EMAIL_FROM not configured",
    "invalid api key",
    "domain is not verified",
    "550",  // Permanent SMTP bounce
    "invalid email address",
  ];
  return permanentErrors.some(e => errorMsg.toLowerCase().includes(e.toLowerCase()));
}

// ─── Enqueue (called inside DB transactions) ─────────────────────────────────

/**
 * Enqueue an email job inside a Prisma transaction.
 * Designed to be called from within business logic transactions so the job
 * is only created when the parent transaction commits successfully.
 *
 * @param prismaClient - The Prisma transaction client (tx) or global prisma
 * @param eventType    - A human-readable event name for logging/idempotency
 * @param recipient    - The destination email address
 * @param templateId   - The email template to use
 * @param payload      - Template variables
 * @param idempotencyKey - Optional override; auto-generated if omitted
 */
export const enqueueEmailJob = async (
  prismaClient: any,
  eventType: string,
  recipient: string,
  templateId: string,
  payload: any,
  idempotencyKey?: string,
): Promise<void> => {
  try {
    if (!recipient || typeof recipient !== "string" || !recipient.includes("@")) {
      console.warn(`[Email Dispatcher] Skipping job — invalid recipient: "${recipient}"`);
      return;
    }

    const key = idempotencyKey || `${eventType}_${templateId}_${Date.now()}_${randomUUID().slice(0, 8)}`;

    // Check if already enqueued with same key (idempotency guard)
    const existing = await prismaClient.emailJob.findUnique({ where: { idempotencyKey: key } }).catch(() => null);
    if (existing) {
      console.log(`[Email Dispatcher] Skipping duplicate job — key already exists: ${key}`);
      return;
    }

    await prismaClient.emailJob.create({
      data: {
        eventType,
        recipient: recipient.trim().toLowerCase(),
        templateId,
        payload: JSON.stringify(payload),
        idempotencyKey: key,
        status: "PENDING",
      },
    });
  } catch (error: any) {
    // Job queue failure must NEVER propagate to the business transaction
    console.error(`[Email Dispatcher] Failed to enqueue job (${eventType} → ${recipient}):`, error?.message || error);
  }
};

// ─── Process pending jobs ─────────────────────────────────────────────────────

const MAX_JOB_ATTEMPTS = 3; // Maximum retry attempts for transient failures

export const processEmailJobs = async (): Promise<void> => {
  const db = prisma as any;

  // Only process if an email provider is configured
  const provider = env.EMAIL_PROVIDER;
  const hasProvider =
    (provider === "resend" && env.RESEND_API_KEY && env.EMAIL_FROM) ||
    (provider === "smtp" && env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD) ||
    (provider === "gas" && env.GAS_WEBHOOK_URL) ||
    (provider !== "none" && env.NODE_ENV !== "production"); // dev console fallback

  if (!hasProvider) {
    return; // Silently skip — startup validation already warned about this
  }

  // Fetch pending or failed (with attempts left) jobs
  const jobs = await db.emailJob.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] as EmailJobStatus[] },
      attempts: { lt: MAX_JOB_ATTEMPTS },
      scheduledAt: { lte: new Date() },
    },
    take: 10,
    orderBy: { createdAt: "asc" },
  });

  if (jobs.length === 0) return;

  for (const job of jobs) {
    // Mark as PROCESSING to prevent concurrent workers picking it up
    await db.emailJob.update({
      where: { id: job.id },
      data: { status: "PROCESSING" as EmailJobStatus, attempts: { increment: 1 } },
    }).catch(() => null);

    try {
      let payload: any = {};
      try {
        payload = JSON.parse(job.payload || "{}");
      } catch {
        payload = {};
      }

      const html = generateEmailHtml(job.templateId, payload);
      const text = generateEmailText(job.templateId, payload);
      const subject = resolveSubject(job.templateId, payload);

      const result = await sendEmail({
        to: job.recipient,
        subject,
        html,
        text,
      });

      if (result.success) {
        await db.emailJob.update({
          where: { id: job.id },
          data: { status: "SENT" as EmailJobStatus, sentAt: new Date() },
        });
        console.log(
          `[Email Dispatcher] ✓ Job ${job.id} (${job.templateId}) sent to ${job.recipient} via ${result.provider} — msgId=${result.messageId || "n/a"}`
        );
      } else {
        const permanent = isUnrecoverableError(result.error || "");
        await db.emailJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED" as EmailJobStatus,
            lastError: result.error || "Unknown error",
            // Exhaust remaining attempts for permanent failures to stop retrying
            ...(permanent ? { attempts: MAX_JOB_ATTEMPTS } : {}),
          },
        });
        console.error(
          `[Email Dispatcher] ✗ Job ${job.id} (${job.templateId}) failed — ${result.error}${permanent ? " [PERMANENT — no retry]" : ""}`
        );
      }
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      const permanent = isUnrecoverableError(errorMsg);
      await db.emailJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED" as EmailJobStatus,
          lastError: errorMsg,
          ...(permanent ? { attempts: MAX_JOB_ATTEMPTS } : {}),
        },
      }).catch(() => null);
      console.error(`[Email Dispatcher] ✗ Job ${job.id} exception: ${errorMsg}`);
    }
  }
};

// ─── Background dispatcher ────────────────────────────────────────────────────

let _isRunning = false;
let _isProcessing = false;

export const startEmailDispatcher = (): void => {
  if (_isRunning) return;
  _isRunning = true;
  console.log("[Email Dispatcher] Started background worker (interval: 10s)");

  setInterval(async () => {
    if (_isProcessing) return;
    _isProcessing = true;
    try {
      await processEmailJobs();
    } catch (err: any) {
      if (err?.code === "P1001" || err?.code === "P1017") {
        // Database temporarily unreachable — silently retry next cycle
        console.warn("[Email Dispatcher] Database temporarily unreachable. Retrying in next cycle...");
      } else {
        console.error("[Email Dispatcher] Unhandled loop error:", err?.message || err);
      }
    } finally {
      _isProcessing = false;
    }
  }, 10_000); // Check every 10 seconds
};
