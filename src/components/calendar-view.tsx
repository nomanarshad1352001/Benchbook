"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  PhoneCall,
  Plus,
  Ruler,
  Wrench,
  X,
} from "lucide-react";
import { cn, fmtTime } from "@/lib/utils";

export type Appt = {
  id: number; title: string; type: string;
  startsAt: string; endsAt: string; notes: string | null; status: string;
  clientId: number; clientName: string;
  jobId: number | null; jobTitle: string | null;
  assigneeId: number | null; assigneeName: string; assigneeColor: string;
};

type Team = { id: number; name: string; color: string; role: string };
type ClientOpt = { id: number; name: string };
type JobOpt = { id: number; title: string; clientId: number };

const DAY_START = 7; // 7 AM
const DAY_END = 20; // 8 PM
const PX_PER_HOUR = 56;
const TYPE_ICON: Record<string, typeof Wrench> = { estimate: Ruler, job: Wrench, callback: PhoneCall };

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
const DAY_FMT = new Intl.DateTimeFormat("en-CA", { weekday: "short", day: "numeric" });
const MONTH_FMT = new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric" });

type View = "day" | "week" | "month";

export default function CalendarView(props: {
  appointments: Appt[];
  team: Team[];
  clients: ClientOpt[];
  jobs: JobOpt[];
  openNew: boolean;
  presetClientId: number | null;
  presetJobId: number | null;
}) {
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(() => new Date());
  const [filter, setFilter] = useState<number[]>([]);
  const [selected, setSelected] = useState<Appt | null>(null);
  const [showNew, setShowNew] = useState(props.openNew);

  const appts = useMemo(
    () => props.appointments.filter((a) => filter.length === 0 || (a.assigneeId != null && filter.includes(a.assigneeId))),
    [props.appointments, filter]
  );

  function shift(dir: number) {
    setCursor((c) => {
      if (view === "day") return addDays(c, dir);
      if (view === "week") return addDays(c, dir * 7);
      const x = new Date(c);
      x.setMonth(x.getMonth() + dir);
      return x;
    });
  }

  const title =
    view === "month"
      ? MONTH_FMT.format(cursor)
      : view === "day"
        ? cursor.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })
        : `${DAY_FMT.format(startOfWeek(cursor))} – ${DAY_FMT.format(addDays(startOfWeek(cursor), 6))}, ${startOfWeek(cursor).getFullYear()}`;

  return (
    <div className="space-y-4 animate-rise">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center rounded-xl border border-line bg-white p-1">
          <button onClick={() => shift(-1)} className="grid size-8 place-items-center rounded-lg transition hover:bg-canvas"><ChevronLeft className="size-4" /></button>
          <button onClick={() => setCursor(new Date())} className="rounded-lg px-3 py-1.5 text-xs font-bold transition hover:bg-canvas">Today</button>
          <button onClick={() => shift(1)} className="grid size-8 place-items-center rounded-lg transition hover:bg-canvas"><ChevronRight className="size-4" /></button>
        </div>
        <h2 className="font-display text-[15px] font-bold sm:text-lg">{title}</h2>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-xl border border-line bg-white p-1">
            {(["day", "week", "month"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-xs font-bold capitalize transition",
                  view === v ? "bg-ink text-white" : "text-ink-soft hover:bg-canvas"
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-black"
          >
            <Plus className="size-3.5" /> <span className="hidden sm:inline">Book visit</span>
          </button>
        </div>
      </div>

      {/* Crew filter */}
      <div className="no-scrollbars flex gap-2 overflow-x-auto pb-1">
        {props.team.map((t) => {
          const on = filter.length === 0 || filter.includes(t.id);
          return (
            <button
              key={t.id}
              onClick={() =>
                setFilter((f) => (f.includes(t.id) ? f.filter((x) => x !== t.id) : [...f, t.id]))
              }
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                on ? "border-transparent bg-white shadow-card" : "border-line bg-white/50 opacity-50"
              )}
            >
              <span className="size-2.5 rounded-full" style={{ background: t.color }} />
              {t.name.split(" ")[0]}
            </button>
          );
        })}
        {filter.length > 0 && (
          <button onClick={() => setFilter([])} className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-accent-deep hover:underline">
            Show everyone
          </button>
        )}
      </div>

      {/* Views */}
      {view === "month" ? (
        <MonthGrid cursor={cursor} appts={appts} onPick={(a) => setSelected(a)} onDay={(d) => { setCursor(d); setView("day"); }} />
      ) : (
        <TimeGrid cursor={cursor} view={view} appts={appts} onPick={setSelected} />
      )}

      {selected && <ApptDetail appt={selected} onClose={() => setSelected(null)} />}
      {showNew && (
        <NewAppointmentModal
          clients={props.clients}
          jobs={props.jobs}
          team={props.team}
          presetClientId={props.presetClientId}
          presetJobId={props.presetJobId}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

/* ---------------- Time grid (day & week) ---------------- */

function TimeGrid({ cursor, view, appts, onPick }: { cursor: Date; view: View; appts: Appt[]; onPick: (a: Appt) => void }) {
  const days = view === "day" ? [cursor] : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i));
  const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
  const height = (DAY_END - DAY_START) * PX_PER_HOUR;
  const today = new Date();
  const nowTop = ((today.getHours() + today.getMinutes() / 60) - DAY_START) * PX_PER_HOUR;

  return (
    <div className="card overflow-hidden">
      <div className="thin-scroll overflow-x-auto">
        <div className={cn("min-w-[640px]", view === "week" && "min-w-[860px]")}>
          {/* header */}
          <div className="grid border-b border-line" style={{ gridTemplateColumns: `52px repeat(${days.length}, 1fr)` }}>
            <div className="border-r border-line" />
            {days.map((d, i) => (
              <div key={i} className={cn("border-r border-line px-2 py-2.5 text-center last:border-r-0", sameDay(d, today) && "bg-amber-50/60")}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">{d.toLocaleDateString("en-CA", { weekday: "short" })}</p>
                <p className={cn(
                  "mx-auto mt-0.5 grid size-7 place-items-center rounded-full font-display text-sm font-bold tnum",
                  sameDay(d, today) && "bg-ink text-white"
                )}>
                  {d.getDate()}
                </p>
              </div>
            ))}
          </div>

          {/* body */}
          <div className="relative grid" style={{ gridTemplateColumns: `52px repeat(${days.length}, 1fr)` }}>
            {/* gutter */}
            <div className="relative border-r border-line" style={{ height }}>
              {hours.map((h) => (
                <span key={h} className="absolute right-2 -translate-y-1/2 text-[10px] font-semibold text-ink-soft/70 tnum" style={{ top: (h - DAY_START) * PX_PER_HOUR }}>
                  {h > 12 ? `${h - 12}pm` : h === 12 ? "12pm" : `${h}am`}
                </span>
              ))}
            </div>
            {days.map((d, di) => {
              const dayAppts = appts.filter((a) => sameDay(new Date(a.startsAt), d) && a.status !== "cancelled");
              return (
                <div key={di} className={cn("relative border-r border-line last:border-r-0", sameDay(d, today) && "bg-amber-50/40")} style={{ height }}>
                  {hours.map((h) => (
                    <div key={h} className="absolute inset-x-0 border-t border-line/60" style={{ top: (h - DAY_START) * PX_PER_HOUR }} />
                  ))}
                  {sameDay(d, today) && nowTop > 0 && nowTop < height && (
                    <div className="absolute inset-x-0 z-10 border-t-2 border-red-500" style={{ top: nowTop }}>
                      <span className="absolute -left-1 -top-1 size-2 rounded-full bg-red-500" />
                    </div>
                  )}
                  {dayAppts.map((a) => {
                    const s = new Date(a.startsAt);
                    const e = new Date(a.endsAt);
                    const top = Math.max(0, ((s.getHours() + s.getMinutes() / 60) - DAY_START) * PX_PER_HOUR);
                    const h = Math.max(26, ((e.getTime() - s.getTime()) / 3600000) * PX_PER_HOUR);
                    const Icon = TYPE_ICON[a.type] ?? Wrench;
                    return (
                      <button
                        key={a.id}
                        onClick={() => onPick(a)}
                        className="absolute inset-x-1 z-[5] overflow-hidden rounded-lg border-l-4 bg-white p-1.5 text-left shadow-card transition hover:shadow-lift sm:inset-x-1.5"
                        style={{ top: top + 1, height: h - 3, borderColor: a.assigneeColor }}
                      >
                        <p className={cn("flex items-center gap-1 truncate text-[11px] font-bold leading-tight", a.status === "done" && "line-through opacity-60")}>
                          <Icon className="size-3 shrink-0" style={{ color: a.assigneeColor }} />
                          {a.title}
                        </p>
                        {h > 46 && (
                          <p className="mt-0.5 truncate text-[10px] text-ink-soft tnum">
                            {fmtTime(a.startsAt)}–{fmtTime(a.endsAt)} · {a.clientName}
                          </p>
                        )}
                        {h > 66 && <p className="truncate text-[10px] text-ink-soft/80">{a.assigneeName}</p>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Month grid ---------------- */

function MonthGrid({ cursor, appts, onPick, onDay }: { cursor: Date; appts: Appt[]; onPick: (a: Appt) => void; onDay: (d: Date) => void }) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const today = new Date();

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line bg-canvas/60">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <p key={d} className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-ink-soft">{d}</p>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const dayAppts = appts.filter((a) => sameDay(new Date(a.startsAt), d));
          return (
            <div
              key={i}
              onClick={() => onDay(d)}
              className={cn(
                "min-h-[88px] cursor-pointer border-b border-r border-line/70 p-1.5 transition hover:bg-canvas/60 sm:min-h-[112px]",
                !inMonth && "bg-black/[0.015] text-ink-soft/40",
                i % 7 === 6 && "border-r-0",
                i >= 35 && "border-b-0"
              )}
            >
              <p className={cn(
                "grid size-6 place-items-center rounded-full text-xs font-bold tnum",
                sameDay(d, today) ? "bg-ink text-white" : inMonth ? "text-ink" : "text-ink-soft/50"
              )}>
                {d.getDate()}
              </p>
              <div className="mt-1 space-y-1">
                {dayAppts.slice(0, 3).map((a) => (
                  <button
                    key={a.id}
                    onClick={(e) => { e.stopPropagation(); onPick(a); }}
                    className="block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[10px] font-semibold text-white transition hover:opacity-85"
                    style={{ background: a.assigneeColor }}
                  >
                    {fmtTime(a.startsAt)} {a.title}
                  </button>
                ))}
                {dayAppts.length > 3 && (
                  <p className="px-1 text-[10px] font-semibold text-ink-soft">+{dayAppts.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Detail popover ---------------- */

function ApptDetail({ appt, onClose }: { appt: Appt; onClose: () => void }) {
  const Icon = TYPE_ICON[appt.type] ?? Wrench;
  const d = new Date(appt.startsAt);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4 backdrop-blur-sm animate-fade" onMouseDown={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-lift animate-pop" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <span className="grid size-11 place-items-center rounded-2xl" style={{ background: `${appt.assigneeColor}1a`, color: appt.assigneeColor }}>
            <Icon className="size-5" />
          </span>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-ink-soft transition hover:bg-canvas"><X className="size-4" /></button>
        </div>
        <h3 className="mt-3 font-display text-lg font-bold leading-snug">{appt.title}</h3>
        <div className="mt-3 space-y-2 text-[13px]">
          <p className="flex items-center justify-between border-b border-line/70 py-2">
            <span className="text-ink-soft">When</span>
            <span className="font-semibold tnum">
              {d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })} · {fmtTime(appt.startsAt)}–{fmtTime(appt.endsAt)}
            </span>
          </p>
          <p className="flex items-center justify-between border-b border-line/70 py-2">
            <span className="text-ink-soft">Client</span>
            <Link href={`/clients/${appt.clientId}`} className="font-semibold text-accent-deep hover:underline">{appt.clientName}</Link>
          </p>
          <p className="flex items-center justify-between border-b border-line/70 py-2">
            <span className="text-ink-soft">Crew member</span>
            <span className="flex items-center gap-1.5 font-semibold">
              <span className="size-2.5 rounded-full" style={{ background: appt.assigneeColor }} />
              {appt.assigneeName}
            </span>
          </p>
          <p className="flex items-center justify-between py-2">
            <span className="text-ink-soft">Type</span>
            <span className="font-semibold capitalize">{appt.type === "estimate" ? "Estimate visit" : appt.type}</span>
          </p>
        </div>
        {appt.notes && (
          <p className="mt-1 flex items-start gap-2 rounded-xl bg-canvas px-3 py-2.5 text-xs leading-relaxed text-ink-soft">
            <MapPin className="mt-0.5 size-3.5 shrink-0" /> {appt.notes}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          {appt.jobId && (
            <Link href={`/jobs/${appt.jobId}`} className="flex-1 rounded-xl bg-ink py-2.5 text-center text-[13px] font-semibold text-white transition hover:bg-black">
              Open job card
            </Link>
          )}
          <Link href={`/clients/${appt.clientId}`} className="flex-1 rounded-xl border border-line py-2.5 text-center text-[13px] font-semibold transition hover:border-ink/40">
            Client profile
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---------------- New appointment ---------------- */

function NewAppointmentModal({
  clients, jobs, team, presetClientId, presetJobId, onClose,
}: {
  clients: ClientOpt[]; jobs: JobOpt[]; team: Team[];
  presetClientId: number | null; presetJobId: number | null; onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [f, setF] = useState({
    clientId: presetClientId ? String(presetClientId) : "",
    jobId: presetJobId ? String(presetJobId) : "",
    title: "",
    type: "job",
    date: tomorrow.toISOString().slice(0, 10),
    start: "09:00",
    end: "11:00",
    assigneeId: "",
    notes: "",
  });

  const clientJobs = jobs.filter((j) => j.clientId === Number(f.clientId));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: Number(f.clientId),
          jobId: f.jobId ? Number(f.jobId) : null,
          title: f.title,
          type: f.type,
          startsAt: new Date(`${f.date}T${f.start}`).toISOString(),
          endsAt: new Date(`${f.date}T${f.end}`).toISOString(),
          assigneeId: f.assigneeId ? Number(f.assigneeId) : null,
          notes: f.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not book the visit.");
        return;
      }
      onClose();
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
          <div>
            <h2 className="font-display text-lg font-bold">Book a visit</h2>
            <p className="text-xs text-ink-soft">Internal scheduling — clients never book themselves.</p>
          </div>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-ink-soft transition hover:bg-canvas"><X className="size-4" /></button>
        </div>
        <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-ink-soft">Client *</label>
            <select required value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value, jobId: "" })} className={cn(field, "mt-1")}>
              <option value="" disabled>Select…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-soft">Linked job</label>
            <select value={f.jobId} onChange={(e) => setF({ ...f, jobId: e.target.value })} className={cn(field, "mt-1")}>
              <option value="">None / phone call</option>
              {clientJobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-ink-soft">Title *</label>
            <input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={cn(field, "mt-1")} placeholder="e.g. Estimate visit — deck boards" />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-soft">Type</label>
            <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className={cn(field, "mt-1")}>
              <option value="estimate">Estimate visit</option>
              <option value="job">Job</option>
              <option value="callback">Callback / phone</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-soft">Crew member</label>
            <select value={f.assigneeId} onChange={(e) => setF({ ...f, assigneeId: e.target.value })} className={cn(field, "mt-1")}>
              <option value="">Unassigned</option>
              {team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-soft">Date</label>
            <input type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={cn(field, "mt-1")} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-ink-soft">Start</label>
              <input type="time" required value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} className={cn(field, "mt-1")} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-soft">End</label>
              <input type="time" required value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} className={cn(field, "mt-1")} />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-ink-soft">Notes for the crew</label>
            <input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className={cn(field, "mt-1")} placeholder="Parking, keys, what to bring…" />
          </div>
          {error && <p className="sm:col-span-2 rounded-xl bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600">{error}</p>}
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold transition hover:bg-canvas">Cancel</button>
            <button disabled={busy} className="flex items-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-black disabled:opacity-60">
              {busy && <Loader2 className="size-4 animate-spin" />} Book it
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
