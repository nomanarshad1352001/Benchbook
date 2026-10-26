import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Briefcase,
  CalendarCheck2,
  CalendarClock,
  FileSignature,
  PhoneCall,
  Ruler,
  Wrench,
} from "lucide-react";
import { db } from "@/db";
import { activities, appointments, clients, forms, jobs, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { computeTotals } from "@/lib/ops";
import { FORM_PHASES, STAGES } from "@/lib/constants";
import { cn, fmtTime, money, moneyCompact, sameDay, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPE_ICON: Record<string, typeof Wrench> = { estimate: Ruler, job: Wrench, callback: PhoneCall };

export default async function DashboardPage() {
  const me = (await getSessionUser())!;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [allJobs, team] = await Promise.all([
    db.select().from(jobs),
    db.select().from(users),
  ]);
  const appts = await db
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
    .leftJoin(users, eq(appointments.assigneeId, users.id));

  const pendingForms = await db
    .select({ f: forms, jobTitle: jobs.title, clientName: clients.name })
    .from(forms)
    .innerJoin(jobs, eq(forms.jobId, jobs.id))
    .innerJoin(clients, eq(forms.clientId, clients.id));

  const acts = await db
    .select({ act: activities, userName: users.name, userColor: users.color })
    .from(activities)
    .leftJoin(users, eq(activities.userId, users.id));

  const activeJobs = allJobs.filter((j) => j.stage !== "paid" && j.stage !== "lost");
  const paidMTD = allJobs
    .filter((j) => j.stage === "paid" && new Date(j.updatedAt) >= monthStart)
    .reduce((s, j) => s + computeTotals(j.lineItems).total, 0);
  const today = appts
    .filter((r) => sameDay(new Date(r.a.startsAt), now) && r.a.status !== "cancelled")
    .sort((a, b) => +new Date(a.a.startsAt) - +new Date(b.a.startsAt));
  const pending = pendingForms.filter((r) => r.f.status !== "signed");
  const recentActs = acts
    .sort((a, b) => +new Date(b.act.createdAt) - +new Date(a.act.createdAt))
    .slice(0, 10);

  const stageValues = STAGES.filter((s) => s.key !== "lost").map((s) => ({
    ...s,
    count: allJobs.filter((j) => j.stage === s.key).length,
    value: allJobs
      .filter((j) => j.stage === s.key)
      .reduce((sum, j) => sum + computeTotals(j.lineItems).subtotal, 0),
  }));
  const maxStage = Math.max(...stageValues.map((s) => s.value), 1);

  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="animate-rise">
        <p className="text-[13px] font-medium text-ink-soft">
          {now.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {greeting}, {me.name.split(" ")[0]}<span className="text-accent">.</span>
        </h2>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 animate-rise [animation-delay:60ms] lg:grid-cols-4 lg:gap-4">
        {[
          { icon: Briefcase, label: "Active jobs", value: String(activeJobs.length), sub: `${new Set(activeJobs.map((j) => j.clientId)).size} clients on the books`, tone: "text-blue-600 bg-blue-50" },
          { icon: CalendarClock, label: "On today", value: String(today.length), sub: "appointments scheduled", tone: "text-amber-700 bg-amber-50" },
          { icon: FileSignature, label: "Awaiting signature", value: String(pending.length), sub: "forms out with clients", tone: "text-violet-600 bg-violet-50" },
          { icon: Banknote, label: "Collected this month", value: moneyCompact(paidMTD), sub: "incl. HST", tone: "text-emerald-600 bg-emerald-50" },
        ].map((k) => (
          <div key={k.label} className="card card-hover p-4 sm:p-5">
            <span className={cn("grid size-9 place-items-center rounded-xl", k.tone)}>
              <k.icon className="size-[18px]" />
            </span>
            <p className="mt-3 font-display text-[26px] font-bold leading-none tnum">{k.value}</p>
            <p className="mt-1.5 text-[13px] font-semibold">{k.label}</p>
            <p className="text-xs text-ink-soft">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        {/* Today's schedule */}
        <div className="card animate-rise [animation-delay:120ms] xl:col-span-3">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h3 className="font-display text-[15px] font-bold">Today&rsquo;s schedule</h3>
            <Link href="/calendar" className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent-deep hover:underline">
              Open calendar <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-line/70 px-2 py-1">
            {today.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <CalendarCheck2 className="size-8 text-line" strokeWidth={1.6} />
                <p className="text-sm font-semibold">Nothing on the books today</p>
                <p className="max-w-56 text-xs text-ink-soft">Enjoy the quiet — or book an estimate visit while the phone&rsquo;s slow.</p>
              </div>
            )}
            {today.map((r) => {
              const Icon = TYPE_ICON[r.a.type] ?? Wrench;
              return (
                <div key={r.a.id} className="flex items-center gap-3.5 px-3 py-3.5">
                  <div className="w-[76px] shrink-0 text-right">
                    <p className="text-[13px] font-bold tnum">{fmtTime(r.a.startsAt)}</p>
                    <p className="text-[11px] text-ink-soft tnum">{fmtTime(r.a.endsAt)}</p>
                  </div>
                  <span className="h-9 w-1 rounded-full" style={{ background: r.assigneeColor ?? "#cbd5e1" }} />
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-canvas text-ink-soft">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.a.title}</p>
                    <p className="truncate text-xs text-ink-soft">
                      {r.clientName} {r.assigneeName ? `· ${r.assigneeName}` : ""}
                    </p>
                  </div>
                  {r.a.jobId && (
                    <Link href={`/jobs/${r.a.jobId}`} className="rounded-full border border-line px-2.5 py-1 text-[11px] font-bold text-ink-soft transition hover:border-ink hover:text-ink">
                      Job card
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Pipeline value */}
        <div className="card animate-rise p-5 [animation-delay:180ms] xl:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-[15px] font-bold">Pipeline value</h3>
            <Link href="/pipeline" className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent-deep hover:underline">
              Board <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {stageValues.map((s) => (
              <div key={s.key}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-semibold text-ink-soft">
                    <span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: s.color }} />
                    {s.label} <span className="text-ink-soft/60">· {s.count}</span>
                  </span>
                  <span className="font-bold tnum">{moneyCompact(s.value)}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-canvas">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.max(2.5, (s.value / maxStage) * 100)}%`, background: s.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Awaiting signature */}
          <div className="mt-5 border-t border-line pt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[13px] font-bold">Out for signature</h4>
              <Link href="/forms" className="text-xs font-semibold text-accent-deep hover:underline">All forms</Link>
            </div>
            <div className="mt-2.5 space-y-2">
              {pending.length === 0 && <p className="text-xs text-ink-soft">Nothing waiting on a client right now.</p>}
              {pending.map((r) => (
                <Link key={r.f.id} href="/forms" className="flex items-center gap-3 rounded-xl border border-line bg-canvas px-3 py-2.5 transition hover:border-ink/25 hover:bg-white">
                  <FileSignature className="size-4 shrink-0 text-ink-soft" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{FORM_PHASES[r.f.templateKey]?.label ?? r.f.templateKey}</p>
                    <p className="truncate text-[11px] text-ink-soft">{r.clientName} · sent {timeAgo(r.f.sentAt)}</p>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", r.f.status === "viewed" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700")}>
                    {r.f.status}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Activity */}
      <div className="card animate-rise [animation-delay:240ms]">
        <h3 className="border-b border-line px-5 py-4 font-display text-[15px] font-bold">Recent activity</h3>
        <ul className="grid gap-x-8 px-5 py-3 md:grid-cols-2">
          {recentActs.map((r) => (
            <li key={r.act.id} className="flex items-start gap-3 border-b border-line/60 py-3 last:border-0 md:[&:nth-last-child(2)]:border-0">
              <span
                className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
                style={{ background: r.userColor ?? "#94a3b8" }}
              >
                {r.userName ? r.userName.split(" ").map((p) => p[0]).slice(0, 2).join("") : "CL"}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] leading-snug">
                  <span className="font-semibold">{r.userName ?? "Client"}</span>{" "}
                  <span className="text-ink-soft">{r.act.message.replace(/^\S+ added a note$/, "added a note")}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-ink-soft/80">{timeAgo(r.act.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
