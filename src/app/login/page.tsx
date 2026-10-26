import { redirect } from "next/navigation";
import { Wrench, ShieldCheck, CalendarDays, FileSignature } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { ensureSeeded } from "@/db/seed";
import { LOGIN_HERO, COMPANY, AVATARS } from "@/lib/constants";
import LoginForm from "@/components/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await ensureSeeded();
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[46%_54%]">
      {/* ------- Form side ------- */}
      <section className="flex min-h-dvh flex-col justify-center px-5 py-10 sm:px-12 lg:px-16 bg-paper">
        <div className="mx-auto w-full max-w-md animate-rise">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-ink text-accent">
              <Wrench className="size-5" strokeWidth={2.2} />
            </span>
            <div>
              <p className="font-display text-lg font-bold leading-tight">Benchbook</p>
              <p className="text-xs text-ink-soft">{COMPANY.name} · Internal CRM</p>
            </div>
          </div>

          <h1 className="mt-10 font-display text-[28px] font-bold tracking-tight sm:text-3xl">
            Sign in to the workshop<span className="text-accent">.</span>
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            Clients, pipeline, crew schedule and signed paperwork — one bench.
          </p>

          <LoginForm />
        </div>

        <p className="mx-auto mt-10 w-full max-w-md text-center text-[11px] text-ink-soft/70">
          Demo environment with seeded data · fixeswell board resets nightly
        </p>
      </section>

      {/* ------- Hero side ------- */}
      <section className="relative hidden overflow-hidden lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGIN_HERO}
          alt="Fixwell crew member on site"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/35 to-ink/10" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white">
          <div className="animate-rise space-y-5 [animation-delay:150ms]">
            <div className="flex gap-8">
              <div>
                <p className="font-display text-3xl font-bold tnum">214</p>
                <p className="text-[13px] text-white/70">jobs completed this year</p>
              </div>
              <div>
                <p className="font-display text-3xl font-bold tnum">4.9<span className="text-accent">★</span></p>
                <p className="text-[13px] text-white/70">HomeStars rating</p>
              </div>
              <div>
                <p className="font-display text-3xl font-bold tnum">9 yrs</p>
                <p className="text-[13px] text-white/70">serving the east end</p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-white/15 pt-5">
              <div className="flex -space-x-2.5">
                {[AVATARS.dan, AVATARS.priya, AVATARS.marcus, AVATARS.tanya, AVATARS.jim].map((a) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={a} src={a} alt="" className="size-8 rounded-full border-2 border-ink object-cover" />
                ))}
              </div>
              <p className="text-[13px] text-white/70">
                Dan, Priya, Marcus, Tanya &amp; Jim run their whole day in here.
              </p>
            </div>
            <div className="flex gap-6 text-[12px] text-white/50">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Roles &amp; audit trail</span>
              <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" /> Crew calendar</span>
              <span className="inline-flex items-center gap-1.5"><FileSignature className="size-3.5" /> E-sign forms</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
