import { db } from "@/db";
import { appointments, clients, jobs, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import CalendarView from "@/components/calendar-view";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;

  const [rows, team, clientOpts, jobOpts] = await Promise.all([
    db
      .select({
        a: appointments,
        clientName: clients.name,
        jobTitle: jobs.title,
        assigneeName: users.name,
        assigneeColor: users.color,
      })
      .from(appointments)
      .innerJoin(clients, eq(appointments.clientId, clients.id))
      .leftJoin(jobs, eq(appointments.jobId, jobs.id))
      .leftJoin(users, eq(appointments.assigneeId, users.id)),
    db.select({ id: users.id, name: users.name, color: users.color, role: users.role }).from(users),
    db.select({ id: clients.id, name: clients.name }).from(clients),
    db
      .select({ id: jobs.id, title: jobs.title, clientId: jobs.clientId, stage: jobs.stage })
      .from(jobs),
  ]);

  return (
    <CalendarView
      appointments={rows.map((r) => ({
        id: r.a.id,
        title: r.a.title,
        type: r.a.type,
        startsAt: r.a.startsAt.toISOString(),
        endsAt: r.a.endsAt.toISOString(),
        notes: r.a.notes,
        status: r.a.status,
        clientId: r.a.clientId,
        clientName: r.clientName,
        jobId: r.a.jobId,
        jobTitle: r.jobTitle,
        assigneeId: r.a.assigneeId,
        assigneeName: r.assigneeName ?? "Unassigned",
        assigneeColor: r.assigneeColor ?? "#94a3b8",
      }))}
      team={team}
      clients={clientOpts.sort((a, b) => a.name.localeCompare(b.name))}
      jobs={jobOpts.filter((j) => j.stage !== "paid" && j.stage !== "lost")}
      openNew={sp.new === "1"}
      presetClientId={sp.client ? Number(sp.client) : null}
      presetJobId={sp.job ? Number(sp.job) : null}
    />
  );
}
