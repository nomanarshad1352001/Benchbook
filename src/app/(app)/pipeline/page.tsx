import { db } from "@/db";
import { clients, jobs, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import PipelineBoard from "@/components/pipeline-board";
import { computeTotals } from "@/lib/ops";

export const dynamic = "force-dynamic";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const rows = await db
    .select({
      j: jobs,
      clientName: clients.name,
      assigneeName: users.name,
      assigneeColor: users.color,
      assigneeAvatar: users.avatarUrl,
    })
    .from(jobs)
    .innerJoin(clients, eq(jobs.clientId, clients.id))
    .leftJoin(users, eq(jobs.assigneeId, users.id));

  const boardJobs = rows.map((r) => ({
    id: r.j.id,
    title: r.j.title,
    serviceType: r.j.serviceType,
    stage: r.j.stage,
    total: computeTotals(r.j.lineItems).total,
    client: { id: r.j.clientId, name: r.clientName },
    assignee: r.assigneeName
      ? { name: r.assigneeName, color: r.assigneeColor ?? "#94a3b8", avatar: r.assigneeAvatar }
      : null,
    updatedAt: r.j.updatedAt.toISOString(),
  }));

  const clientOpts = await db
    .select({ id: clients.id, name: clients.name, addresses: clients.addresses })
    .from(clients);
  const team = await db
    .select({ id: users.id, name: users.name, color: users.color })
    .from(users);

  return (
    <PipelineBoard
      jobs={boardJobs}
      clients={clientOpts.map((c) => ({
        id: c.id,
        name: c.name,
        address: `${(c.addresses.find((a) => a.primary) ?? c.addresses[0])?.line1 ?? ""}, ${(c.addresses.find((a) => a.primary) ?? c.addresses[0])?.city ?? ""}`,
      }))}
      team={team}
      openNew={sp.new === "1"}
      presetClientId={sp.client ? Number(sp.client) : null}
    />
  );
}
