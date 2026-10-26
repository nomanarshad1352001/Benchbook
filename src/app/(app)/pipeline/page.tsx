"use client";

import PipelineBoard from "@/components/pipeline-board";
import { computeTotals, primaryAddress } from "@/lib/model";
import { useData, useReady } from "@/lib/store";
import { BootScreen } from "@/app/(app)/layout";

export default function PipelinePage() {
  const ready = useReady();
  const d = useData();
  if (!ready) return <BootScreen />;

  const sp = Object.fromEntries(new URLSearchParams(window.location.search));

  const boardJobs = d.jobs.map((j) => {
    const client = d.clients.find((c) => c.id === j.clientId);
    const assignee = d.users.find((u) => u.id === j.assigneeId);
    return {
      id: j.id, title: j.title, serviceType: j.serviceType, stage: j.stage,
      total: computeTotals(j.lineItems).total,
      client: { id: j.clientId, name: client?.name ?? "—" },
      assignee: assignee ? { name: assignee.name, color: assignee.color, avatar: assignee.avatarUrl } : null,
      updatedAt: j.updatedAt,
    };
  });

  return (
    <PipelineBoard
      jobs={boardJobs}
      clients={d.clients.map((c) => {
        const a = primaryAddress(c);
        return { id: c.id, name: c.name, address: a ? `${a.line1}, ${a.city}` : "" };
      })}
      team={d.users.map((u) => ({ id: u.id, name: u.name, color: u.color }))}
      openNew={sp.new === "1"}
      presetClientId={sp.client ? Number(sp.client) : null}
    />
  );
}
