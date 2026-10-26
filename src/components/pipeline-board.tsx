"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { GripVertical, Loader2, MapPin, Plus, Search, X } from "lucide-react";
import { SERVICE_TYPES, STAGES } from "@/lib/constants";
import type { LineItem } from "@/db/schema";
import LineItemsEditor from "@/components/line-items-editor";
import { cn, daysInStage, moneyCompact } from "@/lib/utils";
import { money } from "@/lib/utils";

export type BoardJob = {
  id: number;
  title: string;
  serviceType: string;
  stage: string;
  total: number;
  client: { id: number; name: string };
  assignee: { name: string; color: string; avatar: string | null } | null;
  updatedAt: string;
};

type ClientOpt = { id: number; name: string; address: string };
type TeamOpt = { id: number; name: string; color: string };

export default function PipelineBoard({
  jobs: initialJobs,
  clients,
  team,
  openNew,
  presetClientId,
}: {
  jobs: BoardJob[];
  clients: ClientOpt[];
  team: TeamOpt[];
  openNew: boolean;
  presetClientId: number | null;
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [q, setQ] = useState("");
  const [dragId, setDragId] = useState<number | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(openNew);
  const [saving, setSaving] = useState<number | null>(null);

  const filtered = useMemo(
    () =>
      jobs.filter((j) =>
        `${j.title} ${j.client.name} ${j.serviceType}`.toLowerCase().includes(q.toLowerCase())
      ),
    [jobs, q]
  );

  const filteredVisible = filtered.filter((j) => j.stage !== "lost");
  const openValue = filteredVisible.reduce((s, j) => s + j.total, 0);

  function move(jobId: number, stage: string) {
    const current = jobs.find((j) => j.id === jobId);
    if (!current || current.stage === stage) return;
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, stage } : j)));
    setSaving(jobId);
    fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    })
      .catch(() => {})
      .finally(() => {
        setSaving(null);
        router.refresh();
      });
  }

  return (
    <div className="animate-rise">
      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter jobs or clients…"
            className="w-60 rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm transition focus:border-ink"
          />
        </div>
        <p className="text-[13px] text-ink-soft">
          <span className="font-bold text-ink tnum">{filteredVisible.length}</span> open jobs ·{" "}
          <span className="font-bold text-ink tnum">{moneyCompact(openValue)}</span> on the board
        </p>
        <button
          onClick={() => setShowNew(true)}
          className="ml-auto flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-black"
        >
          <Plus className="size-4" /> New job
        </button>
      </div>

      {/* Board */}
      <div className="thin-scroll -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
        {STAGES.map((stage) => {
          const cards = filtered.filter((j) => j.stage === stage.key);
          const colTotal = cards.reduce((s, j) => s + j.total, 0);
          return (
            <section
              key={stage.key}
              onDragOver={(e) => {
                e.preventDefault();
                setOverStage(stage.key);
              }}
              onDragLeave={() => setOverStage((s) => (s === stage.key ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId != null) move(dragId, stage.key);
                setDragId(null);
                setOverStage(null);
              }}
              className={cn(
                "flex w-[288px] shrink-0 snap-start flex-col rounded-2xl border border-line/70 bg-black/[0.025] transition",
                overStage === stage.key && "kanban-drop",
                stage.key === "lost" && "opacity-90"
              )}
            >
              <header className="flex items-center gap-2 px-4 pb-2.5 pt-3.5">
                <span className="size-2.5 rounded-full" style={{ background: stage.color }} />
                <h3 className="text-[13px] font-bold">{stage.label}</h3>
                <span className="rounded-full bg-white px-1.5 text-[11px] font-bold text-ink-soft tnum">{cards.length}</span>
                <span className="ml-auto text-[11px] font-semibold text-ink-soft tnum">{moneyCompact(colTotal)}</span>
              </header>

              <div className="flex min-h-[120px] flex-1 flex-col gap-2.5 px-2.5 pb-3">
                {cards.map((j) => (
                  <JobCard
                    key={j.id}
                    job={j}
                    saving={saving === j.id}
                    dim={dragId === j.id}
                    onDragStart={() => setDragId(j.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverStage(null);
                    }}
                  />
                ))}
                {cards.length === 0 && (
                  <p className="grid flex-1 place-items-center rounded-xl border border-dashed border-line px-4 py-6 text-center text-[11px] font-medium text-ink-soft/70">
                    Drop a card here
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <p className="text-xs text-ink-soft/80">
        Tip: drag cards between stages — moves are saved instantly and fire the{" "}
        <code className="rounded bg-black/5 px-1 font-mono text-[11px]">job.stage_changed</code> webhook.
      </p>

      {showNew && <NewJobModal clients={clients} team={team} presetClientId={presetClientId} onClose={() => setShowNew(false)} />}
    </div>
  );
}

/* ---------- Card ---------- */

function JobCard({
  job,
  dim,
  saving,
  onDragStart,
  onDragEnd,
}: {
  job: BoardJob;
  dim: boolean;
  saving: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const days = daysInStage(job.updatedAt);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group cursor-grab rounded-xl border border-line bg-paper p-3.5 shadow-card transition hover:border-ink/25 hover:shadow-lift active:cursor-grabbing",
        dim && "drag-ghost"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/clients/${job.client.id}`}
          className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-soft transition hover:text-accent-deep"
        >
          {job.client.name}
        </Link>
        <GripVertical className="size-4 shrink-0 text-line transition group-hover:text-ink-soft" />
      </div>
      <Link href={`/jobs/${job.id}`} className="mt-1 block text-[13.5px] font-semibold leading-snug transition hover:text-accent-deep">
        {job.title}
      </Link>
      <div className="mt-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-canvas px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-soft">
          <MapPin className="size-2.5" />{job.serviceType}
        </span>
        {saving && <Loader2 className="size-3 animate-spin text-ink-soft" />}
      </div>
      <div className="mt-2.5 flex items-center border-t border-line/70 pt-2.5">
        <span className="font-display text-[13.5px] font-bold tnum">{money(job.total)}</span>
        <span className="ml-auto flex items-center gap-1.5">
          {days >= 7 && job.stage !== "paid" && (
            <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600 tnum">{days}d</span>
          )}
          {job.assignee ? (
            <span
              title={job.assignee.name}
              className="grid size-6 place-items-center overflow-hidden rounded-full text-[9px] font-bold text-white"
              style={{ background: job.assignee.color }}
            >
              {job.assignee.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={job.assignee.avatar} alt="" className="size-full object-cover" />
              ) : (
                job.assignee.name.slice(0, 2).toUpperCase()
              )}
            </span>
          ) : (
            <span className="grid size-6 place-items-center rounded-full border border-dashed border-line text-[9px] text-ink-soft">?</span>
          )}
        </span>
      </div>
    </div>
  );
}

/* ---------- New job modal ---------- */

function NewJobModal({
  clients,
  team,
  presetClientId,
  onClose,
}: {
  clients: ClientOpt[];
  team: TeamOpt[];
  presetClientId: number | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    clientId: presetClientId ? String(presetClientId) : "",
    title: "",
    serviceType: "General Repairs",
    address: "",
    description: "",
    assigneeId: "",
  });
  const [items, setItems] = useState<LineItem[]>([
    { id: 1, description: "", kind: "labour", qty: 2, unit: "hrs", rate: 95 },
  ]);

  function pickClient(id: string) {
    const c = clients.find((x) => x.id === Number(id));
    setF((p) => ({ ...p, clientId: id, address: p.address || c?.address || "" }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, clientId: Number(f.clientId), assigneeId: f.assigneeId ? Number(f.assigneeId) : null, lineItems: items }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create the job.");
        return;
      }
      onClose();
      router.push(`/jobs/${data.id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm transition focus:border-ink";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/45 p-4 backdrop-blur-sm animate-fade" onMouseDown={onClose}>
      <div className="my-8 w-full max-w-2xl rounded-3xl bg-white p-6 shadow-lift animate-pop" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold">New job</h2>
            <p className="text-xs text-ink-soft">Starts as a Lead — drag it along the board as it progresses.</p>
          </div>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-ink-soft transition hover:bg-canvas"><X className="size-4" /></button>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-ink-soft">Client *</label>
              <select required value={f.clientId} onChange={(e) => pickClient(e.target.value)} className={cn(field, "mt-1")}>
                <option value="" disabled>Select client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-soft">Service type</label>
              <select value={f.serviceType} onChange={(e) => setF({ ...f, serviceType: e.target.value })} className={cn(field, "mt-1")}>
                {SERVICE_TYPES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-ink-soft">Job title *</label>
              <input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={cn(field, "mt-1")} placeholder="e.g. Kitchen faucet & shut-off valves" />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-soft">Job address</label>
              <input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} className={cn(field, "mt-1")} placeholder="Defaults to client address" />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-soft">Lead tech</label>
              <select value={f.assigneeId} onChange={(e) => setF({ ...f, assigneeId: e.target.value })} className={cn(field, "mt-1")}>
                <option value="">Unassigned</option>
                {team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-ink-soft">Scope / description</label>
              <textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={cn(field, "mt-1 resize-none")} placeholder="What are we fixing, and what did you see on site?" />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-ink-soft">Estimate — labour &amp; materials</p>
            <div className="rounded-2xl border border-line p-3">
              <LineItemsEditor items={items} onChange={setItems} />
            </div>
          </div>

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold transition hover:bg-canvas">Cancel</button>
            <button disabled={busy} className="flex items-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-black disabled:opacity-60">
              {busy && <Loader2 className="size-4 animate-spin" />} Create job
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
