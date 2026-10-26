import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import type { clients, jobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sha256 } from "@/lib/auth";
import { computeTotals } from "@/lib/ops";

export async function authenticate(req: Request) {
  const header = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!header) return null;
  const [key] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, sha256(header)));
  if (!key || key.revokedAt) return null;
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));
  return key;
}

export function unauthorized() {
  return Response.json(
    { error: { message: "Invalid or missing API key. Send it as `x-api-key` or a Bearer token.", status: 401 } },
    { status: 401 }
  );
}

export function apiError(status: number, message: string) {
  return Response.json({ error: { message, status } }, { status });
}

type ClientRow = typeof clients.$inferSelect;
export function serializeClient(c: ClientRow) {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    leadSource: c.leadSource,
    tags: c.tags,
    addresses: c.addresses,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

type JobRow = typeof jobs.$inferSelect;
export function serializeJob(j: JobRow) {
  const totals = computeTotals(j.lineItems);
  return {
    id: j.id,
    clientId: j.clientId,
    title: j.title,
    serviceType: j.serviceType,
    stage: j.stage,
    address: j.address,
    description: j.description,
    lineItems: j.lineItems,
    totals: {
      subtotal: totals.subtotal,
      hst: totals.hst,
      total: totals.total,
      currency: "CAD",
      taxRate: 0.13,
    },
    scheduledStart: j.scheduledStart?.toISOString() ?? null,
    scheduledEnd: j.scheduledEnd?.toISOString() ?? null,
    lostReason: j.lostReason,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}
