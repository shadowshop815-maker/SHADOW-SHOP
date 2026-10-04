import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/db.js";

/** Retry Prisma $connect with exponential back-off.
 *  Supabase pooler can be slow to accept the first connection (cold start / idle eviction).
 *  Without retries the server crashes on the first P1001 even though the DB is reachable.
 */
async function connectWithRetry(maxAttempts = 5, baseDelayMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await prisma.$connect();
      return; // success
    } catch (err: any) {
      const isRetryable = err?.errorCode === "P1001" || err?.code === "P1001";
      if (!isRetryable || attempt === maxAttempts) throw err;
      const delay = Math.min(10000, baseDelayMs * attempt); // Cap at 10s
      console.warn(`[DB] Connection attempt ${attempt}/${maxAttempts} failed (P1001). Retrying in ${delay / 1000}s…`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

async function start() {
  try {
    // Start server immediately so frontend doesn't get 'Failed to fetch' (Connection Refused)
    const server = app.listen(env.PORT, () => console.log(`✓ Backend running at ${env.BACKEND_URL}`));
    
    // Slowloris DDoS Protection
    server.keepAliveTimeout = 61000;
    server.headersTimeout = 65000;
    server.requestTimeout = 30000; // Force close requests taking longer than 30s
    
    // Connect to DB asynchronously in the background
    connectWithRetry(15).then(() => {
      console.log("✓ Database connected");
      // Start Background Workers
      import("./services/email/dispatcher.js").then((mod) => {
        mod.startEmailDispatcher();
      });
    }).catch(error => {
      console.error("Database connection failed completely.", error);
    });

    const shutdown = async () => { server.close(); await prisma.$disconnect(); process.exit(0); };
    process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
  } catch (error) { console.error("Backend startup failed.", error); process.exit(1); }
}
start();

