"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  FileSignature,
  ImageIcon,
  KanbanSquare,
  Loader2,
  Mail,
  MapPin,
  Paperclip,
  Phone,
  Plus,
  Send,
  StickyNote,
  Tag,
  User,
} from "lucide-react";
import { STAGE_MAP, type StageKey } from "@/lib/constants";
import { cn, fmtDate, fmtDateTime, fmtTime, money, timeAgo } from "@/lib/utils";
import { CopyButton } from "@/components/clients-view";

type JobLite = { id: number; title: string; serviceType: string; stage: string; total: number; updatedAt: string };
type TimelineItem = { kind: string; text: string; at: string; who: string };
type NoteLite = { id: number; body: string; at: string; userName: string; userColor: string; jobTitle: string | null };

const TABS = [
  { key: "jobs", label: "Jobs", icon: KanbanSquare },
  { key: "history", label: "History", icon: CalendarDays },
  { key: "notes", label: "Notes", icon: StickyNote },
  { key: "files", label: "Photos & files", icon: Paperclip },
] as const;

const TIMELINE_ICON: Record<string, typeof FileSignature> = {
  stage: KanbanSquare,
  form: FileSignature,
  "form-signed": FileSignature,
  note: StickyNote,
  photo: ImageIcon,
  invoice: Banknote,
};
const TIMELINE_BG: Record<string, string> = {
  stage: "bg-blue-50 text-blue-600",
  form: "bg-violet-50 text-violet-600",
  "form-signed": "bg-emerald-50 text-emerald-600",
  note: "bg-amber-50 text-amber-700",
  photo: "bg-cyan-50 text-cyan-600",
  invoice: "bg-emerald-50 text-emerald-600",
};

export default function ClientView(props: {
  client: {
    id: number; name: string; email: string | null; phone: string | null;
    leadSource: string; tags: string[];
    addresses: { label: string; line1: string; city: string; province: string; postal: string }[];
    notes: string | null; createdAt: string;
  };
  jobs: JobLite[];
  timeline: TimelineItem[];
  notes: NoteLite[];
  photos: { id: number; url: string; caption: string | null }[];
  upcoming: { title: string; startsAt: string; endsAt: string; assigneeName: string | null; jobId: number | null } | null;
  jobsForNotes: { id: number; title: string }[];
}) {
  const { client, jobs, timeline, notes, photos, upcoming, jobsForNotes } = props;
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("jobs");
  const activeJobs = jobs.filter((j) => j.stage !== "paid" && j.stage !== "lost");
  const billed = jobs.filter((j) => j.stage === "paid").reduce((s, j) => s + j.total, 0);

  return (
    <div className="space-y-5 animate-rise">
      <Link href="/clients" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft transition hover:text-ink">
        <ArrowLeft className="size-4" /> All clients
      </Link>

      {/* Header card */}
      <div className="card overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-accent via-amber-300 to-transparent" />
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-4">
              <span className="grid size-14 place-items-center rounded-2xl bg-ink font-display text-lg font-bold text-accent">
                {client.name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("")}
              </span>
              <div>
                <h2 className="font-display text-xl font-bold leading-tight">{client.name}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-canvas px-2.5 py-0.5 text-[11px] font-semibold text-ink-soft">
                    via {client.leadSource}
                  </span>
                  {client.tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                      <Tag className="size-2.5" />{t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {client.notes && (
              <p className="mt-4 rounded-xl bg-canvas px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-soft">
                {client.notes}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/pipeline?new=1&client=${client.id}`} className="flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-black">
                <Plus className="size-3.5" /> New job
              </Link>
              <Link href={`/calendar?new=1&client=${client.id}`} className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-semibold transition hover:border-ink/40">
                <CalendarDays className="size-3.5" /> Schedule
              </Link>
              <Link href={`/forms?send=1&client=${client.id}`} className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-semibold transition hover:border-ink/40">
                <Send className="size-3.5" /> Send form
              </Link>
            </div>
          </div>

          <div className="space-y-2.5 text-[13px]">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">Contact</p>
            {client.phone && (
              <p className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-ink"><Phone className="size-3.5 text-ink-soft" />{client.phone}</span>
                <CopyButton value={client.phone} />
              </p>
            )}
            {client.email && (
              <p className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-ink"><Mail className="size-3.5 shrink-0 text-ink-soft" /><span className="truncate">{client.email}</span></span>
                <CopyButton value={client.email} />
              </p>
            )}
            <div className="pt-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">Service addresses</p>
              <div className="mt-1.5 space-y-1.5">
                {client.addresses.map((a, i) => (
                  <p key={i} className="flex items-start gap-2 text-ink">
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-ink-soft" />
                    <span>{a.line1}, {a.city}, {a.province} {a.postal}
                      <span className="ml-1.5 rounded bg-canvas px-1.5 py-px text-[10px] font-bold text-ink-soft">{a.label}</span>
                    </span>
                  </p>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl bg-canvas p-3.5">
                <p className="font-display text-2xl font-bold tnum">{activeJobs.length}</p>
                <p className="text-[11px] font-semibold text-ink-soft">Active jobs</p>
              </div>
              <div className="rounded-2xl bg-canvas p-3.5">
                <p className="font-display text-2xl font-bold tnum">{money(billed)}</p>
                <p className="text-[11px] font-semibold text-ink-soft">Lifetime billed</p>
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-white p-3.5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft">
                <CalendarDays className="size-3.5" /> Next visit
              </p>
              {upcoming ? (
                <div className="mt-1.5">
                  <p className="text-[13px] font-semibold leading-snug">{upcoming.title}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {fmtDateTime(upcoming.startsAt)}{upcoming.assigneeName ? ` · ${upcoming.assigneeName}` : ""}
                  </p>
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-ink-soft">Nothing booked — schedule a visit.</p>
              )}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-ink-soft"><User className="size-3.5" /> Client since {fmtDate(client.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
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
            <span className={cn("rounded-full px-1.5 text-[10px] font-bold tnum", tab === t.key ? "bg-white/15" : "bg-canvas text-ink-soft")}>
              {t.key === "jobs" ? jobs.length : t.key === "history" ? timeline.length : t.key === "notes" ? notes.length : photos.length}
            </span>
          </button>
        ))}
      </div>

      {tab === "jobs" && <JobsTab jobs={jobs} />}
      {tab === "history" && <HistoryTab timeline={timeline} />}
      {tab === "notes" && <NotesTab clientId={client.id} notes={notes} jobs={jobsForNotes} />}
      {tab === "files" && <FilesTab clientId={client.id} photos={photos} />}
    </div>
  );
}

function JobsTab({ jobs }: { jobs: JobLite[] }) {
  if (jobs.length === 0)
    return <div className="card py-12 text-center text-sm text-ink-soft">No jobs yet — create one from the pipeline board.</div>;
  return (
    <div className="card divide-y divide-line/70">
      {jobs.map((j) => {
        const s = STAGE_MAP[j.stage as StageKey];
        return (
          <Link key={j.id} href={`/jobs/${j.id}`} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-canvas/60">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold group-hover:underline">{j.title}</p>
              <p className="text-xs text-ink-soft">{j.serviceType} · updated {timeAgo(j.updatedAt)}</p>
            </div>
            <span className={cn("hidden rounded-full px-2.5 py-1 text-[11px] font-bold sm:inline-flex", s?.soft, s?.text)}>
              <span className="mr-1.5 mt-[3px] size-1.5 rounded-full" style={{ background: s?.color }} />
              {s?.label ?? j.stage}
            </span>
            <span className="w-24 text-right font-display text-sm font-bold tnum">{money(j.total)}</span>
          </Link>
        );
      })}
    </div>
  );
}

function HistoryTab({ timeline }: { timeline: TimelineItem[] }) {
  return (
    <div className="card p-5 sm:p-6">
      <ol className="relative space-y-5 border-l-2 border-line pl-6">
        {timeline.map((t, i) => {
          const Icon = TIMELINE_ICON[t.kind] ?? CalendarDays;
          const bg = TIMELINE_BG[t.kind] ?? "bg-canvas text-ink-soft";
          return (
            <li key={i} className="relative animate-rise" style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}>
              <span className={cn("absolute -left-[35px] grid size-6 place-items-center rounded-full ring-4 ring-paper", bg)}>
                <Icon className="size-3" />
              </span>
              <p className="text-[13px] leading-snug"><span className="font-semibold">{t.who}</span> <span className="text-ink-soft">— {t.text}</span></p>
              <p className="mt-0.5 text-[11px] text-ink-soft/70">{fmtDateTime(t.at)}</p>
            </li>
          );
        })}
        {timeline.length === 0 && <p className="text-sm text-ink-soft">No activity yet.</p>}
      </ol>
    </div>
  );
}

function NotesTab({ clientId, notes, jobs }: { clientId: number; notes: NoteLite[]; jobs: { id: number; title: string }[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [jobId, setJobId] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, jobId: jobId ? Number(jobId) : null, body }),
    });
    setBody("");
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        {notes.map((n) => (
          <div key={n.id} className="card p-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-7 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: n.userColor }}>
                {n.userName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </span>
              <p className="text-[13px] font-semibold">{n.userName}</p>
              {n.jobTitle && <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] font-semibold text-ink-soft">{n.jobTitle}</span>}
              <span className="ml-auto text-[11px] text-ink-soft/80">{timeAgo(n.at)}</span>
            </div>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink">{n.body}</p>
          </div>
        ))}
        {notes.length === 0 && <div className="card py-12 text-center text-sm text-ink-soft">No notes yet — add the first one.</div>}
      </div>
      <form onSubmit={add} className="card h-fit space-y-3 p-4 lg:sticky lg:top-24">
        <p className="text-[13px] font-bold">Add a note</p>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder="Gate codes, preferences, promises made on the phone…"
          className="w-full resize-none rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm transition focus:border-ink"
        />
        <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm transition focus:border-ink">
          <option value="">Not tied to a job</option>
          {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
        <button disabled={busy || !body.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-2.5 text-[13px] font-semibold text-white transition hover:bg-black disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Save note
        </button>
      </form>
    </div>
  );
}

function FilesTab({ clientId, photos }: { clientId: number; photos: { id: number; url: string; caption: string | null }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function addPhoto() {
    setBusy(true);
    await fetch("/api/photos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[13px] text-ink-soft">{photos.length} photo{photos.length === 1 ? "" : "s"} &amp; files on this record</p>
        <button onClick={addPhoto} disabled={busy} className="flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-black disabled:opacity-60">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />} Add photo
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {photos.map((p, i) => (
          <figure key={p.id} className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-canvas animate-rise" style={{ animationDelay: `${i * 40}ms` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.caption ?? "Job photo"} className="size-full object-cover transition duration-500 group-hover:scale-105" />
            {p.caption && (
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent px-3 pb-2.5 pt-8 text-[11px] font-semibold text-white">
                {p.caption}
              </figcaption>
            )}
          </figure>
        ))}
        {photos.length === 0 && (
          <div className="col-span-full card flex flex-col items-center gap-2 py-14 text-center">
            <ImageIcon className="size-7 text-line" />
            <p className="text-sm font-semibold">Nothing attached yet</p>
            <p className="text-xs text-ink-soft">Crew photos and signed PDFs land here automatically.</p>
          </div>
        )}
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-ink-soft">
        <FileSignature className="size-3.5" /> Signed form PDFs filed under each job card — see a job&rsquo;s Forms tab.
      </p>
    </div>
  );
}
