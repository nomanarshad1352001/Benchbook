import crypto from "crypto";
import { db } from "@/db";
import { clients, forms, formTemplates, jobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { fireWebhooks, recordActivity, resolveTemplate } from "@/lib/ops";
import { FORM_PHASES } from "@/lib/constants";
import type { Address, AuditEvent } from "@/db/schema";
import { formatAddress } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => null);
  if (!b?.jobId || !b?.templateKey) {
    return Response.json({ error: "Job and template are required." }, { status: 400 });
  }
  const [job] = await db.select().from(jobs).where(eq(jobs.id, Number(b.jobId)));
  if (!job) return Response.json({ error: "Job not found." }, { status: 404 });
  const [client] = await db.select().from(clients).where(eq(clients.id, job.clientId));
  const [template] = await db.select().from(formTemplates).where(eq(formTemplates.key, String(b.templateKey)));
  if (!client || !template) return Response.json({ error: "Template not found." }, { status: 404 });

  const primary: Address | undefined = client.addresses.find((a) => a.primary) ?? client.addresses[0];
  const content = resolveTemplate(template.body, {
    client,
    clientAddress: primary ? formatAddress(primary) : "",
    job,
  });

  const channel = b.channel === "sms" ? "sms" : "email";
  const recipient =
    b.recipient?.trim() || (channel === "sms" ? client.phone : client.email) || "";
  const token = `fx-sign-${crypto.randomBytes(6).toString("hex")}`;

  const events: AuditEvent[] = [
    {
      at: new Date().toISOString(),
      event: "sent",
      ip: null,
      meta: `${channel === "sms" ? "Text message" : "Email"} to ${recipient}`,
    },
  ];

  const [row] = await db
    .insert(forms)
    .values({
      token,
      templateKey: template.key,
      jobId: job.id,
      clientId: client.id,
      status: "sent",
      channel,
      recipient,
      content,
      sentById: me.id,
      events,
    })
    .returning();

  const label = FORM_PHASES[template.key]?.label ?? template.name;
  await recordActivity({
    clientId: client.id,
    jobId: job.id,
    userId: me.id,
    kind: "form",
    message: `${label} sent to ${client.name} by ${channel === "sms" ? "text" : "email"}`,
  });
  await fireWebhooks("form.sent", { formId: row.id, jobId: job.id, clientId: client.id, templateKey: template.key });
  return Response.json({ id: row.id, token });
}
