import { db } from "@/db";
import { appointments, jobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { fireWebhooks, recordActivity } from "@/lib/ops";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b?.clientId || !b?.startsAt || !b?.endsAt || !b?.title?.trim()) {
    return Response.json({ error: "Title, client, start and end are required." }, { status: 400 });
  }
  const [row] = await db
    .insert(appointments)
    .values({
      clientId: Number(b.clientId),
      jobId: b.jobId ? Number(b.jobId) : null,
      title: b.title.trim(),
      type: b.type || "job",
      startsAt: new Date(b.startsAt),
      endsAt: new Date(b.endsAt),
      assigneeId: b.assigneeId ? Number(b.assigneeId) : null,
      notes: b.notes?.trim() || null,
    })
    .returning();

  if (row.jobId && row.type === "job") {
    // keep the job's scheduled window in sync
    await db
      .update(jobs)
      .set({ scheduledStart: row.startsAt, scheduledEnd: row.endsAt })
      .where(eq(jobs.id, row.jobId));
  }
  await recordActivity({
    clientId: row.clientId,
    jobId: row.jobId,
    userId: me.id,
    kind: "event",
    message: `Scheduled — ${row.title}`,
  });
  await fireWebhooks("appointment.created", {
    id: row.id,
    clientId: row.clientId,
    jobId: row.jobId,
    startsAt: row.startsAt,
    assigneeId: row.assigneeId,
  });
  return Response.json({ id: row.id });
}
