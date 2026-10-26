"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, Loader2, LogIn, MousePointerClick } from "lucide-react";
import { DEMO_ACCOUNTS } from "@/lib/constants";

const ROLE_STYLES: Record<string, string> = {
  admin: "bg-amber-100 text-amber-800",
  office: "bg-violet-100 text-violet-700",
  field: "bg-blue-100 text-blue-700",
};

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Sign-in failed. Check the credentials and try again.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function autofill(e: string, p: string, label: string) {
    setEmail(e);
    setPassword(p);
    setError(null);
    setFlash(label);
    window.setTimeout(() => setFlash(null), 1600);
  }

  return (
    <div className="mt-8">
      <form onSubmit={submit} className="space-y-3.5">
        <div>
          <label className="text-xs font-semibold text-ink-soft">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@fixwell.ca"
            className="mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm transition focus:border-ink"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-ink-soft">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm transition focus:border-ink"
          />
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] font-medium text-red-600 animate-pop">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
          {busy ? "Signing in…" : "Sign in"}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </form>

      <div className="mt-8">
        <div className="flex items-center gap-2">
          <KeyRound className="size-3.5 text-ink-soft" />
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
            Demo credentials — click to autofill
          </p>
        </div>

        <div className="mt-3 space-y-2.5">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.email}
              type="button"
              onClick={() => autofill(a.email, a.password, a.label)}
              className="group w-full rounded-2xl border border-line bg-canvas px-4 py-3 text-left transition hover:border-ink/30 hover:bg-white"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${ROLE_STYLES[a.role]}`}>
                    {a.label}
                  </span>
                  <span className="text-sm font-semibold">
                    {a.name}
                    <span className="ml-1.5 font-normal text-ink-soft">· {a.title}</span>
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-soft transition group-hover:text-accent-deep">
                  <MousePointerClick className="size-3.5" />
                  {flash === a.label ? "Filled!" : "Autofill"}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 font-mono text-[11px] text-ink-soft">
                <span>{a.email}</span>
                <span>pw: {a.password}</span>
                <span className="font-sans">{a.blurb}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
