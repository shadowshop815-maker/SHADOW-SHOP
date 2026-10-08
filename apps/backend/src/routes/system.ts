import express from "express";
import { env } from "../config/env.js";
import { triggerDispatch } from "../services/email/dispatcher.js";

export const systemRouter = express.Router();

systemRouter.post("/dispatch-emails", async (req, res) => {
  const secret = req.headers["x-system-secret"];
  
  if (!env.SYSTEM_SECRET || env.SYSTEM_SECRET.length < 16) {
    return res.status(503).json({ success: false, message: "System secret not securely configured" });
  }

  if (secret !== env.SYSTEM_SECRET) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  const didRun = await triggerDispatch();
  return res.json({ success: true, processed: didRun });
});
