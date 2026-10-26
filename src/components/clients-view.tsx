"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Copy,
  FileDown,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  Tag,
  UserPlus,
  X,
} from "lucide-react";
import { LEAD_SOURCES, STAGE_MAP, type StageKey } from "@/lib/constants";
import { cn, formatAddress, moneyCompact } from "@/lib/utils";

export type ClientRow = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  leadSource: string;
  tags: string[];
  address: { label: string; line1: string; city: string; province: string; postal: string } | null;
  activeCount: number;
  stageDots: string[];
  billed: number;
  notePreview: string | null;
};

const AV_COLORS = ["#f59e0b", "#3b82f6", "#8b5cf6", "#22c55e", "#ec4899", "#14b8a6", "#f97316", "#6366f1"];

function avColor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return AV_COLORS[h % AV_COLORS.length];
}

export default function ClientsView({
  clients,
  initialQ,
  openNew,
}: {
  clients: ClientRow[];
  initialQ: string;
  openNew: boolean;
}) {
  const [q, setQ] = useState(initialQ);
  const [tag, setTag] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(openNew);

  const allTags = useMemo(
    () => [...new Set(clients.flatMap((c) => c.tags))].sort(),
    [clients]
  );

  const filtered = clients.filter((c) => {
    const hay = `${c.name} ${c.email ?? ""} ${c.phone ?? ""} ${c.tags.join(" ")}`.toLowerCase();
    return hay.includes(q.toLowerCase()) && (!tag || c.tags.includes(tag));
  });

  return (
    <div className="space-y-5 animate-rise">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, phone, tag…"
            className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm transition focus:border-ink"
          />
        </div>
        <div className="no-scrollbars flex gap-1.5 overflow-x-auto">
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => setTag(tag === t ? null : t)}
              className={cn(
                "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                tag === t ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft hover:border-ink/40"
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={async () => (await import("@/lib/store")).downloadClientsCsv()}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2.5 text-[13px] font-semibold transition hover:border-ink/40"
            title="Download all clients as CSV (same format as import)"
          >
            <FileDown className="size-4" /> Export
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-black"
          >
            <UserPlus className="size-4" /> New client
          </button>
        </div>
      </div>

      <p className="text-xs font-medium text-ink-soft">
        {filtered.length} client{filtered.length === 1 ? "" : "s"}
        {tag ? ` tagged “${tag}”` : ""}
      </p>

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((c, i) => (
          <Link
            key={c.id}
            href={`/clients/${c.id}`}
            className="card card-hover group p-5 animate-rise"
            style={{ animationDelay: `${Math.min(i * 40, 320)}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className="grid size-11 shrink-0 place-items-center rounded-2xl font-display text-sm font-bold text-white"
                  style={{ background: avColor(c.name) }}
                >
                  {c.name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("")}
                </span>
                <div>
                  <p className="font-display text-[15px] font-bold leading-tight">{c.name}</p>
                  <span className="mt-1 inline-block rounded-full bg-canvas px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                    {c.leadSource}
                  </span>
                </div>
              </div>
              <ArrowUpRight className="size-4 text-line transition group-hover:text-ink" />
            </div>

            <div className="mt-4 space-y-1.5 text-[13px] text-ink-soft">
              {c.phone && <p className="flex items-center gap-2"><Phone className="size-3.5" /> {c.phone}</p>}
              {c.email && <p className="flex items-center gap-2 truncate"><Mail className="size-3.5 shrink-0" /> {c.email}</p>}
              {c.address && (
                <p className="flex items-center gap-2"><MapPin className="size-3.5 shrink-0" /> {c.address.line1}</p>
              )}
            </div>

            {c.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                    <Tag className="size-2.5" /> {t}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-line pt-3.5 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-ink-soft">
                {c.activeCount} active
                <span className="flex gap-1">
                  {c.stageDots.map((s, i2) => (
                    <span key={i2} className="size-2 rounded-full" style={{ background: STAGE_MAP[s as StageKey]?.color ?? "#cbd5e1" }} />
                  ))}
                </span>
              </span>
              <span className="text-ink-soft">Lifetime <span className="font-bold text-ink tnum">{moneyCompact(c.billed)}</span></span>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full card flex flex-col items-center gap-2 py-14 text-center">
            <Search className="size-7 text-line" />
            <p className="text-sm font-semibold">No clients match</p>
            <p className="text-xs text-ink-soft">Try a different name, phone number or tag.</p>
          </div>
        )}
      </div>

      {showNew && <NewClientModal onClose={() => setShowNew(false)} />}
    </div>
  );
}

/* ---------- New client modal ---------- */

function NewClientModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    name: "", email: "", phone: "", leadSource: "Referral",
    line1: "", postal: "", tags: "", notes: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create client.");
        return;
      }
      router.push(`/clients/${data.id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm transition focus:border-ink";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4 backdrop-blur-sm animate-fade" onMouseDown={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-lift animate-pop" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">New client</h2>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-ink-soft transition hover:bg-canvas"><X className="size-4" /></button>
        </div>
        <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-ink-soft">Full name or company *</label>
            <input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={cn(field, "mt-1")} placeholder="e.g. Dana Whitaker" />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-soft">Phone</label>
            <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={cn(field, "mt-1")} placeholder="(416) 555-0100" />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-soft">Email</label>
            <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={cn(field, "mt-1")} placeholder="client@email.com" />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-soft">Lead source</label>
            <select value={f.leadSource} onChange={(e) => setF({ ...f, leadSource: e.target.value })} className={cn(field, "mt-1")}>
              {LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-soft">Tags (comma separated)</label>
            <input value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} className={cn(field, "mt-1")} placeholder="VIP, Repeat" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-ink-soft">Street address</label>
            <input value={f.line1} onChange={(e) => setF({ ...f, line1: e.target.value })} className={cn(field, "mt-1")} placeholder="88 Roxborough St E" />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-soft">Postal code</label>
            <input value={f.postal} onChange={(e) => setF({ ...f, postal: e.target.value })} className={cn(field, "mt-1")} placeholder="M4W 1V7" />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-soft">Notes</label>
            <input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className={cn(field, "mt-1")} placeholder="Gate code, pets, preferences…" />
          </div>
          {error && <p className="sm:col-span-2 rounded-xl bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600">{error}</p>}
          <div className="sm:col-span-2 mt-1 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold transition hover:bg-canvas">Cancel</button>
            <button disabled={busy} className="flex items-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-black disabled:opacity-60">
              {busy && <Loader2 className="size-4 animate-spin" />} Create client
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value).catch(() => {});
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      className="rounded-md p-1 text-ink-soft transition hover:bg-black/5 hover:text-ink"
      title="Copy"
    >
      {done ? <span className="text-[10px] font-bold text-emerald-600">Copied</span> : <Copy className="size-3.5" />}
    </button>
  );
}
