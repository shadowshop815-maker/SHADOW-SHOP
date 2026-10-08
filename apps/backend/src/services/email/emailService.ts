/**
 * Central Email Service — SHADOW SHOP
 *
 * ALL emails must go through this module.
 * Supports: Resend (primary), SMTP (fallback), GAS relay (legacy)
 *
 * Configuration (backend env vars only):
 *   EMAIL_PROVIDER=resend
 *   RESEND_API_KEY=<key>
 *   EMAIL_FROM=no-reply@yourdomain.com
 *   EMAIL_FROM_NAME=SHADOW SHOP
 *   ADMIN_EMAIL=admin@yourdomain.com
 *   SUPPORT_EMAIL=support@yourdomain.com
 */

import { env } from "../../config/env.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}

export interface SendEmailResult {
  success: boolean;
  provider: "resend" | "smtp" | "brevo" | "gas" | "console" | "none";
  messageId?: string;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const maskEmail = (email: string) =>
  email.includes("@")
    ? `${email[0]}*****@${email.split("@")[1]}`
    : email.slice(0, 3) + "***";

function buildFromHeader(): string {
  const name = env.EMAIL_FROM_NAME || "SHADOW SHOP";
  const address = env.EMAIL_FROM || "noreply@example.com";
  return `${name} <${address}>`;
}

// ─── Resend Provider ──────────────────────────────────────────────────────────

async function sendViaResend(options: SendEmailOptions): Promise<SendEmailResult> {
  if (!env.RESEND_API_KEY) {
    return { success: false, provider: "resend", error: "RESEND_API_KEY not configured" };
  }
  if (!env.EMAIL_FROM) {
    return { success: false, provider: "resend", error: "EMAIL_FROM not configured" };
  }

  const body: Record<string, unknown> = {
    from: buildFromHeader(),
    to: [options.to],
    subject: options.subject,
    html: options.html,
  };

  if (options.text) body.text = options.text;
  if (options.replyTo) body.reply_to = options.replyTo;
  if (options.tags) body.tags = options.tags;

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr: unknown) {
    const msg = networkErr instanceof Error ? networkErr.message : String(networkErr);
    return { success: false, provider: "resend", error: `Network error: ${msg}` };
  }

  // Always check the actual response — never assume success on no-exception
  let responseData: any;
  try {
    responseData = await response.json();
  } catch {
    responseData = {};
  }

  if (!response.ok || responseData.error) {
    const errorMsg = responseData?.error?.message || responseData?.message || `HTTP ${response.status}`;
    return {
      success: false,
      provider: "resend",
      error: `Resend API error: ${errorMsg} (status=${response.status})`,
    };
  }

  return {
    success: true,
    provider: "resend",
    messageId: responseData.id || responseData.message_id,
  };
}

// ─── SMTP Provider ────────────────────────────────────────────────────────────

async function sendViaSmtp(options: SendEmailOptions): Promise<SendEmailResult> {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
    return { success: false, provider: "smtp", error: "SMTP not fully configured" };
  }

  // Lazy-import nodemailer only when SMTP is the active provider
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.default.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 8000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
  });

  try {
    const info = await Promise.race([
      transport.sendMail({
        from: buildFromHeader(),
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("SMTP timeout after 8s (possible firewall block)")), 8000)
      ),
    ]) as any;

    return { success: true, provider: "smtp", messageId: info.messageId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, provider: "smtp", error: msg };
  }
}

// ─── GAS Relay Provider ───────────────────────────────────────────────────────

async function sendViaGas(options: SendEmailOptions): Promise<SendEmailResult> {
  if (!env.GAS_WEBHOOK_URL) {
    return { success: false, provider: "gas", error: "GAS_WEBHOOK_URL not configured" };
  }

  try {
    const response = await fetch(env.GAS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        fromName: env.EMAIL_FROM_NAME || "SHADOW SHOP",
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    });

    const data = await response.json().catch(() => ({})) as any;
    if (!data.success) {
      return { success: false, provider: "gas", error: `GAS error: ${data.error || response.statusText}` };
    }

    return { success: true, provider: "gas", messageId: data.messageId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, provider: "gas", error: msg };
  }
}

// ─── Brevo Provider ────────────────────────────────────────────────────────────

async function sendViaBrevo(options: SendEmailOptions): Promise<SendEmailResult> {
  if (!env.BREVO_API_KEY) {
    return { success: false, provider: "brevo", error: "BREVO_API_KEY not configured" };
  }
  if (!env.EMAIL_FROM) {
    return { success: false, provider: "brevo", error: "EMAIL_FROM not configured" };
  }

  const body: Record<string, unknown> = {
    sender: { name: env.EMAIL_FROM_NAME || "SHADOW SHOP", email: env.EMAIL_FROM },
    to: [{ email: options.to }],
    subject: options.subject,
    htmlContent: options.html,
  };

  if (options.text) body.textContent = options.text;
  if (options.replyTo) body.replyTo = { email: options.replyTo };
  if (options.tags) body.tags = options.tags.map(t => t.name);

  let response: Response;
  try {
    response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": env.BREVO_API_KEY,
        "accept": "application/json"
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr: unknown) {
    const msg = networkErr instanceof Error ? networkErr.message : String(networkErr);
    return { success: false, provider: "brevo", error: `Network error: ${msg}` };
  }

  let responseData: any;
  try {
    responseData = await response.json();
  } catch {
    responseData = {};
  }

  if (!response.ok || responseData.error || responseData.code) {
    const errorMsg = responseData?.message || responseData?.error || `HTTP ${response.status}`;
    return {
      success: false,
      provider: "brevo",
      error: `Brevo API error: ${errorMsg} (status=${response.status})`,
    };
  }

  return {
    success: true,
    provider: "brevo",
    messageId: responseData.messageId || responseData.messageIds?.[0],
  };
}

// ─── Console / Dev fallback ───────────────────────────────────────────────────

function sendToConsole(options: SendEmailOptions): SendEmailResult {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  📧 EMAIL (dev console fallback)`);
  console.log(`${"═".repeat(60)}`);
  console.log(`  To     : ${options.to}`);
  console.log(`  Subject: ${options.subject}`);
  console.log(`  (HTML email body omitted — see template)`);
  console.log(`${"═".repeat(60)}\n`);
  return { success: true, provider: "console", messageId: `dev-${Date.now()}` };
}

// ─── Central sendEmail function ───────────────────────────────────────────────

/**
 * Send an email through the configured provider.
 * This is the ONLY function controllers/services should call.
 *
 * Email failures are returned as results, not thrown exceptions,
 * so a failed email never corrupts a successful business transaction.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  // Validate recipient
  const recipient = (options.to || "").trim().toLowerCase();
  if (!recipient || !recipient.includes("@")) {
    return { success: false, provider: "none", error: `Invalid recipient: "${options.to}"` };
  }

  // Route to correct provider
  const provider = (env.EMAIL_PROVIDER || "none").toLowerCase();
  let result: SendEmailResult;

  if (provider === "resend") {
    result = await sendViaResend({ ...options, to: recipient });
  } else if (provider === "smtp") {
    result = await sendViaSmtp({ ...options, to: recipient });
  } else if (provider === "brevo") {
    result = await sendViaBrevo({ ...options, to: recipient });
  } else if (provider === "gas") {
    result = await sendViaGas({ ...options, to: recipient });
  } else if (env.NODE_ENV !== "production") {
    result = sendToConsole({ ...options, to: recipient });
  } else {
    result = {
      success: false,
      provider: "none",
      error: "EMAIL_PROVIDER not configured",
    };
  }

  // Structured logging (no secrets ever)
  if (result.success) {
    console.log(
      `[EMAIL SENT] to=${maskEmail(recipient)} subject="${options.subject.slice(0, 60)}" provider=${result.provider} msgId=${result.messageId || "n/a"}`
    );
  } else {
    console.error(
      `[EMAIL FAILED] to=${maskEmail(recipient)} subject="${options.subject.slice(0, 60)}" provider=${result.provider} error="${result.error}"`
    );
  }

  return result;
}

// ─── Convenience: send to admin ───────────────────────────────────────────────

export async function sendAdminEmail(options: Omit<SendEmailOptions, "to">): Promise<SendEmailResult> {
  const adminEmail = env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn("[EMAIL] sendAdminEmail skipped — ADMIN_EMAIL not configured");
    return { success: false, provider: "none", error: "ADMIN_EMAIL not configured" };
  }
  return sendEmail({ ...options, to: adminEmail });
}
