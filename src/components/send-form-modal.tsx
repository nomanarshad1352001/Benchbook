"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Loader2, Mail, MessageSquareText, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type FormTarget = {
  id: number;
  title: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  stage: string;
};

export type TemplateOpt = { key: string; name: string; description: string; nextStage: string | null };

export default function SendFormModal({
  jobs,
  templates,
  presetJobId,
  onClose,
}: {
  jobs: FormTarget[];
  templates: TemplateOpt[];
  presetJobId?: number | null;
  onClose: () => void;
}) {
  const [jobId, setJobId] = useState(presetJobId ? String(presetJobId) : "");
  const [templateKey, setTemplateKey] = useState(templates[0]?.key ?? "");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ token: string; id: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const job = jobs.find((j) => j.id === Number(jobId));
  const template = templates.find((t) => t.key === templateKey);

  function pickJob(id: string) {
    setJobId(id);
    const j = jobs.find((x) => x.id === Number(id));
    if (j) setRecipient(channel === "email" ? j.clientEmail ?? "" : j.clientPhone ?? "");
  }
  function pickChannel(ch: "email" | "sms") {
    setChannel(ch);
    if (job) setRecipient(ch === "email" ? job.clientEmail ?? "" : job.clientPhone ?? "");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: Number(jobId), templateKey, channel, recipient }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not send the form.");
        return;
      }
      setSent(data);
    } finally {
      setBusy(false);
    }
  }

  const link = sent
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${(sent as { link?: string }).link ?? `/sign/${sent.token}`}`
    : "";

  const field = "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm transition focus:border-ink";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4 backdrop-blur-sm animate-fade" onMouseDown={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-lift animate-pop" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Send form for signature</h2>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-ink-soft transition hover:bg-canvas"><X className="size-4" /></button>
        </div>

        {sent ? (
          <div className="mt-5 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
              <Check className="size-6" />
            </span>
            <p className="mt-3 font-display text-base font-bold">Form sent for signature</p>
            <p className="mt-1 text-[13px] text-ink-soft">
              The client got a {channel === "email" ? "email" : "text"} with a secure signing link. When they sign,
              the PDF and audit trail file themselves onto the client and job.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-canvas p-2 pl-3.5">
              <p className="min-w-0 flex-1 truncate font-mono text-xs text-ink-soft">{link}</p>
              <button
                onClick={() => { navigator.clipboard.writeText(link).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1300); }}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white"
              >
                <Copy className="size-3.5" /> {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="mt-3 flex justify-center gap-2">
              <a href={link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold transition hover:border-ink/40">
                <ExternalLink className="size-3.5" /> Open signing page
              </a>
              <button onClick={onClose} className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold text-white">Done</button>
            </div>
            <p className="mt-3 text-[11px] text-ink-soft/80">On site? Open the same link on your phone or tablet for in-person signing.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-ink-soft">Job</label>
              <select required value={jobId} onChange={(e) => pickJob(e.target.value)} className={cn(field, "mt-1")} disabled={presetJobId != null}>
                <option value="" disabled>Select job…</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.title} — {j.clientName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-ink-soft">Template</label>
              <div className="mt-1.5 space-y-2">
                {templates.map((t) => (
                  <button
                    type="button"
                    key={t.key}
                    onClick={() => setTemplateKey(t.key)}
                    className={cn(
                      "w-full rounded-2xl border px-4 py-3 text-left transition",
                      templateKey === t.key ? "border-ink bg-canvas" : "border-line hover:border-ink/30"
                    )}
                  >
                    <p className="flex items-center justify-between text-[13px] font-bold">
                      {t.name}
                      {t.nextStage && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          moves job → {t.nextStage}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-soft">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-line p-1">
              {(["email", "sms"] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => pickChannel(ch)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold transition",
                    channel === ch ? "bg-ink text-white" : "text-ink-soft hover:bg-canvas"
                  )}
                >
                  {ch === "email" ? <Mail className="size-4" /> : <MessageSquareText className="size-4" />}
                  {ch === "email" ? "Email" : "Text message"}
                </button>
              ))}
            </div>

            <div>
              <label className="text-xs font-semibold text-ink-soft">{channel === "email" ? "Send to (email)" : "Send to (mobile)"}</label>
              <input required value={recipient} onChange={(e) => setRecipient(e.target.value)} className={cn(field, "mt-1")} placeholder={channel === "email" ? "client@email.com" : "(416) 555-0100"} />
            </div>

            <p className="rounded-xl bg-canvas px-3.5 py-2.5 text-xs leading-relaxed text-ink-soft">
              Client name, job details, line items and totals are filled into the template automatically.
              {template?.nextStage
                ? ` On signature, the job moves to ${template.nextStage} and the signed PDF files itself.`
                : " On signature, the signed PDF and audit trail file themselves."}
            </p>

            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold transition hover:bg-canvas">Cancel</button>
              <button disabled={busy || !jobId} className="flex items-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-black disabled:opacity-60">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send form
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
