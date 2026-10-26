import { db } from "@/db";
import { clients } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { fireWebhooks, recordActivity } from "@/lib/ops";
import type { Address } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b?.name?.trim()) return Response.json({ error: "Client name is required." }, { status: 400 });

  const addresses: Address[] = [];
  if (b.line1?.trim()) {
    addresses.push({
      label: "Home",
      line1: b.line1.trim(),
      city: b.city?.trim() || "Toronto",
      province: "ON",
      postal: b.postal?.trim() || "",
      primary: true,
    });
  }
  const tags: string[] = String(b.tags ?? "")
    .split(",")
    .map((t: string) => t.trim())
    .filter(Boolean)
    .slice(0, 8);

  const [row] = await db
    .insert(clients)
    .values({
      name: b.name.trim(),
      email: b.email?.trim() || null,
      phone: b.phone?.trim() || null,
      leadSource: b.leadSource || "Referral",
      tags,
      addresses,
      notes: b.notes?.trim() || null,
    })
    .returning();

  await recordActivity({ clientId: row.id, userId: me.id, kind: "client", message: `Client added — ${row.name}` });
  await fireWebhooks("client.created", {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    leadSource: row.leadSource,
  });
  return Response.json({ id: row.id });
}
