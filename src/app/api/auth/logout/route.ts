import { cookies } from "next/headers";
import { destroySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const jar = await cookies();
  const token = jar.get("bb_session")?.value;
  if (token) await destroySession(token);
  jar.delete("bb_session");
  return Response.json({ ok: true });
}
