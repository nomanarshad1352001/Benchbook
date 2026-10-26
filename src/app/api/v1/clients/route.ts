import { db } from "@/db";
import { clients } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { apiError, authenticate, serializeClient, unauthorized } from "@/lib/api-v1";
import { fireWebhooks, recordActivity } from "@/lib/ops";
import type { Address } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const key = await authenticate(req);
  if (!key) return unauthorized();
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
  const offset = Number(url.searchParams.get("offset")) || 0;
  const rows = await db.select().from(clients).orderBy(desc(clients.createdAt)).limit(limit).offset(offset);
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(clients);
  return Response.json({ data: rows.map(serializeClient), meta: { total: Number(n), limit, offset } });
}

export async function POST(req: Request) {
  const key = await authenticate(req);
  if (!key) return unauthorized();
  const b = await req.json().catch(() => null);
  if (!b?.name) return apiError(400, "`name` is required.");

  const addresses: Address[] = Array.isArray(b.addresses)
    ? b.addresses.map((a: Partial<Address>) => ({
        label: a.label ?? "Home",
        line1: a.line1 ?? "",
        city: a.city ?? "Toronto",
        province: a.province ?? "ON",
        postal: a.postal ?? "",
        primary: a.primary ?? true,
      }))
    : [];

  const [row] = await db
    .insert(clients)
    .values({
      name: String(b.name),
      email: b.email ?? null,
      phone: b.phone ?? null,
      leadSource: b.leadSource ?? "API",
      tags: Array.isArray(b.tags) ? b.tags.map(String).slice(0, 8) : [],
      addresses,
      notes: b.notes ?? null,
    })
    .returning();
  await recordActivity({ clientId: row.id, kind: "client", message: `Client added via API — ${row.name}` });
  await fireWebhooks("client.created", serializeClient(row));
  return Response.json({ data: serializeClient(row) }, { status: 201 });
}
