"use client";

import FormsView from "@/components/forms-view";
import { FORM_PHASES } from "@/lib/constants";
import { auth, useData, useReady } from "@/lib/store";
import { BootScreen } from "@/app/(app)/layout";

export default function FormsPage() {
  const ready = useReady();
  const d = useData();
  if (!ready) return <BootScreen />;

  const sp = Object.fromEntries(new URLSearchParams(window.location.search));
  const me = d.users.find((u) => u.id === auth.uid);

  return (
    <FormsView
      templates={d.templates.map((t) => ({
        key: t.key, name: t.name, description: t.description, body: t.body,
        nextStage: t.nextStage, updatedAt: t.updatedAt,
      }))}
      forms={[...d.forms]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((f) => {
          const job = d.jobs.find((j) => j.id === f.jobId);
          const client = d.clients.find((c) => c.id === f.clientId);
          return {
            id: f.id, token: f.token, templateKey: f.templateKey,
            templateLabel: FORM_PHASES[f.templateKey]?.label ?? f.templateKey,
            status: f.status, channel: f.channel, recipient: f.recipient,
            sentAt: f.sentAt, signedAt: f.signedAt, signerName: f.signerName,
            signerIp: f.signerIp, jobId: f.jobId,
            jobTitle: job?.title ?? "—", jobStage: job?.stage ?? "lead",
            clientName: client?.name ?? "—",
          };
        })}
      jobs={d.jobs
        .filter((j) => j.stage !== "paid" && j.stage !== "lost")
        .map((j) => {
          const client = d.clients.find((c) => c.id === j.clientId);
          return { id: j.id, title: j.title, clientName: client?.name ?? "—", clientEmail: client?.email ?? null, clientPhone: client?.phone ?? null, stage: j.stage };
        })}
      canEdit={me?.role === "admin" || me?.role === "office"}
      openSend={sp.send === "1"}
      presetJobId={sp.job ? Number(sp.job) : null}
    />
  );
}
