import { db } from "@/db";
import { clients, jobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { apiError, authenticate, serializeClient, serializeJob, unauthorized } from "@/lib/api-v1";
import { recordActivity } from "@/lib/ops";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const key = await authenticate(req);
  if (!key) return unauthorized();
  const { id } = await ctx.params;
  const [client] = await db.select().from(clients).where(eq(clients.id, Number(id)));
  if (!client) return apiError(404, "Client not found.");
  const clientJobs = await db.select().from(jobs).where(eq(jobs.clientId, client.id));
  return Response.json({ data: { ...serializeClient(client), jobs: clientJobs.map(serializeJob) } });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const key = await authenticate(req);
  if (!key) return unauthorized();
  const { id } = await ctx.params;
  const [client] = await db.select().from(clients).where(eq(clients.id, Number(id)));
  if (!client) return apiError(404, "Client not found.");
  const b = await req.json().catch(() => ({}));
  const patch: Partial<typeof clients.$inferInsert> = { updatedAt: new Date() };
  if (typeof b.name === "string") patch.name = b.name;
  if (typeof b.email === "string" || b.email === null) patch.email = b.email;
  if (typeof b.phone === "string" || b.phone === null) patch.phone = b.phone;
  if (typeof b.leadSource === "string") patch.leadSource = b.leadSource;
  if (Array.isArray(b.tags)) patch.tags = b.tags.map(String).slice(0, 8);
  if (typeof b.notes === "string" || b.notes === null) patch.notes = b.notes;
  await db.update(clients).set(patch).where(eq(clients.id, client.id));
  const [updated] = await db.select().from(clients).where(eq(clients.id, client.id));
  await recordActivity({ clientId: client.id, kind: "client", message: "Client updated via API" });
  return Response.json({ data: serializeClient(updated) });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const key = await authenticate(req);
  if (!key) return unauthorized();
  const { id } = await ctx.params;
  const [client] = await db.select().from(clients).where(eq(clients.id, Number(id)));
  if (!client) return apiError(404, "Client not found.");
  const clientJobs = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.clientId, client.id));
  if (clientJobs.length > 0) {
    return apiError(409, "Client has jobs on record and cannot be deleted — archive by tagging instead.");
  }
  await db.delete(clients).where(eq(clients.id, client.id));
  return new Response(null, { status: 204 });
}
