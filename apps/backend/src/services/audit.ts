import type { Prisma } from "@prisma/client";
import { prisma } from "../config/db.js";

export async function audit(adminId: string, action: string, entityType: string, entityId?: string | null, metadata: Record<string, unknown> = {}) {
  await prisma.adminAuditLog.create({ data: { adminId, action, entityType, entityId: entityId ?? null, metadata: JSON.stringify(metadata) } });
}
