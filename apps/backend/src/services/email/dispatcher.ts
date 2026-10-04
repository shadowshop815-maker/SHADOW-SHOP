import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { generateEmailHtml } from "./emailTemplates.js";

// Safe helper to queue emails without blocking the main thread
export const enqueueEmailJob = async (
  prismaClient: any, 
  eventType: string, 
  recipient: string, 
  templateId: string, 
  payload: any
) => {
  try {
    if (!recipient) return;
    await prismaClient.emailJob.create({
      data: {
        eventType,
        recipient,
        templateId,
        payload: JSON.stringify(payload),
        idempotencyKey: `${templateId}_${Date.now()}_${randomUUID().substring(0, 8)}`
      }
    });
  } catch (error) {
    console.error("[Email Dispatcher] Failed to enqueue job:", error);
  }
};

import { prisma } from "../../config/db.js";

// Override prisma locally as any to avoid type errors
const db = prisma as any;

import { env } from "../../config/env.js";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST || "smtp.gmail.com",
  port: env.SMTP_PORT || 465,
  secure: env.SMTP_PORT === 465, // true for 465, false for other ports
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASSWORD,
  },
  tls: { rejectUnauthorized: false },
});

export const processEmailJobs = async () => {
  // Only process if an email provider is configured
  const canSendSmtp = env.EMAIL_PROVIDER === "smtp" && env.SMTP_USER && env.SMTP_PASSWORD;
  const canSendResend = env.EMAIL_PROVIDER === "resend" && env.RESEND_API_KEY;
  if (!canSendSmtp && !canSendResend) {
    console.log("[Email Dispatcher] Email credentials missing. Skipping jobs.");
    return;
  }

  // Fetch pending or failed (with attempts left) jobs
  const jobs = await db.emailJob.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      attempts: { lt: 5 },
      scheduledAt: { lte: new Date() }
    },
    take: 10,
    orderBy: { createdAt: "asc" }
  });

  if (jobs.length === 0) return;

  for (const job of jobs) {
    try {
      // Mark as PROCESSING
      await db.emailJob.update({
        where: { id: job.id },
        data: { status: "PROCESSING", attempts: { increment: 1 } }
      });

      const payload = JSON.parse(job.payload);
      const html = generateEmailHtml(job.templateId as any, payload);
      
      let subject = "Update from SHADOW SHOP";
      if (job.templateId === "order_placed") subject = `Order Confirmation #${payload.orderNumber}`;
      if (job.templateId === "admin_new_order_alert") subject = `New Order Alert #${payload.orderNumber}`;
      if (job.templateId === "order_shipped") subject = `Your Order #${payload.orderNumber} has Shipped`;
      if (job.templateId === "order_delivered") subject = `Your Order #${payload.orderNumber} is Delivered`;
      if (job.templateId === "order_cancelled") subject = `Order Cancelled: #${payload.orderNumber}`;
      if (job.templateId === "admin_new_return_alert") subject = `New Return Request: ${payload.returnNumber}`;
      if (job.templateId === "return_pickup_scheduled") subject = `Pickup Scheduled for Return ${payload.returnNumber}`;
      if (job.templateId === "return_refund_completed") subject = `Refund Processed for Return ${payload.returnNumber}`;

      if (!job.recipient || job.recipient === "undefined" || job.recipient === "null") {
        throw new Error("No recipients defined or invalid recipient address");
      }

      if (env.EMAIL_PROVIDER === "resend" && env.RESEND_API_KEY) {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Shadow Shop <onboarding@resend.dev>",
            to: job.recipient,
            subject,
            html,
          }),
        });
        if (!resendRes.ok) {
          const body = await resendRes.text().catch(() => "");
          throw new Error(`Resend API Error: ${resendRes.status} ${body}`);
        }
      } else {
        await transporter.sendMail({
          from: `"SHADOW SHOP" <${env.SMTP_FROM || env.SMTP_USER}>`,
          to: job.recipient,
          subject,
          html
        });
      }

      // Mark as SENT
      await db.emailJob.update({
        where: { id: job.id },
        data: { status: "SENT", sentAt: new Date() }
      });
      console.log(`[Email Dispatcher] Successfully sent job ${job.id} (${job.templateId}) to ${job.recipient}`);
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error(`[Email Dispatcher] Failed to send job ${job.id}: ${errorMsg}`);
      
      // If it's an unrecoverable error like no recipient, max out attempts to stop retrying
      const isUnrecoverable = errorMsg.includes("No recipients defined") || error?.code === "EENVELOPE";
      
      await db.emailJob.update({
        where: { id: job.id },
        data: { 
          status: "FAILED", 
          lastError: errorMsg,
          ...(isUnrecoverable && { attempts: 5 }) // Stop retrying
        }
      });
    }
  }
};

// Start the daemon loop
let isRunning = false;
export const startEmailDispatcher = () => {
  if (isRunning) return;
  isRunning = true;
  console.log("[Email Dispatcher] Started background worker (interval: 10s)");
let isProcessingJobs = false;
  setInterval(async () => {
    if (isProcessingJobs) return;
    isProcessingJobs = true;
    try {
      await processEmailJobs();
    } catch (e: any) {
      if (e?.code === 'P1001') {
        console.warn("[Email Dispatcher] Database unreachable (P1001). Retrying in next cycle...");
      } else {
        console.error("[Email Dispatcher] Unhandled loop error:", e?.message || e);
      }
    } finally {
      isProcessingJobs = false;
    }
  }, 10000); // Check every 10 seconds
};
