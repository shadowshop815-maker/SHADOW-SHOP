import type { Prisma } from "@prisma/client";
import { prisma } from "../config/db.js";

export async function audit(adminId: string, action: string, entityType: string, entityId?: string, metadata: Record<string, unknown> = {}) {
  await prisma.adminAuditLog.create({ data: { adminId, action, entityType, entityId, metadata: JSON.stringify(metadata) } });
}
