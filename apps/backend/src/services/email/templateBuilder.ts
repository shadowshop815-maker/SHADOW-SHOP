// Premium minimalist styling for universal email client compatibility
const COLORS = {
  bg: "#f4f4f5", // Light zinc background
  cardBg: "#ffffff", // Pure white card
  textPrimary: "#18181b", // Near black text
  textSecondary: "#71717a", // Gray text
  accent: "#000000", // Pure black for buttons/headers
  border: "#e4e4e7", // Light gray border
  danger: "#dc2626",
  success: "#10b981",
};

export function formatCurrency(amount: number | string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
  }).format(Number(amount));
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short"
  });
}

// Security: Escape user input to prevent HTML injection
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export interface EmailTemplateData {
  title: string;
  previewText?: string;
  bodyHtml: string;
  callToAction?: {
    text: string;
    url: string;
  };
}

export function buildShadowShopTemplate(data: EmailTemplateData): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(data.title)}</title>
  <style>
    /* Client-specific resets */
    #outlook a { padding: 0; }
    .ReadMsgBody { width: 100%; }
    .ExternalClass { width: 100%; }
    .ExternalClass, .ExternalClass p, .ExternalClass span, .ExternalClass font, .ExternalClass td, .ExternalClass div { line-height: 100%; }
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; }

    /* General styles */
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      background-color: ${COLORS.bg};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: ${COLORS.textPrimary};
      -webkit-font-smoothing: antialiased;
    }
    
    .content h2 {
      margin-top: 0;
      font-size: 22px;
      font-weight: 700;
      color: ${COLORS.textPrimary};
      margin-bottom: 20px;
    }

    .content p {
      margin: 0 0 16px 0;
      color: ${COLORS.textPrimary};
      font-size: 15px;
    }

    /* Tables for Orders */
    .order-table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
      background: #fafafa;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid ${COLORS.border};
    }
    .order-table th, .order-table td {
      padding: 16px;
      border-bottom: 1px solid ${COLORS.border};
      text-align: left;
      color: ${COLORS.textPrimary};
      font-size: 14px;
    }
    .order-table th {
      font-size: 12px;
      text-transform: uppercase;
      color: ${COLORS.textSecondary};
      font-weight: 700;
      letter-spacing: 0.5px;
      background-color: #f4f4f5;
    }
    .text-right {
      text-align: right !important;
    }
    
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .summary-row td {
      border-bottom: none;
      padding: 10px 16px;
      background: #ffffff;
      color: ${COLORS.textPrimary};
      font-size: 14px;
    }
    .summary-row.total td {
      border-top: 2px solid ${COLORS.accent};
      padding-top: 16px;
      padding-bottom: 16px;
      font-weight: 800;
      font-size: 18px;
      color: ${COLORS.accent};
    }
  </style>
</head>
<body style="background-color: ${COLORS.bg}; margin: 0; padding: 0;">
  ${data.previewText ? `<div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;">${escapeHtml(data.previewText)}</div>` : ''}
  
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${COLORS.bg};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: ${COLORS.cardBg}; border: 1px solid ${COLORS.border}; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 40px 40px 30px 40px;">
              <h1 style="margin: 0; font-family: -apple-system, sans-serif; font-size: 28px; font-weight: 900; letter-spacing: 4px; text-transform: uppercase; color: ${COLORS.accent};">
                SHADOW SHOP
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td class="content" style="padding: 0 40px 40px 40px; font-family: -apple-system, sans-serif; color: ${COLORS.textPrimary}; line-height: 1.6;">
              ${data.bodyHtml}
              
              ${data.callToAction ? `
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${escapeHtml(data.callToAction.url)}" style="display: inline-block; background-color: ${COLORS.accent}; color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 8px; font-weight: 700; font-size: 15px; letter-spacing: 1px; text-transform: uppercase; font-family: -apple-system, sans-serif;">
                    ${escapeHtml(data.callToAction.text)}
                  </a>
                </div>
              ` : ''}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 30px 40px; font-family: -apple-system, sans-serif; font-size: 13px; color: ${COLORS.textSecondary}; background-color: ${COLORS.bg}; border-top: 1px solid ${COLORS.border}; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;">
              <p style="margin: 0 0 8px 0; color: ${COLORS.textSecondary};">&copy; ${new Date().getFullYear()} SHADOW SHOP. All rights reserved.</p>
              <p style="margin: 0; color: ${COLORS.textSecondary};">This is an automated message, please do not reply directly to this email.</p>
            </td>
          </tr>
        </table>
        
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

