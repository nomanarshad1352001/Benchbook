import { notFound } from "next/navigation";
import { db } from "@/db";
import { activities, appointments, clients, forms, formTemplates, jobs, photos, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import JobView from "@/components/job-view";
import { FORM_PHASES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isFinite(jobId)) notFound();

  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) notFound();
  const [client] = await db.select().from(clients).where(eq(clients.id, job.clientId));
  if (!client) notFound();

  const [formRows, apptRows, actRows, photoRows, team, templates] = await Promise.all([
    db.select().from(forms).where(eq(forms.jobId, jobId)),
    db
      .select({ a: appointments, assigneeName: users.name, assigneeColor: users.color })
      .from(appointments)
      .leftJoin(users, eq(appointments.assigneeId, users.id))
      .where(eq(appointments.jobId, jobId)),
    db
      .select({ a: activities, userName: users.name, userColor: users.color })
      .from(activities)
      .leftJoin(users, eq(activities.userId, users.id))
      .where(eq(activities.jobId, jobId)),
    db.select().from(photos).where(eq(photos.jobId, jobId)),
    db.select({ id: users.id, name: users.name, color: users.color, role: users.role }).from(users),
    db.select().from(formTemplates),
  ]);

  return (
    <JobView
      job={{
        id: job.id,
        title: job.title,
        serviceType: job.serviceType,
        stage: job.stage,
        address: job.address,
        description: job.description,
        lineItems: job.lineItems,
        assigneeId: job.assigneeId,
        lostReason: job.lostReason,
        scheduledStart: job.scheduledStart?.toISOString() ?? null,
        createdAt: job.createdAt.toISOString(),
      }}
      client={{
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        address: client.addresses.find((a) => a.primary) ?? client.addresses[0] ?? null,
      }}
      forms={formRows
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .map((f) => ({
          id: f.id,
          token: f.token,
          templateKey: f.templateKey,
          templateLabel: FORM_PHASES[f.templateKey]?.label ?? f.templateKey,
          status: f.status,
          channel: f.channel,
          recipient: f.recipient,
          sentAt: f.sentAt.toISOString(),
          signedAt: f.signedAt?.toISOString() ?? null,
          signerName: f.signerName,
          signerIp: f.signerIp,
          clientNote: f.clientNote,
          events: f.events,
        }))}
      appointments={apptRows
        .sort((a, b) => +new Date(a.a.startsAt) - +new Date(b.a.startsAt))
        .map((r) => ({
          id: r.a.id,
          title: r.a.title,
          type: r.a.type,
          startsAt: r.a.startsAt.toISOString(),
          endsAt: r.a.endsAt.toISOString(),
          assigneeName: r.assigneeName,
          assigneeColor: r.assigneeColor,
          status: r.a.status,
        }))}
      activities={actRows
        .sort((a, b) => +new Date(b.a.createdAt) - +new Date(a.a.createdAt))
        .map((r) => ({
          id: r.a.id,
          message: r.a.message,
          kind: r.a.kind,
          at: r.a.createdAt.toISOString(),
          userName: r.userName,
          userColor: r.userColor,
        }))}
      photos={photoRows.map((p) => ({ id: p.id, url: p.url, caption: p.caption }))}
      team={team}
      templates={templates.map((t) => ({ key: t.key, name: t.name, description: t.description ?? "", nextStage: t.nextStage }))}
    />
  );
}
