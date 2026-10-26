import { db } from "@/db";
import { notes } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { recordActivity } from "@/lib/ops";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b?.body?.trim() || !b?.clientId) {
    return Response.json({ error: "Note body and client are required." }, { status: 400 });
  }
  const [row] = await db
    .insert(notes)
    .values({
      clientId: Number(b.clientId),
      jobId: b.jobId ? Number(b.jobId) : null,
      userId: me.id,
      body: b.body.trim(),
    })
    .returning();
  await recordActivity({
    clientId: row.clientId,
    jobId: row.jobId,
    userId: me.id,
    kind: "note",
    message: `${me.name.split(" ")[0]} added a note`,
  });
  return Response.json({ id: row.id });
}
