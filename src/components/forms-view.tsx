"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CloudDownload,
  Copy,
  ExternalLink,
  FileSignature,
  Loader2,
  Mail,
  MessageSquareText,
  PencilLine,
  Save,
  Send,
  X,
} from "lucide-react";
import SendFormModal, { type FormTarget } from "@/components/send-form-modal";
import { cn, fmtDateTime, timeAgo } from "@/lib/utils";

type Template = {
  key: string; name: string; description: string; body: string;
  nextStage: string | null; updatedAt: string;
};

type FormRow = {
  id: number; token: string; templateKey: string; templateLabel: string;
  status: string; channel: string; recipient: string | null;
  sentAt: string; signedAt: string | null; signerName: string | null; signerIp: string | null;
  jobId: number; jobTitle: string; jobStage: string; clientName: string;
};

const TOKENS = [
  ["{{client.name}}", "Client full name"],
  ["{{client.address}}", "Primary service address"],
  ["{{client.email}}", "Client email"],
  ["{{client.phone}}", "Client phone"],
  ["{{job.title}}", "Job title"],
  ["{{job.address}}", "Job address"],
  ["{{job.service}}", "Service type"],
  ["{{job.items}}", "Estimate line items"],
  ["{{job.subtotal}}", "Estimate subtotal"],
  ["{{job.hst}}", "HST (13%)"],
  ["{{job.total}}", "Estimate total"],
  ["{{company.name}}", "Fixwell Handyman Co."],
  ["{{date.today}}", "Today's date"],
];

export default function FormsView({
  templates,
  forms,
  jobs,
  canEdit,
  openSend,
  presetJobId,
}: {
  templates: Template[];
  forms: FormRow[];
  jobs: FormTarget[];
  canEdit: boolean;
  openSend: boolean;
  presetJobId: number | null;
}) {
  const router = useRouter();
  const [sendOpen, setSendOpen] = useState(openSend);
  const [sendPref, setSendPref] = useState<Template[] | null>(null);
  const [editing, setEditing] = useState<Template | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "signed">("all");

  const visible = forms.filter((f) =>
    filter === "all" ? true : filter === "signed" ? f.status === "signed" : f.status !== "signed"
  );
  const pending = forms.filter((f) => f.status !== "signed").length;
  const signed = forms.filter((f) => f.status === "signed").length;

  function copyLink(f: FormRow) {
    navigator.clipboard.writeText(`${window.location.origin}/sign/${f.token}`).catch(() => {});
    setCopied(f.id);
    setTimeout(() => setCopied(null), 1300);
  }

  return (
    <div className="space-y-6 animate-rise">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-[13px] text-ink-soft">
            <span className="font-bold text-amber-700 tnum">{pending}</span> waiting on clients ·{" "}
            <span className="font-bold text-emerald-700 tnum">{signed}</span> signed &amp; filed
          </p>
        </div>
        <button
          onClick={() => { setSendPref(null); setSendOpen(true); }}
          className="ml-auto flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-black"
        >
          <Send className="size-4" /> Send form
        </button>
      </div>

      {/* Templates */}
      <div className="grid gap-4 md:grid-cols-3">
        {templates.map((t, i) => (
          <div key={t.key} className="card card-hover flex flex-col p-5 animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-start justify-between gap-2">
              <span className="grid size-10 place-items-center rounded-2xl bg-violet-50 text-violet-600">
                <FileSignature className="size-5" />
              </span>
              {t.nextStage ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                  on sign → {t.nextStage}
                </span>
              ) : (
                <span className="rounded-full bg-canvas px-2.5 py-1 text-[10px] font-bold text-ink-soft">
                  stage unchanged
                </span>
              )}
            </div>
            <h3 className="mt-3 font-display text-[15px] font-bold leading-snug">{t.name}</h3>
            <p className="mt-1 flex-1 text-xs leading-relaxed text-ink-soft">{t.description}</p>
            <p className="mt-3 truncate rounded-lg bg-canvas px-2.5 py-1.5 font-mono text-[10px] text-ink-soft/80">
              {t.body.split("\n")[0]} · updated {timeAgo(t.updatedAt)}
            </p>
            <div className="mt-3.5 flex gap-2">
              <button
                onClick={() => { setSendPref([t, ...templates.filter((x) => x.key !== t.key)]); setSendOpen(true); }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-xs font-semibold text-white transition hover:bg-black"
              >
                <Send className="size-3.5" /> Use
              </button>
              {canEdit && (
                <button
                  onClick={() => setEditing(t)}
                  className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-semibold transition hover:border-ink/40"
                >
                  <PencilLine className="size-3.5" /> Edit wording
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Forms list */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          {(["all", "pending", "signed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold capitalize transition",
                filter === f ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft hover:border-ink/40"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="card divide-y divide-line/70">
          {visible.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", f.status === "signed" ? "bg-emerald-50 text-emerald-600" : "bg-violet-50 text-violet-600")}>
                {f.status === "signed" ? <BadgeCheck className="size-4.5" /> : f.channel === "sms" ? <MessageSquareText className="size-4.5" /> : <Mail className="size-4.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold">
                  {f.templateLabel} <span className="font-normal text-ink-soft">→ {f.clientName}</span>
                </p>
                <p className="truncate text-xs text-ink-soft">
                  {f.status === "signed"
                    ? `Signed by ${f.signerName} · ${fmtDateTime(f.signedAt)} · IP ${f.signerIp}`
                    : `Sent ${timeAgo(f.sentAt)} to ${f.recipient} · `}
                  {f.status !== "signed" && <Link href={`/jobs/${f.jobId}`} className="font-semibold text-accent-deep hover:underline">{f.jobTitle}</Link>}
                </p>
              </div>
              <span className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                f.status === "signed" ? "bg-emerald-100 text-emerald-700" : f.status === "viewed" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
              )}>
                {f.status}
              </span>
              <div className="flex items-center gap-1.5">
                {f.status !== "signed" && (
                  <>
                    <button onClick={() => copyLink(f)} title="Copy signing link" className="grid size-8 place-items-center rounded-lg border border-line text-ink-soft transition hover:border-ink/40 hover:text-ink">
                      <Copy className={cn("size-3.5", copied === f.id && "text-emerald-600")} />
                    </button>
                    <Link href={`/sign/${f.token}`} target="_blank" title="Open signing page" className="grid size-8 place-items-center rounded-lg border border-line text-ink-soft transition hover:border-ink/40 hover:text-ink">
                      <ExternalLink className="size-3.5" />
                    </Link>
                  </>
                )}
                <a href={`/api/forms/${f.id}/pdf`} target="_blank" rel="noreferrer" title="Download PDF" className="grid size-8 place-items-center rounded-lg border border-line text-ink-soft transition hover:border-ink/40 hover:text-ink">
                  <CloudDownload className="size-3.5" />
                </a>
                <Link href={`/jobs/${f.jobId}`} title="Open job" className="grid size-8 place-items-center rounded-lg border border-line text-ink-soft transition hover:border-ink/40 hover:text-ink">
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          ))}
          {visible.length === 0 && (
            <p className="px-5 py-12 text-center text-sm text-ink-soft">No forms in this view.</p>
          )}
        </div>
      </div>

      {(sendOpen || sendPref) && (
        <SendFormModal
          jobs={jobs}
          templates={sendPref ?? templates.map(({ key, name, description, nextStage }) => ({ key, name, description, nextStage }))}
          presetJobId={presetJobId}
          onClose={() => { setSendOpen(false); setSendPref(null); router.refresh(); }}
        />
      )}

      {editing && <EditTemplateModal template={editing} onClose={(saved) => { setEditing(null); if (saved) router.refresh(); }} />}
    </div>
  );
}

/* ---------- Edit template wording ---------- */

function EditTemplateModal({ template, onClose }: { template: Template; onClose: (saved: boolean) => void }) {
  const [body, setBody] = useState(template.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/forms/templates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: template.key, body }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Could not save.");
      return;
    }
    onClose(true);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/45 p-4 backdrop-blur-sm animate-fade" onMouseDown={() => onClose(false)}>
      <div className="my-8 w-full max-w-3xl rounded-3xl bg-white p-6 shadow-lift animate-pop" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold">{template.name} — wording</h2>
            <p className="text-xs text-ink-soft">You own this wording. Tokens are auto-filled from the client and job when a form is sent.</p>
          </div>
          <button onClick={() => onClose(false)} className="grid size-8 place-items-center rounded-lg text-ink-soft transition hover:bg-canvas"><X className="size-4" /></button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_220px]">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={22}
            className="w-full resize-none rounded-2xl border border-line bg-canvas/60 p-4 font-mono text-[12px] leading-relaxed transition focus:border-ink focus:bg-white"
          />
          <div className="h-fit rounded-2xl border border-line p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft">Auto-fill tokens</p>
            <div className="mt-2 space-y-1.5">
              {TOKENS.map(([t, d]) => (
                <p key={t} className="text-[10.5px] leading-snug">
                  <code className="rounded bg-amber-50 px-1 py-px font-mono text-[9.5px] font-bold text-amber-800">{t}</code>
                  <span className="ml-1 text-ink-soft">{d}</span>
                </p>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => onClose(false)} className="rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold transition hover:bg-canvas">Cancel</button>
          <button onClick={save} disabled={busy} className="flex items-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-black disabled:opacity-60">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save wording
          </button>
        </div>
      </div>
    </div>
  );
}
