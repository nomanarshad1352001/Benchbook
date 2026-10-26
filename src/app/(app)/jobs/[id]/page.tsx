"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import JobView from "@/components/job-view";
import { FORM_PHASES } from "@/lib/constants";
import { primaryAddress } from "@/lib/model";
import { useData, useReady } from "@/lib/store";
import { BootScreen } from "@/app/(app)/layout";

export default function JobPage() {
  const ready = useReady();
  const d = useData();
  const params = useParams<{ id: string }>();
  const jobId = Number(params.id);
  if (!ready) return <BootScreen />;

  const job = d.jobs.find((j) => j.id === jobId);
  if (!job) {
    return (
      <div className="card mx-auto mt-10 max-w-md p-10 text-center">
        <p className="font-display text-lg font-bold">Job not found</p>
        <Link href="/pipeline" className="mt-4 inline-block rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white">Back to pipeline</Link>
      </div>
    );
  }
  const client = d.clients.find((c) => c.id === job.clientId)!;

  return (
    <JobView
      job={{
        id: job.id, title: job.title, serviceType: job.serviceType, stage: job.stage,
        address: job.address, description: job.description, lineItems: job.lineItems,
        assigneeId: job.assigneeId, lostReason: job.lostReason,
        scheduledStart: job.scheduledStart, createdAt: job.createdAt,
      }}
      client={{ id: client.id, name: client.name, email: client.email, phone: client.phone, address: primaryAddress(client) ?? null }}
      forms={d.forms
        .filter((f) => f.jobId === job.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((f) => ({
          id: f.id, token: f.token, templateKey: f.templateKey,
          templateLabel: FORM_PHASES[f.templateKey]?.label ?? f.templateKey,
          status: f.status, channel: f.channel, recipient: f.recipient,
          sentAt: f.sentAt, signedAt: f.signedAt, signerName: f.signerName,
          signerIp: f.signerIp, clientNote: f.clientNote, events: f.events,
        }))}
      appointments={d.appointments
        .filter((a) => a.jobId === job.id)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .map((a) => {
          const u = d.users.find((x) => x.id === a.assigneeId);
          return { id: a.id, title: a.title, type: a.type, startsAt: a.startsAt, endsAt: a.endsAt, assigneeName: u?.name ?? null, assigneeColor: u?.color ?? null, status: a.status };
        })}
      activities={d.activities
        .filter((a) => a.jobId === job.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((a) => {
          const u = d.users.find((x) => x.id === a.userId);
          return { id: a.id, message: a.message, kind: a.kind, at: a.createdAt, userName: u?.name ?? null, userColor: u?.color ?? null };
        })}
      photos={d.photos.filter((p) => p.jobId === job.id).map((p) => ({ id: p.id, url: p.url, caption: p.caption }))}
      team={d.users.map((u) => ({ id: u.id, name: u.name, color: u.color, role: u.role }))}
      templates={d.templates.map((t) => ({ key: t.key, name: t.name, description: t.description, nextStage: t.nextStage }))}
    />
  );
}
