"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import ClientView from "@/components/client-view";
import { FORM_PHASES } from "@/lib/constants";
import { computeTotals } from "@/lib/model";
import { useData, useReady } from "@/lib/store";
import { BootScreen } from "@/app/(app)/layout";

export default function ClientPage() {
  const ready = useReady();
  const d = useData();
  const params = useParams<{ id: string }>();
  const clientId = Number(params.id);
  if (!ready) return <BootScreen />;

  const client = d.clients.find((c) => c.id === clientId);
  if (!client) {
    return (
      <div className="card mx-auto mt-10 max-w-md p-10 text-center">
        <p className="font-display text-lg font-bold">Client not found</p>
        <p className="mt-1 text-sm text-ink-soft">This record may have been removed or the link is wrong.</p>
        <Link href="/clients" className="mt-4 inline-block rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white">Back to clients</Link>
      </div>
    );
  }

  const jobRows = d.jobs.filter((j) => j.clientId === client.id);
  const jobsList = jobRows
    .map((j) => ({ id: j.id, title: j.title, serviceType: j.serviceType, stage: j.stage, total: computeTotals(j.lineItems).total, updatedAt: j.updatedAt }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const noteRows = d.notes
    .filter((n) => n.clientId === client.id)
    .map((n) => ({
      id: n.id, body: n.body, at: n.createdAt,
      userName: d.users.find((u) => u.id === n.userId)?.name ?? "Team",
      userColor: d.users.find((u) => u.id === n.userId)?.color ?? "#94a3b8",
      jobTitle: d.jobs.find((j) => j.id === n.jobId)?.title ?? null,
    }))
    .sort((a, b) => b.at.localeCompare(a.at));

  const actRows = d.activities
    .filter((a) => a.clientId === client.id)
    .map((a) => ({ kind: a.kind, text: a.message, at: a.createdAt, who: d.users.find((u) => u.id === a.userId)?.name ?? "System" }));

  const formRows = d.forms.filter((f) => f.clientId === client.id);
  const timeline = [
    ...actRows,
    ...noteRows.map((n) => ({ kind: "note", text: n.body, at: n.at, who: n.userName })),
    ...formRows.flatMap((f) => {
      const label = FORM_PHASES[f.templateKey]?.label ?? f.templateKey;
      const items = [{ kind: "form", text: `${label} sent to ${f.recipient ?? "client"} (${f.channel.toUpperCase()})`, at: f.sentAt, who: "Office" }];
      if (f.signedAt)
        items.push({ kind: "form-signed", text: `${label} signed by ${f.signerName ?? "client"} — job: ${d.jobs.find((j) => j.id === f.jobId)?.title ?? ""}`, at: f.signedAt, who: "Client" });
      return items;
    }),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const upcoming = d.appointments
    .filter((a) => a.clientId === client.id && +new Date(a.startsAt) > Date.now() && a.status !== "cancelled")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];

  return (
    <ClientView
      client={{
        id: client.id, name: client.name, email: client.email, phone: client.phone,
        leadSource: client.leadSource, tags: client.tags, addresses: client.addresses,
        notes: client.notes, createdAt: client.createdAt,
      }}
      jobs={jobsList}
      timeline={timeline}
      notes={noteRows}
      photos={d.photos.filter((p) => p.clientId === client.id).map((p) => ({ id: p.id, url: p.url, caption: p.caption }))}
      upcoming={
        upcoming
          ? { title: upcoming.title, startsAt: upcoming.startsAt, endsAt: upcoming.endsAt, assigneeName: d.users.find((u) => u.id === upcoming.assigneeId)?.name ?? null, jobId: upcoming.jobId }
          : null
      }
      jobsForNotes={jobsList.map((j) => ({ id: j.id, title: j.title }))}
    />
  );
}
