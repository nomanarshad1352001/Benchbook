import { db } from "@/db";
import { clients, jobs } from "@/db/schema";
import ClientsView from "@/components/clients-view";
import { computeTotals } from "@/lib/ops";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const [allClients, allJobs] = await Promise.all([
    db.select().from(clients),
    db.select().from(jobs),
  ]);

  const rows = allClients
    .map((c) => {
      const cj = allJobs.filter((j) => j.clientId === c.id);
      const active = cj.filter((j) => j.stage !== "paid" && j.stage !== "lost");
      const billed = cj
        .filter((j) => j.stage === "paid")
        .reduce((s, j) => s + computeTotals(j.lineItems).total, 0);
      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        leadSource: c.leadSource,
        tags: c.tags,
        address: c.addresses.find((a) => a.primary) ?? c.addresses[0] ?? null,
        activeCount: active.length,
        stageDots: active.slice(0, 5).map((j) => j.stage),
        billed,
        notePreview: c.notes,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return <ClientsView clients={rows} initialQ={sp.q ?? ""} openNew={sp.new === "1"} />;
}
