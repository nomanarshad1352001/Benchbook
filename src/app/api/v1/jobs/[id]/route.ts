import { db } from "@/db";
import { jobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { apiError, authenticate, serializeJob, unauthorized } from "@/lib/api-v1";
import { moveJobStage, recordActivity } from "@/lib/ops";
import type { LineItem } from "@/db/schema";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const key = await authenticate(req);
  if (!key) return unauthorized();
  const { id } = await ctx.params;
  const [job] = await db.select().from(jobs).where(eq(jobs.id, Number(id)));
  if (!job) return apiError(404, "Job not found.");
  return Response.json({ data: serializeJob(job) });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const key = await authenticate(req);
  if (!key) return unauthorized();
  const { id } = await ctx.params;
  const jobId = Number(id);
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) return apiError(404, "Job not found.");

  const b = await req.json().catch(() => ({}));

  if (typeof b.stage === "string") {
    await moveJobStage({ jobId, stage: b.stage, userId: null, lostReason: b.lostReason });
  }
  if (Array.isArray(b.lineItems)) {
    const items: LineItem[] = b.lineItems
      .filter((i: Partial<LineItem>) => i?.description)
      .map((i: Partial<LineItem>, n: number) => ({
        id: n + 1,
        description: String(i.description),
        kind: i.kind === "material" ? "material" : "labour",
        qty: Number(i.qty) || 0,
        unit: i.unit || "hrs",
        rate: Number(i.rate) || 0,
      }));
    await db.update(jobs).set({ lineItems: items, updatedAt: new Date() }).where(eq(jobs.id, jobId));
    await recordActivity({ clientId: job.clientId, jobId, kind: "quote", message: "Estimate updated via API" });
  }
  if (typeof b.title === "string" || typeof b.description === "string") {
    await db
      .update(jobs)
      .set({
        ...(typeof b.title === "string" ? { title: b.title } : {}),
        ...(typeof b.description === "string" ? { description: b.description } : {}),
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));
  }
  const [updated] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  return Response.json({ data: serializeJob(updated) });
}
