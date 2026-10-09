import { env } from "./src/config/env.js";

async function runDiagnostic() {
  console.log("==================================================");
  console.log(" Brevo API Key Diagnostic");
  console.log("==================================================");

  // 1. Trace the source of the variable
  console.log("\n[1] Environment Source Analysis:");
  console.log(`- process.env.BREVO_API_KEY is ${process.env.BREVO_API_KEY === undefined ? "UNDEFINED" : "DEFINED"}`);
  if (process.env.BREVO_API_KEY !== undefined) {
    console.log(`- Raw length: ${process.env.BREVO_API_KEY.length}`);
    const startsWithQuote = /^["']/.test(process.env.BREVO_API_KEY);
    const endsWithQuote = /["']$/.test(process.env.BREVO_API_KEY);
    console.log(`- Has leading quotes: ${startsWithQuote ? "YES" : "NO"}`);
    console.log(`- Has trailing quotes: ${endsWithQuote ? "YES" : "NO"}`);
    console.log(`- Has leading/trailing whitespace: ${process.env.BREVO_API_KEY !== process.env.BREVO_API_KEY.trim() ? "YES" : "NO"}`);
  }

  // 2. Trace the parsed value
  console.log("\n[2] Parsed Configuration Value:");
  const key = env.BREVO_API_KEY;
  console.log(`- env.BREVO_API_KEY length: ${key.length}`);
  
  if (key) {
    const prefix = key.substring(0, 8);
    console.log(`- Prefix: ${prefix}...`);
    if (prefix !== "xkeysib-") {
      console.warn("  ⚠️ WARNING: Brevo v3 API keys typically start with 'xkeysib-'");
    } else {
      console.log("  ✅ Prefix format looks correct for Brevo v3");
    }
    
    // Check if it's accidentally a Resend key
    if (key.startsWith("re_")) {
      console.warn("  ⚠️ DANGER: This looks like a Resend API key ('re_'), not a Brevo key.");
    }
  }

  // 3. Test Authentication
  if (!key) {
    console.log("\n[3] Test Authentication: SKIPPED (No API key found)");
    return;
  }

  console.log("\n[3] Testing Authentication against api.brevo.com/v3/account...");
  try {
    const res = await fetch("https://api.brevo.com/v3/account", {
      method: "GET",
      headers: {
        "api-key": key,
        "accept": "application/json"
      }
    });

    console.log(`- HTTP Status: ${res.status} ${res.statusText}`);
    
    const data = await res.json().catch(() => null);
    if (res.ok) {
      console.log("  ✅ Authentication SUCCESS!");
      if (data && data.email) {
        console.log(`  Account Email: ${data.email}`);
        console.log(`  Company Name: ${data.companyName || "N/A"}`);
      }
    } else {
      console.error("  ❌ Authentication FAILED!");
      console.error(`  Provider response: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    console.error(`  ❌ Network request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log("==================================================");
}

runDiagnostic().catch(console.error);
