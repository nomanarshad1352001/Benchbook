"use client";

import Link from "next/link";
import {
  ArrowRight, Banknote, Briefcase, CalendarCheck2, CalendarClock,
  FileSignature, PhoneCall, Ruler, Wrench,
} from "lucide-react";
import { FORM_PHASES, STAGES } from "@/lib/constants";
import { computeTotals } from "@/lib/model";
import { auth, useData, useReady } from "@/lib/store";
import { cn, fmtTime, moneyCompact, sameDay, timeAgo } from "@/lib/utils";
import { BootScreen } from "@/app/(app)/layout";

const TYPE_ICON: Record<string, typeof Wrench> = { estimate: Ruler, job: Wrench, callback: PhoneCall };

export default function DashboardPage() {
  const ready = useReady();
  const d = useData();
  if (!ready) return <BootScreen />;

  const me = d.users.find((u) => u.id === auth.uid) ?? d.users[0];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const activeJobs = d.jobs.filter((j) => j.stage !== "paid" && j.stage !== "lost");
  const paidMTD = d.jobs
    .filter((j) => j.stage === "paid" && new Date(j.updatedAt) >= monthStart)
    .reduce((s, j) => s + computeTotals(j.lineItems).total, 0);

  const today = d.appointments
    .filter((a) => sameDay(new Date(a.startsAt), now) && a.status !== "cancelled")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((a) => ({
      ...a,
      clientName: d.clients.find((c) => c.id === a.clientId)?.name ?? "—",
      user: d.users.find((u) => u.id === a.assigneeId) ?? null,
    }));

  const pending = d.forms
    .filter((f) => f.status !== "signed")
    .map((f) => ({ ...f, clientName: d.clients.find((c) => c.id === f.clientId)?.name ?? "—" }));

  const recentActs = [...d.activities]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10)
    .map((a) => ({ ...a, user: d.users.find((u) => u.id === a.userId) ?? null }));

  const stageValues = STAGES.filter((s) => s.key !== "lost").map((s) => ({
    ...s,
    count: d.jobs.filter((j) => j.stage === s.key).length,
    value: d.jobs.filter((j) => j.stage === s.key).reduce((sum, j) => sum + computeTotals(j.lineItems).subtotal, 0),
  }));
  const maxStage = Math.max(...stageValues.map((s) => s.value), 1);

  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      <div className="animate-rise">
        <p className="text-[13px] font-medium text-ink-soft">
          {now.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {greeting}, {me.name.split(" ")[0]}<span className="text-accent">.</span>
        </h2>
      </div>

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
            {today.map((a) => {
              const Icon = TYPE_ICON[a.type] ?? Wrench;
              return (
                <div key={a.id} className="flex items-center gap-3.5 px-3 py-3.5">
                  <div className="w-[76px] shrink-0 text-right">
                    <p className="text-[13px] font-bold tnum">{fmtTime(a.startsAt)}</p>
                    <p className="text-[11px] text-ink-soft tnum">{fmtTime(a.endsAt)}</p>
                  </div>
                  <span className="h-9 w-1 rounded-full" style={{ background: a.user?.color ?? "#cbd5e1" }} />
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-canvas text-ink-soft">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{a.title}</p>
                    <p className="truncate text-xs text-ink-soft">
                      {a.clientName} {a.user ? `· ${a.user.name}` : ""}
                    </p>
                  </div>
                  {a.jobId && (
                    <Link href={`/jobs/${a.jobId}`} className="rounded-full border border-line px-2.5 py-1 text-[11px] font-bold text-ink-soft transition hover:border-ink hover:text-ink">
                      Job card
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>

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

          <div className="mt-5 border-t border-line pt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[13px] font-bold">Out for signature</h4>
              <Link href="/forms" className="text-xs font-semibold text-accent-deep hover:underline">All forms</Link>
            </div>
            <div className="mt-2.5 space-y-2">
              {pending.length === 0 && <p className="text-xs text-ink-soft">Nothing waiting on a client right now.</p>}
              {pending.map((f) => (
                <Link key={f.id} href="/forms" className="flex items-center gap-3 rounded-xl border border-line bg-canvas px-3 py-2.5 transition hover:border-ink/25 hover:bg-white">
                  <FileSignature className="size-4 shrink-0 text-ink-soft" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{FORM_PHASES[f.templateKey]?.label ?? f.templateKey}</p>
                    <p className="truncate text-[11px] text-ink-soft">{f.clientName} · sent {timeAgo(f.sentAt)}</p>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", f.status === "viewed" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700")}>
                    {f.status}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card animate-rise [animation-delay:240ms]">
        <h3 className="border-b border-line px-5 py-4 font-display text-[15px] font-bold">Recent activity</h3>
        <ul className="grid gap-x-8 px-5 py-3 md:grid-cols-2">
          {recentActs.map((a) => (
            <li key={a.id} className="flex items-start gap-3 border-b border-line/60 py-3 last:border-0 md:[&:nth-last-child(2)]:border-0">
              <span
                className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
                style={{ background: a.user?.color ?? "#94a3b8" }}
              >
                {a.user ? a.user.name.split(" ").map((p) => p[0]).slice(0, 2).join("") : "CL"}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] leading-snug">
                  <span className="font-semibold">{a.user?.name ?? "Client"}</span>{" "}
                  <span className="text-ink-soft">{a.message.replace(/^\S+ added a note$/, "added a note")}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-ink-soft/80">{timeAgo(a.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
