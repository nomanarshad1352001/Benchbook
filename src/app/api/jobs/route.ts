import { db } from "@/db";
import { jobs } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { fireWebhooks, recordActivity } from "@/lib/ops";
import type { LineItem } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b?.clientId || !b?.title?.trim()) {
    return Response.json({ error: "Job title and client are required." }, { status: 400 });
  }
  const items: LineItem[] = Array.isArray(b.lineItems)
    ? b.lineItems
        .filter((i: Partial<LineItem>) => i?.description?.trim())
        .map((i: Partial<LineItem>, n: number) => ({
          id: n + 1,
          description: String(i.description).trim(),
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
      title: b.title.trim(),
      serviceType: b.serviceType || "General Repairs",
      stage: "lead",
      address: b.address?.trim() || null,
      description: b.description?.trim() || null,
      assigneeId: b.assigneeId ? Number(b.assigneeId) : null,
      lineItems: items,
      createdById: me.id,
    })
    .returning();

  await recordActivity({
    clientId: row.clientId,
    jobId: row.id,
    userId: me.id,
    kind: "job",
    message: `Job created — ${row.title}`,
  });
  await fireWebhooks("job.created", { id: row.id, clientId: row.clientId, title: row.title, stage: row.stage });
  return Response.json({ id: row.id });
}
