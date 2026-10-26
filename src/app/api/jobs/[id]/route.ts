import { db } from "@/db";
import { jobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { moveJobStage, recordActivity } from "@/lib/ops";
import type { LineItem } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isFinite(jobId)) return Response.json({ error: "Bad id" }, { status: 400 });

  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ error: "Invalid body" }, { status: 400 });

  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  if (typeof b.stage === "string") {
    const updated = await moveJobStage({
      jobId,
      stage: b.stage,
      userId: me.id,
      lostReason: typeof b.lostReason === "string" ? b.lostReason : undefined,
    });
    return Response.json({ ok: true, stage: updated?.stage });
  }

  if (Array.isArray(b.lineItems)) {
    const items: LineItem[] = b.lineItems
      .filter((i: Partial<LineItem>) => i?.description?.trim())
      .map((i: Partial<LineItem>, n: number) => ({
        id: n + 1,
        description: String(i.description).trim(),
        kind: i.kind === "material" ? "material" : "labour",
        qty: Number(i.qty) || 0,
        unit: i.unit || "hrs",
        rate: Number(i.rate) || 0,
      }));
    await db.update(jobs).set({ lineItems: items, updatedAt: new Date() }).where(eq(jobs.id, jobId));
    await recordActivity({
      clientId: job.clientId,
      jobId,
      userId: me.id,
      kind: "quote",
      message: "Estimate line items updated",
    });
    return Response.json({ ok: true });
  }

  if (typeof b.assigneeId === "number" || b.assigneeId === null) {
    await db.update(jobs).set({ assigneeId: b.assigneeId, updatedAt: new Date() }).where(eq(jobs.id, jobId));
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Nothing to update" }, { status: 400 });
}
