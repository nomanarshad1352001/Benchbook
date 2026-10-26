"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Braces,
  CalendarDays,
  Check,
  Copy,
  FileJson,
  FileSignature,
  KanbanSquare,
  KeyRound,
  ShieldCheck,
  Users,
  Webhook,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DEMO_KEY = "fwk_live_demokey7a3f9b2c4d8e1560";

const METHOD_STYLE: Record<string, string> = {
  GET: "bg-emerald-400/15 text-emerald-300",
  POST: "bg-blue-400/15 text-blue-300",
  PATCH: "bg-amber-400/15 text-amber-300",
  DELETE: "bg-red-400/15 text-red-300",
};

type Endpoint = { method: string; path: string; desc: string; example?: string };

const GROUPS: { key: string; label: string; icon: typeof Users; endpoints: Endpoint[] }[] = [
  {
    key: "clients",
    label: "Clients",
    icon: Users,
    endpoints: [
      { method: "GET", path: "/clients?limit=50&offset=0", desc: "Paginated client list with addresses and tags." },
      { method: "POST", path: "/clients", desc: "Create a client. Fires the client.created webhook.", example: `{\n  "name": "Dana Whitfield",\n  "email": "dana.w@gmail.com",\n  "phone": "(416) 555-0172",\n  "leadSource": "Referral",\n  "tags": ["Repeat"]\n}` },
      { method: "GET", path: "/clients/{id}", desc: "One client plus every job on their record." },
      { method: "PATCH", path: "/clients/{id}", desc: "Update contact details, tags, notes." },
      { method: "DELETE", path: "/clients/{id}", desc: "Delete — blocked (409) while the client has jobs." },
    ],
  },
  {
    key: "jobs",
    label: "Jobs / pipeline",
    icon: KanbanSquare,
    endpoints: [
      { method: "GET", path: "/jobs?stage=quoted", desc: "List jobs, optionally filtered by stage. Includes CAD totals with 13% HST." },
      { method: "POST", path: "/jobs", desc: "Create a job (starts as a lead) with estimate line items." },
      { method: "GET", path: "/jobs/{id}", desc: "One job with line items and computed totals." },
      { method: "PATCH", path: "/jobs/{id}", desc: "Move pipeline stage, replace line items, edit title/scope.", example: `{\n  "stage": "scheduled"\n}` },
    ],
  },
  {
    key: "appointments",
    label: "Appointments",
    icon: CalendarDays,
    endpoints: [
      { method: "GET", path: "/appointments?assigneeId=3", desc: "Crew schedule — filter by crew member." },
      { method: "POST", path: "/appointments", desc: "Book an estimate visit, job or callback.", example: `{\n  "clientId": 2,\n  "jobId": 14,\n  "title": "Estimate visit — deck",\n  "type": "estimate",\n  "startsAt": "2026-04-02T13:00:00.000Z",\n  "endsAt": "2026-04-02T14:00:00.000Z",\n  "assigneeId": 3\n}` },
    ],
  },
  {
    key: "forms",
    label: "Forms & e-signature",
    icon: FileSignature,
    endpoints: [
      { method: "GET", path: "/forms?status=signed", desc: "Forms with full audit trails (who, when, IP)." },
      { method: "POST", path: "/forms", desc: "Send a template for signature. Client/job/estimate are auto-filled; returns signingUrl.", example: `{\n  "jobId": 14,\n  "templateKey": "work-authorization",\n  "channel": "email"\n}` },
    ],
  },
];

const EVENTS = [
  ["client.created", "A new client is added (app, import or API)"],
  ["job.created", "A job is created"],
  ["job.stage_changed", "Any drag on the pipeline board, stepper click, or form-sign auto-move"],
  ["form.sent", "A form goes out by email or text"],
  ["form.signed", "Client signs — includes signer, timestamp and IP"],
  ["appointment.created", "A visit is booked"],
];

export default function DocsPage() {
  return (
    <div className="-mx-4 -mt-6 animate-fade sm:-mx-6 md:-mt-8">
      <div className="bg-ink text-white">
        {/* Hero */}
        <div className="mx-auto max-w-5xl px-4 pb-10 pt-12 sm:px-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">
            <Braces className="size-3.5 text-accent" /> Open REST API · v1
          </p>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Every record, programmable<span className="text-accent">.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/60">
            Clients, jobs, appointments and signed forms — all exposed over a documented REST API with
            secure keys and live webhooks, ready for QuickBooks, Zapier or whatever you bolt on next.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/api/openapi.json"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[13px] font-bold text-ink transition hover:bg-amber-300"
            >
              <FileJson className="size-4" /> Download OpenAPI 3.1 spec
            </a>
            <Link
              href="/settings"
              className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-[13px] font-bold text-white/80 transition hover:bg-white/5"
            >
              <KeyRound className="size-4" /> Manage API keys
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-6">
        {/* Auth */}
        <section>
          <SectionTitle icon={ShieldCheck} title="Authentication" />
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Every request carries an API key — as the <code className="rounded bg-black/5 px-1 font-mono text-xs">x-api-key</code> header
            or a Bearer token. Keys are <b>sha-256 hashed at rest</b>, shown once at creation, and revocable any time in Settings.
          </p>
          <CodeBlock
            lang="bash"
            code={`curl "$ORIGIN/api/v1/jobs?stage=scheduled" \\
  -H "x-api-key: ${DEMO_KEY}"`}
          />
          <p className="mt-2 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
            <b>Demo key included:</b> the seeded key above is live in this environment — try the curl now.
            In production you would issue one key per integration and never embed it in client-side code.
          </p>
        </section>

        {/* Endpoint groups */}
        {GROUPS.map((g) => (
          <section key={g.key} id={g.key}>
            <SectionTitle icon={g.icon} title={g.label} />
            <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white">
              {g.endpoints.map((e, i) => (
                <div key={i} className={cn("px-4 py-4 sm:px-5", i > 0 && "border-t border-line/70")}>
                  <p className="flex flex-wrap items-center gap-2.5">
                    <span className={cn("rounded-md px-2 py-0.5 bg-ink font-mono text-[10.5px] font-bold text-white", "")}>
                      <span className="text-accent">{e.method}</span>
                    </span>
                    <code className="font-mono text-[13px] font-semibold">{e.path}</code>
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{e.desc}</p>
                  {e.example && <CodeBlock lang="json" code={e.example} />}
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Webhooks */}
        <section id="webhooks">
          <SectionTitle icon={Webhook} title="Webhooks" />
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Register HTTPS endpoints in Settings → Webhooks. We POST JSON the moment something happens,
            with <code className="rounded bg-black/5 px-1 font-mono text-xs">X-Webhook-Event</code> and a{" "}
            <code className="rounded bg-black/5 px-1 font-mono text-xs">X-Webhook-Secret</code> you can verify.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {EVENTS.map(([ev, d]) => (
              <div key={ev} className="rounded-2xl border border-line bg-white px-4 py-3">
                <code className="font-mono text-[12px] font-bold text-accent-deep">{ev}</code>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">{d}</p>
              </div>
            ))}
          </div>
          <CodeBlock
            lang="json"
            title="Example payload — form.signed"
            code={`{
  "id": "evt_ax92k1",
  "event": "form.signed",
  "createdAt": "2026-03-27T18:44:12.000Z",
  "data": {
    "formId": 1,
    "jobId": 8,
    "templateKey": "completion-signoff",
    "signerName": "Grace Whitaker",
    "signedAt": "2026-03-27T18:44:08.000Z",
    "ip": "99.244.18.72"
  }
}`}
          />
        </section>

        {/* Errors */}
        <section id="errors">
          <SectionTitle icon={BookOpen} title="Errors & conventions" />
          <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white">
            {[
              ["200 / 201", "Success — responses are wrapped in { data } with optional { meta } pagination."],
              ["400", "Validation failed — the error.message names the missing field."],
              ["401", "Missing, invalid or revoked API key."],
              ["404", "Record not found (or belonged to a different record)."],
              ["409", "Conflict — e.g. signing a form twice."],
            ].map(([code, d], i) => (
              <div key={code} className={cn("flex items-start gap-4 px-4 py-3 text-[13px] sm:px-5", i > 0 && "border-t border-line/70")}>
                <code className="w-16 shrink-0 rounded-md bg-canvas px-2 py-0.5 text-center font-mono text-[11px] font-bold">{code}</code>
                <p className="text-ink-soft">{d}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-ink-soft">
            <Wrench className="size-3.5" /> Dates are ISO-8601 UTC. Money is CAD; HST 13% is computed server-side from line items.
          </p>
        </section>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Users; title: string }) {
  return (
    <h2 className="flex items-center gap-2.5 font-display text-xl font-bold tracking-tight">
      <span className="grid size-9 place-items-center rounded-xl bg-ink text-accent">
        <Icon className="size-4.5" />
      </span>
      {title}
    </h2>
  );
}

function CodeBlock({ code, lang, title }: { code: string; lang: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 overflow-hidden rounded-2xl bg-ink text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-white/40">
          {title ?? lang}
        </span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(code.replace(/\$ORIGIN/g, window.location.origin)).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1300);
          }}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10.5px] font-bold text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[11.5px] leading-relaxed text-white/85">{code}</pre>
    </div>
  );
}
