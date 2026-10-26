import { db } from "@/db";
import { clients } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { fireWebhooks } from "@/lib/ops";
import type { Address } from "@/db/schema";

export const dynamic = "force-dynamic";

function parseRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === "," && !inQ) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b?.csv || typeof b.csv !== "string") {
    return Response.json({ error: "CSV payload required." }, { status: 400 });
  }

  const lines = (b.csv as string).split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
  if (lines.length < 2) return Response.json({ error: "CSV needs a header row and at least one client." }, { status: 400 });

  const existing = await db.select({ email: clients.email, name: clients.name }).from(clients);
  const seen = new Set(existing.map((e) => `${(e.name ?? "").toLowerCase()}|${(e.email ?? "").toLowerCase()}`));

  let added = 0;
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const [name, email, phone, leadSource, tags, line1, city, postal] = parseRow(line);
    if (!name) {
      skipped++;
      continue;
    }
    const key = `${name.toLowerCase()}|${(email ?? "").toLowerCase()}`;
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    const addresses: Address[] = line1
      ? [{ label: "Home", line1, city: city || "Toronto", province: "ON", postal: postal || "", primary: true }]
      : [];
    await db.insert(clients).values({
      name,
      email: email || null,
      phone: phone || null,
      leadSource: leadSource || "Import",
      tags: (tags || "").split(/[|;]/).map((t) => t.trim()).filter(Boolean).slice(0, 8),
      addresses,
      notes: "Imported from spreadsheet.",
    });
    added++;
  }
  await fireWebhooks("client.created", { imported: added, skipped });
  return Response.json({ added, skipped });
}
