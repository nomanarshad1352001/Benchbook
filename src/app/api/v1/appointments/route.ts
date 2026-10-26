import { db } from "@/db";
import { appointments, clients, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { apiError, authenticate, unauthorized } from "@/lib/api-v1";
import { fireWebhooks, recordActivity } from "@/lib/ops";

export const dynamic = "force-dynamic";

function serialize(a: typeof appointments.$inferSelect, clientName?: string, assigneeName?: string | null) {
  return {
    id: a.id,
    clientId: a.clientId,
    clientName: clientName ?? null,
    jobId: a.jobId,
    title: a.title,
    type: a.type,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    assigneeId: a.assigneeId,
    assigneeName: assigneeName ?? null,
    notes: a.notes,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
  };
}

export async function GET(req: Request) {
  const key = await authenticate(req);
  if (!key) return unauthorized();
  const url = new URL(req.url);
  const assigneeId = url.searchParams.get("assigneeId");
  const rows = await db
    .select({ a: appointments, clientName: clients.name, assigneeName: users.name })
    .from(appointments)
    .innerJoin(clients, eq(appointments.clientId, clients.id))
    .leftJoin(users, eq(appointments.assigneeId, users.id))
    .orderBy(desc(appointments.startsAt))
    .limit(200);
  const filtered = assigneeId ? rows.filter((r) => r.a.assigneeId === Number(assigneeId)) : rows;
  return Response.json({ data: filtered.map((r) => serialize(r.a, r.clientName, r.assigneeName)) });
}

export async function POST(req: Request) {
  const key = await authenticate(req);
  if (!key) return unauthorized();
  const b = await req.json().catch(() => null);
  if (!b?.clientId || !b?.title || !b?.startsAt || !b?.endsAt) {
    return apiError(400, "`clientId`, `title`, `startsAt` and `endsAt` are required.");
  }
  const [row] = await db
    .insert(appointments)
    .values({
      clientId: Number(b.clientId),
      jobId: b.jobId ? Number(b.jobId) : null,
      title: String(b.title),
      type: b.type ?? "job",
      startsAt: new Date(b.startsAt),
      endsAt: new Date(b.endsAt),
      assigneeId: b.assigneeId ? Number(b.assigneeId) : null,
      notes: b.notes ?? null,
    })
    .returning();
  await recordActivity({ clientId: row.clientId, jobId: row.jobId, kind: "event", message: `Scheduled via API — ${row.title}` });
  await fireWebhooks("appointment.created", serialize(row));
  return Response.json({ data: serialize(row) }, { status: 201 });
}
