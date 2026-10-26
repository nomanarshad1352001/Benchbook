import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, sha256, randomToken } from "@/lib/auth";
import { recordActivity } from "@/lib/ops";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me || me.role !== "admin") {
    return Response.json({ error: "Only admins can create API keys." }, { status: 403 });
  }
  const b = await req.json().catch(() => null);
  if (!b?.name?.trim()) return Response.json({ error: "Key name is required." }, { status: 400 });

  const plainKey = `fwk_live_${randomToken(12)}`;
  const [row] = await db
    .insert(apiKeys)
    .values({
      name: b.name.trim(),
      prefix: plainKey.slice(0, 16),
      keyHash: sha256(plainKey),
      createdById: me.id,
    })
    .returning();
  await recordActivity({ userId: me.id, kind: "security", message: `API key created — ${row.name}` });
  return Response.json({ id: row.id, plainKey, prefix: row.prefix });
}

export async function PATCH(req: Request) {
  const me = await getSessionUser();
  if (!me || me.role !== "admin") {
    return Response.json({ error: "Only admins can manage API keys." }, { status: 403 });
  }
  const b = await req.json().catch(() => null);
  if (!b?.id) return Response.json({ error: "Key id required." }, { status: 400 });
  await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, Number(b.id)));
  await recordActivity({ userId: me.id, kind: "security", message: "API key revoked" });
  return Response.json({ ok: true });
}
