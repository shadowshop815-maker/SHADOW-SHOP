import { buildShadowShopTemplate, formatCurrency, formatDate, escapeHtml } from "./templateBuilder.js";
import { env } from "../../config/env.js";

// ─── Template helpers ─────────────────────────────────────────────────────────

function supportUrl(): string {
  return `${env.CUSTOMER_URL || "http://localhost:3000"}/contact`;
}

function orderUrl(orderId: string): string {
  return `${env.CUSTOMER_URL || "http://localhost:3000"}/account/orders/${orderId}`;
}

function adminOrderUrl(orderId: string): string {
  return `${env.ADMIN_URL || "http://localhost:3001"}/orders/${orderId}`;
}

function adminReturnUrl(returnId: string): string {
  return `${env.ADMIN_URL || "http://localhost:3001"}/returns/${returnId}`;
}

function shopUrl(): string {
  return env.CUSTOMER_URL || "http://localhost:3000";
}

function supportFooter(): string {
  const supportEmail = env.SUPPORT_EMAIL || env.ADMIN_EMAIL || "";
  if (supportEmail) {
    return `<p>Need help? <a href="mailto:${escapeHtml(supportEmail)}" style="color:#18181b;font-weight:600;">${escapeHtml(supportEmail)}</a></p>`;
  }
  return `<p>Need help? Visit our <a href="${escapeHtml(supportUrl())}" style="color:#18181b;font-weight:600;">support page</a>.</p>`;
}

// ─── Template Registry ────────────────────────────────────────────────────────

const Templates: Record<string, (payload: any) => string> = {

  // ── OTP / Email Verification ──────────────────────────────────────────────

  otp_verify: (data: any) => buildShadowShopTemplate({
    title: "Verify Your Email — SHADOW SHOP",
    previewText: `Your SHADOW SHOP verification code is: ${data.code}. Valid for ${data.expiryMinutes || 5} minutes.`,
    bodyHtml: `
      <h2 style="margin-top:0;">Verify your email</h2>
      <p>Hi${data.name ? ` ${escapeHtml(data.name)}` : ""},</p>
      <p>Use the code below to verify your email address. This code expires in <strong>${data.expiryMinutes || 5} minutes</strong>.</p>

      <div style="margin:32px auto;padding:28px 0;text-align:center;background:#f4f4f5;border-radius:12px;border:1px solid #e4e4e7;">
        <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#71717a;font-weight:600;">Verification Code</p>
        <span style="font-family:'Courier New',Courier,monospace;font-size:44px;font-weight:800;letter-spacing:10px;color:#18181b;display:inline-block;padding:0 12px;">${escapeHtml(String(data.code))}</span>
        <p style="margin:12px 0 0;font-size:12px;color:#71717a;">Expires in ${data.expiryMinutes || 5} minutes</p>
      </div>

      <p style="font-size:13px;color:#71717a;">⚠️ <strong>Never share this code</strong> with anyone — including SHADOW SHOP staff.</p>
      <p style="font-size:13px;color:#71717a;">If you didn't request this, you can safely ignore this email.</p>
      ${supportFooter()}
    `,
  }),

  // ── Password Reset ────────────────────────────────────────────────────────

  otp_password_reset: (data: any) => buildShadowShopTemplate({
    title: "Reset Your Password — SHADOW SHOP",
    previewText: `Your SHADOW SHOP password reset code is: ${data.code}. Valid for ${data.expiryMinutes || 5} minutes.`,
    bodyHtml: `
      <h2 style="margin-top:0;">Reset your password</h2>
      <p>Hi${data.name ? ` ${escapeHtml(data.name)}` : ""},</p>
      <p>We received a request to reset your password. Use the code below to continue.</p>

      <div style="margin:32px auto;padding:28px 0;text-align:center;background:#f4f4f5;border-radius:12px;border:1px solid #e4e4e7;">
        <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#71717a;font-weight:600;">Password Reset Code</p>
        <span style="font-family:'Courier New',Courier,monospace;font-size:44px;font-weight:800;letter-spacing:10px;color:#18181b;display:inline-block;padding:0 12px;">${escapeHtml(String(data.code))}</span>
        <p style="margin:12px 0 0;font-size:12px;color:#71717a;">Expires in ${data.expiryMinutes || 5} minutes</p>
      </div>

      <p style="font-size:13px;color:#71717a;">If you did not request a password reset, your account is safe — simply ignore this email.</p>
      <p style="font-size:13px;color:#71717a;">⚠️ <strong>Never share this code</strong> with anyone.</p>
      ${supportFooter()}
    `,
  }),

  // ── Password Changed Notification ─────────────────────────────────────────

  password_changed: (data: any) => buildShadowShopTemplate({
    title: "Your Password Was Changed — SHADOW SHOP",
    previewText: "Your SHADOW SHOP password was successfully changed.",
    bodyHtml: `
      <h2 style="margin-top:0;">Password changed</h2>
      <p>Hi${data.name ? ` ${escapeHtml(data.name)}` : ""},</p>
      <p>Your SHADOW SHOP account password was changed on <strong>${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</strong>.</p>
      <p>If you made this change, no further action is needed.</p>
      <div style="padding:16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin:24px 0;">
        <p style="margin:0;color:#dc2626;font-size:14px;font-weight:600;">⚠️ If you did NOT change your password, please contact us immediately and reset your password.</p>
      </div>
      ${supportFooter()}
    `,
    callToAction: { text: "Reset Password Now", url: `${shopUrl()}/reset-password` },
  }),

  // ── Welcome Email ─────────────────────────────────────────────────────────

  welcome: (data: any) => buildShadowShopTemplate({
    title: "Welcome to SHADOW SHOP",
    previewText: "Welcome to SHADOW SHOP — own the shadow, define the style.",
    bodyHtml: `
      <h2 style="margin-top:0;">Welcome to SHADOW SHOP</h2>
      <p>Hi ${escapeHtml(data.name || "there")},</p>
      <p>Your account is verified and ready. We're glad to have you in the SHADOW SHOP family.</p>
      <p>Explore our latest collections, exclusive drops, and premium essentials curated for a bold, modern wardrobe.</p>
      <div style="margin:24px 0;padding:20px;background:#f4f4f5;border-radius:8px;text-align:center;">
        <p style="margin:0;font-size:14px;color:#52525b;font-weight:600;">Own the shadow. Define the style.</p>
      </div>
      ${supportFooter()}
    `,
    callToAction: { text: "Shop Now", url: shopUrl() },
  }),

  // ── Order Placed (Customer) ───────────────────────────────────────────────

  order_placed: (order: any) => {
    const shippingAddr = (() => {
      try { return JSON.parse(order.shippingAddressSnapshot || "{}"); } catch { return {}; }
    })();
    return buildShadowShopTemplate({
      title: `Order Confirmation — #${order.orderNumber}`,
      previewText: `Your order #${order.orderNumber} has been received. Thank you for shopping with SHADOW SHOP.`,
      bodyHtml: `
        <h2 style="margin-top:0;">Order Confirmed</h2>
        <p>Hi ${escapeHtml(order.customerName || order.guestName || "Customer")},</p>
        <p>Thank you for your order! We've received it and are getting it ready.</p>

        <div style="background:#f4f4f5;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#71717a;font-weight:600;">Order Number</p>
          <p style="margin:0;font-size:18px;font-weight:800;color:#18181b;">#${escapeHtml(order.orderNumber)}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#71717a;">${formatDate(order.createdAt || new Date())}</p>
        </div>

        <table class="order-table">
          <thead><tr><th>Item</th><th style="text-align:center;">Qty</th><th class="text-right">Price</th></tr></thead>
          <tbody>
            ${(order.items || []).map((item: any) => `
              <tr>
                <td>
                  <strong>${escapeHtml(item.productNameSnapshot || item.product?.name || "Product")}</strong>
                  ${item.selectedSize || item.selectedColor ? `<br><span style="font-size:12px;color:#71717a;">${[item.selectedSize, item.selectedColor].filter(Boolean).join(" · ")}</span>` : ""}
                </td>
                <td style="text-align:center;">${item.quantity}</td>
                <td class="text-right" style="font-weight:600;">${formatCurrency(Number(item.unitPriceSnapshot || 0) * item.quantity)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <table class="summary-table">
          <tr class="summary-row"><td>Subtotal</td><td class="text-right">${formatCurrency(order.subtotal || 0)}</td></tr>
          ${Number(order.discount) > 0 ? `<tr class="summary-row"><td>Discount</td><td class="text-right" style="color:#dc2626;">-${formatCurrency(order.discount)}</td></tr>` : ""}
          <tr class="summary-row"><td>Shipping</td><td class="text-right">${Number(order.shippingCharge) > 0 ? formatCurrency(order.shippingCharge) : "Free"}</td></tr>
          ${Number(order.tax) > 0 ? `<tr class="summary-row"><td>Tax (GST)</td><td class="text-right">${formatCurrency(order.tax)}</td></tr>` : ""}
          <tr class="summary-row total"><td>Total</td><td class="text-right">${formatCurrency(order.grandTotal || 0)}</td></tr>
        </table>

        <table style="width:100%;margin-top:16px;">
          <tr>
            <td style="vertical-align:top;width:50%;padding-right:12px;">
              <p style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#71717a;font-weight:600;margin:0 0 8px;">Payment</p>
              <p style="margin:0;font-size:14px;color:#18181b;">${escapeHtml((order.paymentMethod || "").replace(/_/g, " "))}</p>
              <p style="margin:4px 0 0;font-size:13px;color:${order.paymentStatus === "PAID" ? "#10b981" : "#71717a"};">${escapeHtml(order.paymentStatus || "PENDING")}</p>
            </td>
            ${shippingAddr.line1 ? `
            <td style="vertical-align:top;padding-left:12px;">
              <p style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#71717a;font-weight:600;margin:0 0 8px;">Delivery Address</p>
              <p style="margin:0;font-size:14px;color:#18181b;line-height:1.6;">
                ${escapeHtml(shippingAddr.fullName || shippingAddr.name || "")}${shippingAddr.fullName || shippingAddr.name ? "<br>" : ""}
                ${escapeHtml(shippingAddr.line1 || "")}<br>
                ${shippingAddr.line2 ? escapeHtml(shippingAddr.line2) + "<br>" : ""}
                ${escapeHtml(shippingAddr.city || shippingAddr.town || "")}${shippingAddr.state ? ", " + escapeHtml(shippingAddr.state) : ""} — ${escapeHtml(shippingAddr.pinCode || "")}
              </p>
            </td>` : ""}
          </tr>
        </table>

        ${supportFooter()}
      `,
      callToAction: { text: "Track Order", url: orderUrl(order.id) },
    });
  },

  // ── Admin New Order Alert ─────────────────────────────────────────────────

  admin_new_order_alert: (order: any) => buildShadowShopTemplate({
    title: `New Order Alert — #${order.orderNumber}`,
    previewText: `New order #${order.orderNumber} placed for ${formatCurrency(order.grandTotal || 0)}.`,
    bodyHtml: `
      <h2 style="margin-top:0;">🛍️ New Order Received</h2>
      <div style="background:#f4f4f5;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 6px;"><strong>Order:</strong> #${escapeHtml(order.orderNumber)}</p>
        <p style="margin:0 0 6px;"><strong>Customer:</strong> ${escapeHtml(order.customerName || order.guestName || "Guest")}</p>
        <p style="margin:0 0 6px;"><strong>Email:</strong> ${escapeHtml(order.customerEmail || order.guestEmail || "—")}</p>
        <p style="margin:0 0 6px;"><strong>Phone:</strong> ${escapeHtml(order.customerPhone || order.guestPhone || "—")}</p>
        <p style="margin:0 0 6px;"><strong>Total:</strong> ${formatCurrency(order.grandTotal || 0)}</p>
        <p style="margin:0 0 6px;"><strong>Payment:</strong> ${escapeHtml((order.paymentMethod || "").replace(/_/g, " "))} — ${escapeHtml(order.paymentStatus || "PENDING")}</p>
        <p style="margin:0;"><strong>Time:</strong> ${formatDate(order.createdAt || new Date())}</p>
      </div>
      <table class="order-table">
        <thead><tr><th>Item</th><th style="text-align:center;">Qty</th><th class="text-right">Price</th></tr></thead>
        <tbody>
          ${(order.items || []).map((item: any) => `
            <tr>
              <td><strong>${escapeHtml(item.productNameSnapshot || "Product")}</strong>${item.selectedSize || item.selectedColor ? `<br><span style="font-size:12px;color:#71717a;">${[item.selectedSize, item.selectedColor].filter(Boolean).join(" · ")}</span>` : ""}</td>
              <td style="text-align:center;">${item.quantity}</td>
              <td class="text-right">${formatCurrency(Number(item.unitPriceSnapshot || 0) * item.quantity)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `,
    callToAction: { text: "View Order in Admin", url: adminOrderUrl(order.id) },
  }),

  // ── Order Status Emails ───────────────────────────────────────────────────

  order_confirmed: (order: any) => buildShadowShopTemplate({
    title: `Order Confirmed — #${order.orderNumber}`,
    previewText: `Your order #${order.orderNumber} is confirmed and will be processed shortly.`,
    bodyHtml: `
      <h2 style="margin-top:0;">✅ Order Confirmed</h2>
      <p>Hi ${escapeHtml(order.customerName || order.guestName || "Customer")},</p>
      <p>Great news! Your order <strong>#${escapeHtml(order.orderNumber)}</strong> has been confirmed and will be processed shortly.</p>
      <p>We'll send you another update when your order is packed and ready to ship.</p>
      ${supportFooter()}
    `,
    callToAction: { text: "View Order", url: orderUrl(order.id) },
  }),

  order_processing: (order: any) => buildShadowShopTemplate({
    title: `Your Order is Being Processed — #${order.orderNumber}`,
    previewText: `Order #${order.orderNumber} is now being processed.`,
    bodyHtml: `
      <h2 style="margin-top:0;">⚙️ Processing Your Order</h2>
      <p>Hi ${escapeHtml(order.customerName || order.guestName || "Customer")},</p>
      <p>Your order <strong>#${escapeHtml(order.orderNumber)}</strong> is now being processed by our team. We're making sure everything is perfect before it ships.</p>
      ${supportFooter()}
    `,
    callToAction: { text: "View Order", url: orderUrl(order.id) },
  }),

  order_packed: (order: any) => buildShadowShopTemplate({
    title: `Your Order is Packed — #${order.orderNumber}`,
    previewText: `Order #${order.orderNumber} is packed and ready to ship.`,
    bodyHtml: `
      <h2 style="margin-top:0;">📦 Order Packed</h2>
      <p>Hi ${escapeHtml(order.customerName || order.guestName || "Customer")},</p>
      <p>Your order <strong>#${escapeHtml(order.orderNumber)}</strong> has been carefully packed and is ready for pickup by the courier. You'll receive tracking details once it ships.</p>
      ${supportFooter()}
    `,
    callToAction: { text: "View Order", url: orderUrl(order.id) },
  }),

  order_shipped: (order: any) => buildShadowShopTemplate({
    title: `Your Order Has Shipped — #${order.orderNumber}`,
    previewText: `Good news! Order #${order.orderNumber} is on its way to you.`,
    bodyHtml: `
      <h2 style="margin-top:0;">🚚 Your Order is on the Way!</h2>
      <p>Hi ${escapeHtml(order.customerName || order.guestName || "Customer")},</p>
      <p>Your order <strong>#${escapeHtml(order.orderNumber)}</strong> has been shipped and is on its way to you.</p>
      ${order.courierName ? `<p><strong>Courier:</strong> ${escapeHtml(order.courierName)}</p>` : ""}
      ${order.trackingNumber ? `<p><strong>Tracking Number:</strong> ${escapeHtml(order.trackingNumber)}</p>` : ""}
      ${supportFooter()}
    `,
    callToAction: { text: "Track Shipment", url: orderUrl(order.id) },
  }),

  order_out_for_delivery: (order: any) => buildShadowShopTemplate({
    title: `Out for Delivery — #${order.orderNumber}`,
    previewText: `Your order #${order.orderNumber} is out for delivery today!`,
    bodyHtml: `
      <h2 style="margin-top:0;">🏍️ Out for Delivery!</h2>
      <p>Hi ${escapeHtml(order.customerName || order.guestName || "Customer")},</p>
      <p>Your order <strong>#${escapeHtml(order.orderNumber)}</strong> is out for delivery today. Please make sure someone is available to receive it.</p>
      ${order.trackingNumber ? `<p><strong>Tracking:</strong> ${escapeHtml(order.trackingNumber)}</p>` : ""}
      ${supportFooter()}
    `,
    callToAction: { text: "View Order", url: orderUrl(order.id) },
  }),

  order_delivered: (order: any) => buildShadowShopTemplate({
    title: `Order Delivered — #${order.orderNumber}`,
    previewText: `Your order #${order.orderNumber} has been delivered. We hope you love it!`,
    bodyHtml: `
      <h2 style="margin-top:0;">🎉 Order Delivered!</h2>
      <p>Hi ${escapeHtml(order.customerName || order.guestName || "Customer")},</p>
      <p>Your order <strong>#${escapeHtml(order.orderNumber)}</strong> has been successfully delivered.</p>

      <div style="margin-top:24px;padding-top:24px;border-top:2px solid #e4e4e7;">
        <h3 style="margin-bottom:16px;font-size:14px;text-transform:uppercase;color:#71717a;letter-spacing:1px;">Final Invoice</h3>
        <table class="order-table">
          <thead><tr><th>Item</th><th style="text-align:center;">Qty</th><th class="text-right">Total</th></tr></thead>
          <tbody>
            ${(order.items || []).map((item: any) => `
              <tr>
                <td>
                  <strong>${escapeHtml(item.productNameSnapshot || "Product")}</strong>
                  ${item.selectedSize || item.selectedColor ? `<br><span style="font-size:12px;color:#71717a;">${[item.selectedSize, item.selectedColor].filter(Boolean).join(" · ")}</span>` : ""}
                </td>
                <td style="text-align:center;">${item.quantity}</td>
                <td class="text-right">${formatCurrency(Number(item.unitPriceSnapshot || 0) * item.quantity)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <table class="summary-table">
          <tr class="summary-row"><td>Subtotal</td><td class="text-right">${formatCurrency(order.subtotal || 0)}</td></tr>
          ${Number(order.discount) > 0 ? `<tr class="summary-row"><td>Discount</td><td class="text-right" style="color:#dc2626;">-${formatCurrency(order.discount)}</td></tr>` : ""}
          <tr class="summary-row"><td>Shipping</td><td class="text-right">${Number(order.shippingCharge) > 0 ? formatCurrency(order.shippingCharge) : "Free"}</td></tr>
          ${Number(order.tax) > 0 ? `<tr class="summary-row"><td>Tax (GST)</td><td class="text-right">${formatCurrency(order.tax)}</td></tr>` : ""}
          <tr class="summary-row total"><td>Grand Total</td><td class="text-right">${formatCurrency(order.grandTotal || 0)}</td></tr>
        </table>
        <div style="margin-top:16px;background:#f8fafc;padding:16px;border-radius:8px;">
          <p style="margin:0;font-size:13px;color:#475569;"><strong>Payment:</strong> ${escapeHtml((order.paymentMethod || "").replace(/_/g, " "))}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#475569;"><strong>Delivered:</strong> ${new Date().toLocaleDateString("en-IN")}</p>
        </div>
      </div>

      <p style="margin-top:24px;">We hope you love your purchase! 💜 Your feedback helps us improve.</p>
      ${supportFooter()}
    `,
    callToAction: { text: "View Invoice", url: orderUrl(order.id) },
  }),

  order_cancelled: (order: any) => buildShadowShopTemplate({
    title: `Order Cancelled — #${order.orderNumber}`,
    previewText: `Your order #${order.orderNumber} has been cancelled.`,
    bodyHtml: `
      <h2 style="margin-top:0;">Order Cancelled</h2>
      <p>Hi ${escapeHtml(order.customerName || order.guestName || "Customer")},</p>
      <p>Your order <strong>#${escapeHtml(order.orderNumber)}</strong> has been cancelled.</p>
      ${order.cancellationReason ? `<p><strong>Reason:</strong> ${escapeHtml(order.cancellationReason)}</p>` : ""}
      <p>If a payment was made, a refund will be processed to your original payment method within 5–7 business days.</p>
      ${supportFooter()}
    `,
    callToAction: { text: "Shop Again", url: shopUrl() },
  }),

  // ── Return / Refund Emails ────────────────────────────────────────────────

  return_requested: (data: any) => buildShadowShopTemplate({
    title: `Return Request Received — ${data.returnNumber}`,
    previewText: `Your return request ${data.returnNumber} has been received and is under review.`,
    bodyHtml: `
      <h2 style="margin-top:0;">Return Request Received</h2>
      <p>Hi ${escapeHtml(data.customerName || "Customer")},</p>
      <p>We've received your return request <strong>${escapeHtml(data.returnNumber)}</strong> for order <strong>#${escapeHtml(data.orderNumber || "")}</strong>.</p>
      <p><strong>Reason:</strong> ${escapeHtml(data.reason || "")}</p>
      <p>Our team will review your request and respond within 2–3 business days.</p>
      ${supportFooter()}
    `,
    callToAction: { text: "View Return Status", url: orderUrl(data.orderId || "") },
  }),

  return_approved: (data: any) => buildShadowShopTemplate({
    title: `Return Approved — ${data.returnNumber}`,
    previewText: `Your return request ${data.returnNumber} has been approved.`,
    bodyHtml: `
      <h2 style="margin-top:0;">✅ Return Approved</h2>
      <p>Hi ${escapeHtml(data.customerName || "Customer")},</p>
      <p>Your return request <strong>${escapeHtml(data.returnNumber)}</strong> has been <strong style="color:#10b981;">approved</strong>.</p>
      <p>We'll arrange a pickup for your item(s) shortly. Please keep the items in their original packaging with all tags attached.</p>
      ${data.adminResponse ? `<p><strong>Note from our team:</strong> ${escapeHtml(data.adminResponse)}</p>` : ""}
      ${supportFooter()}
    `,
    callToAction: { text: "View Return Status", url: orderUrl(data.orderId || "") },
  }),

  return_rejected: (data: any) => buildShadowShopTemplate({
    title: `Return Request Update — ${data.returnNumber}`,
    previewText: `An update on your return request ${data.returnNumber}.`,
    bodyHtml: `
      <h2 style="margin-top:0;">Return Request Update</h2>
      <p>Hi ${escapeHtml(data.customerName || "Customer")},</p>
      <p>After reviewing your return request <strong>${escapeHtml(data.returnNumber)}</strong>, we are unable to approve it at this time.</p>
      ${data.adminResponse ? `<p><strong>Reason:</strong> ${escapeHtml(data.adminResponse)}</p>` : ""}
      <p>If you believe this is in error, please contact our support team.</p>
      ${supportFooter()}
    `,
  }),

  return_pickup_scheduled: (data: any) => buildShadowShopTemplate({
    title: `Pickup Scheduled — ${data.returnNumber}`,
    previewText: `A pickup has been scheduled for your return ${data.returnNumber}.`,
    bodyHtml: `
      <h2 style="margin-top:0;">📦 Pickup Scheduled</h2>
      <p>Hi ${escapeHtml(data.customerName || "Customer")},</p>
      <p>A pickup has been scheduled for your return request <strong>${escapeHtml(data.returnNumber)}</strong> (Order: <strong>#${escapeHtml(data.orderNumber || "")}</strong>).</p>
      <p>Please ensure the item(s) are:</p>
      <ul style="color:#52525b;font-size:14px;line-height:1.8;">
        <li>In their original packaging</li>
        <li>Tags still attached</li>
        <li>Not used or damaged further</li>
      </ul>
      ${supportFooter()}
    `,
  }),

  return_picked_up: (data: any) => buildShadowShopTemplate({
    title: `Item Picked Up — ${data.returnNumber}`,
    previewText: `Your return item for ${data.returnNumber} has been picked up.`,
    bodyHtml: `
      <h2 style="margin-top:0;">Item Picked Up</h2>
      <p>Hi ${escapeHtml(data.customerName || "Customer")},</p>
      <p>Your returned item(s) for request <strong>${escapeHtml(data.returnNumber)}</strong> have been picked up. Our team will inspect them and process your refund/exchange accordingly.</p>
      ${supportFooter()}
    `,
  }),

  return_received: (data: any) => buildShadowShopTemplate({
    title: `Return Received — ${data.returnNumber}`,
    previewText: `We've received your return for ${data.returnNumber}.`,
    bodyHtml: `
      <h2 style="margin-top:0;">Return Received</h2>
      <p>Hi ${escapeHtml(data.customerName || "Customer")},</p>
      <p>We've received your returned item(s) for request <strong>${escapeHtml(data.returnNumber)}</strong>. They're now undergoing inspection.</p>
      <p>We'll notify you as soon as the inspection is complete and your refund is processed.</p>
      ${supportFooter()}
    `,
  }),

  refund_initiated: (data: any) => buildShadowShopTemplate({
    title: `Refund Initiated — ${data.returnNumber || data.orderNumber}`,
    previewText: `Your refund of ${formatCurrency(data.refundAmount || 0)} has been initiated.`,
    bodyHtml: `
      <h2 style="margin-top:0;">💰 Refund Initiated</h2>
      <p>Hi ${escapeHtml(data.customerName || "Customer")},</p>
      <p>Your refund has been initiated for ${data.returnNumber ? `return <strong>${escapeHtml(data.returnNumber)}</strong>` : `order <strong>#${escapeHtml(data.orderNumber || "")}</strong>`}.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="margin:0;color:#15803d;font-size:18px;font-weight:700;">Refund Amount: ${formatCurrency(data.refundAmount || 0)}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#16a34a;">Status: Processing</p>
      </div>
      <p style="font-size:14px;color:#52525b;">The refund will be credited to your original payment method within <strong>5–7 business days</strong>.</p>
      ${supportFooter()}
    `,
  }),

  return_refund_completed: (data: any) => buildShadowShopTemplate({
    title: `Refund Completed — ${data.returnNumber}`,
    previewText: `Your refund for return ${data.returnNumber} has been processed.`,
    bodyHtml: `
      <h2 style="margin-top:0;">✅ Refund Processed</h2>
      <p>Hi ${escapeHtml(data.customerName || "Customer")},</p>
      <p>The refund for your return request <strong>${escapeHtml(data.returnNumber)}</strong> (Order: <strong>#${escapeHtml(data.orderNumber || "")}</strong>) has been successfully processed.</p>
      ${data.refundAmount ? `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="margin:0;color:#15803d;font-size:18px;font-weight:700;">Refund Amount: ${formatCurrency(data.refundAmount)}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#16a34a;">Status: Completed</p>
      </div>` : ""}
      <p style="font-size:14px;color:#52525b;">Please allow 2–5 business days for the amount to reflect in your account depending on your bank.</p>
      ${supportFooter()}
    `,
    callToAction: { text: "Shop Again", url: shopUrl() },
  }),

  // ── Admin Return Alerts ───────────────────────────────────────────────────

  admin_new_return_alert: (data: any) => buildShadowShopTemplate({
    title: `New Return Request — ${data.returnNumber}`,
    previewText: `New return request ${data.returnNumber} for order #${data.orderNumber}.`,
    bodyHtml: `
      <h2 style="margin-top:0;">🔄 New Return Request</h2>
      <div style="background:#f4f4f5;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 6px;"><strong>Return ID:</strong> ${escapeHtml(data.returnNumber)}</p>
        <p style="margin:0 0 6px;"><strong>Order:</strong> #${escapeHtml(data.orderNumber || "")}</p>
        <p style="margin:0 0 6px;"><strong>Customer:</strong> ${escapeHtml(data.customerName || "Guest")}</p>
        <p style="margin:0 0 6px;"><strong>Reason:</strong> ${escapeHtml(data.reason || "")}</p>
        <p style="margin:0;"><strong>Submitted:</strong> ${formatDate(data.createdAt || new Date())}</p>
      </div>
    `,
    callToAction: { text: "Review Return", url: adminReturnUrl(data.id || "") },
  }),

  // ── System Test ───────────────────────────────────────────────────────────

  email_system_test: (_data: any) => buildShadowShopTemplate({
    title: "SHADOW SHOP Email System Test",
    previewText: "Your SHADOW SHOP email system is configured correctly.",
    bodyHtml: `
      <h2 style="margin-top:0;">✅ Email System Working</h2>
      <p>This is a test message from the SHADOW SHOP email system.</p>
      <p>If you received this email, your email configuration is working correctly.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="margin:0;color:#15803d;font-weight:600;">Email provider: ${escapeHtml(env.EMAIL_PROVIDER || "none")}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#16a34a;">Sender: ${escapeHtml(env.EMAIL_FROM_NAME || "SHADOW SHOP")} &lt;${escapeHtml(env.EMAIL_FROM || "not configured")}&gt;</p>
      </div>
      <p style="font-size:13px;color:#71717a;">Sent at: ${new Date().toISOString()}</p>
    `,
  }),
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const generateEmailHtml = (templateId: string, payload: any): string => {
  const templateFn = Templates[templateId];
  if (!templateFn) {
    console.warn(`[EmailTemplates] Template not found: ${templateId}`);
    return `<p>Hello from SHADOW SHOP. This is a system notification.</p>`;
  }
  return templateFn(payload);
};

export const generateEmailText = (templateId: string, payload: any): string => {
  // Simple plain-text fallback for all templates
  const textMap: Record<string, string> = {
    otp_verify: `SHADOW SHOP\n\nYour verification code is: ${payload.code}\n\nExpires in ${payload.expiryMinutes || 5} minutes. Do not share this code.`,
    otp_password_reset: `SHADOW SHOP\n\nYour password reset code is: ${payload.code}\n\nExpires in ${payload.expiryMinutes || 5} minutes. Do not share this code.`,
    password_changed: `SHADOW SHOP\n\nYour password was changed successfully. If you did not make this change, contact us immediately.`,
    welcome: `SHADOW SHOP\n\nWelcome, ${payload.name || "Customer"}! Your account is now active. Shop at ${shopUrl()}`,
    order_placed: `SHADOW SHOP Order Confirmation\n\nHi ${payload.customerName || payload.guestName || "Customer"},\n\nYour order #${payload.orderNumber} has been received.\nTotal: ${formatCurrency(payload.grandTotal || 0)}\n\nTrack your order: ${orderUrl(payload.id)}`,
    order_shipped: `SHADOW SHOP\n\nYour order #${payload.orderNumber} has shipped.${payload.trackingNumber ? "\nTracking: " + payload.trackingNumber : ""}`,
    order_delivered: `SHADOW SHOP\n\nYour order #${payload.orderNumber} has been delivered. Thank you for shopping with us!`,
    order_cancelled: `SHADOW SHOP\n\nYour order #${payload.orderNumber} has been cancelled. If you paid, expect a refund within 5-7 business days.`,
    email_system_test: `SHADOW SHOP Email System Test\n\nYour email system is configured correctly.\nProvider: ${env.EMAIL_PROVIDER}\nSent: ${new Date().toISOString()}`,
  };
  return textMap[templateId] || `SHADOW SHOP notification. View online for full details.`;
};
