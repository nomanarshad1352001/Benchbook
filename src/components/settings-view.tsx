"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  CloudUpload,
  Copy,
  FileDown,
  FileSpreadsheet,
  Globe,
  HardDriveDownload,
  KeyRound,
  Loader2,
  Lock,
  PlayCircle,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  Webhook,
  X,
} from "lucide-react";
import { WEBHOOK_EVENTS, WORK_PHOTOS } from "@/lib/constants";
import { cn, fmtDate, timeAgo } from "@/lib/utils";

type Me = { id: number; name: string; email: string; role: string; color: string; avatarUrl: string | null };
type TeamMember = { id: number; name: string; email: string; phone: string | null; role: string; color: string; avatarUrl: string | null; createdAt: string };
type ApiKey = { id: number; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; revoked: boolean };
type Hook = { id: number; url: string; events: string[]; active: boolean; createdAt: string };
type Delivery = { id: number; event: string; status: string; responseCode: number | null; at: string; url: string };

const TABS = [
  { key: "team", label: "Team & roles", icon: Users },
  { key: "keys", label: "API keys", icon: KeyRound },
  { key: "webhooks", label: "Webhooks", icon: Webhook },
  { key: "import", label: "Import & export", icon: FileSpreadsheet },
  { key: "hosting", label: "Hosting & backups", icon: Globe },
] as const;

const ROLE_DESC: Record<string, string> = {
  admin: "Everything — team, API keys, webhooks, backups",
  office: "Clients, jobs, quoting, forms, scheduling",
  field: "Schedule, job cards, photos, on-site signing",
};

export default function SettingsView({
  me, team, apiKeys, webhooks, deliveries,
}: {
  me: Me; team: TeamMember[]; apiKeys: ApiKey[]; webhooks: Hook[]; deliveries: Delivery[];
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("team");
  return (
    <div className="space-y-5 animate-rise">
      <div className="no-scrollbars flex gap-1 overflow-x-auto rounded-2xl border border-line bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-[13px] font-semibold transition",
              tab === t.key ? "bg-ink text-white" : "text-ink-soft hover:bg-canvas hover:text-ink"
            )}
          >
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "team" && <TeamTab team={team} />}
      {tab === "keys" && <KeysTab me={me} apiKeys={apiKeys} />}
      {tab === "webhooks" && <WebhooksTab me={me} webhooks={webhooks} deliveries={deliveries} />}
      {tab === "import" && <ImportTab />}
      {tab === "hosting" && <HostingTab />}
    </div>
  );
}

/* ================= TEAM ================= */

function TeamTab({ team }: { team: TeamMember[] }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        {team.map((t) => (
          <div key={t.id} className="card flex flex-wrap items-center gap-4 p-4 sm:p-5">
            <span className="grid size-12 place-items-center overflow-hidden rounded-2xl text-xs font-bold text-white" style={{ background: t.color }}>
              {t.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.avatarUrl} alt={t.name} className="size-full object-cover" />
              ) : (
                t.name.slice(0, 2).toUpperCase()
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[15px] font-bold">{t.name}</p>
              <p className="truncate text-xs text-ink-soft">{t.email}{t.phone ? ` · ${t.phone}` : ""}</p>
            </div>
            <div className="text-right">
              <span className={cn(
                "rounded-full px-3 py-1 text-[11px] font-bold capitalize",
                t.role === "admin" ? "bg-amber-100 text-amber-800" : t.role === "office" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"
              )}>
                {t.role === "field" ? "Field crew" : t.role}
              </span>
              <p className="mt-1 max-w-52 text-[10.5px] leading-snug text-ink-soft">{ROLE_DESC[t.role]}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card h-fit p-5">
        <h3 className="flex items-center gap-2 text-[13px] font-bold"><ShieldCheck className="size-4 text-accent-deep" /> Permission matrix</h3>
        <table className="mt-3 w-full text-left text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-ink-soft">
              <th className="py-1.5 pr-2 font-bold">Capability</th>
              <th className="py-1.5 text-center font-bold">Admin</th>
              <th className="py-1.5 text-center font-bold">Office</th>
              <th className="py-1.5 text-center font-bold">Field</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {[
              ["Clients & job cards", true, true, true],
              ["Drag pipeline stages", true, true, true],
              ["Book appointments", true, true, true],
              ["Send & edit forms", true, true, false],
              ["Signed PDFs & audit", true, true, true],
              ["API keys & webhooks", true, false, false],
              ["Backups & restore", true, false, false],
            ].map(([cap, a, o, f]) => (
              <tr key={cap as string}>
                <td className="py-2 pr-2 font-medium">{cap as string}</td>
                {[a, o, f].map((v, i) => (
                  <td key={i} className="py-2 text-center">
                    {v ? <Check className="mx-auto size-3.5 text-emerald-600" strokeWidth={3} /> : <X className="mx-auto size-3.5 text-line" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">
          Field accounts default to the mobile day view. Demo: sign in as marcus@fixwell.ca to see the crew experience.
        </p>
      </div>
    </div>
  );
}

/* ================= API KEYS ================= */

function KeysTab({ me, apiKeys }: { me: Me; apiKeys: ApiKey[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Failed."); return; }
    setCreated(data.plainKey);
    setName("");
    router.refresh();
  }

  async function revoke(id: number) {
    await fetch("/api/keys", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    router.refresh();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <div className="space-y-3">
        {apiKeys.map((k) => (
          <div key={k.id} className={cn("card flex flex-wrap items-center gap-3 p-4", k.revoked && "opacity-55")}>
            <span className="grid size-10 place-items-center rounded-2xl bg-slate-100 text-slate-600"><KeyRound className="size-4.5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{k.name}</p>
              <p className="font-mono text-[11px] text-ink-soft">{k.prefix}••••••••••••{k.revoked ? " · revoked" : ""}</p>
            </div>
            <div className="text-right text-[11px] text-ink-soft">
              <p>created {fmtDate(k.createdAt)}</p>
              <p>{k.lastUsedAt ? `last used ${timeAgo(k.lastUsedAt)}` : "never used"}</p>
            </div>
            {!k.revoked && me.role === "admin" && (
              <button onClick={() => revoke(k.id)} className="grid size-8 place-items-center rounded-lg border border-line text-ink-soft transition hover:border-red-300 hover:bg-red-50 hover:text-red-600" title="Revoke key">
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        ))}
        {apiKeys.length === 0 && <div className="card py-12 text-center text-sm text-ink-soft">No keys yet.</div>}
      </div>

      <div className="space-y-4">
        <form onSubmit={create} className="card space-y-3 p-5">
          <h3 className="text-[13px] font-bold">Create API key</h3>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. QuickBooks sync" className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm transition focus:border-ink" />
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600">{error}</p>}
          <button disabled={busy || !name.trim() || me.role !== "admin"} className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-2.5 text-[13px] font-semibold text-white transition hover:bg-black disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Generate key
          </button>
          {me.role !== "admin" && <p className="text-[11px] text-ink-soft">Only admins can create keys.</p>}
          {created && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 animate-pop">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700"><Lock className="size-3" /> Shown once — store it safely</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-2.5 py-2 font-mono text-[11px]">{created}</code>
                <button type="button" onClick={() => { navigator.clipboard.writeText(created).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1200); }} className="grid size-8 shrink-0 place-items-center rounded-lg bg-ink text-white">
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </button>
              </div>
            </div>
          )}
        </form>

        <div className="card p-5">
          <h3 className="text-[13px] font-bold">Using the API</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">Send the key on every request:</p>
          <pre className="mt-2 overflow-x-auto rounded-xl bg-ink p-3 font-mono text-[10.5px] leading-relaxed text-white/85">
{`curl https://your-domain/api/v1/jobs \\
  -H "x-api-key: fwk_live_…"`}
          </pre>
          <Link href="/docs" className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-line py-2.5 text-[13px] font-semibold transition hover:border-ink/40">
            <BookOpen className="size-4" /> Open API reference
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ================= WEBHOOKS ================= */

function WebhooksTab({ me, webhooks, deliveries }: { me: Me; webhooks: Hook[]; deliveries: Delivery[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["job.stage_changed", "form.signed"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, events }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Failed."); return; }
    setOpen(false);
    setUrl("");
    router.refresh();
  }

  async function toggle(id: number, active: boolean) {
    await fetch("/api/webhooks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, active }) });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-soft">POST JSON to your endpoints the moment key events happen — signed with <code className="rounded bg-black/5 px-1 font-mono text-[11px]">X-Webhook-Secret</code>.</p>
        <button onClick={() => setOpen((v) => !v)} disabled={me.role !== "admin"} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-black disabled:opacity-50">
          <Plus className="size-4" /> Add endpoint
        </button>
      </div>

      {open && (
        <form onSubmit={create} className="card space-y-3 p-5 animate-pop">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-server.com/hooks/fixwell" className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 font-mono text-sm transition focus:border-ink" />
            <button disabled={busy} className="flex items-center justify-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Webhook className="size-4" />} Save
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {WEBHOOK_EVENTS.map((ev) => (
              <button
                type="button"
                key={ev.key}
                onClick={() => setEvents((cur) => (cur.includes(ev.key) ? cur.filter((x) => x !== ev.key) : [...cur, ev.key]))}
                className={cn(
                  "rounded-full border px-3 py-1.5 font-mono text-[11px] font-semibold transition",
                  events.includes(ev.key) ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft hover:border-ink/40"
                )}
              >
                {ev.key}
              </button>
            ))}
          </div>
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600">{error}</p>}
        </form>
      )}

      <div className="card divide-y divide-line/70">
        {webhooks.map((h) => (
          <div key={h.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
            <span className={cn("grid size-9 place-items-center rounded-xl", h.active ? "bg-emerald-50 text-emerald-600" : "bg-canvas text-ink-soft")}>
              <Webhook className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-[13px] font-semibold">{h.url}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {h.events.map((e) => (
                  <span key={e} className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-ink-soft">{e}</span>
                ))}
              </div>
            </div>
            <button
              onClick={() => toggle(h.id, !h.active)}
              className={cn("relative h-6 w-11 rounded-full transition", h.active ? "bg-emerald-500" : "bg-line")}
              disabled={me.role !== "admin"}
            >
              <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", h.active ? "left-[22px]" : "left-0.5")} />
            </button>
          </div>
        ))}
        {webhooks.length === 0 && <p className="px-5 py-10 text-center text-sm text-ink-soft">No endpoints yet.</p>}
      </div>

      <div>
        <h3 className="mb-2 text-[13px] font-bold">Recent deliveries</h3>
        <div className="card divide-y divide-line/70">
          {deliveries.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-xs">
              <span className={cn("size-2 rounded-full", d.status === "delivered" ? "bg-emerald-500" : d.status === "failed" ? "bg-red-500" : "bg-amber-500")} />
              <code className="font-mono font-semibold">{d.event}</code>
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-soft">{d.url}</span>
              <span className="text-ink-soft">HTTP {d.responseCode ?? "—"}</span>
              <span className="text-ink-soft/80">{timeAgo(d.at)}</span>
            </div>
          ))}
          {deliveries.length === 0 && <p className="px-5 py-8 text-center text-xs text-ink-soft">No deliveries yet — they appear the moment events fire.</p>}
        </div>
      </div>
    </div>
  );
}

/* ================= IMPORT ================= */

const SAMPLE_CSV = `name,email,phone,lead_source,tags,address,city,postal
"Dana Whitfield",dana.w@gmail.com,(416) 555-0172,Referral,Repeat | VIP,12 Vine Ave,Toronto,M6P 1V7
"Ross McAllister",ross.mac@outlook.com,(647) 555-0133,Google,New,401 Pacific Ave,Toronto,M6P 2R4`;

function ImportTab() {
  const router = useRouter();
  const [csv, setCsv] = useState(SAMPLE_CSV);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rowCount = useMemo(() => Math.max(0, csv.split(/\r?\n/).filter((l) => l.trim()).length - 1), [csv]);

  function loadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(f);
  }

  async function run() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/clients/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Import failed."); return; }
    setResult(data);
    router.refresh();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[13px] font-bold">Paste your spreadsheet</h3>
          <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] font-bold text-ink-soft tnum">{rowCount} rows detected</span>
          <div className="ml-auto flex gap-2">
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-semibold transition hover:border-ink/40">
              <CloudUpload className="size-3.5" /> Upload .csv
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={loadFile} />
            <button onClick={() => setCsv(SAMPLE_CSV)} className="rounded-xl border border-line px-3 py-2 text-xs font-semibold transition hover:border-ink/40">
              Sample
            </button>
          </div>
        </div>
        <textarea
          value={csv}
          onChange={(e) => { setCsv(e.target.value); setResult(null); }}
          rows={12}
          className="mt-3 w-full resize-y rounded-2xl border border-line bg-canvas/60 p-4 font-mono text-[11.5px] leading-relaxed transition focus:border-ink focus:bg-white"
        />
        {error && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600">{error}</p>}
        {result && (
          <p className="mt-2 flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-[13px] font-semibold text-emerald-700 animate-pop">
            <Check className="size-4" /> Imported {result.added} client{result.added === 1 ? "" : "s"} — {result.skipped} skipped as duplicates.{" "}
            <Link href="/clients" className="ml-auto underline">View clients</Link>
          </p>
        )}
        <div className="mt-3 flex justify-end">
          <button onClick={run} disabled={busy || rowCount === 0} className="flex items-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-black disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
            Import {rowCount} clients
          </button>
        </div>

        <div className="mt-5 border-t border-line pt-5">
          <h3 className="text-[13px] font-bold">Export your client list</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            Downloads every client — contacts, lead source, tags and service addresses — in the exact
            spreadsheet format above, so it re-imports cleanly (here, Excel, Numbers or Google Sheets).
          </p>
          <button
            onClick={async () => (await import("@/lib/store")).downloadClientsCsv()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-white py-2.5 text-[13px] font-semibold transition hover:border-ink/40"
          >
            <FileDown className="size-4" /> Download clients.csv
          </button>
        </div>
      </div>

      <div className="card h-fit p-5">
        <h3 className="text-[13px] font-bold">Column format</h3>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">Header row required. Only <code className="rounded bg-black/5 px-1 font-mono">name</code> is mandatory — everything else is optional.</p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-ink p-3 font-mono text-[10px] leading-relaxed text-white/85">
{`name,email,phone,lead_source,
tags,address,city,postal`}
        </pre>
        <ul className="mt-3 space-y-1.5 text-[11.5px] leading-relaxed text-ink-soft">
          <li>• Duplicates on name + email are skipped safely.</li>
          <li>• Tags accept “|” or “;” separators.</li>
          <li>• Imported clients are tagged “Imported from spreadsheet” in their notes.</li>
          <li>• Exports from Jobber / Housecall Pro map cleanly to this shape.</li>
        </ul>
      </div>
    </div>
  );
}

/* ================= HOSTING ================= */

function HostingTab() {
  const backups = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(3, 15, 0, 0);
        return d;
      }),
    []
  );

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="space-y-5">
        <div className="card p-5">
          <h3 className="flex items-center gap-2 text-[13px] font-bold"><Globe className="size-4 text-accent-deep" /> Your hosting (your accounts)</h3>
          <div className="mt-3 space-y-2.5 text-[13px]">
            {[
              ["App server", "Vercel — your team account, auto-deploys from main"],
              ["Database", "Managed Postgres (Neon) — your account, Toronto region"],
              ["Domain & SSL", "crm.fixwell.ca — auto-renewed certificate (A+)"],
              ["Media/files", "Cloudflare R2 bucket, private with signed URLs"],
            ].map(([k, v]) => (
              <p key={k} className="flex items-start justify-between gap-4 border-b border-line/60 pb-2.5 last:border-0">
                <span className="shrink-0 font-semibold">{k}</span>
                <span className="text-right text-ink-soft">{v}</span>
              </p>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-700">
            <Lock className="size-3.5" /> SSL active — expires in 71 days, renews automatically.
          </p>
        </div>

        <div className="card p-5">
          <h3 className="flex items-center gap-2 text-[13px] font-bold"><HardDriveDownload className="size-4 text-accent-deep" /> Automatic daily backups</h3>
          <p className="mt-1 text-xs text-ink-soft">Point-in-time snapshots, kept 30 days, stored in your account.</p>
          <ul className="mt-3 divide-y divide-line/60">
            {backups.map((d, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5 text-[13px]">
                <span className="grid size-7 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><Check className="size-3.5" strokeWidth={3} /></span>
                <span className="font-mono text-xs font-semibold">fixwell-{d.toISOString().slice(0, 10)}.dump</span>
                <span className="ml-auto text-xs text-ink-soft">{fmtDate(d)} · 03:15 · 18.4 MB</span>
              </li>
            ))}
          </ul>
          <button className="mt-3 w-full rounded-xl border border-line py-2.5 text-[13px] font-semibold transition hover:border-ink/40">
            Restore a previous day…
          </button>
        </div>
      </div>

      <div className="card h-fit p-5">
        <h3 className="text-[13px] font-bold">Handover pack — training & docs</h3>
        <p className="mt-1 text-xs text-ink-soft">How-to recordings and the technical README that ship with the system.</p>
        <div className="mt-4 space-y-3">
          {[
            ["Full live walkthrough (22 min)", "Every screen, end to end", 9],
            ["Office: quotes, forms & the board (8 min)", "For whoever runs the desk", 10],
            ["Crew: phone day-view & on-site signing (6 min)", "For the field team", 11],
          ].map(([title, sub, photo], i) => (
            <button key={i} className="group relative flex w-full items-center gap-3.5 overflow-hidden rounded-2xl border border-line p-2.5 text-left transition hover:border-ink/30">
              <span className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={WORK_PHOTOS[photo as number]} alt="" className="size-full object-cover transition duration-500 group-hover:scale-105" />
                <span className="absolute inset-0 grid place-items-center bg-ink/45">
                  <PlayCircle className="size-6 text-white" />
                </span>
              </span>
              <span>
                <span className="block text-[13px] font-bold">{title}</span>
                <span className="block text-xs text-ink-soft">{sub}</span>
              </span>
            </button>
          ))}
        </div>
        <Link href="/docs" className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-ink py-2.5 text-[13px] font-semibold text-white transition hover:bg-black">
          <BookOpen className="size-4" /> Technical documentation
        </Link>
      </div>
    </div>
  );
}
