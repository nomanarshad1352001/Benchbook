"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Check, Eraser, Loader2, PenLine, ShieldCheck, Wrench } from "lucide-react";
import { COMPANY } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default function SignView(props: {
  token: string;
  docName: string;
  content: string;
  status: string;
  clientName: string;
  clientEmail: string;
  jobTitle: string;
  signed: {
    signerName: string | null;
    signedAt: string | null;
    signerIp: string | null;
    signatureUrl: string | null;
  };
}) {
  const { token, docName, content, clientName, clientEmail, jobTitle, signed } = props;
  const [name, setName] = useState(clientName);
  const [email, setEmail] = useState(clientEmail);
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null); // movedTo stage or "signed"

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  /* hi-dpi canvas setup */
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = c.getBoundingClientRect();
      c.width = rect.width * ratio;
      c.height = rect.height * ratio;
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.scale(ratio, ratio);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#1a1b1e";
        ctx.lineWidth = 2.6;
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  function pos(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function down(e: React.PointerEvent) {
    drawing.current = true;
    canvasRef.current?.setPointerCapture(e.pointerId);
    const p = pos(e);
    last.current = p;
    const ctx = canvasRef.current?.getContext("2d");
    ctx?.beginPath();
    ctx?.moveTo(p.x, p.y);
    ctx?.lineTo(p.x + 0.1, p.y + 0.1);
    ctx?.stroke();
    setHasInk(true);
  }
  function moveEvt(e: React.PointerEvent) {
    if (!drawing.current) return;
    const p = pos(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && last.current) {
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    last.current = p;
  }
  function up() {
    drawing.current = false;
    last.current = null;
  }
  function clearPad() {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  }

  async function sign() {
    if (!canvasRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const signature = canvasRef.current.toDataURL("image/png");
      const res = await fetch("/api/forms/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, signerName: name, signerEmail: email, clientNote: note, signature }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not record the signature.");
        return;
      }
      setDone(data.movedTo ?? "signed");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  }

  const alreadySigned = props.status === "signed";

  return (
    <main className="min-h-dvh bg-canvas">
      {/* brand bar */}
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-2.5 px-4 py-3.5 sm:px-6">
          <span className="grid size-9 place-items-center rounded-xl bg-ink text-accent">
            <Wrench className="size-4.5" strokeWidth={2.4} />
          </span>
          <div>
            <p className="font-display text-[15px] font-bold leading-none">{COMPANY.name}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Secure document signing</p>
          </div>
          <span className="ml-auto hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 sm:flex">
            <ShieldCheck className="size-3.5" /> Encrypted session
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {done || alreadySigned ? (
          <SignedState
            signerName={alreadySigned ? signed.signerName : name}
            signedAt={alreadySigned ? signed.signedAt : new Date().toISOString()}
            signerIp={alreadySigned ? signed.signerIp : null}
            signatureUrl={alreadySigned ? signed.signatureUrl : null}
            movedTo={done && done !== "signed" ? done : null}
            docName={docName}
          />
        ) : (
          <>
            <div className="mb-6 animate-rise">
              <h1 className="font-display text-2xl font-bold tracking-tight">{docName}</h1>
              <p className="mt-1 text-sm text-ink-soft">
                For <span className="font-semibold text-ink">{clientName}</span> · {jobTitle}
              </p>
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
              {/* document */}
              <article className="card animate-rise overflow-hidden [animation-delay:80ms]">
                <div className="h-1.5 bg-gradient-to-r from-accent via-amber-300 to-transparent" />
                <pre className="whitespace-pre-wrap px-6 py-7 font-sans text-[13.5px] leading-[1.75] text-ink sm:px-9 sm:py-9">
                  {content}
                </pre>
              </article>

              {/* sign panel */}
              <aside className="card sticky top-6 animate-rise space-y-4 p-5 [animation-delay:160ms]">
                <h2 className="flex items-center gap-2 font-display text-[15px] font-bold">
                  <PenLine className="size-4 text-accent-deep" /> Sign this document
                </h2>

                <div>
                  <label className="text-xs font-semibold text-ink-soft">Full legal name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm transition focus:border-ink" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-soft">Email (copy of signed PDF)</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm transition focus:border-ink" />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-ink-soft">Draw your signature</label>
                    <button type="button" onClick={clearPad} className="flex items-center gap-1 text-[11px] font-semibold text-ink-soft transition hover:text-ink">
                      <Eraser className="size-3" /> Clear
                    </button>
                  </div>
                  <div className="mt-1 overflow-hidden rounded-2xl border-2 border-dashed border-line bg-white">
                    <canvas
                      ref={canvasRef}
                      className="sig-canvas h-40 w-full"
                      onPointerDown={down}
                      onPointerMove={moveEvt}
                      onPointerUp={up}
                      onPointerLeave={up}
                    />
                  </div>
                  {!hasInk && <p className="mt-1.5 text-[11px] text-ink-soft/80">Sign with your finger, stylus or mouse.</p>}
                </div>

                <div>
                  <label className="text-xs font-semibold text-ink-soft">Note for the crew (optional)</label>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="e.g. Please use the side entrance" className="mt-1 w-full resize-none rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm transition focus:border-ink" />
                </div>

                <button
                  type="button"
                  onClick={() => setConsent((v) => !v)}
                  className="flex items-start gap-2.5 rounded-xl border border-line bg-canvas/60 px-3 py-2.5 text-left"
                >
                  <span className={cn("mt-0.5 grid size-4.5 shrink-0 place-items-center rounded border transition", consent ? "border-ink bg-ink text-white" : "border-line bg-white")}>
                    {consent && <Check className="size-3" strokeWidth={3.5} />}
                  </span>
                  <span className="text-[11.5px] leading-snug text-ink-soft">
                    I agree this electronic signature is legally binding, identical to a handwritten signature.
                  </span>
                </button>

                {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600">{error}</p>}

                <button
                  onClick={sign}
                  disabled={busy || !consent || !hasInk || !name.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <PenLine className="size-4" />}
                  {busy ? "Recording signature…" : "Sign & submit"}
                </button>
                <p className="text-center text-[10.5px] leading-relaxed text-ink-soft/80">
                  Your name, timestamp, IP address and device are recorded with the audit trail.
                </p>
              </aside>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function SignedState(props: {
  signerName: string | null;
  signedAt: string | null;
  signerIp: string | null;
  signatureUrl: string | null;
  movedTo: string | null;
  docName: string;
}) {
  return (
    <div className="mx-auto max-w-md">
      <div className="card animate-pop p-8 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-500 text-white shadow-lift">
          <BadgeCheck className="size-8" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold">Signed — thank you<span className="text-accent">.</span></h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          {props.docName} was signed{props.signerName ? ` by ${props.signerName}` : ""}
          {props.signedAt ? ` on ${new Date(props.signedAt).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" })}` : ""}.
        </p>

        {props.signatureUrl && (
          <div className="mt-5 rounded-2xl border border-line bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={props.signatureUrl} alt="Signature" className="mx-auto h-20 object-contain" />
            <p className="mt-1 text-[10px] uppercase tracking-widest text-ink-soft">Signature on file</p>
          </div>
        )}
        {props.signerIp && (
          <p className="mt-3 font-mono text-[11px] text-ink-soft/80">Recorded IP {props.signerIp}</p>
        )}
        {props.movedTo && (
          <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-700">
            Done — the job automatically moved to “{props.movedTo}” on our board.
          </p>
        )}
        <p className="mt-4 text-xs text-ink-soft">
          A signed PDF copy and audit trail were filed automatically. Questions? Call {COMPANY.phone}.
        </p>
      </div>
    </div>
  );
}
