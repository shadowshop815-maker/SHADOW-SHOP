import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const EMAIL_FROM = process.env.EMAIL_FROM;
const BREVO_API_KEY = process.env.BREVO_API_KEY?.trim();

if (!EMAIL_FROM || !BREVO_API_KEY) {
  console.error('❌ Missing EMAIL_FROM or BREVO_API_KEY in .env');
  process.exit(1);
}

const testDest = process.argv[2] || process.env.ADMIN_EMAIL || EMAIL_FROM;

const body = {
  sender: { name: process.env.EMAIL_FROM_NAME || "SHADOW SHOP Test", email: EMAIL_FROM },
  to: [{ email: testDest }],
  subject: "SHADOW SHOP Email System Test - Brevo API",
  htmlContent: `<h2>Success!</h2><p>The SHADOW SHOP email system is now successfully using the Brevo HTTPS Transactional API.</p>`,
};

async function run() {
  console.log(`🚀 Sending test email to ${testDest} via Brevo API...`);
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
        "accept": "application/json"
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      console.log(`✅ Success! Message ID: ${data.messageId || data.messageIds?.[0]}`);
    } else {
      console.error(`❌ Failed! Status: ${res.status}`);
      console.error(data);
    }
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
  }
}

run();
