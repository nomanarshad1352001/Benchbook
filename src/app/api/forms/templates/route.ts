import { db } from "@/db";
import { formTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { recordActivity } from "@/lib/ops";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const me = await getSessionUser();
  if (!me || (me.role !== "admin" && me.role !== "office")) {
    return Response.json({ error: "Only office staff can edit templates." }, { status: 403 });
  }
  const b = await req.json().catch(() => null);
  if (!b?.key || !b?.body?.trim()) {
    return Response.json({ error: "Template key and body are required." }, { status: 400 });
  }
  await db
    .update(formTemplates)
    .set({ body: b.body, updatedAt: new Date() })
    .where(eq(formTemplates.key, String(b.key)));
  await recordActivity({ userId: me.id, kind: "form", message: `Form template updated — ${b.key}` });
  return Response.json({ ok: true });
}
