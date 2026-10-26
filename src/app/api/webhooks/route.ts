import { db } from "@/db";
import { webhookEndpoints } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, randomToken } from "@/lib/auth";
import { recordActivity } from "@/lib/ops";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me || me.role !== "admin") return Response.json({ error: "Only admins can manage webhooks." }, { status: 403 });
  const b = await req.json().catch(() => null);
  if (!b?.url || !/^https:\/\//.test(b.url) || !Array.isArray(b.events) || b.events.length === 0) {
    return Response.json({ error: "HTTPS URL and at least one event are required." }, { status: 400 });
  }
  const [row] = await db
    .insert(webhookEndpoints)
    .values({ url: b.url.trim(), events: b.events.map(String), secret: `whsec_${randomToken(6)}` })
    .returning();
  await recordActivity({ userId: me.id, kind: "security", message: `Webhook endpoint added — ${new URL(row.url).host}` });
  return Response.json({ id: row.id, secret: row.secret });
}

export async function PATCH(req: Request) {
  const me = await getSessionUser();
  if (!me || me.role !== "admin") return Response.json({ error: "Only admins can manage webhooks." }, { status: 403 });
  const b = await req.json().catch(() => null);
  if (!b?.id || typeof b.active !== "boolean") {
    return Response.json({ error: "id and active are required." }, { status: 400 });
  }
  await db.update(webhookEndpoints).set({ active: b.active }).where(eq(webhookEndpoints.id, Number(b.id)));
  return Response.json({ ok: true });
}
