"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  CloudDownload,
  Copy,
  ExternalLink,
  FileSignature,
  History,
  ImageIcon,
  KanbanSquare,
  Loader2,
  MapPin,
  Receipt,
  Save,
  Send,
  ShieldCheck,
  StickyNote,
  X,
} from "lucide-react";
import { APPOINTMENT_TYPES, FORM_PHASES, STAGES, STAGE_MAP, type StageKey } from "@/lib/constants";
import type { AuditEvent, LineItem } from "@/lib/model";
import LineItemsEditor from "@/components/line-items-editor";
import SendFormModal from "@/components/send-form-modal";
import { cn, fmtDate, fmtDateTime, fmtTime, money, timeAgo } from "@/lib/utils";

type JobForm = {
  id: number; token: string; templateKey: string; templateLabel: string;
  status: string; channel: string; recipient: string | null;
  sentAt: string; signedAt: string | null;
  signerName: string | null; signerIp: string | null; clientNote: string | null;
  events: AuditEvent[];
};

const TABS = [
  { key: "overview", label: "Overview", icon: StickyNote },
  { key: "estimate", label: "Estimate", icon: Receipt },
  { key: "forms", label: "Forms", icon: FileSignature },
  { key: "photos", label: "Photos", icon: ImageIcon },
  { key: "activity", label: "Activity", icon: History },
] as const;

const STEP_KEYS: StageKey[] = ["lead", "quoted", "approved", "scheduled", "completed", "paid"];

export default function JobView(props: {
  job: {
    id: number; title: string; serviceType: string; stage: string;
    address: string | null; description: string | null;
    lineItems: LineItem[]; assigneeId: number | null;
    lostReason: string | null; scheduledStart: string | null; createdAt: string;
  };
  client: { id: number; name: string; email: string | null; phone: string | null; address: { label: string; line1: string; city: string; province: string; postal: string } | null };
  forms: JobForm[];
  appointments: { id: number; title: string; type: string; startsAt: string; endsAt: string; assigneeName: string | null; assigneeColor: string | null; status: string }[];
  activities: { id: number; message: string; kind: string; at: string; userName: string | null; userColor: string | null }[];
  photos: { id: number; url: string; caption: string | null }[];
  team: { id: number; name: string; color: string; role: string }[];
  templates: { key: string; name: string; description: string; nextStage: string | null }[];
}) {
  const { job, client, forms, appointments, activities, photos, team, templates } = props;
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overview");
  const [stageBusy, setStageBusy] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [items, setItems] = useState<LineItem[]>(job.lineItems);
  const [dirty, setDirty] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  const curIdx = STEP_KEYS.indexOf(job.stage as StageKey);
  const isLost = job.stage === "lost";

  async function setStage(stage: string, reason?: string) {
    setStageBusy(true);
    await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage, lostReason: reason }),
    });
    setStageBusy(false);
    setLostOpen(false);
    router.refresh();
  }

  async function saveItems() {
    setSaveBusy(true);
    await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineItems: items }),
    });
    setSaveBusy(false);
    setDirty(false);
    router.refresh();
  }

  async function setAssignee(id: string) {
    await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeId: id ? Number(id) : null }),
    });
    router.refresh();
  }

  const next = !isLost && curIdx < STEP_KEYS.length - 1 ? STEP_KEYS[curIdx + 1] : null;

  return (
    <div className="space-y-5 animate-rise">
      <Link href="/pipeline" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft transition hover:text-ink">
        <ArrowLeft className="size-4" /> Pipeline
      </Link>

      {/* ---------- Header ---------- */}
      <div className="card overflow-hidden">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{job.title}</h2>
                <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", STAGE_MAP[job.stage as StageKey]?.soft, STAGE_MAP[job.stage as StageKey]?.text)}>
                  {STAGE_MAP[job.stage as StageKey]?.label}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] text-ink-soft">
                <Link href={`/clients/${client.id}`} className="font-semibold text-ink hover:text-accent-deep hover:underline">{client.name}</Link>
                {" · "}{job.serviceType} · opened {fmtDate(job.createdAt)}
              </p>
              {job.address && (
                <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-soft">
                  <MapPin className="size-3.5" /> {job.address}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSendOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-black"
              >
                <FileSignature className="size-3.5" /> Send form
              </button>
              <Link
                href={`/calendar?new=1&client=${client.id}&job=${job.id}`}
                className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-semibold transition hover:border-ink/40"
              >
                <CalendarDays className="size-3.5" /> Schedule visit
              </Link>
              {next && (
                <button
                  onClick={() => setStage(next)}
                  disabled={stageBusy}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {stageBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  Move to {STAGE_MAP[next].label}
                </button>
              )}
              {!isLost && (
                <button
                  onClick={() => setLostOpen((v) => !v)}
                  className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                >
                  <X className="size-3.5" /> Lost
                </button>
              )}
            </div>
          </div>

          {lostOpen && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 animate-pop">
              <input
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="Why did we lose it? (price, timing, went with someone else…)"
                className="min-w-0 flex-1 rounded-xl border border-red-200 bg-white px-3.5 py-2.5 text-sm"
              />
              <button
                onClick={() => setStage("lost", lostReason || "No reason recorded")}
                disabled={stageBusy}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-red-700"
              >
                Mark as lost
              </button>
            </div>
          )}

          {isLost && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700">
              <CircleAlert className="size-4" /> Lost{job.lostReason ? ` — ${job.lostReason}` : ""}.
              <button onClick={() => setStage("lead")} className="ml-auto font-bold underline">Re-open as lead</button>
            </div>
          )}
        </div>

        {/* Stage stepper */}
        {!isLost && (
          <div className="no-scrollbars flex items-stretch gap-0 overflow-x-auto border-t border-line bg-canvas/60 px-3 py-3">
            {STEP_KEYS.map((key, i) => {
              const s = STAGE_MAP[key];
              const state = i < curIdx ? "done" : i === curIdx ? "current" : "todo";
              return (
                <button
                  key={key}
                  onClick={() => setStage(key)}
                  disabled={stageBusy}
                  className={cn(
                    "group relative flex min-w-[116px] flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-bold transition",
                    state === "done" && "text-emerald-700 hover:bg-emerald-50",
                    state === "current" && "bg-white shadow-card text-ink ring-1 ring-line",
                    state === "todo" && "text-ink-soft/50 hover:bg-white/70 hover:text-ink-soft"
                  )}
                >
                  {state === "done" ? (
                    <span className="grid size-5 place-items-center rounded-full bg-emerald-500 text-white"><Check className="size-3" strokeWidth={3} /></span>
                  ) : (
                    <span
                      className={cn("grid size-5 place-items-center rounded-full text-[10px] font-bold ring-2", state === "current" ? "text-white" : "bg-white text-ink-soft")}
                      style={{ background: state === "current" ? s.color : undefined, ["--tw-ring-color" as string]: s.color } as React.CSSProperties}
                    >
                      {i + 1}
                    </span>
                  )}
                  {s.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------- Tabs ---------- */}
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
            {t.key === "forms" && forms.length > 0 && (
              <span className={cn("rounded-full px-1.5 text-[10px] font-bold tnum", tab === "forms" ? "bg-white/15" : "bg-canvas text-ink-soft")}>{forms.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ---------- Overview ---------- */}
      {tab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-2 animate-fade">
          <div className="card p-5">
            <h3 className="text-[13px] font-bold uppercase tracking-[0.1em] text-ink-soft">Scope</h3>
            <p className="mt-2 text-[14px] leading-relaxed">{job.description ?? "No description yet."}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft">Lead tech</label>
                <select
                  value={job.assigneeId ?? ""}
                  onChange={(e) => setAssignee(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm transition focus:border-ink"
                >
                  <option value="">Unassigned</option>
                  {team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft">Client contact</p>
                <p className="mt-1.5 text-sm">{client.phone ?? "—"}</p>
                <p className="text-sm text-ink-soft">{client.email ?? ""}</p>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-bold uppercase tracking-[0.1em] text-ink-soft">Visits</h3>
              <Link href={`/calendar?new=1&client=${client.id}&job=${job.id}`} className="text-xs font-semibold text-accent-deep hover:underline">
                + Book visit
              </Link>
            </div>
            <div className="mt-3 space-y-2.5">
              {appointments.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl border border-line bg-canvas/50 px-3.5 py-3">
                  <span className="h-9 w-1 rounded-full" style={{ background: a.assigneeColor ?? "#cbd5e1" }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{a.title}</p>
                    <p className="text-[11px] text-ink-soft">
                      {APPOINTMENT_TYPES[a.type]?.label ?? a.type} · {fmtDate(a.startsAt)} {fmtTime(a.startsAt)}–{fmtTime(a.endsAt)}
                      {a.assigneeName ? ` · ${a.assigneeName}` : ""}
                    </p>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", a.status === "done" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700")}>
                    {a.status}
                  </span>
                </div>
              ))}
              {appointments.length === 0 && <p className="py-6 text-center text-[13px] text-ink-soft">No visits booked yet.</p>}
            </div>
          </div>
        </div>
      )}

      {/* ---------- Estimate ---------- */}
      {tab === "estimate" && (
        <div className="card p-5 animate-fade sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-[15px] font-bold">Estimate</h3>
              <p className="text-xs text-ink-soft">Labour &amp; materials · HST 13% auto · flows into every form and quote</p>
            </div>
            <button
              onClick={saveItems}
              disabled={!dirty || saveBusy}
              className="flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white transition hover:bg-black disabled:opacity-40"
            >
              {saveBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              {dirty ? "Save changes" : "Saved"}
            </button>
          </div>
          <LineItemsEditor
            items={items}
            onChange={(v) => { setItems(v); setDirty(true); }}
          />
        </div>
      )}

      {/* ---------- Forms ---------- */}
      {tab === "forms" && (
        <div className="space-y-3 animate-fade">
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-ink-soft">Signed PDFs and the audit trail file themselves here and on the client record.</p>
            <button onClick={() => setSendOpen(true)} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white transition hover:bg-black">
              <Send className="size-3.5" /> Send form
            </button>
          </div>
          {forms.map((f) => <FormCard key={f.id} f={f} />)}
          {forms.length === 0 && (
            <div className="card flex flex-col items-center gap-2 py-14 text-center">
              <FileSignature className="size-8 text-line" strokeWidth={1.6} />
              <p className="text-sm font-semibold">No forms sent for this job yet</p>
              <p className="max-w-72 text-xs text-ink-soft">Send the work authorization to get sign-off, or open a signing link on-site on your phone.</p>
            </div>
          )}
        </div>
      )}

      {/* ---------- Photos ---------- */}
      {tab === "photos" && (
        <div className="animate-fade">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {photos.map((p) => (
              <figure key={p.id} className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-canvas">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption ?? "Job photo"} className="size-full object-cover transition duration-500 group-hover:scale-105" />
                {p.caption && (
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent px-3 pb-2.5 pt-8 text-[11px] font-semibold text-white">{p.caption}</figcaption>
                )}
              </figure>
            ))}
          </div>
          <JobPhotoAdder clientId={client.id} jobId={job.id} />
        </div>
      )}

      {/* ---------- Activity ---------- */}
      {tab === "activity" && (
        <div className="card p-5 animate-fade sm:p-6">
          <ol className="relative space-y-5 border-l-2 border-line pl-6">
            {activities.map((a) => (
              <li key={a.id} className="relative">
                <span
                  className="absolute -left-[35px] grid size-6 place-items-center rounded-full text-[9px] font-bold text-white ring-4 ring-paper"
                  style={{ background: a.userColor ?? "#94a3b8" }}
                >
                  {a.userName ? a.userName.split(" ").map((p) => p[0]).slice(0, 2).join("") : "SY"}
                </span>
                <p className="text-[13px]"><span className="font-semibold">{a.userName ?? "System"}</span> <span className="text-ink-soft">— {a.message}</span></p>
                <p className="mt-0.5 text-[11px] text-ink-soft/70">{timeAgo(a.at)} · {fmtDateTime(a.at)}</p>
              </li>
            ))}
            {activities.length === 0 && <p className="text-sm text-ink-soft">Nothing logged yet.</p>}
          </ol>
        </div>
      )}

      {sendOpen && (
        <SendFormModal
          jobs={[{ id: job.id, title: job.title, clientName: client.name, clientEmail: client.email, clientPhone: client.phone, stage: job.stage }]}
          templates={templates}
          presetJobId={job.id}
          onClose={() => { setSendOpen(false); router.refresh(); }}
        />
      )}
    </div>
  );
}

/* ---------- Form card with audit trail ---------- */

function FormCard({ f }: { f: JobForm }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/sign/${f.token}` : `/sign/${f.token}`;
  const nextStage = FORM_PHASES[f.templateKey]?.nextStage;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn(
          "grid size-10 place-items-center rounded-2xl",
          f.status === "signed" ? "bg-emerald-50 text-emerald-600" : "bg-violet-50 text-violet-600"
        )}>
          {f.status === "signed" ? <BadgeCheck className="size-5" /> : <FileSignature className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{f.templateLabel}</p>
          <p className="text-xs text-ink-soft">
            {f.status === "signed"
              ? `Signed by ${f.signerName} · ${fmtDateTime(f.signedAt)} · IP ${f.signerIp}`
              : `Sent ${timeAgo(f.sentAt)} by ${f.channel === "sms" ? "text" : "email"} to ${f.recipient}`}
          </p>
        </div>
        <span className={cn(
          "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
          f.status === "signed" ? "bg-emerald-100 text-emerald-700" : f.status === "viewed" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
        )}>
          {f.status}
        </span>
      </div>

      {f.clientNote && (
        <p className="mt-3 rounded-xl bg-canvas px-3.5 py-2.5 text-xs italic text-ink-soft">“{f.clientNote}” — client note at signing</p>
      )}

      <div className="mt-3.5 flex flex-wrap gap-2">
        <a href={`/api/forms/${f.id}/pdf`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-xs font-semibold transition hover:border-ink/40">
          <CloudDownload className="size-3.5" /> PDF{f.status === "signed" ? " (signed)" : ""}
        </a>
        {f.status !== "signed" && (
          <>
            <button
              onClick={() => { navigator.clipboard.writeText(link).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1300); }}
              className="flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-xs font-semibold transition hover:border-ink/40"
            >
              <Copy className="size-3.5" /> {copied ? "Copied link" : "Copy link"}
            </button>
            <a href={link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-xs font-semibold transition hover:border-ink/40">
              <ExternalLink className="size-3.5" /> Open on this device
            </a>
          </>
        )}
        <button onClick={() => setOpen((v) => !v)} className="ml-auto flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-ink-soft transition hover:bg-canvas">
          <ShieldCheck className="size-3.5" /> Audit trail
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <ol className="mt-3 space-y-2 border-t border-line pt-3.5 animate-fade">
          {f.events.map((e, i) => (
            <li key={i} className="flex items-center gap-3 text-xs">
              <span className={cn(
                "size-2 rounded-full",
                e.event === "signed" ? "bg-emerald-500" : e.event === "viewed" ? "bg-blue-500" : "bg-amber-500"
              )} />
              <span className="w-16 font-bold capitalize">{e.event}</span>
              <span className="text-ink-soft tnum">{fmtDateTime(e.at)}</span>
              {e.ip && <span className="font-mono text-[10px] text-ink-soft/80">IP {e.ip}</span>}
              {e.meta && <span className="truncate text-ink-soft/70">{e.meta}</span>}
            </li>
          ))}
          {nextStage && f.status === "signed" && (
            <li className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700">
              <KanbanSquare className="size-3.5" /> Signature automatically moved the job to {nextStage}.
            </li>
          )}
        </ol>
      )}
    </div>
  );
}

function JobPhotoAdder({ clientId, jobId }: { clientId: number; jobId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        await fetch("/api/photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, jobId }),
        });
        setBusy(false);
        router.refresh();
      }}
      disabled={busy}
      className="mt-4 flex items-center gap-1.5 rounded-xl border border-dashed border-line px-4 py-2.5 text-xs font-semibold text-ink-soft transition hover:border-ink/40 hover:text-ink"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />} Add photo (demo pool)
    </button>
  );
}
