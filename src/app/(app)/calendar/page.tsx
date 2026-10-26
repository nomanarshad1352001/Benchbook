"use client";

import CalendarView from "@/components/calendar-view";
import { useData, useReady } from "@/lib/store";
import { BootScreen } from "@/app/(app)/layout";

export default function CalendarPage() {
  const ready = useReady();
  const d = useData();
  if (!ready) return <BootScreen />;

  const sp = Object.fromEntries(new URLSearchParams(window.location.search));

  return (
    <CalendarView
      appointments={d.appointments.map((a) => {
        const client = d.clients.find((c) => c.id === a.clientId);
        const job = d.jobs.find((j) => j.id === a.jobId);
        const user = d.users.find((u) => u.id === a.assigneeId);
        return {
          id: a.id, title: a.title, type: a.type, startsAt: a.startsAt, endsAt: a.endsAt,
          notes: a.notes, status: a.status, clientId: a.clientId, clientName: client?.name ?? "—",
          jobId: a.jobId, jobTitle: job?.title ?? null,
          assigneeId: a.assigneeId, assigneeName: user?.name ?? "Unassigned",
          assigneeColor: user?.color ?? "#94a3b8",
        };
      })}
      team={d.users.map((u) => ({ id: u.id, name: u.name, color: u.color, role: u.role }))}
      clients={[...d.clients].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, name: c.name }))}
      jobs={d.jobs.filter((j) => j.stage !== "paid" && j.stage !== "lost").map((j) => ({ id: j.id, title: j.title, clientId: j.clientId }))}
      openNew={sp.new === "1"}
      presetClientId={sp.client ? Number(sp.client) : null}
      presetJobId={sp.job ? Number(sp.job) : null}
    />
  );
}
