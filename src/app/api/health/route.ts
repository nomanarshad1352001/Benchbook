export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ ok: true, mode: "zero-database", storage: "client-localStorage + serverless sandbox API" });
}
