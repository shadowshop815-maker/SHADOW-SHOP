import { env } from "./src/config/env.js";
import { sendEmail } from "./src/services/email/emailService.js";

async function runTests() {
  console.log("Running Brevo Tests...");

  // Mock fetch
  const originalFetch = global.fetch;
  let fetchMock: any = () => Promise.resolve(new Response(JSON.stringify({ messageId: "123" }), { status: 201 }));

  global.fetch = async (url, options) => {
    return fetchMock(url, options);
  };

  try {
    env.EMAIL_PROVIDER = "brevo";
    
    // Test 1: Missing API key
    env.BREVO_API_KEY = "";
    env.EMAIL_FROM = "test@example.com";
    let res = await sendEmail({ to: "test@example.com", subject: "Test", html: "<h1>Test</h1>" });
    if (res.success === false && res.error === "BREVO_API_KEY not configured") {
      console.log("PASS: Missing API key");
    } else {
      console.error("FAIL: Missing API key", res);
    }

    // Test 2: Invalid API key (mocked 401)
    env.BREVO_API_KEY = "invalid";
    fetchMock = () => Promise.resolve(new Response(JSON.stringify({ message: "Key not found", code: "unauthorized" }), { status: 401 }));
    res = await sendEmail({ to: "test@example.com", subject: "Test", html: "<h1>Test</h1>" });
    if (res.success === false && res.error?.includes("status=401")) {
      console.log("PASS: Invalid API key (401)");
    } else {
      console.error("FAIL: Invalid API key (401)", res);
    }

    // Test 3: Valid mocked Brevo response
    env.BREVO_API_KEY = "valid";
    fetchMock = () => Promise.resolve(new Response(JSON.stringify({ messageId: "msg123" }), { status: 201 }));
    res = await sendEmail({ to: "test@example.com", subject: "Test", html: "<h1>Test</h1>" });
    if (res.success === true && res.messageId === "msg123") {
      console.log("PASS: Valid mocked Brevo response");
    } else {
      console.error("FAIL: Valid mocked Brevo response", res);
    }

  } finally {
    global.fetch = originalFetch;
  }
}

runTests().catch(console.error);
