import { db } from "@/db";
import { jobs } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { apiError, authenticate, serializeJob, unauthorized } from "@/lib/api-v1";
import { fireWebhooks, recordActivity } from "@/lib/ops";
import type { LineItem } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const key = await authenticate(req);
  if (!key) return unauthorized();
  const url = new URL(req.url);
  const stage = url.searchParams.get("stage");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
  const rows = stage
    ? await db.select().from(jobs).where(eq(jobs.stage, stage)).orderBy(desc(jobs.updatedAt)).limit(limit)
    : await db.select().from(jobs).orderBy(desc(jobs.updatedAt)).limit(limit);
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(jobs);
  return Response.json({ data: rows.map(serializeJob), meta: { total: Number(n), limit } });
}

export async function POST(req: Request) {
  const key = await authenticate(req);
  if (!key) return unauthorized();
  const b = await req.json().catch(() => null);
  if (!b?.clientId || !b?.title) return apiError(400, "`clientId` and `title` are required.");
  const items: LineItem[] = Array.isArray(b.lineItems)
    ? b.lineItems
        .filter((i: Partial<LineItem>) => i?.description)
        .map((i: Partial<LineItem>, n: number) => ({
          id: n + 1,
          description: String(i.description),
          kind: i.kind === "material" ? "material" : "labour",
          qty: Number(i.qty) || 0,
          unit: i.unit || "hrs",
          rate: Number(i.rate) || 0,
        }))
    : [];
  const [row] = await db
    .insert(jobs)
    .values({
      clientId: Number(b.clientId),
      title: String(b.title),
      serviceType: b.serviceType ?? "General Repairs",
      stage: "lead",
      address: b.address ?? null,
      description: b.description ?? null,
      lineItems: items,
    })
    .returning();
  await recordActivity({ clientId: row.clientId, jobId: row.id, kind: "job", message: `Job created via API — ${row.title}` });
  await fireWebhooks("job.created", serializeJob(row));
  return Response.json({ data: serializeJob(row) }, { status: 201 });
}
