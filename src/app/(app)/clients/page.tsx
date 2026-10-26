"use client";

import ClientsView from "@/components/clients-view";
import { computeTotals, primaryAddress } from "@/lib/model";
import { useData, useReady } from "@/lib/store";
import { BootScreen } from "@/app/(app)/layout";

export default function ClientsPage() {
  const ready = useReady();
  const d = useData();
  if (!ready) return <BootScreen />;

  const sp = Object.fromEntries(new URLSearchParams(window.location.search));

  const rows = [...d.clients]
    .map((c) => {
      const cj = d.jobs.filter((j) => j.clientId === c.id);
      const active = cj.filter((j) => j.stage !== "paid" && j.stage !== "lost");
      const billed = cj.filter((j) => j.stage === "paid").reduce((s, j) => s + computeTotals(j.lineItems).total, 0);
      return {
        id: c.id, name: c.name, email: c.email, phone: c.phone, leadSource: c.leadSource,
        tags: c.tags, address: primaryAddress(c) ?? null,
        activeCount: active.length,
        stageDots: active.slice(0, 5).map((j) => j.stage),
        billed, notePreview: c.notes,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return <ClientsView clients={rows} initialQ={sp.q ?? ""} openNew={sp.new === "1"} />;
}
