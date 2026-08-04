import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

type Client = Prisma.TransactionClient | typeof prisma;

/**
 * Registry decisions get questioned months later ("why was she withdrawn?", "who released that
 * mark?"), so anything consequential leaves a trail. Deliberately fire-and-forget-safe: an audit
 * write must never be the reason a legitimate mutation fails.
 */
export async function recordAudit(
  client: Client,
  entry: {
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  try {
    await client.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log", entry.action, error);
  }
}

export async function auditTrailFor(entityType: string, entityId: string, take = 20) {
  return prisma.auditLog.findMany({
    where: { entityType, entityId },
    include: { actor: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });
}
