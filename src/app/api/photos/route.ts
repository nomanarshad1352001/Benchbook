import { db } from "@/db";
import { photos } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { WORK_PHOTOS } from "@/lib/constants";
import { recordActivity } from "@/lib/ops";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const CAPTIONS = [
  "Before — site condition on arrival",
  "Mid-job — work in progress",
  "After — wrapped and cleaned up",
  "Detail — finish work",
  "Materials staged on site",
];

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b?.clientId) return Response.json({ error: "Client is required." }, { status: 400 });

  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(photos);
  const idx = Number(n) % WORK_PHOTOS.length;
  const [row] = await db
    .insert(photos)
    .values({
      clientId: Number(b.clientId),
      jobId: b.jobId ? Number(b.jobId) : null,
      url: b.url ?? WORK_PHOTOS[idx],
      caption: b.caption ?? CAPTIONS[idx % CAPTIONS.length],
    })
    .returning();
  await recordActivity({
    clientId: row.clientId,
    jobId: row.jobId,
    userId: me.id,
    kind: "photo",
    message: "Photo added to record",
  });
  return Response.json({ id: row.id, url: row.url });
}
