import { notFound } from "next/navigation";
import { db } from "@/db";
import { activities, appointments, clients, forms, jobs, notes, photos, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import ClientView from "@/components/client-view";
import { computeTotals } from "@/lib/ops";
import { FORM_PHASES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientId = Number(id);
  if (!Number.isFinite(clientId)) notFound();

  const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
  if (!client) notFound();

  const [jobRows, noteRows, actRows, photoRows, apptRows, formRows, team] = await Promise.all([
    db.select().from(jobs).where(eq(jobs.clientId, clientId)),
    db
      .select({ n: notes, userName: users.name, userColor: users.color, jobTitle: jobs.title })
      .from(notes)
      .leftJoin(users, eq(notes.userId, users.id))
      .leftJoin(jobs, eq(notes.jobId, jobs.id))
      .where(eq(notes.clientId, clientId)),
    db
      .select({ a: activities, userName: users.name })
      .from(activities)
      .leftJoin(users, eq(activities.userId, users.id))
      .where(eq(activities.clientId, clientId)),
    db.select().from(photos).where(eq(photos.clientId, clientId)),
    db
      .select({ a: appointments, assigneeName: users.name, jobTitle: jobs.title })
      .from(appointments)
      .leftJoin(users, eq(appointments.assigneeId, users.id))
      .leftJoin(jobs, eq(appointments.jobId, jobs.id))
      .where(eq(appointments.clientId, clientId)),
    db.select({ f: forms, jobTitle: jobs.title }).from(forms).innerJoin(jobs, eq(forms.jobId, jobs.id)).where(eq(forms.clientId, clientId)),
    db.select({ id: users.id, name: users.name, color: users.color }).from(users),
  ]);

  const jobsList = jobRows
    .map((j) => ({
      id: j.id,
      title: j.title,
      serviceType: j.serviceType,
      stage: j.stage,
      total: computeTotals(j.lineItems).total,
      updatedAt: j.updatedAt.toISOString(),
    }))
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));

  const timeline = [
    ...actRows.map((r) => ({
      kind: r.a.kind,
      text: r.a.message,
      at: r.a.createdAt.toISOString(),
      who: r.userName ?? "System",
    })),
    ...noteRows.map((r) => ({
      kind: "note",
      text: r.n.body,
      at: r.n.createdAt.toISOString(),
      who: r.userName ?? "Team",
    })),
    ...formRows.flatMap((r) => {
      const label = FORM_PHASES[r.f.templateKey]?.label ?? r.f.templateKey;
      const items = [
        { kind: "form", text: `${label} sent to ${r.f.recipient ?? "client"} (${r.f.channel.toUpperCase()})`, at: r.f.sentAt.toISOString(), who: "Office" },
      ];
      if (r.f.signedAt)
        items.push({
          kind: "form-signed",
          text: `${label} signed by ${r.f.signerName ?? "client"} — job: ${r.jobTitle}`,
          at: r.f.signedAt.toISOString(),
          who: "Client",
        });
      return items;
    }),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

  const upcoming = apptRows
    .filter((r) => +new Date(r.a.startsAt) > Date.now() && r.a.status !== "cancelled")
    .sort((a, b) => +new Date(a.a.startsAt) - +new Date(b.a.startsAt))[0];

  return (
    <ClientView
      client={{
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        leadSource: client.leadSource,
        tags: client.tags,
        addresses: client.addresses,
        notes: client.notes,
        createdAt: client.createdAt.toISOString(),
      }}
      jobs={jobsList}
      timeline={timeline}
      notes={noteRows
        .map((r) => ({
          id: r.n.id,
          body: r.n.body,
          at: r.n.createdAt.toISOString(),
          userName: r.userName ?? "Team",
          userColor: r.userColor ?? "#94a3b8",
          jobTitle: r.jobTitle,
        }))
        .sort((a, b) => +new Date(b.at) - +new Date(a.at))}
      photos={photoRows.map((p) => ({ id: p.id, url: p.url, caption: p.caption }))}
      upcoming={
        upcoming
          ? {
              title: upcoming.a.title,
              startsAt: upcoming.a.startsAt.toISOString(),
              endsAt: upcoming.a.endsAt.toISOString(),
              assigneeName: upcoming.assigneeName,
              jobId: upcoming.a.jobId,
            }
          : null
      }
      jobsForNotes={jobsList.map((j) => ({ id: j.id, title: j.title }))}
    />
  );
}
