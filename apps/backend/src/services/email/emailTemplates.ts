import { buildShadowShopTemplate, formatCurrency, formatDate, escapeHtml } from "./templateBuilder.js";

const Templates: Record<string, (payload: any) => string> = {
  order_placed: (order: any) => {
    return buildShadowShopTemplate({
      title: `Order Confirmation - #${order.orderNumber}`,
      previewText: `Thank you for your order! Your order #${order.orderNumber} has been received.`,
      bodyHtml: `
        <h2>Order Confirmed</h2>
        <p>Hi ${escapeHtml(order.customerName || 'Customer')},</p>
        <p>We've received your order and are getting it ready. Here's a quick summary:</p>
        
        <table class="order-table">
          <thead>
            <tr>
              <th>Item</th>
              <th class="text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            ${order.items ? order.items.map((item: any) => `
              <tr>
                <td>
                  <strong>${escapeHtml(item.product?.name || item.productNameSnapshot || 'Product')}</strong><br>
                  <span style="font-size: 13px; color: #71717a; margin-top: 4px; display: inline-block;">Qty: ${item.quantity}</span>
                </td>
                <td class="text-right" style="font-weight: 600;">${formatCurrency(item.unitPriceSnapshot || item.price || 0)}</td>
              </tr>
            `).join('') : ''}
          </tbody>
        </table>

        <table class="summary-table">
          <tr class="summary-row">
            <td>Subtotal</td>
            <td class="text-right">${formatCurrency(order.subtotal || 0)}</td>
          </tr>
          ${order.discount > 0 ? `
          <tr class="summary-row">
            <td>Discount</td>
            <td class="text-right" style="color: #dc2626;">-${formatCurrency(order.discount)}</td>
          </tr>
          ` : ''}
          <tr class="summary-row">
            <td>Shipping</td>
            <td class="text-right">${order.shippingCharge > 0 ? formatCurrency(order.shippingCharge) : 'Free'}</td>
          </tr>
          <tr class="summary-row total">
            <td>Total</td>
            <td class="text-right">${formatCurrency(order.grandTotal || 0)}</td>
          </tr>
        </table>
      `,
      callToAction: {
        text: "Track Order",
        url: `${process.env.CUSTOMER_URL || 'http://localhost:3000'}/account/orders/${order.id}`
      }
    });
  },

  admin_new_order_alert: (order: any) => {
    return buildShadowShopTemplate({
      title: `New Order Alert - #${order.orderNumber}`,
      previewText: `A new order has been placed by ${order.customerName || 'Customer'}.`,
      bodyHtml: `
        <h2>New Order Alert</h2>
        <p><strong>Order Number:</strong> #${order.orderNumber}</p>
        <p><strong>Customer:</strong> ${escapeHtml(order.customerName || 'Guest')}</p>
        <p><strong>Total Value:</strong> ${formatCurrency(order.grandTotal || 0)}</p>
        <p>Please log in to the admin dashboard to process this order.</p>
      `,
      callToAction: {
        text: "View Order in Admin",
        url: `${process.env.ADMIN_URL || 'http://localhost:3001'}/orders/${order.id}`
      }
    });
  },

  order_shipped: (order: any) => {
    return buildShadowShopTemplate({
      title: `Your Order Has Shipped - #${order.orderNumber}`,
      previewText: `Good news! Order #${order.orderNumber} is on its way.`,
      bodyHtml: `
        <h2>It's on the way!</h2>
        <p>Hi ${escapeHtml(order.customerName || 'Customer')},</p>
        <p>Your order is now on its way to you.</p>
        ${order.courierName ? `<p><strong>Courier:</strong> ${escapeHtml(order.courierName)}</p>` : ''}
        ${order.trackingNumber ? `<p><strong>Tracking Number:</strong> ${escapeHtml(order.trackingNumber)}</p>` : ''}
      `,
      callToAction: order.trackingNumber ? {
        text: "Track Shipment",
        url: `${process.env.CUSTOMER_URL || 'http://localhost:3000'}/account/orders/${order.id}`
      } : undefined
    });
  },

  order_delivered: (order: any) => {
    return buildShadowShopTemplate({
      title: `Order Complete & Invoice - #${order.orderNumber}`,
      previewText: `Your order #${order.orderNumber} has been delivered. View your final invoice.`,
      bodyHtml: `
        <h2>Order Completed</h2>
        <p>Hi ${escapeHtml(order.customerName || 'Customer')},</p>
        <p>Your order <strong>#${order.orderNumber}</strong> has been successfully delivered and completed. Below is your final invoice for your records.</p>
        
        <div style="margin-top: 24px; padding-top: 24px; border-top: 2px solid #e4e4e7;">
          <h3 style="margin-bottom: 16px; font-size: 14px; text-transform: uppercase; color: #71717a; letter-spacing: 1px;">Final Invoice Details</h3>
          
          <table class="order-table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #fafafa; border-bottom: 1px solid #e4e4e7;">
                <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #52525b;">Item</th>
                <th style="padding: 12px; text-align: center; font-size: 12px; text-transform: uppercase; color: #52525b;">Qty</th>
                <th class="text-right" style="padding: 12px; text-align: right; font-size: 12px; text-transform: uppercase; color: #52525b;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${order.items ? order.items.map((item: any) => `
                <tr style="border-bottom: 1px solid #f4f4f5;">
                  <td style="padding: 12px;">
                    <strong style="color: #18181b;">${escapeHtml(item.product?.name || item.productNameSnapshot || 'Product')}</strong>
                    ${item.selectedSize || item.selectedColor ? `<br><span style="font-size: 12px; color: #71717a;">${[item.selectedSize, item.selectedColor].filter(Boolean).join(' · ')}</span>` : ''}
                  </td>
                  <td style="padding: 12px; text-align: center; font-size: 13px;">${item.quantity}</td>
                  <td class="text-right" style="padding: 12px; text-align: right; font-weight: 600; font-size: 13px;">${formatCurrency((item.unitPriceSnapshot || item.price || 0) * item.quantity)}</td>
                </tr>
              `).join('') : ''}
            </tbody>
          </table>

          <table class="summary-table" style="width: 100%; margin-top: 16px;">
            <tr class="summary-row">
              <td style="padding: 8px 0; color: #52525b;">Subtotal</td>
              <td class="text-right" style="padding: 8px 0; font-weight: 500;">${formatCurrency(order.subtotal || 0)}</td>
            </tr>
            ${order.discount > 0 ? `
            <tr class="summary-row">
              <td style="padding: 8px 0; color: #52525b;">Discount</td>
              <td class="text-right" style="padding: 8px 0; color: #dc2626; font-weight: 500;">-${formatCurrency(order.discount)}</td>
            </tr>
            ` : ''}
            <tr class="summary-row">
              <td style="padding: 8px 0; color: #52525b;">Shipping</td>
              <td class="text-right" style="padding: 8px 0; font-weight: 500;">${order.shippingCharge > 0 ? formatCurrency(order.shippingCharge) : 'Free'}</td>
            </tr>
            <tr class="summary-row total" style="border-top: 2px solid #e4e4e7; font-weight: 700; font-size: 16px;">
              <td style="padding: 12px 0; color: #18181b;">Grand Total</td>
              <td class="text-right" style="padding: 12px 0; color: #18181b;">${formatCurrency(order.grandTotal || 0)}</td>
            </tr>
          </table>
          
          <div style="margin-top: 32px; background: #f8fafc; padding: 16px; border-radius: 8px;">
            <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Payment Method:</strong> ${order.paymentMethod ? order.paymentMethod.replace(/_/g, ' ') : 'N/A'}</p>
            <p style="margin: 4px 0 0; font-size: 13px; color: #475569;"><strong>Date of Completion:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <p style="margin-top: 32px;">We hope you enjoy your purchase! If you need a printable PDF of this invoice, you can download it anytime from your account dashboard.</p>
      `,
      callToAction: {
        text: "View Order in Dashboard",
        url: `${process.env.CUSTOMER_URL || 'http://localhost:3000'}/account/orders/${order.id}`
      }
    });
  },

  order_cancelled: (order: any) => {
    return buildShadowShopTemplate({
      title: `Order Cancelled - #${order.orderNumber}`,
      previewText: `Your order #${order.orderNumber} has been cancelled.`,
      bodyHtml: `
        <h2>Order Cancelled</h2>
        <p>Hi ${escapeHtml(order.customerName || 'Customer')},</p>
        <p>Your order #${order.orderNumber} has been cancelled.</p>
        <p>If you have already paid, a refund will be processed to your original payment method.</p>
      `
    });
  },

  admin_new_return_alert: (returnReq: any) => {
    return buildShadowShopTemplate({
      title: `New Return Request - ${returnReq.returnNumber}`,
      previewText: `A new return request has been submitted for Order #${returnReq.orderNumber}.`,
      bodyHtml: `
        <h2>New Return Request</h2>
        <p><strong>Return ID:</strong> ${returnReq.returnNumber}</p>
        <p><strong>Reason:</strong> ${escapeHtml(returnReq.reason)}</p>
        <p>Please log in to the admin dashboard to review this request.</p>
      `,
      callToAction: {
        text: "Review Return",
        url: `${process.env.ADMIN_URL || 'http://localhost:3001'}/returns/${returnReq.id}`
      }
    });
  },

  return_pickup_scheduled: (returnReq: any) => {
    return buildShadowShopTemplate({
      title: `Pickup Scheduled - ${returnReq.returnNumber}`,
      previewText: `A pickup has been scheduled for your return.`,
      bodyHtml: `
        <h2>Pickup Scheduled</h2>
        <p>Hi ${escapeHtml(returnReq.customerName || 'Customer')},</p>
        <p>Your return request <strong>${returnReq.returnNumber}</strong> has been approved and a pickup has been scheduled.</p>
        <p>Please keep the item(s) packed in their original condition with tags attached.</p>
      `,
    });
  },

  return_refund_completed: (returnReq: any) => {
    return buildShadowShopTemplate({
      title: `Refund Processed - ${returnReq.returnNumber}`,
      previewText: `Your refund for return ${returnReq.returnNumber} has been processed.`,
      bodyHtml: `
        <h2>Refund Processed</h2>
        <p>Hi ${escapeHtml(returnReq.customerName || 'Customer')},</p>
        <p>We have processed the refund for your return <strong>${returnReq.returnNumber}</strong>.</p>
        <p>The amount will reflect in your original payment method shortly.</p>
      `,
    });
  }
};

export const generateEmailHtml = (templateId: string, payload: any): string => {
  const templateFn = Templates[templateId];
  if (!templateFn) {
    console.warn(`[EmailTemplates] Template not found: ${templateId}`);
    return `<p>Hello from SHADOW SHOP. This is a system notification.</p><pre>${JSON.stringify(payload, null, 2)}</pre>`;
  }
  return templateFn(payload);
};
