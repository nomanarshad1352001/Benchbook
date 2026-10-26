import crypto from "crypto";
import { db } from "@/db";
import { clients, forms, formTemplates, jobs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { apiError, authenticate, unauthorized } from "@/lib/api-v1";
import { fireWebhooks, recordActivity, resolveTemplate } from "@/lib/ops";
import type { Address, AuditEvent } from "@/db/schema";
import { formatAddress } from "@/lib/utils";

export const dynamic = "force-dynamic";

function serialize(f: typeof forms.$inferSelect) {
  return {
    id: f.id,
    templateKey: f.templateKey,
    jobId: f.jobId,
    clientId: f.clientId,
    status: f.status,
    channel: f.channel,
    recipient: f.recipient,
    signingUrl: `/sign/${f.token}`,
    signerName: f.signerName,
    signerIp: f.signerIp,
    audit: f.events,
    pdfUrl: f.status === "signed" ? `/api/forms/${f.id}/pdf` : null,
    sentAt: f.sentAt.toISOString(),
    signedAt: f.signedAt?.toISOString() ?? null,
  };
}

export async function GET(req: Request) {
  const key = await authenticate(req);
  if (!key) return unauthorized();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const rows = await db.select().from(forms).orderBy(desc(forms.createdAt)).limit(200);
  const filtered = status ? rows.filter((r) => r.status === status) : rows;
  return Response.json({ data: filtered.map(serialize) });
}

export async function POST(req: Request) {
  const key = await authenticate(req);
  if (!key) return unauthorized();
  const b = await req.json().catch(() => null);
  if (!b?.jobId || !b?.templateKey) return apiError(400, "`jobId` and `templateKey` are required.");

  const [job] = await db.select().from(jobs).where(eq(jobs.id, Number(b.jobId)));
  if (!job) return apiError(404, "Job not found.");
  const [client] = await db.select().from(clients).where(eq(clients.id, job.clientId));
  const [template] = await db.select().from(formTemplates).where(eq(formTemplates.key, String(b.templateKey)));
  if (!client || !template) return apiError(404, "Template not found.");

  const primary: Address | undefined = client.addresses.find((a) => a.primary) ?? client.addresses[0];
  const content = resolveTemplate(template.body, {
    client,
    clientAddress: primary ? formatAddress(primary) : "",
    job,
  });
  const channel = b.channel === "sms" ? "sms" : "email";
  const recipient = b.recipient ?? (channel === "sms" ? client.phone : client.email) ?? "";
  const events: AuditEvent[] = [
    { at: new Date().toISOString(), event: "sent", ip: null, meta: `${channel} to ${recipient} (via API)` },
  ];
  const [row] = await db
    .insert(forms)
    .values({
      token: `fx-sign-${crypto.randomBytes(6).toString("hex")}`,
      templateKey: template.key,
      jobId: job.id,
      clientId: client.id,
      status: "sent",
      channel,
      recipient,
      content,
      events,
    })
    .returning();
  await recordActivity({ clientId: client.id, jobId: job.id, kind: "form", message: `${template.name} sent via API` });
  await fireWebhooks("form.sent", { formId: row.id, jobId: job.id, clientId: client.id });
  return Response.json({ data: serialize(row) }, { status: 201 });
}
